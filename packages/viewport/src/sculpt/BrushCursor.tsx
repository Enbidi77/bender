import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sculptStore, getSymmetricPoints } from '@blender-elt/sculpting';
import type { SculptStrokePoint } from '@blender-elt/contracts';
import { useViewportContext } from '../context/ViewportContext.js';
import type { SculptViewportBridge } from './SculptViewportBridge.js';

export interface BrushCursorProps {
  bridge: SculptViewportBridge;
}

const MAX_SYMMETRY_ECHOES = 8;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

export const BrushCursor: React.FC<BrushCursorProps> = ({ bridge }) => {
  const { config } = useViewportContext();
  const isSculptMode = config.mode === 'sculpt';

  const primaryGroupRef = useRef<THREE.Group>(null);
  const strengthRingRef = useRef<THREE.Mesh>(null);
  const echoGroupsRef = useRef<(THREE.Group | null)[]>([]);

  // Temporary math scratchpads for zero-allocation useFrame updates
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);
  const tempWorldEcho = useMemo(() => new THREE.Vector3(), []);
  const tempWorldNorm = useMemo(() => new THREE.Vector3(), []);
  const tempLocalEchoPoint = useMemo<SculptStrokePoint>(
    () => ({
      point: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      pressure: 1,
      timestamp: 0,
    }),
    [],
  );

  // Outer radius ring geometry (innerRadius 0.97, outerRadius 1.0)
  const outerRingGeo = useMemo(() => new THREE.RingGeometry(0.97, 1.0, 64), []);
  // Inner strength ring geometry (innerRadius 0.95, outerRadius 1.0)
  const innerRingGeo = useMemo(() => new THREE.RingGeometry(0.94, 1.0, 48), []);
  // Normal needle indicator (small line along normal)
  const normalLineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0.4], 3));
    return geo;
  }, []);

  useFrame(() => {
    const primary = primaryGroupRef.current;
    if (!primary) return;

    if (!isSculptMode) {
      primary.visible = false;
      for (const echo of echoGroupsRef.current) {
        if (echo) echo.visible = false;
      }
      return;
    }

    const cursorState = bridge.getCursorState();
    if (!cursorState.hit || !cursorState.mesh) {
      primary.visible = false;
      for (const echo of echoGroupsRef.current) {
        if (echo) echo.visible = false;
      }
      return;
    }

    const sculptState = sculptStore.getState();
    const brushConfig = sculptState.brushConfigs[sculptState.activeBrush];
    const radius = Math.max(0.001, brushConfig.radius);
    const strength = Math.max(0.01, Math.min(1.0, brushConfig.strength));

    // 1. Position and orient primary cursor ring
    primary.visible = true;
    primary.position.copy(cursorState.worldPoint);

    if (cursorState.worldNormal.lengthSq() > 1e-6) {
      tempQuat.setFromUnitVectors(Z_AXIS, cursorState.worldNormal);
      primary.quaternion.copy(tempQuat);
    }

    primary.scale.set(radius, radius, radius);

    if (strengthRingRef.current) {
      strengthRingRef.current.scale.set(strength, strength, strength);
    }

    // 2. Position and orient secondary symmetry echo cursors
    const symmetry = sculptState.symmetry;
    const hasSymmetry =
      symmetry.x || symmetry.y || symmetry.z || (symmetry.radial && symmetry.radial.count > 1);

    if (hasSymmetry && cursorState.mesh) {
      tempLocalEchoPoint.point.x = cursorState.localPoint.x;
      tempLocalEchoPoint.point.y = cursorState.localPoint.y;
      tempLocalEchoPoint.point.z = cursorState.localPoint.z;
      tempLocalEchoPoint.normal.x = cursorState.localNormal.x;
      tempLocalEchoPoint.normal.y = cursorState.localNormal.y;
      tempLocalEchoPoint.normal.z = cursorState.localNormal.z;

      const echoes = getSymmetricPoints(tempLocalEchoPoint, symmetry);
      const meshMatrixWorld = cursorState.mesh.matrixWorld;

      for (let i = 0; i < MAX_SYMMETRY_ECHOES; i++) {
        const echoGroup = echoGroupsRef.current[i];
        if (!echoGroup) continue;

        if (i < echoes.length) {
          const echoPt = echoes[i];

          // Transform echo local point to world space
          tempWorldEcho
            .set(echoPt.point.x, echoPt.point.y, echoPt.point.z)
            .applyMatrix4(meshMatrixWorld);
          tempWorldNorm
            .set(echoPt.normal.x, echoPt.normal.y, echoPt.normal.z)
            .transformDirection(meshMatrixWorld);

          echoGroup.visible = true;
          echoGroup.position.copy(tempWorldEcho);

          if (tempWorldNorm.lengthSq() > 1e-6) {
            tempQuat.setFromUnitVectors(Z_AXIS, tempWorldNorm.normalize());
            echoGroup.quaternion.copy(tempQuat);
          }

          echoGroup.scale.set(radius, radius, radius);
        } else {
          echoGroup.visible = false;
        }
      }
    } else {
      for (const echo of echoGroupsRef.current) {
        if (echo) echo.visible = false;
      }
    }
  });

  return (
    <>
      {/* Primary surface-aligned brush cursor */}
      <group ref={primaryGroupRef} visible={false}>
        {/* Outer radius ring */}
        <mesh geometry={outerRingGeo}>
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>

        {/* Inner strength ring */}
        <mesh ref={strengthRingRef} geometry={innerRingGeo}>
          <meshBasicMaterial
            color="#4772b3"
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>

        {/* Center hit dot */}
        <mesh>
          <circleGeometry args={[0.02, 16]} />
          <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} depthTest={false} />
        </mesh>

        {/* Normal projection line */}
        <lineSegments geometry={normalLineGeo}>
          <lineBasicMaterial color="#ff9800" transparent opacity={0.75} depthTest={false} />
        </lineSegments>
      </group>

      {/* Secondary symmetry echo cursor rings */}
      {Array.from({ length: MAX_SYMMETRY_ECHOES }).map((_, idx) => (
        <group
          key={`sculpt-echo-${idx}`}
          ref={(el) => {
            echoGroupsRef.current[idx] = el;
          }}
          visible={false}
        >
          <mesh geometry={outerRingGeo}>
            <meshBasicMaterial
              color="#4fc3f7"
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
              depthTest={false}
            />
          </mesh>
          <mesh>
            <circleGeometry args={[0.015, 12]} />
            <meshBasicMaterial color="#4fc3f7" side={THREE.DoubleSide} depthTest={false} />
          </mesh>
        </group>
      ))}
    </>
  );
};

import React, { useMemo, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { useViewportContext } from '../context/ViewportContext.js';

/**
 * Renders the signature Blender 3D Cursor:
 * - Red & White segmented outer ring
 * - Precise 3-axis crosshair (X, Y, Z) with origin center point
 * - Read from SelectionStore cursor3D state
 */
export const Cursor3DOverlay: React.FC = () => {
  const { selectionStore, show3DCursor } = useViewportContext();

  const cursor3D = useSyncExternalStore(
    selectionStore.subscribe,
    () => selectionStore.getState().cursor3D,
  );

  // Generate segmented red & white ring segments
  const { redRingGeo, whiteRingGeo, crosshairGeo } = useMemo(() => {
    const radius = 0.22;
    const segments = 32;
    const redVertices: number[] = [];
    const whiteVertices: number[] = [];

    for (let i = 0; i < segments; i++) {
      const theta1 = (i / segments) * Math.PI * 2;
      const theta2 = ((i + 1) / segments) * Math.PI * 2;

      const p1 = [Math.cos(theta1) * radius, Math.sin(theta1) * radius, 0];
      const p2 = [Math.cos(theta2) * radius, Math.sin(theta2) * radius, 0];

      // Alternate red and white every 4 segments
      if (Math.floor(i / 4) % 2 === 0) {
        redVertices.push(...p1, ...p2);
      } else {
        whiteVertices.push(...p1, ...p2);
      }
    }

    const rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute('position', new THREE.Float32BufferAttribute(redVertices, 3));

    const wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute('position', new THREE.Float32BufferAttribute(whiteVertices, 3));

    // 3-axis crosshairs extending past the ring (length = 0.35)
    const armLength = 0.35;
    const crosshairVertices: number[] = [
      // X axis arm
      -armLength,
      0,
      0,
      armLength,
      0,
      0,
      // Y axis arm
      0,
      -armLength,
      0,
      0,
      armLength,
      0,
      // Z axis arm
      0,
      0,
      -armLength,
      0,
      0,
      armLength,
    ];

    const cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.Float32BufferAttribute(crosshairVertices, 3));

    return {
      redRingGeo: rGeo,
      whiteRingGeo: wGeo,
      crosshairGeo: cGeo,
    };
  }, []);

  if (!show3DCursor) {
    return null;
  }

  const { position, rotation } = cursor3D;

  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z, (rotation.order as 'XYZ') || 'XYZ']}
      renderOrder={999}
    >
      {/* Red Ring Segments */}
      <lineSegments geometry={redRingGeo}>
        <lineBasicMaterial
          color="#e74c3c"
          linewidth={2}
          depthTest={false}
          transparent
          opacity={0.9}
        />
      </lineSegments>

      {/* White Ring Segments */}
      <lineSegments geometry={whiteRingGeo}>
        <lineBasicMaterial
          color="#ffffff"
          linewidth={2}
          depthTest={false}
          transparent
          opacity={0.9}
        />
      </lineSegments>

      {/* Black / Dark Gray Crosshairs */}
      <lineSegments geometry={crosshairGeo}>
        <lineBasicMaterial
          color="#1a1a1a"
          linewidth={1.5}
          depthTest={false}
          transparent
          opacity={0.8}
        />
      </lineSegments>

      {/* Center Anchor Dot */}
      <mesh>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} />
      </mesh>
    </group>
  );
};

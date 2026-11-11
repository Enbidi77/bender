import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import type { CameraNode } from '@blender-elt/contracts';
import { useViewportContext } from '../context/ViewportContext.js';

export interface CameraObjectProps {
  node: CameraNode;
}

export const CameraObject: React.FC<CameraObjectProps> = ({ node }) => {
  const { sceneObjectsRef, hoveredNodeId, setHoveredNodeId, handleNodeSelect } =
    useViewportContext();
  const groupRef = useRef<THREE.Group>(null);

  // Register with sceneObjectsRef for gizmo and selection
  useEffect(() => {
    if (groupRef.current) {
      sceneObjectsRef.current.set(node.id, groupRef.current);
    }
    return () => {
      sceneObjectsRef.current.delete(node.id);
    };
  }, [node.id, sceneObjectsRef]);

  const { position, rotation, scale } = node.transform;
  const isHovered = hoveredNodeId === node.id;

  // Camera frustum wireframe representation
  const frustumGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    // Points forming pyramid frustum: apex at (0,0,0), base rectangle at (w, h, -d)
    const d = 1.2;
    const w = 0.8;
    const h = 0.5;

    const vertices = new Float32Array([
      // Apex to base corners
      0,
      0,
      0,
      -w,
      h,
      -d,
      0,
      0,
      0,
      w,
      h,
      -d,
      0,
      0,
      0,
      w,
      -h,
      -d,
      0,
      0,
      0,
      -w,
      -h,
      -d,
      // Base rectangle
      -w,
      h,
      -d,
      w,
      h,
      -d,
      w,
      h,
      -d,
      w,
      -h,
      -d,
      w,
      -h,
      -d,
      -w,
      -h,
      -d,
      -w,
      -h,
      -d,
      -w,
      h,
      -d,
      // Up indicator triangle on top
      0,
      h,
      -d,
      0,
      h + 0.3,
      -d,
      0,
      h + 0.3,
      -d,
      0.2,
      h,
      -d,
    ]);

    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    return geo;
  }, []);

  useEffect(() => {
    return () => {
      frustumGeo.dispose();
    };
  }, [frustumGeo]);

  if (!node.visible) {
    return null;
  }

  return (
    <group
      ref={groupRef}
      name={`camera-${node.id}`}
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z, rotation.order ?? 'XYZ']}
      scale={[scale.x, scale.y, scale.z]}
    >
      <lineSegments
        geometry={frustumGeo}
        onClick={(e) => {
          e.stopPropagation();
          handleNodeSelect(node.id, e.shiftKey);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredNodeId(node.id);
        }}
        onPointerOut={() => {
          if (hoveredNodeId === node.id) {
            setHoveredNodeId(null);
          }
        }}
      >
        <lineBasicMaterial color={isHovered ? '#64b5f6' : '#90caf9'} transparent opacity={0.85} />
      </lineSegments>
    </group>
  );
};

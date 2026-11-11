import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import type { LightNode } from '@blender-elt/contracts';
import { useViewportContext } from '../context/ViewportContext.js';

export interface LightObjectProps {
  node: LightNode;
}

export const LightObject: React.FC<LightObjectProps> = ({ node }) => {
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

  // Helper geometry for clicking and visualizing light in 3D viewport
  const helperGeo = useMemo(() => {
    return new THREE.SphereGeometry(0.25, 12, 8);
  }, []);

  useEffect(() => {
    return () => {
      helperGeo.dispose();
    };
  }, [helperGeo]);

  if (!node.visible) {
    return null;
  }

  // Convert intensity (in scene-core/three)
  const intensity = (node.intensity ?? 100) / 100;
  const color = node.color || '#ffffff';

  return (
    <group
      ref={groupRef}
      name={`light-${node.id}`}
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z, rotation.order ?? 'XYZ']}
      scale={[scale.x, scale.y, scale.z]}
    >
      {/* 3D Visual Helper for Light node */}
      <mesh
        geometry={helperGeo}
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
        <meshBasicMaterial
          color={isHovered ? '#ffeb3b' : color}
          wireframe
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Actual Three.js Light component */}
      {node.lightType === 'point' && (
        <pointLight
          color={color}
          intensity={intensity}
          distance={node.distance ?? 0}
          decay={node.decay ?? 2}
          castShadow={node.castShadow ?? false}
        />
      )}

      {node.lightType === 'directional' && (
        <directionalLight
          color={color}
          intensity={intensity}
          castShadow={node.castShadow ?? false}
        />
      )}

      {node.lightType === 'spot' && (
        <spotLight
          color={color}
          intensity={intensity}
          distance={node.distance ?? 0}
          angle={node.angle ?? Math.PI / 4}
          penumbra={node.penumbra ?? 0.1}
          decay={node.decay ?? 2}
          castShadow={node.castShadow ?? false}
        />
      )}

      {node.lightType === 'ambient' && <ambientLight color={color} intensity={intensity} />}

      {node.lightType === 'hemisphere' && (
        <hemisphereLight args={[color, node.groundColor ?? '#444444', intensity]} />
      )}
    </group>
  );
};

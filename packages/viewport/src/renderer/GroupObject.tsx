import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { GroupNode, SceneNode } from '@blender-elt/contracts';
import { useViewportContext } from '../context/ViewportContext.js';
import { NodeRenderer } from './NodeRenderer.js';

export interface GroupObjectProps {
  node: GroupNode;
  allNodes: Record<string, SceneNode>;
}

export const GroupObject: React.FC<GroupObjectProps> = ({ node, allNodes }) => {
  const { sceneObjectsRef } = useViewportContext();
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (groupRef.current) {
      sceneObjectsRef.current.set(node.id, groupRef.current);
    }
    return () => {
      sceneObjectsRef.current.delete(node.id);
    };
  }, [node.id, sceneObjectsRef]);

  const { position, rotation, scale } = node.transform;

  if (!node.visible) {
    return null;
  }

  return (
    <group
      ref={groupRef}
      name={`group-${node.id}`}
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z, rotation.order ?? 'XYZ']}
      scale={[scale.x, scale.y, scale.z]}
    >
      {node.childrenIds.map((childId) => {
        const childNode = allNodes[childId];
        if (!childNode) return null;
        return <NodeRenderer key={childId} node={childNode} allNodes={allNodes} />;
      })}
    </group>
  );
};

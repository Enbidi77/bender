import React, { useSyncExternalStore, useMemo } from 'react';
import { useViewportContext } from '../context/ViewportContext.js';
import { NodeRenderer } from './NodeRenderer.js';
import type { SceneNode } from '@blender-elt/contracts';

export const SceneRenderer: React.FC = () => {
  const { sceneStore } = useViewportContext();

  const nodes = useSyncExternalStore(sceneStore.subscribe, () => sceneStore.getState().nodes);

  const root = useSyncExternalStore(sceneStore.subscribe, () => sceneStore.getState().root);

  // Top-level nodes (attached to root or without parent)
  const topLevelNodes = useMemo(() => {
    const list: SceneNode[] = [];
    if (root && Array.isArray(root.childrenIds)) {
      for (const id of root.childrenIds) {
        if (nodes[id]) {
          list.push(nodes[id]);
        }
      }
    }

    // In case there are top-level nodes not listed in root.childrenIds
    for (const id in nodes) {
      const n = nodes[id];
      if ((n.parentId === null || n.parentId === 'root') && !list.some((item) => item.id === id)) {
        list.push(n);
      }
    }

    return list;
  }, [nodes, root]);

  return (
    <group name="blender-scene-root">
      {topLevelNodes.map((node) => (
        <NodeRenderer key={node.id} node={node} allNodes={nodes} />
      ))}
    </group>
  );
};

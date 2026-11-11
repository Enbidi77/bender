import React from 'react';
import type { SceneNode, MeshNode, LightNode, CameraNode, GroupNode } from '@blender-elt/contracts';
import { MeshObject } from './MeshObject.js';
import { LightObject } from './LightObject.js';
import { CameraObject } from './CameraObject.js';
import { GroupObject } from './GroupObject.js';

export interface NodeRendererProps {
  node: SceneNode;
  allNodes: Record<string, SceneNode>;
}

export const NodeRenderer: React.FC<NodeRendererProps> = ({ node, allNodes }) => {
  if (!node || !node.visible) {
    return null;
  }

  switch (node.type) {
    case 'mesh':
      return <MeshObject node={node as MeshNode} />;
    case 'light':
      return <LightObject node={node as LightNode} />;
    case 'camera':
      return <CameraObject node={node as CameraNode} />;
    case 'group':
      return <GroupObject node={node as GroupNode} allNodes={allNodes} />;
    default:
      return null;
  }
};

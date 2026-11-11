import type { SceneNode, SceneRoot } from '@blender-elt/contracts';

/**
 * Depth-first traversal of a node and its descendants
 */
export function traverse(
  startNodeId: string,
  nodes: Record<string, SceneNode>,
  callback: (node: SceneNode, parent: SceneNode | null, depth: number) => boolean | void,
  parent: SceneNode | null = null,
  depth = 0,
): void {
  const node = nodes[startNodeId];
  if (!node) return;

  const shouldContinue = callback(node, parent, depth);
  if (shouldContinue === false) return;

  for (const childId of node.childrenIds) {
    traverse(childId, nodes, callback, node, depth + 1);
  }
}

/**
 * Returns array of ancestors from immediate parent up to root
 */
export function getAncestors(nodeId: string, nodes: Record<string, SceneNode>): SceneNode[] {
  const ancestors: SceneNode[] = [];
  let current = nodes[nodeId];

  while (current && current.parentId && current.parentId !== 'root') {
    const parent = nodes[current.parentId];
    if (!parent) break;
    ancestors.push(parent);
    current = parent;
  }

  return ancestors;
}

/**
 * Returns all descendant nodes flattened
 */
export function getDescendants(nodeId: string, nodes: Record<string, SceneNode>): SceneNode[] {
  const descendants: SceneNode[] = [];
  const node = nodes[nodeId];
  if (!node) return descendants;

  traverse(nodeId, nodes, (current) => {
    if (current.id !== nodeId) {
      descendants.push(current);
    }
  });

  return descendants;
}

/**
 * Checks if candidateId is a descendant of ancestorId (prevents cyclic parenting)
 */
export function isDescendantOf(
  candidateId: string,
  ancestorId: string,
  nodes: Record<string, SceneNode>,
): boolean {
  if (candidateId === ancestorId) return true;
  const node = nodes[candidateId];
  if (!node || !node.parentId || node.parentId === 'root') return false;
  if (node.parentId === ancestorId) return true;
  return isDescendantOf(node.parentId, ancestorId, nodes);
}

/**
 * Safely reparents a node to a new parent or to the scene root
 */
export function reparentNodeInGraph(
  nodeId: string,
  newParentId: string | null,
  nodes: Record<string, SceneNode>,
  root: SceneRoot,
): { nodes: Record<string, SceneNode>; root: SceneRoot; success: boolean } {
  const node = nodes[nodeId];
  if (!node) {
    return { nodes, root, success: false };
  }

  const targetParentId = newParentId || 'root';

  // Cannot parent to self
  if (nodeId === targetParentId) {
    return { nodes, root, success: false };
  }

  // Cannot parent to own descendant (cycles)
  if (targetParentId !== 'root' && isDescendantOf(targetParentId, nodeId, nodes)) {
    return { nodes, root, success: false };
  }

  const nextNodes = { ...nodes };
  let nextRoot = { ...root };

  // 1. Remove from old parent
  if (node.parentId === 'root' || !node.parentId) {
    nextRoot = {
      ...nextRoot,
      childrenIds: nextRoot.childrenIds.filter((id) => id !== nodeId),
    };
  } else if (nextNodes[node.parentId]) {
    const oldParent = nextNodes[node.parentId];
    nextNodes[node.parentId] = {
      ...oldParent,
      childrenIds: oldParent.childrenIds.filter((id) => id !== nodeId),
    };
  }

  // 2. Add to new parent
  if (targetParentId === 'root') {
    nextRoot = {
      ...nextRoot,
      childrenIds: Array.from(new Set([...nextRoot.childrenIds, nodeId])),
    };
    nextNodes[nodeId] = {
      ...node,
      parentId: 'root',
    };
  } else if (nextNodes[targetParentId]) {
    const newParent = nextNodes[targetParentId];
    nextNodes[targetParentId] = {
      ...newParent,
      childrenIds: Array.from(new Set([...newParent.childrenIds, nodeId])),
    };
    nextNodes[nodeId] = {
      ...node,
      parentId: targetParentId,
    };
  }

  return { nodes: nextNodes, root: nextRoot, success: true };
}

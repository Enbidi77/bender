import { createStore } from 'zustand/vanilla';
import type {
  SceneNode,
  SceneRoot,
  MeshNode,
  CameraNode,
  LightNode,
  Transform,
  Vector3,
  Euler,
  SceneCollection,
} from '@blender-elt/contracts';
import { reparentNodeInGraph, traverse, getAncestors, getDescendants } from './hierarchy.js';
import { computeWorldMatrix, computeWorldTransform } from './transform.js';
import { createCameraNode, createCollection, createLightNode, createMeshNode } from './factory.js';

export type { MeshNode, CameraNode, LightNode };

export interface SceneGraphState {
  root: SceneRoot;
  nodes: Record<string, SceneNode>;
  collections: Record<string, SceneCollection>;
  selectedNodeIds: string[];
  activeNodeId: string | null;

  // Node CRUD
  addNode: (node: SceneNode, parentId?: string | null, collectionId?: string | null) => void;
  removeNode: (id: string) => void;
  reparentNode: (nodeId: string, newParentId: string | null) => boolean;
  getNodeById: (id: string) => SceneNode | undefined;
  updateNode: (id: string, updates: Partial<SceneNode>) => void;

  // Hierarchy traversal
  traverseNode: (
    nodeId: string,
    callback: (node: SceneNode, parent: SceneNode | null, depth: number) => boolean | void,
  ) => void;
  getNodeAncestors: (nodeId: string) => SceneNode[];
  getNodeDescendants: (nodeId: string) => SceneNode[];

  // Transforms
  setTransform: (id: string, transform: Partial<Transform>) => void;
  updateNodeTransform: (id: string, transform: Partial<Transform>) => void;
  setPosition: (id: string, pos: Partial<Vector3>) => void;
  setRotation: (id: string, rot: Partial<Euler>) => void;
  setScale: (id: string, scale: Partial<Vector3>) => void;
  getNodeWorldMatrix: (id: string) => import('three').Matrix4;
  getNodeWorldTransform: (id: string) => Transform;

  // Selection
  select: (id: string, multi?: boolean) => void;
  selectMultiple: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  deselectAll: () => void;
  isSelected: (id: string) => boolean;
  getActiveNode: () => SceneNode | null;
  getSelectedNodes: () => SceneNode[];

  // Visibility and Locking
  setNodeVisibility: (id: string, visible: boolean) => void;
  setNodeLocked: (id: string, locked: boolean) => void;

  // Collections
  addCollection: (name: string, color?: string) => SceneCollection;
  removeCollection: (collectionId: string) => void;
  addNodeToCollection: (nodeId: string, collectionId: string) => void;
  removeNodeFromCollection: (nodeId: string, collectionId: string) => void;
  setCollectionVisibility: (collectionId: string, visible: boolean) => void;
  setCollectionLocked: (collectionId: string, locked: boolean) => void;
  getCollections: () => SceneCollection[];

  // Scene lifecycle
  resetToDefaultScene: () => void;
  loadScene: (
    root: SceneRoot,
    nodes: Record<string, SceneNode>,
    collections?: Record<string, SceneCollection>,
  ) => void;
}

export function createDefaultScene(): {
  root: SceneRoot;
  nodes: Record<string, SceneNode>;
  collections: Record<string, SceneCollection>;
} {
  const root: SceneRoot = {
    id: 'root',
    name: 'Scene Root',
    type: 'root',
    childrenIds: ['cube-default', 'camera-default', 'light-default'],
    environment: {
      preset: 'studio',
      backgroundBlur: 0.5,
      backgroundIntensity: 1.0,
    },
    backgroundColor: '#1d1e22',
  };

  const defaultCollection = createCollection({
    id: 'collection-default',
    name: 'Collection',
    color: '#4772b3',
    nodeIds: ['cube-default', 'camera-default', 'light-default'],
  });

  const cubeNode = createMeshNode({
    id: 'cube-default',
    name: 'Cube',
    geometryId: 'geo-cube-default',
    primitiveType: 'cube',
    materialId: 'mat-clay-default',
    collectionId: defaultCollection.id,
  });

  const cameraNode = createCameraNode({
    id: 'camera-default',
    name: 'Camera',
    transform: {
      position: { x: 7.35889, y: 4.95831, z: 6.92579 },
      rotation: { x: -0.4, y: 0.8, z: 0.3, order: 'XYZ' },
      scale: { x: 1, y: 1, z: 1 },
    },
    collectionId: defaultCollection.id,
  });

  const lightNode = createLightNode({
    id: 'light-default',
    name: 'Light',
    lightType: 'point',
    intensity: 1000,
    transform: {
      position: { x: 4.07625, y: 5.90386, z: 1.00545 },
      rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
      scale: { x: 1, y: 1, z: 1 },
    },
    collectionId: defaultCollection.id,
  });

  return {
    root,
    nodes: {
      [cubeNode.id]: cubeNode,
      [cameraNode.id]: cameraNode,
      [lightNode.id]: lightNode,
    },
    collections: {
      [defaultCollection.id]: defaultCollection,
    },
  };
}

export function createSceneStore(initialState?: {
  root?: SceneRoot;
  nodes?: Record<string, SceneNode>;
  collections?: Record<string, SceneCollection>;
}) {
  const initial = createDefaultScene();
  const initRoot = initialState?.root || initial.root;
  const initNodes = initialState?.nodes || initial.nodes;
  const initCollections = initialState?.collections || initial.collections;

  return createStore<SceneGraphState>((set, get) => ({
    root: initRoot,
    nodes: initNodes,
    collections: initCollections,
    selectedNodeIds: ['cube-default'],
    activeNodeId: 'cube-default',

    // Node CRUD
    addNode: (node, parentId = 'root', collectionId = null) => {
      const pid = parentId || 'root';
      const colId = collectionId || node.collectionId || null;

      set((state) => {
        const nextNodes = {
          ...state.nodes,
          [node.id]: {
            ...node,
            parentId: pid,
            collectionId: colId,
          },
        };

        let nextRoot = state.root;
        if (pid === 'root') {
          nextRoot = {
            ...state.root,
            childrenIds: Array.from(new Set([...state.root.childrenIds, node.id])),
          };
        } else if (nextNodes[pid]) {
          const parent = nextNodes[pid];
          nextNodes[pid] = {
            ...parent,
            childrenIds: Array.from(new Set([...parent.childrenIds, node.id])),
          };
        }

        const nextCollections = { ...state.collections };
        if (colId && nextCollections[colId]) {
          const col = nextCollections[colId];
          nextCollections[colId] = {
            ...col,
            nodeIds: Array.from(new Set([...col.nodeIds, node.id])),
          };
        }

        return {
          root: nextRoot,
          nodes: nextNodes,
          collections: nextCollections,
          selectedNodeIds: [node.id],
          activeNodeId: node.id,
        };
      });
    },

    removeNode: (id) => {
      set((state) => {
        if (!state.nodes[id]) return state;

        // Collect node and all its descendants to remove
        const descendants = getDescendants(id, state.nodes);
        const idsToRemove = new Set([id, ...descendants.map((d) => d.id)]);

        const nextNodes = { ...state.nodes };
        idsToRemove.forEach((nodeId) => delete nextNodes[nodeId]);

        // Clean up from root
        const nextRoot = {
          ...state.root,
          childrenIds: state.root.childrenIds.filter((cid) => !idsToRemove.has(cid)),
        };

        // Clean up parent's childrenIds
        const targetNode = state.nodes[id];
        if (targetNode?.parentId && nextNodes[targetNode.parentId]) {
          const p = nextNodes[targetNode.parentId];
          nextNodes[targetNode.parentId] = {
            ...p,
            childrenIds: p.childrenIds.filter((cid) => !idsToRemove.has(cid)),
          };
        }

        // Clean up from collections
        const nextCollections: Record<string, SceneCollection> = {};
        Object.values(state.collections).forEach((col) => {
          nextCollections[col.id] = {
            ...col,
            nodeIds: col.nodeIds.filter((nid) => !idsToRemove.has(nid)),
          };
        });

        // Clean selection
        const nextSelected = state.selectedNodeIds.filter((sid) => !idsToRemove.has(sid));
        return {
          root: nextRoot,
          nodes: nextNodes,
          collections: nextCollections,
          selectedNodeIds: nextSelected,
          activeNodeId: nextSelected[nextSelected.length - 1] || null,
        };
      });
    },

    reparentNode: (nodeId, newParentId) => {
      const state = get();
      const res = reparentNodeInGraph(nodeId, newParentId, state.nodes, state.root);
      if (res.success) {
        set({
          nodes: res.nodes,
          root: res.root,
        });
        return true;
      }
      return false;
    },

    getNodeById: (id) => {
      return get().nodes[id];
    },

    updateNode: (id, updates) => {
      set((state) => {
        const node = state.nodes[id];
        if (!node) return state;
        return {
          nodes: {
            ...state.nodes,
            [id]: {
              ...node,
              ...updates,
            } as SceneNode,
          },
        };
      });
    },

    // Hierarchy Traversal
    traverseNode: (nodeId, callback) => {
      traverse(nodeId, get().nodes, callback);
    },

    getNodeAncestors: (nodeId) => {
      return getAncestors(nodeId, get().nodes);
    },

    getNodeDescendants: (nodeId) => {
      return getDescendants(nodeId, get().nodes);
    },

    // Transforms
    setTransform: (id, partialTransform) => {
      set((state) => {
        const node = state.nodes[id];
        if (!node) return state;
        return {
          nodes: {
            ...state.nodes,
            [id]: {
              ...node,
              transform: {
                ...node.transform,
                ...partialTransform,
              },
            },
          },
        };
      });
    },

    updateNodeTransform: (id, partialTransform) => {
      get().setTransform(id, partialTransform);
    },

    setPosition: (id, pos) => {
      set((state) => {
        const node = state.nodes[id];
        if (!node) return state;
        return {
          nodes: {
            ...state.nodes,
            [id]: {
              ...node,
              transform: {
                ...node.transform,
                position: { ...node.transform.position, ...pos },
              },
            },
          },
        };
      });
    },

    setRotation: (id, rot) => {
      set((state) => {
        const node = state.nodes[id];
        if (!node) return state;
        return {
          nodes: {
            ...state.nodes,
            [id]: {
              ...node,
              transform: {
                ...node.transform,
                rotation: { ...node.transform.rotation, ...rot },
              },
            },
          },
        };
      });
    },

    setScale: (id, scale) => {
      set((state) => {
        const node = state.nodes[id];
        if (!node) return state;
        return {
          nodes: {
            ...state.nodes,
            [id]: {
              ...node,
              transform: {
                ...node.transform,
                scale: { ...node.transform.scale, ...scale },
              },
            },
          },
        };
      });
    },

    getNodeWorldMatrix: (id) => {
      return computeWorldMatrix(id, get().nodes);
    },

    getNodeWorldTransform: (id) => {
      return computeWorldTransform(id, get().nodes);
    },

    // Selection
    select: (id, multi = false) => {
      set((state) => {
        if (!state.nodes[id]) return state;
        if (multi) {
          const already = state.selectedNodeIds.includes(id);
          const next = already
            ? state.selectedNodeIds.filter((sid) => sid !== id)
            : [...state.selectedNodeIds, id];
          return {
            selectedNodeIds: next,
            activeNodeId: already ? next[next.length - 1] || null : id,
          };
        }
        return {
          selectedNodeIds: [id],
          activeNodeId: id,
        };
      });
    },

    selectMultiple: (ids) => {
      set((state) => {
        const validIds = ids.filter((id) => !!state.nodes[id]);
        return {
          selectedNodeIds: validIds,
          activeNodeId: validIds[validIds.length - 1] || null,
        };
      });
    },

    toggleSelect: (id) => {
      const state = get();
      state.select(id, true);
    },

    deselectAll: () => {
      set({
        selectedNodeIds: [],
        activeNodeId: null,
      });
    },

    isSelected: (id) => {
      return get().selectedNodeIds.includes(id);
    },

    getActiveNode: () => {
      const state = get();
      return state.activeNodeId ? state.nodes[state.activeNodeId] || null : null;
    },

    getSelectedNodes: () => {
      const state = get();
      return state.selectedNodeIds.map((id) => state.nodes[id]).filter((n): n is SceneNode => !!n);
    },

    // Visibility & Locking
    setNodeVisibility: (id, visible) => {
      set((state) => {
        const node = state.nodes[id];
        if (!node) return state;
        return {
          nodes: {
            ...state.nodes,
            [id]: { ...node, visible },
          },
        };
      });
    },

    setNodeLocked: (id, locked) => {
      set((state) => {
        const node = state.nodes[id];
        if (!node) return state;
        return {
          nodes: {
            ...state.nodes,
            [id]: { ...node, locked },
          },
        };
      });
    },

    // Collections
    addCollection: (name, color) => {
      const col = createCollection({ name, color });
      set((state) => ({
        collections: {
          ...state.collections,
          [col.id]: col,
        },
      }));
      return col;
    },

    removeCollection: (collectionId) => {
      set((state) => {
        if (!state.collections[collectionId]) return state;
        const nextCollections = { ...state.collections };
        delete nextCollections[collectionId];

        // Reset collectionId on member nodes
        const nextNodes = { ...state.nodes };
        Object.keys(nextNodes).forEach((nid) => {
          if (nextNodes[nid].collectionId === collectionId) {
            nextNodes[nid] = { ...nextNodes[nid], collectionId: null };
          }
        });

        return {
          collections: nextCollections,
          nodes: nextNodes,
        };
      });
    },

    addNodeToCollection: (nodeId, collectionId) => {
      set((state) => {
        const col = state.collections[collectionId];
        const node = state.nodes[nodeId];
        if (!col || !node) return state;

        return {
          collections: {
            ...state.collections,
            [collectionId]: {
              ...col,
              nodeIds: Array.from(new Set([...col.nodeIds, nodeId])),
            },
          },
          nodes: {
            ...state.nodes,
            [nodeId]: {
              ...node,
              collectionId,
            },
          },
        };
      });
    },

    removeNodeFromCollection: (nodeId, collectionId) => {
      set((state) => {
        const col = state.collections[collectionId];
        const node = state.nodes[nodeId];
        if (!col) return state;

        const nextNodes = { ...state.nodes };
        if (node && node.collectionId === collectionId) {
          nextNodes[nodeId] = { ...node, collectionId: null };
        }

        return {
          collections: {
            ...state.collections,
            [collectionId]: {
              ...col,
              nodeIds: col.nodeIds.filter((nid) => nid !== nodeId),
            },
          },
          nodes: nextNodes,
        };
      });
    },

    setCollectionVisibility: (collectionId, visible) => {
      set((state) => {
        const col = state.collections[collectionId];
        if (!col) return state;

        // Cascade visibility to all nodes in this collection
        const nextNodes = { ...state.nodes };
        col.nodeIds.forEach((nid) => {
          if (nextNodes[nid]) {
            nextNodes[nid] = { ...nextNodes[nid], visible };
          }
        });

        return {
          collections: {
            ...state.collections,
            [collectionId]: { ...col, visible },
          },
          nodes: nextNodes,
        };
      });
    },

    setCollectionLocked: (collectionId, locked) => {
      set((state) => {
        const col = state.collections[collectionId];
        if (!col) return state;

        // Cascade locked state to all nodes in this collection
        const nextNodes = { ...state.nodes };
        col.nodeIds.forEach((nid) => {
          if (nextNodes[nid]) {
            nextNodes[nid] = { ...nextNodes[nid], locked };
          }
        });

        return {
          collections: {
            ...state.collections,
            [collectionId]: { ...col, locked },
          },
          nodes: nextNodes,
        };
      });
    },

    getCollections: () => {
      return Object.values(get().collections);
    },

    // Scene lifecycle
    resetToDefaultScene: () => {
      const def = createDefaultScene();
      set({
        root: def.root,
        nodes: def.nodes,
        collections: def.collections,
        selectedNodeIds: ['cube-default'],
        activeNodeId: 'cube-default',
      });
    },

    loadScene: (root, nodes, collections = {}) => {
      const firstNodeId = Object.keys(nodes)[0] || null;
      set({
        root,
        nodes,
        collections,
        selectedNodeIds: firstNodeId ? [firstNodeId] : [],
        activeNodeId: firstNodeId,
      });
    },
  }));
}

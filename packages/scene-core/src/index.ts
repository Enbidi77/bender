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
} from '@blender-elt/contracts';

export type { Vector3, Euler };

export interface SceneGraphState {
  root: SceneRoot;
  nodes: Record<string, SceneNode>;
  selectedNodeIds: string[];
  activeNodeId: string | null;

  // Actions
  addNode: (node: SceneNode, parentId?: string | null) => void;
  removeNode: (id: string) => void;
  updateTransform: (id: string, transform: Partial<Transform>) => void;
  selectNode: (id: string, multi?: boolean) => void;
  deselectAll: () => void;
  resetToDefaultScene: () => void;
}

export function createDefaultTransform(): Transform {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
    scale: { x: 1, y: 1, z: 1 },
  };
}

export function createDefaultScene(): { root: SceneRoot; nodes: Record<string, SceneNode> } {
  const root: SceneRoot = {
    id: 'root',
    name: 'Scene Collection',
    type: 'root',
    childrenIds: ['cube-default', 'camera-default', 'light-default'],
    environment: {
      preset: 'studio',
      backgroundBlur: 0.5,
      backgroundIntensity: 1.0,
    },
    backgroundColor: '#1d1e22',
  };

  const cubeNode: MeshNode = {
    id: 'cube-default',
    name: 'Cube',
    type: 'mesh',
    geometryId: 'geo-cube-default',
    primitiveType: 'cube',
    materialId: 'mat-clay-default',
    transform: createDefaultTransform(),
    visible: true,
    locked: false,
    parentId: 'root',
    childrenIds: [],
    castShadow: true,
    receiveShadow: true,
  };

  const cameraNode: CameraNode = {
    id: 'camera-default',
    name: 'Camera',
    type: 'camera',
    projection: 'perspective',
    fov: 50,
    near: 0.1,
    far: 1000,
    zoom: 1,
    transform: {
      position: { x: 7.35889, y: 4.95831, z: 6.92579 },
      rotation: { x: -0.4, y: 0.8, z: 0.3, order: 'XYZ' },
      scale: { x: 1, y: 1, z: 1 },
    },
    visible: true,
    locked: false,
    parentId: 'root',
    childrenIds: [],
  };

  const lightNode: LightNode = {
    id: 'light-default',
    name: 'Light',
    type: 'light',
    lightType: 'point',
    color: '#ffffff',
    intensity: 1000,
    distance: 100,
    decay: 2,
    castShadow: true,
    transform: {
      position: { x: 4.07625, y: 5.90386, z: 1.00545 },
      rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
      scale: { x: 1, y: 1, z: 1 },
    },
    visible: true,
    locked: false,
    parentId: 'root',
    childrenIds: [],
  };

  return {
    root,
    nodes: {
      [cubeNode.id]: cubeNode,
      [cameraNode.id]: cameraNode,
      [lightNode.id]: lightNode,
    },
  };
}

export function createSceneStore() {
  const initial = createDefaultScene();

  return createStore<SceneGraphState>((set) => ({
    root: initial.root,
    nodes: initial.nodes,
    selectedNodeIds: ['cube-default'],
    activeNodeId: 'cube-default',

    addNode: (node, parentId = 'root') =>
      set((state) => {
        const nextNodes = { ...state.nodes, [node.id]: node };
        let nextRoot = state.root;

        if (parentId === 'root' || !parentId) {
          nextRoot = {
            ...state.root,
            childrenIds: Array.from(new Set([...state.root.childrenIds, node.id])),
          };
        } else if (state.nodes[parentId]) {
          const parent = state.nodes[parentId];
          nextNodes[parentId] = {
            ...parent,
            childrenIds: Array.from(new Set([...parent.childrenIds, node.id])),
          };
        }

        return {
          root: nextRoot,
          nodes: nextNodes,
          selectedNodeIds: [node.id],
          activeNodeId: node.id,
        };
      }),

    removeNode: (id) =>
      set((state) => {
        const nextNodes = { ...state.nodes };
        delete nextNodes[id];

        const nextRoot = {
          ...state.root,
          childrenIds: state.root.childrenIds.filter((cid) => cid !== id),
        };

        // remove reference from any parents
        Object.keys(nextNodes).forEach((nodeId) => {
          const n = nextNodes[nodeId];
          if (n.childrenIds.includes(id)) {
            nextNodes[nodeId] = {
              ...n,
              childrenIds: n.childrenIds.filter((cid) => cid !== id),
            };
          }
        });

        const nextSelected = state.selectedNodeIds.filter((sid) => sid !== id);
        return {
          root: nextRoot,
          nodes: nextNodes,
          selectedNodeIds: nextSelected,
          activeNodeId: nextSelected[0] || null,
        };
      }),

    updateTransform: (id, partialTransform) =>
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
      }),

    selectNode: (id, multi = false) =>
      set((state) => {
        if (multi) {
          const exists = state.selectedNodeIds.includes(id);
          const nextSelected = exists
            ? state.selectedNodeIds.filter((item) => item !== id)
            : [...state.selectedNodeIds, id];
          return {
            selectedNodeIds: nextSelected,
            activeNodeId: exists ? nextSelected[nextSelected.length - 1] || null : id,
          };
        }
        return {
          selectedNodeIds: [id],
          activeNodeId: id,
        };
      }),

    deselectAll: () =>
      set({
        selectedNodeIds: [],
        activeNodeId: null,
      }),

    resetToDefaultScene: () => {
      const def = createDefaultScene();
      set({
        root: def.root,
        nodes: def.nodes,
        selectedNodeIds: ['cube-default'],
        activeNodeId: 'cube-default',
      });
    },
  }));
}

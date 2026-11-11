import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSceneStore,
  createMeshNode,
  createLightNode,
  createCameraNode,
  composeMatrix,
  decomposeMatrix,
  eulerToQuaternion,
  quaternionToEuler,
} from '../src/index.js';

describe('packages/scene-core', () => {
  let store: ReturnType<typeof createSceneStore>;

  beforeEach(() => {
    store = createSceneStore();
  });

  describe('Default Scene Graph', () => {
    it('initializes default scene with Cube, Camera, Light and Collection', () => {
      const state = store.getState();
      expect(state.root.childrenIds).toHaveLength(3);
      expect(state.nodes['cube-default']).toBeDefined();
      expect(state.nodes['cube-default'].type).toBe('mesh');
      expect(state.nodes['camera-default']).toBeDefined();
      expect(state.nodes['camera-default'].type).toBe('camera');
      expect(state.nodes['light-default']).toBeDefined();
      expect(state.nodes['light-default'].type).toBe('light');

      const collections = state.getCollections();
      expect(collections.length).toBeGreaterThanOrEqual(1);
      expect(collections[0].nodeIds).toContain('cube-default');
    });

    it('has active selection on default cube', () => {
      const state = store.getState();
      expect(state.selectedNodeIds).toEqual(['cube-default']);
      expect(state.activeNodeId).toBe('cube-default');
      expect(state.isSelected('cube-default')).toBe(true);
    });
  });

  describe('Node Types and Factories', () => {
    it('creates and adds a MeshNode', () => {
      const mesh = createMeshNode({
        name: 'Suzanne',
        primitiveType: 'monkey',
        transform: { position: { x: 1, y: 2, z: 3 } },
      });

      store.getState().addNode(mesh);
      const retrieved = store.getState().getNodeById(mesh.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Suzanne');
      expect(retrieved?.transform.position).toEqual({ x: 1, y: 2, z: 3 });
      expect(store.getState().root.childrenIds).toContain(mesh.id);
    });

    it('creates and adds different LightNode types', () => {
      const dirLight = createLightNode({
        name: 'Sun',
        lightType: 'directional',
        intensity: 5,
        color: '#fffaed',
      });
      const spotLight = createLightNode({
        name: 'Spot',
        lightType: 'spot',
        angle: 0.6,
        penumbra: 0.2,
      });

      store.getState().addNode(dirLight);
      store.getState().addNode(spotLight);

      const d = store.getState().getNodeById(dirLight.id);
      const s = store.getState().getNodeById(spotLight.id);

      expect(d?.type).toBe('light');
      expect((d as any).lightType).toBe('directional');
      expect(s?.type).toBe('light');
      expect((s as any).lightType).toBe('spot');
    });

    it('creates CameraNode with perspective or orthographic projection', () => {
      const orthoCam = createCameraNode({
        name: 'Ortho View',
        projection: 'orthographic',
        zoom: 2,
      });

      store.getState().addNode(orthoCam);
      const cam = store.getState().getNodeById(orthoCam.id);
      expect(cam?.type).toBe('camera');
      expect((cam as any).projection).toBe('orthographic');
      expect((cam as any).zoom).toBe(2);
    });
  });

  describe('Hierarchy and Reparenting', () => {
    it('handles parent/child additions and traverses descendants', () => {
      const parent = createMeshNode({ name: 'CarBody' });
      const wheel1 = createMeshNode({ name: 'WheelFL' });
      const wheel2 = createMeshNode({ name: 'WheelFR' });

      store.getState().addNode(parent);
      store.getState().addNode(wheel1, parent.id);
      store.getState().addNode(wheel2, parent.id);

      const pNode = store.getState().getNodeById(parent.id);
      expect(pNode?.childrenIds).toEqual([wheel1.id, wheel2.id]);

      const w1 = store.getState().getNodeById(wheel1.id);
      expect(w1?.parentId).toBe(parent.id);

      const descendants = store.getState().getNodeDescendants(parent.id);
      expect(descendants.map((d) => d.id)).toEqual([wheel1.id, wheel2.id]);

      const ancestors = store.getState().getNodeAncestors(wheel1.id);
      expect(ancestors.map((a) => a.id)).toEqual([parent.id]);
    });

    it('reparents nodes safely and updates child lists', () => {
      const groupA = createMeshNode({ name: 'GroupA' });
      const groupB = createMeshNode({ name: 'GroupB' });
      const item = createMeshNode({ name: 'Item' });

      store.getState().addNode(groupA);
      store.getState().addNode(groupB);
      store.getState().addNode(item, groupA.id);

      expect(store.getState().getNodeById(groupA.id)?.childrenIds).toContain(item.id);

      // Reparent item to groupB
      const success = store.getState().reparentNode(item.id, groupB.id);
      expect(success).toBe(true);

      expect(store.getState().getNodeById(groupA.id)?.childrenIds).not.toContain(item.id);
      expect(store.getState().getNodeById(groupB.id)?.childrenIds).toContain(item.id);
      expect(store.getState().getNodeById(item.id)?.parentId).toBe(groupB.id);
    });

    it('prevents cyclic parenting', () => {
      const grandParent = createMeshNode({ name: 'GP' });
      const parent = createMeshNode({ name: 'P' });
      const child = createMeshNode({ name: 'C' });

      store.getState().addNode(grandParent);
      store.getState().addNode(parent, grandParent.id);
      store.getState().addNode(child, parent.id);

      // Attempt to reparent grandParent to child (cycle)
      const cyclic = store.getState().reparentNode(grandParent.id, child.id);
      expect(cyclic).toBe(false);

      // Attempt to reparent to itself
      const selfParent = store.getState().reparentNode(grandParent.id, grandParent.id);
      expect(selfParent).toBe(false);
    });

    it('removes parent and cascades deletion to descendants', () => {
      const parent = createMeshNode({ name: 'Parent' });
      const child = createMeshNode({ name: 'Child' });

      store.getState().addNode(parent);
      store.getState().addNode(child, parent.id);

      expect(store.getState().getNodeById(parent.id)).toBeDefined();
      expect(store.getState().getNodeById(child.id)).toBeDefined();

      store.getState().removeNode(parent.id);

      expect(store.getState().getNodeById(parent.id)).toBeUndefined();
      expect(store.getState().getNodeById(child.id)).toBeUndefined();
    });
  });

  describe('Transform and Matrix Management', () => {
    it('composes and decomposes transform matrices accurately', () => {
      const initial = {
        position: { x: 5, y: -2, z: 10 },
        rotation: { x: 0.5, y: 0.2, z: -0.1, order: 'XYZ' as const },
        scale: { x: 2, y: 3, z: 4 },
      };

      const mat = composeMatrix(initial);
      const decomposed = decomposeMatrix(mat);

      expect(decomposed.position.x).toBeCloseTo(5);
      expect(decomposed.position.y).toBeCloseTo(-2);
      expect(decomposed.position.z).toBeCloseTo(10);
      expect(decomposed.rotation.x).toBeCloseTo(0.5);
      expect(decomposed.scale.x).toBeCloseTo(2);
      expect(decomposed.scale.y).toBeCloseTo(3);
      expect(decomposed.scale.z).toBeCloseTo(4);
    });

    it('converts between Euler and Quaternion cleanly', () => {
      const euler = { x: 0.3, y: 0.7, z: -0.2, order: 'XYZ' as const };
      const q = eulerToQuaternion(euler);
      const roundtrip = quaternionToEuler(q);

      expect(roundtrip.x).toBeCloseTo(euler.x);
      expect(roundtrip.y).toBeCloseTo(euler.y);
      expect(roundtrip.z).toBeCloseTo(euler.z);
    });

    it('computes world transform by propagating through parent chain', () => {
      const parent = createMeshNode({
        name: 'Parent',
        transform: { position: { x: 10, y: 0, z: 0 } },
      });
      const child = createMeshNode({
        name: 'Child',
        transform: { position: { x: 5, y: 2, z: 0 } },
      });

      store.getState().addNode(parent);
      store.getState().addNode(child, parent.id);

      const childWorld = store.getState().getNodeWorldTransform(child.id);

      expect(childWorld.position.x).toBeCloseTo(15);
      expect(childWorld.position.y).toBeCloseTo(2);
      expect(childWorld.position.z).toBeCloseTo(0);
    });
  });

  describe('Scene Collections', () => {
    it('creates collections, assigns nodes, and toggles collection visibility', () => {
      const col = store.getState().addCollection('Props', '#ff9900');
      const box = createMeshNode({ name: 'Box' });

      store.getState().addNode(box);
      store.getState().addNodeToCollection(box.id, col.id);

      expect(store.getState().getNodeById(box.id)?.collectionId).toBe(col.id);

      // Hide collection cascades to member nodes
      store.getState().setCollectionVisibility(col.id, false);
      expect(store.getState().getNodeById(box.id)?.visible).toBe(false);

      // Re-enable collection visibility
      store.getState().setCollectionVisibility(col.id, true);
      expect(store.getState().getNodeById(box.id)?.visible).toBe(true);
    });

    it('cascades lock state from collection to member nodes', () => {
      const col = store.getState().addCollection('Environment');
      const ground = createMeshNode({ name: 'Ground' });

      store.getState().addNode(ground);
      store.getState().addNodeToCollection(ground.id, col.id);

      store.getState().setCollectionLocked(col.id, true);
      expect(store.getState().getNodeById(ground.id)?.locked).toBe(true);
    });
  });

  describe('Selection Management', () => {
    it('supports single selection, multi-selection, and active node', () => {
      const a = createMeshNode({ name: 'NodeA' });
      const b = createMeshNode({ name: 'NodeB' });

      store.getState().addNode(a);
      store.getState().addNode(b);

      store.getState().select(a.id);
      expect(store.getState().selectedNodeIds).toEqual([a.id]);
      expect(store.getState().activeNodeId).toBe(a.id);

      // Multi-select
      store.getState().select(b.id, true);
      expect(store.getState().selectedNodeIds).toContain(a.id);
      expect(store.getState().selectedNodeIds).toContain(b.id);
      expect(store.getState().activeNodeId).toBe(b.id);

      // Deselect all
      store.getState().deselectAll();
      expect(store.getState().selectedNodeIds).toEqual([]);
      expect(store.getState().activeNodeId).toBeNull();
    });
  });
});

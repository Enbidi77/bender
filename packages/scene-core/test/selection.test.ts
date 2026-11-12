import { describe, it, expect, beforeEach } from 'vitest';
import { createSelectionStore, type SelectionStore } from '../src/index.js';

describe('packages/scene-core - SelectionStore', () => {
  let store: SelectionStore;

  beforeEach(() => {
    store = createSelectionStore();
  });

  describe('Initial State & Defaults', () => {
    it('initializes with default Blender selection states', () => {
      const state = store.getState();
      expect(state.activeNodeId).toBeNull();
      expect(state.selectedNodeIds).toEqual([]);
      expect(state.selectionOrder).toEqual([]);
      expect(state.pivotPoint).toBe('median-point');
      expect(state.cursor3D.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(state.cursor3D.rotation).toEqual({ x: 0, y: 0, z: 0, order: 'XYZ' });
      expect(state.editSelection.elementModes).toEqual(['vertex']);
      expect(state.editSelection.selectedVertexIndices).toEqual([]);
    });
  });

  describe('Object Selection Modes (set, add, subtract, invert)', () => {
    it('handles "set" mode replacing existing selection', () => {
      store.getState().selectObject('cube-1', 'set');
      expect(store.getState().activeNodeId).toBe('cube-1');
      expect(store.getState().selectedNodeIds).toEqual(['cube-1']);
      expect(store.getState().selectionOrder).toEqual(['cube-1']);

      store.getState().selectObject('sphere-2', 'set');
      expect(store.getState().activeNodeId).toBe('sphere-2');
      expect(store.getState().selectedNodeIds).toEqual(['sphere-2']);
      expect(store.getState().selectionOrder).toEqual(['sphere-2']);
    });

    it('handles "add" mode accumulating selection order and active target', () => {
      store.getState().selectObject('cube-1', 'set');
      store.getState().selectObject('sphere-2', 'add');
      store.getState().selectObject('cylinder-3', 'add');

      const state = store.getState();
      expect(state.activeNodeId).toBe('cylinder-3');
      expect(state.selectedNodeIds).toEqual(['cube-1', 'sphere-2', 'cylinder-3']);
      expect(state.selectionOrder).toEqual(['cube-1', 'sphere-2', 'cylinder-3']);
    });

    it('handles "subtract" mode adjusting activeNodeId to last remaining', () => {
      store.getState().selectMultipleObjects(['node-1', 'node-2', 'node-3'], 'set');
      expect(store.getState().activeNodeId).toBe('node-3');

      // Subtract the active node
      store.getState().selectObject('node-3', 'subtract');
      const state = store.getState();
      expect(state.selectedNodeIds).toEqual(['node-1', 'node-2']);
      expect(state.activeNodeId).toBe('node-2'); // Fallback to last remaining
      expect(state.selectionOrder).toEqual(['node-1', 'node-2']);
    });

    it('handles "invert" mode toggling items in selection', () => {
      store.getState().selectObject('node-1', 'set');
      expect(store.getState().isObjectSelected('node-1')).toBe(true);

      store.getState().selectObject('node-1', 'invert');
      expect(store.getState().isObjectSelected('node-1')).toBe(false);
      expect(store.getState().activeNodeId).toBeNull();

      store.getState().selectObject('node-2', 'invert');
      expect(store.getState().isObjectSelected('node-2')).toBe(true);
      expect(store.getState().activeNodeId).toBe('node-2');
    });

    it('deselects all objects cleanly', () => {
      store.getState().selectMultipleObjects(['a', 'b', 'c']);
      expect(store.getState().selectedNodeIds).toHaveLength(3);

      store.getState().deselectAllObjects();
      expect(store.getState().selectedNodeIds).toEqual([]);
      expect(store.getState().activeNodeId).toBeNull();
      expect(store.getState().selectionOrder).toEqual([]);
    });

    it('sets active object explicitly and ensures membership', () => {
      store.getState().selectObject('obj-1');
      store.getState().setActiveObject('obj-2');

      const state = store.getState();
      expect(state.activeNodeId).toBe('obj-2');
      expect(state.selectedNodeIds).toContain('obj-2');
      expect(state.selectionOrder[state.selectionOrder.length - 1]).toBe('obj-2');
    });
  });

  describe('3D Cursor & Pivot Point Operations', () => {
    it('updates 3D cursor position and rotation', () => {
      store.getState().setCursorPosition({ x: 5, y: 10 });
      expect(store.getState().cursor3D.position).toEqual({ x: 5, y: 10, z: 0 });

      store.getState().setCursorRotation({ y: Math.PI });
      expect(store.getState().cursor3D.rotation.y).toBe(Math.PI);

      store.getState().resetCursor();
      expect(store.getState().cursor3D.position).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('updates transform pivot mode', () => {
      store.getState().setPivotPoint('3d-cursor');
      expect(store.getState().pivotPoint).toBe('3d-cursor');

      store.getState().setPivotPoint('individual-origins');
      expect(store.getState().pivotPoint).toBe('individual-origins');
    });
  });

  describe('Edit Mode Selection Masks & Sub-Element Indices', () => {
    it('manages simultaneous edit element masks', () => {
      store.getState().setEditElementModes(['vertex', 'edge']);
      expect(store.getState().editSelection.elementModes).toEqual(['vertex', 'edge']);

      store.getState().toggleEditElementMode('face');
      expect(store.getState().editSelection.elementModes).toContain('face');

      // Toggling off when multiple are active works
      store.getState().toggleEditElementMode('vertex');
      expect(store.getState().editSelection.elementModes).toEqual(['edge', 'face']);

      // Toggling off the only active mode is prevented to keep at least 1 mask
      store.getState().setEditElementModes(['edge']);
      store.getState().toggleEditElementMode('edge');
      expect(store.getState().editSelection.elementModes).toEqual(['edge']);
    });

    it('manages vertex selection with set, add, and subtract', () => {
      store.getState().selectVertices([0, 1, 2], 'set');
      expect(store.getState().editSelection.selectedVertexIndices).toEqual([0, 1, 2]);
      expect(store.getState().editSelection.activeVertexIndex).toBe(2);

      store.getState().selectVertices([3, 4], 'add');
      expect(store.getState().editSelection.selectedVertexIndices).toEqual([0, 1, 2, 3, 4]);

      store.getState().selectVertices([1, 3], 'subtract');
      expect(store.getState().editSelection.selectedVertexIndices).toEqual([0, 2, 4]);
    });

    it('manages face and edge selections', () => {
      store.getState().selectEdges([10, 11], 'set');
      expect(store.getState().editSelection.selectedEdgeIndices).toEqual([10, 11]);

      store.getState().selectFaces([5], 'set');
      expect(store.getState().editSelection.selectedFaceIndices).toEqual([5]);
      expect(store.getState().editSelection.activeFaceIndex).toBe(5);

      store.getState().deselectAllEditElements();
      expect(store.getState().editSelection.selectedVertexIndices).toEqual([]);
      expect(store.getState().editSelection.selectedEdgeIndices).toEqual([]);
      expect(store.getState().editSelection.selectedFaceIndices).toEqual([]);
      expect(store.getState().editSelection.activeFaceIndex).toBeNull();
    });
  });

  describe('Snapshot Serialization & Reset', () => {
    it('creates detached snapshot and loads it faithfully', () => {
      store.getState().selectMultipleObjects(['mesh-1', 'mesh-2']);
      store.getState().setCursorPosition({ x: 3, y: 7, z: -2 });
      store.getState().setPivotPoint('active-element');
      store.getState().selectVertices([10, 20]);

      const snapshot = store.getState().getSnapshot();

      // Modify original store
      store.getState().reset();
      expect(store.getState().selectedNodeIds).toEqual([]);
      expect(store.getState().cursor3D.position.x).toBe(0);

      // Load snapshot back
      store.getState().loadSnapshot(snapshot);
      expect(store.getState().selectedNodeIds).toEqual(['mesh-1', 'mesh-2']);
      expect(store.getState().cursor3D.position).toEqual({ x: 3, y: 7, z: -2 });
      expect(store.getState().pivotPoint).toBe('active-element');
      expect(store.getState().editSelection.selectedVertexIndices).toEqual([10, 20]);
    });
  });
});

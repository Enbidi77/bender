import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSceneStore, createMeshNode } from '@blender-elt/scene-core';
import type {
  CommandContext,
  MeshNode,
  IMeshData,
  EditMeshSelectionState,
} from '@blender-elt/contracts';
import {
  CommandManager,
  EditMeshCommand,
  MeshOperationCommand,
  TransformMeshElementsCommand,
  SelectMeshElementsCommand,
  createMeshNodeSnapshot,
  cloneMeshData,
  computeMedianPoint,
} from '../src/index.js';

describe('packages/commands - Edit Mode Commands', () => {
  let manager: CommandManager;
  let store: ReturnType<typeof createSceneStore>;
  let context: CommandContext;

  // Simple quad mesh: 4 vertices, 2 triangles
  const createQuadMeshNode = (id: string = 'test-mesh'): MeshNode => {
    const meshData: IMeshData = {
      vertices: new Float32Array([
        0,
        0,
        0, // v0
        1,
        0,
        0, // v1
        1,
        1,
        0, // v2
        0,
        1,
        0, // v3
      ]),
      indices: new Uint16Array([
        0,
        1,
        2, // F0
        0,
        2,
        3, // F1
      ]),
    };

    const node: MeshNode = {
      ...createMeshNode({
        id,
        name: 'QuadMesh',
      }),
      metadata: {
        meshData,
        geometryVersion: 1,
        editSelection: {
          elementModes: ['vertex'],
          selectedVertexIndices: [0, 1],
          selectedEdgeIndices: [],
          selectedFaceIndices: [],
          activeVertexIndex: 1,
          activeEdgeIndex: null,
          activeFaceIndex: null,
        } as EditMeshSelectionState,
      },
    };

    return node;
  };

  beforeEach(() => {
    manager = new CommandManager(10);
    store = createSceneStore();
    context = {
      state: store.getState(),
      dispatch: vi.fn(),
      metadata: {},
    };
    store.subscribe((state) => {
      context.state = state;
    });
  });

  describe('EditMeshCommand Snapshot & Undo/Redo', () => {
    it('executes, undoes, and redoes topology modifications accurately', async () => {
      const node = createQuadMeshNode('node-1');
      store.getState().addNode(node);

      const beforeSnapshot = createMeshNodeSnapshot(node);

      // Mutate vertices: move v0 and v1
      const modifiedMeshData = cloneMeshData(beforeSnapshot.meshData);
      (modifiedMeshData.vertices as Float32Array)[0] = 5.0;
      (modifiedMeshData.vertices as Float32Array)[3] = 6.0;

      const afterSnapshot = {
        meshData: modifiedMeshData,
        selectionState: {
          elementModes: ['vertex'] as any,
          selectedVertexIndices: [2, 3],
          selectedEdgeIndices: [],
          selectedFaceIndices: [],
          activeVertexIndex: 3,
          activeEdgeIndex: null,
          activeFaceIndex: null,
        },
      };

      const cmd = new EditMeshCommand('node-1', 'Move Vertices', beforeSnapshot, afterSnapshot);

      // 1. Execute
      await manager.execute(cmd, context);
      let updated = store.getState().getNodeById('node-1') as MeshNode;
      let verts = (updated.metadata?.meshData as IMeshData).vertices as Float32Array;
      expect(verts[0]).toBeCloseTo(5.0);
      expect(verts[3]).toBeCloseTo(6.0);
      expect(updated.metadata?.geometryVersion).toBe(2);
      expect(
        (updated.metadata?.editSelection as EditMeshSelectionState).selectedVertexIndices,
      ).toEqual([2, 3]);
      expect(context.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'GEOMETRY_UPDATED', nodeId: 'node-1' }),
      );

      // 2. Undo
      await manager.undo(context);
      updated = store.getState().getNodeById('node-1') as MeshNode;
      verts = (updated.metadata?.meshData as IMeshData).vertices as Float32Array;
      expect(verts[0]).toBeCloseTo(0.0);
      expect(verts[3]).toBeCloseTo(1.0);
      expect(
        (updated.metadata?.editSelection as EditMeshSelectionState).selectedVertexIndices,
      ).toEqual([0, 1]);

      // 3. Redo
      await manager.redo(context);
      updated = store.getState().getNodeById('node-1') as MeshNode;
      verts = (updated.metadata?.meshData as IMeshData).vertices as Float32Array;
      expect(verts[0]).toBeCloseTo(5.0);
      expect(verts[3]).toBeCloseTo(6.0);
      expect(
        (updated.metadata?.editSelection as EditMeshSelectionState).selectedVertexIndices,
      ).toEqual([2, 3]);
    });
  });

  describe('MeshOperationCommand - Core Operations', () => {
    it('executes "flip-normals" and restores in undo', async () => {
      const node = createQuadMeshNode('flip-node');
      store.getState().addNode(node);

      const origIndices = Array.from((node.metadata?.meshData as IMeshData).indices!);

      const cmd = new MeshOperationCommand({
        nodeId: 'flip-node',
        operation: {
          type: 'flip-normals',
          targetIndices: [0], // Flip Face 0 only
          parameters: {},
        },
      });

      await manager.execute(cmd, context);
      let updated = store.getState().getNodeById('flip-node') as MeshNode;
      let newIndices = Array.from((updated.metadata?.meshData as IMeshData).indices!);
      // Face 0: (0, 1, 2) flipped becomes (0, 2, 1)
      expect(newIndices[0]).toBe(origIndices[0]);
      expect(newIndices[1]).toBe(origIndices[2]);
      expect(newIndices[2]).toBe(origIndices[1]);
      // Face 1 should remain unchanged
      expect(newIndices[3]).toBe(origIndices[3]);
      expect(newIndices[4]).toBe(origIndices[4]);

      // Undo restores original winding
      await manager.undo(context);
      updated = store.getState().getNodeById('flip-node') as MeshNode;
      newIndices = Array.from((updated.metadata?.meshData as IMeshData).indices!);
      expect(newIndices).toEqual(origIndices);
    });

    it('executes "subdivide" quadrupling face count', async () => {
      const node = createQuadMeshNode('subdiv-node');
      store.getState().addNode(node);

      const cmd = new MeshOperationCommand({
        nodeId: 'subdiv-node',
        operation: {
          type: 'subdivide',
          targetIndices: [],
          parameters: { iterations: 1 },
        },
      });

      await manager.execute(cmd, context);
      let updated = store.getState().getNodeById('subdiv-node') as MeshNode;
      let meshData = updated.metadata?.meshData as IMeshData;
      // 2 triangles subdivided 1 iteration -> 2 * 4 = 8 triangles (24 indices)
      expect(meshData.indices?.length).toBe(24);

      // Undo restores 2 triangles (6 indices)
      await manager.undo(context);
      updated = store.getState().getNodeById('subdiv-node') as MeshNode;
      meshData = updated.metadata?.meshData as IMeshData;
      expect(meshData.indices?.length).toBe(6);
    });

    it('executes "extrude" creating top face and side quad walls', async () => {
      const node = createQuadMeshNode('extrude-node');
      store.getState().addNode(node);

      const cmd = new MeshOperationCommand({
        nodeId: 'extrude-node',
        operation: {
          type: 'extrude',
          targetIndices: [0], // Extrude face 0
          parameters: { distance: 2.0 },
        },
      });

      await manager.execute(cmd, context);
      let updated = store.getState().getNodeById('extrude-node') as MeshNode;
      let meshData = updated.metadata?.meshData as IMeshData;
      const numVerts = (meshData.vertices as Float32Array).length / 3;
      // Original 4 vertices + 3 new extruded vertices for triangle 0 = 7 vertices
      expect(numVerts).toBe(7);

      // Undo restores original 4 vertices
      await manager.undo(context);
      updated = store.getState().getNodeById('extrude-node') as MeshNode;
      meshData = updated.metadata?.meshData as IMeshData;
      expect((meshData.vertices as Float32Array).length / 3).toBe(4);
    });

    it('executes "delete" faces removing triangles cleanly', async () => {
      const node = createQuadMeshNode('del-node');
      store.getState().addNode(node);

      const cmd = new MeshOperationCommand({
        nodeId: 'del-node',
        operation: {
          type: 'delete',
          targetIndices: [0], // Delete face 0
          parameters: { target: 'faces' },
        },
      });

      await manager.execute(cmd, context);
      let updated = store.getState().getNodeById('del-node') as MeshNode;
      let indices = (updated.metadata?.meshData as IMeshData).indices!;
      // Only face 1 remains (3 indices)
      expect(indices.length).toBe(3);

      await manager.undo(context);
      updated = store.getState().getNodeById('del-node') as MeshNode;
      indices = (updated.metadata?.meshData as IMeshData).indices!;
      expect(indices.length).toBe(6);
    });

    it('executes "merge" collapsing vertices to center point', async () => {
      const node = createQuadMeshNode('merge-node');
      store.getState().addNode(node);

      const cmd = new MeshOperationCommand({
        nodeId: 'merge-node',
        operation: {
          type: 'merge',
          targetIndices: [1, 2], // Merge vertices 1 and 2
          parameters: { type: 'center' },
        },
      });

      await manager.execute(cmd, context);
      let updated = store.getState().getNodeById('merge-node') as MeshNode;
      let meshData = updated.metadata?.meshData as IMeshData;
      // 4 vertices merged by 1 -> 3 vertices
      expect((meshData.vertices as Float32Array).length / 3).toBe(3);

      await manager.undo(context);
      updated = store.getState().getNodeById('merge-node') as MeshNode;
      meshData = updated.metadata?.meshData as IMeshData;
      expect((meshData.vertices as Float32Array).length / 3).toBe(4);
    });

    it('executes "smooth" Laplacian smoothing on selected vertices', async () => {
      const node = createQuadMeshNode('smooth-node');
      store.getState().addNode(node);

      const cmd = new MeshOperationCommand({
        nodeId: 'smooth-node',
        operation: {
          type: 'smooth',
          targetIndices: [1],
          parameters: { factor: 0.5 },
        },
      });

      await manager.execute(cmd, context);
      let updated = store.getState().getNodeById('smooth-node') as MeshNode;
      let verts = (updated.metadata?.meshData as IMeshData).vertices as Float32Array;
      // v1 at (1,0,0) smoothed towards its neighbors (0,0,0) and (1,1,0)
      expect(verts[3]).toBeLessThan(1.0); // x shifted towards average

      await manager.undo(context);
      updated = store.getState().getNodeById('smooth-node') as MeshNode;
      verts = (updated.metadata?.meshData as IMeshData).vertices as Float32Array;
      expect(verts[3]).toBeCloseTo(1.0);
    });
  });

  describe('TransformMeshElementsCommand', () => {
    it('translates selected vertices with delta and axisLock', async () => {
      const node = createQuadMeshNode('xform-node');
      store.getState().addNode(node);

      // Translate v0 and v1 with X-axis lock: only x should change
      const cmd = new TransformMeshElementsCommand({
        nodeId: 'xform-node',
        vertexIndices: [0, 1],
        translation: { x: 3.0, y: 5.0, z: 2.0 },
        axisLock: 'X',
      });

      await manager.execute(cmd, context);
      let updated = store.getState().getNodeById('xform-node') as MeshNode;
      let verts = (updated.metadata?.meshData as IMeshData).vertices as Float32Array;

      // v0: was (0, 0, 0) -> should be (3, 0, 0)
      expect(verts[0]).toBeCloseTo(3.0);
      expect(verts[1]).toBeCloseTo(0.0);
      expect(verts[2]).toBeCloseTo(0.0);

      // v1: was (1, 0, 0) -> should be (4, 0, 0)
      expect(verts[3]).toBeCloseTo(4.0);
      expect(verts[4]).toBeCloseTo(0.0);
      expect(verts[5]).toBeCloseTo(0.0);

      // v2: not transformed -> remains (1, 1, 0)
      expect(verts[6]).toBeCloseTo(1.0);
      expect(verts[7]).toBeCloseTo(1.0);

      // Undo restores initial positions
      await manager.undo(context);
      updated = store.getState().getNodeById('xform-node') as MeshNode;
      verts = (updated.metadata?.meshData as IMeshData).vertices as Float32Array;
      expect(verts[0]).toBeCloseTo(0.0);
      expect(verts[3]).toBeCloseTo(1.0);
    });

    it('scales selected vertices relative to their median point', async () => {
      const node = createQuadMeshNode('scale-node');
      store.getState().addNode(node);

      // v0 at (0,0,0) and v1 at (1,0,0). Median is (0.5, 0, 0).
      // Scale by 2 along X relative to median:
      // v0: 0.5 + (0 - 0.5)*2 = -0.5
      // v1: 0.5 + (1 - 0.5)*2 = 1.5
      const cmd = new TransformMeshElementsCommand({
        nodeId: 'scale-node',
        vertexIndices: [0, 1],
        scale: { x: 2.0, y: 1.0, z: 1.0 },
      });

      await manager.execute(cmd, context);
      let updated = store.getState().getNodeById('scale-node') as MeshNode;
      let verts = (updated.metadata?.meshData as IMeshData).vertices as Float32Array;

      expect(verts[0]).toBeCloseTo(-0.5);
      expect(verts[3]).toBeCloseTo(1.5);

      await manager.undo(context);
      updated = store.getState().getNodeById('scale-node') as MeshNode;
      verts = (updated.metadata?.meshData as IMeshData).vertices as Float32Array;
      expect(verts[0]).toBeCloseTo(0.0);
      expect(verts[3]).toBeCloseTo(1.0);
    });

    it('rotates selected vertices about origin', async () => {
      const node = createQuadMeshNode('rot-node');
      store.getState().addNode(node);

      // Rotate v1 at (1, 0, 0) by 90 degrees (PI/2 rad) about Z around origin (0, 0, 0)
      // (1, 0, 0) rotated by 90deg about Z -> (0, 1, 0)
      const cmd = new TransformMeshElementsCommand({
        nodeId: 'rot-node',
        vertexIndices: [1],
        rotation: { x: 0, y: 0, z: Math.PI / 2 },
        origin: { x: 0, y: 0, z: 0 },
      });

      await manager.execute(cmd, context);
      let updated = store.getState().getNodeById('rot-node') as MeshNode;
      let verts = (updated.metadata?.meshData as IMeshData).vertices as Float32Array;

      expect(verts[3]).toBeCloseTo(0.0);
      expect(verts[4]).toBeCloseTo(1.0);
      expect(verts[5]).toBeCloseTo(0.0);

      await manager.undo(context);
      updated = store.getState().getNodeById('rot-node') as MeshNode;
      verts = (updated.metadata?.meshData as IMeshData).vertices as Float32Array;
      expect(verts[3]).toBeCloseTo(1.0);
      expect(verts[4]).toBeCloseTo(0.0);
    });
  });

  describe('SelectMeshElementsCommand', () => {
    it('records and restores selection changes with undo/redo', async () => {
      const node = createQuadMeshNode('sel-cmd-node');
      store.getState().addNode(node);

      const beforeSel: EditMeshSelectionState = {
        elementModes: ['vertex'],
        selectedVertexIndices: [0, 1],
        selectedEdgeIndices: [],
        selectedFaceIndices: [],
        activeVertexIndex: 1,
        activeEdgeIndex: null,
        activeFaceIndex: null,
      };

      const afterSel: EditMeshSelectionState = {
        elementModes: ['vertex'],
        selectedVertexIndices: [2, 3],
        selectedEdgeIndices: [],
        selectedFaceIndices: [],
        activeVertexIndex: 3,
        activeEdgeIndex: null,
        activeFaceIndex: null,
      };

      const cmd = new SelectMeshElementsCommand({
        nodeId: 'sel-cmd-node',
        beforeSelection: beforeSel,
        afterSelection: afterSel,
      });

      await manager.execute(cmd, context);
      let updated = store.getState().getNodeById('sel-cmd-node') as MeshNode;
      expect(
        (updated.metadata?.editSelection as EditMeshSelectionState).selectedVertexIndices,
      ).toEqual([2, 3]);

      await manager.undo(context);
      updated = store.getState().getNodeById('sel-cmd-node') as MeshNode;
      expect(
        (updated.metadata?.editSelection as EditMeshSelectionState).selectedVertexIndices,
      ).toEqual([0, 1]);

      await manager.redo(context);
      updated = store.getState().getNodeById('sel-cmd-node') as MeshNode;
      expect(
        (updated.metadata?.editSelection as EditMeshSelectionState).selectedVertexIndices,
      ).toEqual([2, 3]);
    });
  });
});

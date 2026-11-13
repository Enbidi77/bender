import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createSceneStore, createSelectionStore, createMeshNode } from '@blender-elt/scene-core';
import { CommandManager } from '@blender-elt/commands';
import { EditViewportBridge, bufferGeometryToMeshData } from '../../src/edit/EditViewportBridge.js';

describe('EditViewportBridge', () => {
  let sceneStore: ReturnType<typeof createSceneStore>;
  let selectionStore: ReturnType<typeof createSelectionStore>;
  let commandManager: CommandManager;
  let sceneObjectsRef: { current: Map<string, THREE.Object3D> };
  let bridge: EditViewportBridge;

  let meshNodeId: string;
  let threeMesh: THREE.Mesh;
  let camera: THREE.PerspectiveCamera;
  const rect = { left: 0, top: 0, width: 800, height: 600 };

  beforeEach(() => {
    sceneStore = createSceneStore();
    selectionStore = createSelectionStore();
    commandManager = new CommandManager();
    sceneObjectsRef = { current: new Map() };

    // Setup Mesh node
    const node = createMeshNode('TestCube', 'cube');
    meshNodeId = node.id;
    sceneStore.getState().addNode(node);
    sceneStore.getState().select(meshNodeId);

    // Setup Three.js mesh
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    threeMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    threeMesh.position.set(0, 0, 0);
    threeMesh.updateMatrixWorld(true);
    sceneObjectsRef.current.set(meshNodeId, threeMesh);

    camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    bridge = new EditViewportBridge({
      sceneStore,
      selectionStore,
      sceneObjectsRef,
      commandManager,
    });
  });

  it('synchronizes active mesh and builds MeshTopology from geometry', () => {
    const mesh = bridge.syncActiveMesh();
    expect(mesh).toBe(threeMesh);
    expect(bridge.getActiveNodeId()).toBe(meshNodeId);

    const topology = bridge.getTopology();
    expect(topology).not.toBeNull();
    expect(topology?.vertices.length).toBeGreaterThan(0);
    expect(topology?.edges.length).toBeGreaterThan(0);
    expect(topology?.faces.length).toBeGreaterThan(0);
  });

  it('updates real-time hover element and clears hover state', () => {
    bridge.syncActiveMesh();
    selectionStore.getState().setEditElementModes(['face']);

    let notified = false;
    bridge.subscribe(() => {
      notified = true;
    });

    // Hover over center of screen (hits front face)
    const hit = bridge.updateHover(400, 300, rect, camera);
    expect(hit).not.toBeNull();
    expect(bridge.getHoverState().hoveredFaceIndex).not.toBeNull();
    expect(notified).toBe(true);

    // Clear hover
    bridge.clearHover();
    expect(bridge.getHoverState().hoveredFaceIndex).toBeNull();
    expect(bridge.getHoverState().hoveredVertexIndex).toBeNull();
  });

  it('handles single click selection and shift+click multi-selection', () => {
    bridge.syncActiveMesh();
    selectionStore.getState().setEditElementModes(['vertex']);

    const topology = bridge.getTopology()!;
    const v0 = topology.vertices[0];
    const proj = bridge.getRaycaster().projectLocalPoint(v0.position, threeMesh, camera, rect);

    // Single click select
    bridge.selectElementAt(proj.screenX, proj.screenY, rect, camera, false);
    expect(selectionStore.getState().editSelection.selectedVertexIndices).toContain(v0.index);

    // Click outside deselects
    bridge.selectElementAt(10, 10, rect, camera, false);
    expect(selectionStore.getState().editSelection.selectedVertexIndices.length).toBe(0);

    // Re-select v0
    bridge.selectElementAt(proj.screenX, proj.screenY, rect, camera, false);
    // Shift-click another vertex
    const v1 = topology.vertices[1];
    const proj1 = bridge.getRaycaster().projectLocalPoint(v1.position, threeMesh, camera, rect);
    bridge.selectElementAt(proj1.screenX, proj1.screenY, rect, camera, true);

    const sel = selectionStore.getState().editSelection.selectedVertexIndices;
    expect(sel).toContain(v0.index);
    expect(sel).toContain(v1.index);
  });

  it('supports selectAll, deselectAll, and invertSelection', () => {
    bridge.syncActiveMesh();
    selectionStore.getState().setEditElementModes(['vertex']);

    // Select All
    bridge.selectAll();
    const allCount = bridge.getTopology()!.vertices.length;
    expect(selectionStore.getState().editSelection.selectedVertexIndices.length).toBe(allCount);

    // Deselect All
    bridge.deselectAll();
    expect(selectionStore.getState().editSelection.selectedVertexIndices.length).toBe(0);

    // Select one vertex then Invert
    selectionStore.getState().selectVertices([0], 'set');
    bridge.invertSelection();
    expect(selectionStore.getState().editSelection.selectedVertexIndices.length).toBe(allCount - 1);
    expect(selectionStore.getState().editSelection.selectedVertexIndices).not.toContain(0);
  });

  it('synchronizes buffer geometry in-place and recalculates bounds on vertex translation', () => {
    bridge.syncActiveMesh();
    selectionStore.getState().setEditElementModes(['vertex']);
    selectionStore.getState().selectVertices([0], 'set');

    const oldPos = threeMesh.geometry.getAttribute('position').getY(0);

    bridge.translateSelected({ x: 0, y: 1.5, z: 0 });

    const newPos = threeMesh.geometry.getAttribute('position').getY(0);
    expect(newPos).toBeCloseTo(oldPos + 1.5, 4);

    expect(threeMesh.geometry.boundingBox).not.toBeNull();
    expect(threeMesh.geometry.boundingSphere).not.toBeNull();
  });

  it('commits undoable topology change via CommandManager and supports undo/redo', async () => {
    bridge.syncActiveMesh();
    selectionStore.getState().setEditElementModes(['face']);
    selectionStore.getState().selectFaces([0], 'set');

    const initialFaceCount = bridge.getTopology()!.faces.length;

    await bridge.extrudeSelected(1.0);

    const extrudeFaceCount = bridge.getTopology()!.faces.length;
    expect(extrudeFaceCount).toBeGreaterThan(initialFaceCount);

    // Undo via CommandManager
    await commandManager.undo({
      state: sceneStore.getState(),
      dispatch: () => {},
    });

    expect(bridge.getTopology()!.faces.length).toBe(initialFaceCount);

    // Redo via CommandManager
    await commandManager.redo({
      state: sceneStore.getState(),
      dispatch: () => {},
    });

    expect(bridge.getTopology()!.faces.length).toBe(extrudeFaceCount);
  });

  it('converts BufferGeometry to IMeshData correctly', () => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex([0, 1, 2]);

    const data = bufferGeometryToMeshData(geo);
    expect(data.vertices.length).toBe(9);
    expect(data.indices?.length).toBe(3);
  });
});

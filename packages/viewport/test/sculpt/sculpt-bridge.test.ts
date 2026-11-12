import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { createSceneStore, createMeshNode } from '@blender-elt/scene-core';
import { CommandManager } from '@blender-elt/commands';
import { SculptSession } from '@blender-elt/sculpting';
import { SculptViewportBridge } from '../../src/sculpt/SculptViewportBridge.js';

describe('SculptViewportBridge', () => {
  let sceneStore: ReturnType<typeof createSceneStore>;
  let commandManager: CommandManager;
  let sceneObjectsRef: { current: Map<string, THREE.Object3D> };
  let session: SculptSession;
  let bridge: SculptViewportBridge;

  beforeEach(() => {
    sceneStore = createSceneStore();
    commandManager = new CommandManager(10);
    sceneObjectsRef = { current: new Map() };
    session = new SculptSession();

    bridge = new SculptViewportBridge({
      sceneStore,
      sceneObjectsRef,
      commandManager,
      session,
    });
  });

  it('synchronizes active mesh from sceneStore selection and attaches to session', () => {
    const node = createMeshNode({ id: 'mesh-1', name: 'Sculpt Target' });
    sceneStore.getState().addNode(node);
    sceneStore.getState().select('mesh-1');

    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const threeMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    sceneObjectsRef.current.set('mesh-1', threeMesh);

    const activeMesh = bridge.syncActiveMesh();
    expect(activeMesh).toBe(threeMesh);
    expect(session.getNodeId()).toBe('mesh-1');
    expect(session.getBuffer()).not.toBeNull();
    expect(session.getBuffer()?.vertexCount).toBe(geometry.getAttribute('position').count);
  });

  it('detaches mesh when no node is selected', () => {
    const node = createMeshNode({ id: 'mesh-1' });
    sceneStore.getState().addNode(node);
    sceneStore.getState().select('mesh-1');

    const geometry = new THREE.SphereGeometry(1, 8, 8);
    const threeMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    sceneObjectsRef.current.set('mesh-1', threeMesh);

    bridge.syncActiveMesh();
    expect(session.getNodeId()).toBe('mesh-1');

    sceneStore.getState().deselectAll();
    bridge.syncActiveMesh();
    expect(session.getNodeId()).toBeNull();
    expect(bridge.getActiveMesh()).toBeNull();
  });

  it('updates cursor state and notifies listeners on raycast hit', () => {
    const node = createMeshNode({ id: 'mesh-1' });
    sceneStore.getState().addNode(node);
    sceneStore.getState().select('mesh-1');

    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const threeMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    threeMesh.updateMatrixWorld(true);
    sceneObjectsRef.current.set('mesh-1', threeMesh);
    bridge.syncActiveMesh();

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);

    const listener = vi.fn();
    const unsubscribe = bridge.subscribeCursor(listener);

    bridge.updateCursor(0, 0, camera);
    expect(listener).toHaveBeenCalled();

    const cursorState = bridge.getCursorState();
    expect(cursorState.hit).toBe(true);
    expect(cursorState.worldPoint.z).toBeCloseTo(1.0, 2);
    expect(cursorState.mesh).toBe(threeMesh);

    unsubscribe();
    bridge.clearCursor();
    expect(bridge.getCursorState().hit).toBe(false);
  });

  it('flushes dirty buffers in-place to mesh userData.updateSculptBuffers', () => {
    const node = createMeshNode({ id: 'mesh-1' });
    sceneStore.getState().addNode(node);
    sceneStore.getState().select('mesh-1');

    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const threeMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    const updateSpy = vi.fn();
    threeMesh.userData.updateSculptBuffers = updateSpy;

    sceneObjectsRef.current.set('mesh-1', threeMesh);
    bridge.syncActiveMesh();

    const buffer = session.getBuffer();
    expect(buffer).not.toBeNull();
    if (!buffer) return;

    // Mutate a vertex and mark dirty
    buffer.setVertex(0, 10, 20, 30);
    expect(buffer.hasDirty()).toBe(true);

    bridge.flushBufferToMesh();
    expect(updateSpy).toHaveBeenCalledWith(
      buffer.positions,
      buffer.normals,
      buffer.dirtyMinIndex,
      buffer.dirtyMaxIndex,
      buffer.masks,
    );
  });

  it('commits sculpt stroke to CommandManager and updates sceneStore metadata', async () => {
    const node = createMeshNode({ id: 'mesh-1' });
    sceneStore.getState().addNode(node);
    sceneStore.getState().select('mesh-1');

    const geometry = new THREE.BoxGeometry(2, 2, 2, 4, 4, 4);
    const threeMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    sceneObjectsRef.current.set('mesh-1', threeMesh);
    bridge.syncActiveMesh();

    const { sculptStore } = await import('@blender-elt/sculpting');
    sculptStore.getState().setRadius(1.5);

    // Start and modify a stroke
    session.beginStroke({
      point: { x: 0, y: 0, z: 1 },
      normal: { x: 0, y: 0, z: 1 },
      pressure: 1.0,
      timestamp: Date.now(),
    });

    session.updateStroke({
      point: { x: 0.1, y: 0, z: 1 },
      normal: { x: 0, y: 0, z: 1 },
      pressure: 1.0,
      timestamp: Date.now() + 16,
    });

    expect(commandManager.canUndo).toBe(false);

    await bridge.commitStroke();

    expect(commandManager.canUndo).toBe(true);
    const updatedNode = sceneStore.getState().nodes['mesh-1'];
    expect(updatedNode.metadata?.meshData).toBeDefined();
    expect(updatedNode.metadata?.sculptMask).toBeDefined();
  });
});

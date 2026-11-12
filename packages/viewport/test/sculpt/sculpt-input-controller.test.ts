import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { createSceneStore, createMeshNode } from '@blender-elt/scene-core';
import { CommandManager } from '@blender-elt/commands';
import { SculptSession } from '@blender-elt/sculpting';
import { SculptViewportBridge } from '../../src/sculpt/SculptViewportBridge.js';
import {
  SculptInputController,
  normalizePointerPressure,
} from '../../src/sculpt/SculptInputController.js';

describe('SculptInputController', () => {
  describe('normalizePointerPressure', () => {
    it('normalizes pen stylus pressure correctly', () => {
      const penHigh = { pointerType: 'pen', pressure: 0.8 } as PointerEvent;
      expect(normalizePointerPressure(penHigh)).toBeCloseTo(0.8);

      const penZero = { pointerType: 'pen', pressure: 0 } as PointerEvent;
      expect(normalizePointerPressure(penZero)).toBe(0.5);

      const penMax = { pointerType: 'pen', pressure: 1.5 } as PointerEvent;
      expect(normalizePointerPressure(penMax)).toBe(1.0);
    });

    it('normalizes touch pressure correctly', () => {
      const touchEv = { pointerType: 'touch', pressure: 0.6 } as PointerEvent;
      expect(normalizePointerPressure(touchEv)).toBeCloseTo(0.6);

      const touchZero = { pointerType: 'touch', pressure: 0 } as PointerEvent;
      expect(normalizePointerPressure(touchZero)).toBe(1.0);
    });

    it('defaults mouse pressure to 1.0 when unmeasured', () => {
      const mouseEv = { pointerType: 'mouse', pressure: 0 } as PointerEvent;
      expect(normalizePointerPressure(mouseEv)).toBe(1.0);

      const mousePressure = { pointerType: 'mouse', pressure: 0.75 } as PointerEvent;
      expect(normalizePointerPressure(mousePressure)).toBeCloseTo(0.75);
    });
  });

  describe('Pointer Event Handling & Stroke Lifecycle', () => {
    let sceneStore: ReturnType<typeof createSceneStore>;
    let commandManager: CommandManager;
    let sceneObjectsRef: { current: Map<string, THREE.Object3D> };
    let session: SculptSession;
    let bridge: SculptViewportBridge;
    let domElement: HTMLElement;
    let camera: THREE.PerspectiveCamera;
    let setStrokeActiveSpy: ReturnType<typeof vi.fn>;
    let controller: SculptInputController;

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

      // Target mesh
      const node = createMeshNode({ id: 'mesh-1' });
      sceneStore.getState().addNode(node);
      sceneStore.getState().select('mesh-1');

      const geometry = new THREE.BoxGeometry(2, 2, 2, 8, 8, 8);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
      mesh.updateMatrixWorld(true);
      sceneObjectsRef.current.set('mesh-1', mesh);
      bridge.syncActiveMesh();

      // Camera
      camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.set(0, 0, 5);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);

      // DOM Element mock
      domElement = {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 800,
          height: 600,
          right: 800,
          bottom: 600,
          x: 0,
          y: 0,
          toJSON: () => {},
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
      } as unknown as HTMLElement;

      setStrokeActiveSpy = vi.fn();

      controller = new SculptInputController({
        bridge,
        domElement,
        cameraGetter: () => camera,
        setIsSculptStrokeActive: setStrokeActiveSpy,
        getEnabled: () => true,
      });
    });

    it('attaches and detaches DOM event listeners cleanly', () => {
      expect(domElement.addEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(domElement.addEventListener).toHaveBeenCalledWith('pointermove', expect.any(Function));
      expect(domElement.addEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function));

      controller.detach();
      expect(domElement.removeEventListener).toHaveBeenCalledWith(
        'pointerdown',
        expect.any(Function),
      );
    });

    it('starts stroke on pointerdown hitting the mesh and sets stroke active', () => {
      // Center of 800x600 canvas hits the front of the box
      const downEvent = {
        button: 0,
        clientX: 400,
        clientY: 300,
        pointerId: 1,
        pointerType: 'mouse',
        pressure: 0.5,
        altKey: false,
      } as PointerEvent;

      controller.handlePointerDown(downEvent);

      expect(domElement.setPointerCapture).toHaveBeenCalledWith(1);
      expect(setStrokeActiveSpy).toHaveBeenCalledWith(true);
      expect(session.isStroking()).toBe(true);
    });

    it('ignores non-left click (middle/right button)', () => {
      const middleClick = {
        button: 1,
        clientX: 400,
        clientY: 300,
      } as PointerEvent;

      controller.handlePointerDown(middleClick);
      expect(session.isStroking()).toBe(false);
      expect(setStrokeActiveSpy).not.toHaveBeenCalled();
    });

    it('ignores Alt+Left click to preserve Blender camera navigation', () => {
      const altClick = {
        button: 0,
        altKey: true,
        clientX: 400,
        clientY: 300,
      } as PointerEvent;

      controller.handlePointerDown(altClick);
      expect(session.isStroking()).toBe(false);
      expect(setStrokeActiveSpy).not.toHaveBeenCalled();
    });

    it('dispatches stroke points on pointermove and completes on pointerup', async () => {
      const downEvent = {
        button: 0,
        clientX: 400,
        clientY: 300,
        pointerId: 1,
        pointerType: 'mouse',
        pressure: 1.0,
      } as PointerEvent;
      controller.handlePointerDown(downEvent);
      expect(session.isStroking()).toBe(true);

      const moveEvent = {
        clientX: 410,
        clientY: 310,
        pointerId: 1,
        pointerType: 'mouse',
        pressure: 0.8,
      } as PointerEvent;
      controller.handlePointerMove(moveEvent);

      const upEvent = {
        clientX: 410,
        clientY: 310,
        pointerId: 1,
      } as PointerEvent;
      controller.handlePointerUp(upEvent);

      expect(domElement.releasePointerCapture).toHaveBeenCalledWith(1);
      expect(setStrokeActiveSpy).toHaveBeenCalledWith(false);
      expect(session.isStroking()).toBe(false);

      // Wait for async command execution
      await new Promise((r) => setTimeout(r, 10));
      expect(commandManager.canUndo).toBe(true);
    });

    it('cancels stroke gracefully on pointercancel', () => {
      const downEvent = {
        button: 0,
        clientX: 400,
        clientY: 300,
        pointerId: 2,
        pointerType: 'mouse',
      } as PointerEvent;
      controller.handlePointerDown(downEvent);
      expect(session.isStroking()).toBe(true);

      const cancelEvent = {
        pointerId: 2,
      } as PointerEvent;
      controller.handlePointerCancel(cancelEvent);

      expect(session.isStroking()).toBe(false);
      expect(setStrokeActiveSpy).toHaveBeenCalledWith(false);
    });
  });
});

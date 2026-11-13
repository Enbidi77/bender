import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { createSceneStore, createSelectionStore, createMeshNode } from '@blender-elt/scene-core';
import { EditViewportBridge } from '../../src/edit/EditViewportBridge.js';
import { EditInputController } from '../../src/edit/EditInputController.js';
import type { ScreenBoxRect } from '../../src/edit/types.js';

describe('EditInputController', () => {
  let sceneStore: ReturnType<typeof createSceneStore>;
  let selectionStore: ReturnType<typeof createSelectionStore>;
  let sceneObjectsRef: { current: Map<string, THREE.Object3D> };
  let bridge: EditViewportBridge;
  let controller: EditInputController;
  let domElement: HTMLElement;
  let camera: THREE.PerspectiveCamera;
  let marqueeEvents: (ScreenBoxRect | null)[] = [];

  beforeEach(() => {
    if (typeof globalThis.window === 'undefined') {
      const target = new EventTarget();
      (target as any).innerWidth = 800;
      (target as any).innerHeight = 600;
      globalThis.window = target as any;
    }

    sceneStore = createSceneStore();
    selectionStore = createSelectionStore();
    sceneObjectsRef = { current: new Map() };

    const node = createMeshNode({ name: 'TestMesh', primitiveType: 'cube' });
    sceneStore.getState().addNode(node);
    sceneStore.getState().select(node.id);

    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    sceneObjectsRef.current.set(node.id, mesh);

    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 5);

    bridge = new EditViewportBridge({
      sceneStore,
      selectionStore,
      sceneObjectsRef,
    });
    bridge.syncActiveMesh();

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

    marqueeEvents = [];

    controller = new EditInputController({
      bridge,
      domElement,
      cameraGetter: () => camera,
      getEnabled: () => true,
      onMarqueeChange: (rect) => marqueeEvents.push(rect),
    });
  });

  afterEach(() => {
    controller.detach();
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

  it('triggers element click selection on pointer down and up without drag', () => {
    const selectSpy = vi.spyOn(bridge, 'selectElementAt');

    const downEvent = {
      button: 0,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
    } as PointerEvent;
    controller.handlePointerDown(downEvent);

    const upEvent = {
      button: 0,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
      shiftKey: false,
    } as PointerEvent;
    controller.handlePointerUp(upEvent);

    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(selectSpy).toHaveBeenCalledWith(400, 300, expect.anything(), camera, false);
  });

  it('triggers box marquee selection when pointer is dragged past threshold', () => {
    const boxSelectSpy = vi.spyOn(bridge, 'boxSelect');

    // Pointer down at 100, 100
    controller.handlePointerDown({
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    } as PointerEvent);

    // Pointer move to 300, 300 (distance = 282px > 4px threshold)
    controller.handlePointerMove({
      clientX: 300,
      clientY: 300,
    } as PointerEvent);

    expect(marqueeEvents.length).toBeGreaterThan(0);
    const lastMarquee = marqueeEvents[marqueeEvents.length - 1];
    expect(lastMarquee?.active).toBe(true);
    expect(lastMarquee?.x1).toBe(100);
    expect(lastMarquee?.x2).toBe(300);

    // Pointer up commits box select
    controller.handlePointerUp({
      button: 0,
      clientX: 300,
      clientY: 300,
      pointerId: 1,
      shiftKey: false,
    } as PointerEvent);

    expect(boxSelectSpy).toHaveBeenCalledTimes(1);
    expect(boxSelectSpy).toHaveBeenCalledWith(
      { x1: 100, y1: 100, x2: 300, y2: 300 },
      expect.anything(),
      camera,
      'set',
    );
  });

  it('enters interactive modal session, toggles axis lock, accepts numeric input, and commits', () => {
    controller.enterModal('translate');
    expect(controller.getModalState().active).toBe(true);
    expect(controller.getModalState().type).toBe('translate');

    // Press 'X' for X-axis lock
    controller.handleKeyDown({
      code: 'KeyX',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);
    expect(controller.getModalState().axisLock).toBe('X');

    // Type '2', '.', '5'
    controller.handleKeyDown({ key: '2', preventDefault: vi.fn() } as unknown as KeyboardEvent);
    controller.handleKeyDown({ key: '.', preventDefault: vi.fn() } as unknown as KeyboardEvent);
    controller.handleKeyDown({ key: '5', preventDefault: vi.fn() } as unknown as KeyboardEvent);
    expect(controller.getModalState().numericInput).toBe('2.5');

    // Backspace
    controller.handleKeyDown({
      code: 'Backspace',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent);
    expect(controller.getModalState().numericInput).toBe('2.');

    // Enter commits modal
    const commitSpy = vi.spyOn(bridge, 'commitTopologyChange');
    controller.handleKeyDown({
      code: 'Enter',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(controller.getModalState().active).toBe(false);
    expect(commitSpy).toHaveBeenCalled();
  });

  it('cancels modal session on Escape or Right-Click reverting mutations', () => {
    controller.enterModal('extrude');
    expect(controller.getModalState().active).toBe(true);

    const cancelSpy = vi.spyOn(bridge, 'cancelMutation');

    // Escape cancels modal
    controller.handleKeyDown({
      code: 'Escape',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent);
    expect(controller.getModalState().active).toBe(false);
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });

  it('listens to custom window edit events and triggers corresponding bridge actions', () => {
    const extrudeSpy = vi.spyOn(controller, 'enterModal');
    const insetSpy = vi.spyOn(bridge, 'insetSelected');
    const bevelSpy = vi.spyOn(bridge, 'bevelSelected');
    const deleteSpy = vi.spyOn(bridge, 'deleteSelected');
    const selectAllSpy = vi.spyOn(bridge, 'selectAll');

    window.dispatchEvent(new CustomEvent('blender-elt:edit-extrude'));
    expect(extrudeSpy).toHaveBeenCalledWith('extrude');

    window.dispatchEvent(new CustomEvent('blender-elt:edit-inset'));
    expect(insetSpy).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new CustomEvent('blender-elt:edit-bevel'));
    expect(bevelSpy).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new CustomEvent('blender-elt:edit-delete'));
    expect(deleteSpy).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new CustomEvent('blender-elt:edit-select-all'));
    expect(selectAllSpy).toHaveBeenCalledTimes(1);
  });
});

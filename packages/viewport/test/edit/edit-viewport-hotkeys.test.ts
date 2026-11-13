import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSceneStore,
  createSelectionStore,
  createMeshNode,
  createLightNode,
} from '@blender-elt/scene-core';
import {
  handleViewportHotkeyEvent,
  type ViewportHotkeyHandlerContext,
} from '../../src/hooks/useViewportHotkeys.js';
import type { ViewportConfig } from '../../src/types.js';

describe('handleViewportHotkeyEvent in Edit Mode', () => {
  let sceneStore: ReturnType<typeof createSceneStore>;
  let selectionStore: ReturnType<typeof createSelectionStore>;
  let config: ViewportConfig;
  let setMode: ReturnType<typeof vi.fn>;
  let setGizmoType: ReturnType<typeof vi.fn>;
  let setShadingMode: ReturnType<typeof vi.fn>;
  let setAxisLock: ReturnType<typeof vi.fn>;
  let toggleAxisLock: ReturnType<typeof vi.fn>;
  let focusSelection: ReturnType<typeof vi.fn>;
  let setStandardViewpoint: ReturnType<typeof vi.fn>;
  let toggleCameraProjection: ReturnType<typeof vi.fn>;
  let toggleSnapping: ReturnType<typeof vi.fn>;

  let ctx: ViewportHotkeyHandlerContext;

  beforeEach(() => {
    if (typeof globalThis.window === 'undefined') {
      const target = new EventTarget();
      (target as any).innerWidth = 800;
      (target as any).innerHeight = 600;
      globalThis.window = target as any;
    }

    sceneStore = createSceneStore();
    selectionStore = createSelectionStore();
    config = {
      mode: 'object',
      gizmoType: 'translate',
      transformSpace: 'world',
      shadingMode: 'solid',
      grid: {
        visible: true,
        size: 20,
        divisions: 20,
        colorCenterLine: '#444444',
        colorGrid: '#282828',
        showAxes: true,
      },
      showWireframeOverlay: false,
      showNormalsOverlay: false,
      showFloor: true,
    };

    setMode = vi.fn((m) => {
      config.mode = m;
    });
    setGizmoType = vi.fn();
    setShadingMode = vi.fn();
    setAxisLock = vi.fn();
    toggleAxisLock = vi.fn();
    focusSelection = vi.fn();
    setStandardViewpoint = vi.fn();
    toggleCameraProjection = vi.fn();
    toggleSnapping = vi.fn();

    ctx = {
      config,
      sceneStore,
      selectionStore,
      setMode,
      setGizmoType,
      setShadingMode,
      axisLock: null,
      setAxisLock,
      toggleAxisLock,
      focusSelection,
      setStandardViewpoint,
      toggleCameraProjection,
      toggleSnapping,
    };
  });

  it('toggles mode from object to edit when active mesh is selected, and back on Tab', () => {
    const meshNode = createMeshNode({ name: 'CubeMesh', primitiveType: 'cube' });
    sceneStore.getState().addNode(meshNode);
    sceneStore.getState().select(meshNode.id);

    // Tab in Object mode -> switches to 'edit'
    const ev1 = {
      code: 'Tab',
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;

    const handled1 = handleViewportHotkeyEvent(ev1, ctx);
    expect(handled1).toBe(true);
    expect(setMode).toHaveBeenCalledWith('edit');

    // Tab in Edit mode -> switches to 'object'
    ctx.config.mode = 'edit';
    const ev2 = { ...ev1, preventDefault: vi.fn() } as unknown as KeyboardEvent;
    const handled2 = handleViewportHotkeyEvent(ev2, ctx);
    expect(handled2).toBe(true);
    expect(setMode).toHaveBeenCalledWith('object');
  });

  it('does not switch to edit mode on Tab if active node is not a mesh', () => {
    const lightNode = createLightNode({ name: 'SunLight', lightType: 'directional' });
    sceneStore.getState().addNode(lightNode);
    sceneStore.getState().select(lightNode.id);

    const ev = {
      code: 'Tab',
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;

    handleViewportHotkeyEvent(ev, ctx);
    expect(setMode).not.toHaveBeenCalled();
  });

  it('switches element selection modes with 1, 2, and 3 keys in edit mode', () => {
    ctx.config.mode = 'edit';

    // Press '2' -> Edge selection mode
    handleViewportHotkeyEvent(
      {
        code: 'Digit2',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
      ctx,
    );
    expect(selectionStore.getState().editSelection.elementModes).toEqual(['edge']);

    // Press '3' -> Face selection mode
    handleViewportHotkeyEvent(
      {
        code: 'Digit3',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
      ctx,
    );
    expect(selectionStore.getState().editSelection.elementModes).toEqual(['face']);

    // Press '1' -> Vertex selection mode
    handleViewportHotkeyEvent(
      {
        code: 'Digit1',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
      ctx,
    );
    expect(selectionStore.getState().editSelection.elementModes).toEqual(['vertex']);

    // Press Shift + '2' -> Toggles Edge mode (now ['vertex', 'edge'])
    handleViewportHotkeyEvent(
      {
        code: 'Digit2',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: true,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
      ctx,
    );
    expect(selectionStore.getState().editSelection.elementModes).toContain('vertex');
    expect(selectionStore.getState().editSelection.elementModes).toContain('edge');
  });

  it('dispatches edit operations on hotkeys E, I, Ctrl+B, Ctrl+R, K, Delete', () => {
    ctx.config.mode = 'edit';

    const extrudeHandler = vi.fn();
    const insetHandler = vi.fn();
    const bevelHandler = vi.fn();
    const loopCutHandler = vi.fn();
    const knifeHandler = vi.fn();
    const deleteHandler = vi.fn();

    window.addEventListener('blender-elt:edit-extrude', extrudeHandler);
    window.addEventListener('blender-elt:edit-inset', insetHandler);
    window.addEventListener('blender-elt:edit-bevel', bevelHandler);
    window.addEventListener('blender-elt:edit-loopcut', loopCutHandler);
    window.addEventListener('blender-elt:edit-knife', knifeHandler);
    window.addEventListener('blender-elt:edit-delete', deleteHandler);

    // E: Extrude
    handleViewportHotkeyEvent(
      {
        code: 'KeyE',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
      ctx,
    );
    expect(extrudeHandler).toHaveBeenCalledTimes(1);

    // I: Inset
    handleViewportHotkeyEvent(
      {
        code: 'KeyI',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
      ctx,
    );
    expect(insetHandler).toHaveBeenCalledTimes(1);

    // Ctrl+B: Bevel
    handleViewportHotkeyEvent(
      {
        code: 'KeyB',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
      ctx,
    );
    expect(bevelHandler).toHaveBeenCalledTimes(1);

    // Ctrl+R: Loop Cut
    handleViewportHotkeyEvent(
      {
        code: 'KeyR',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
      ctx,
    );
    expect(loopCutHandler).toHaveBeenCalledTimes(1);

    // K: Knife
    handleViewportHotkeyEvent(
      {
        code: 'KeyK',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
      ctx,
    );
    expect(knifeHandler).toHaveBeenCalledTimes(1);

    // Delete
    handleViewportHotkeyEvent(
      {
        code: 'Delete',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
      ctx,
    );
    expect(deleteHandler).toHaveBeenCalledTimes(1);

    window.removeEventListener('blender-elt:edit-extrude', extrudeHandler);
    window.removeEventListener('blender-elt:edit-inset', insetHandler);
    window.removeEventListener('blender-elt:edit-bevel', bevelHandler);
    window.removeEventListener('blender-elt:edit-loopcut', loopCutHandler);
    window.removeEventListener('blender-elt:edit-knife', knifeHandler);
    window.removeEventListener('blender-elt:edit-delete', deleteHandler);
  });

  it('selects and deselects all edit elements on A and Alt+A in edit mode', () => {
    ctx.config.mode = 'edit';
    const selectAllHandler = vi.fn();
    window.addEventListener('blender-elt:edit-select-all', selectAllHandler);

    selectionStore.getState().selectVertices([0, 1], 'set');

    // 'KeyA' in edit mode -> dispatches 'blender-elt:edit-select-all'
    handleViewportHotkeyEvent(
      {
        code: 'KeyA',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
      ctx,
    );
    expect(selectAllHandler).toHaveBeenCalledTimes(1);

    // 'Alt+A' in edit mode -> deselects all edit elements
    handleViewportHotkeyEvent(
      {
        code: 'KeyA',
        ctrlKey: false,
        metaKey: false,
        altKey: true,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
      ctx,
    );
    expect(selectionStore.getState().editSelection.selectedVertexIndices.length).toBe(0);

    window.removeEventListener('blender-elt:edit-select-all', selectAllHandler);
  });

  it('sets gizmo type and dispatches modal transform on G, R, S in edit mode', () => {
    ctx.config.mode = 'edit';
    const modalHandler = vi.fn();
    window.addEventListener('blender-elt:edit-modal-transform', modalHandler);

    // G: Translate
    handleViewportHotkeyEvent(
      {
        code: 'KeyG',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
      ctx,
    );
    expect(setGizmoType).toHaveBeenCalledWith('translate');
    expect(modalHandler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { type: 'translate' } }),
    );

    // R: Rotate
    handleViewportHotkeyEvent(
      {
        code: 'KeyR',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
      ctx,
    );
    expect(setGizmoType).toHaveBeenCalledWith('rotate');
    expect(modalHandler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { type: 'rotate' } }),
    );

    // S: Scale
    handleViewportHotkeyEvent(
      {
        code: 'KeyS',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
      ctx,
    );
    expect(setGizmoType).toHaveBeenCalledWith('scale');
    expect(modalHandler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { type: 'scale' } }),
    );

    window.removeEventListener('blender-elt:edit-modal-transform', modalHandler);
  });
});

import { useEffect, useRef } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import type { SculptBrushType } from '@blender-elt/contracts';
import { sculptStore } from '@blender-elt/sculpting';
import type { SceneGraphState, SelectionStoreState } from '@blender-elt/scene-core';
import { useViewportContext } from '../context/ViewportContext.js';
import { useCameraControls } from './useCameraControls.js';
import type {
  ViewportState,
  ViewportMode,
  GizmoType,
  ShadingMode,
  AxisLock,
  StandardViewpoint,
} from '../types.js';

export interface ViewportHotkeyHandlerContext {
  config: ViewportState['config'];
  sceneStore: StoreApi<SceneGraphState>;
  selectionStore: StoreApi<SelectionStoreState>;
  setMode: (mode: ViewportMode) => void;
  setGizmoType: (type: GizmoType) => void;
  setShadingMode: (mode: ShadingMode) => void;
  axisLock: AxisLock;
  setAxisLock: (axis: AxisLock) => void;
  toggleAxisLock: (axis: 'X' | 'Y' | 'Z') => void;
  focusSelection: () => void;
  setStandardViewpoint: (view: StandardViewpoint) => void;
  toggleCameraProjection: () => void;
  toggleSnapping: () => void;
}

/**
 * Pure handler for Viewport keyboard hotkeys
 */
export function handleViewportHotkeyEvent(
  e: KeyboardEvent,
  ctx: ViewportHotkeyHandlerContext,
): boolean {
  // Ignore if user is focused on an input element
  const target = e.target as HTMLElement | null;
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)
  ) {
    return false;
  }

  const {
    config,
    sceneStore,
    selectionStore,
    setMode,
    setGizmoType,
    setShadingMode,
    axisLock,
    setAxisLock,
    toggleAxisLock,
    focusSelection,
    setStandardViewpoint,
    toggleCameraProjection,
    toggleSnapping,
  } = ctx;

  const code = e.code;
  const key = e.key ? e.key.toLowerCase() : '';
  const isEditMode = config.mode === 'edit';
  const hasActiveNode = Boolean(sceneStore.getState().activeNodeId);
  const isTransformActive = config.gizmoType !== 'none' && hasActiveNode;

  // 1. Edit Mode Hotkeys
  if (isEditMode) {
    // 1: Vertex selection mode
    if (code === 'Digit1' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (e.shiftKey) {
        selectionStore.getState().toggleEditElementMode('vertex');
      } else {
        selectionStore.getState().setEditElementModes(['vertex']);
      }
      return true;
    }

    // 2: Edge selection mode
    if (code === 'Digit2' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (e.shiftKey) {
        selectionStore.getState().toggleEditElementMode('edge');
      } else {
        selectionStore.getState().setEditElementModes(['edge']);
      }
      return true;
    }

    // 3: Face selection mode
    if (code === 'Digit3' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (e.shiftKey) {
        selectionStore.getState().toggleEditElementMode('face');
      } else {
        selectionStore.getState().setEditElementModes(['face']);
      }
      return true;
    }

    // E: Extrude selected elements
    if (code === 'KeyE' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('blender-elt:edit-extrude'));
      }
      return true;
    }

    // I: Inset selected faces
    if (code === 'KeyI' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('blender-elt:edit-inset'));
      }
      return true;
    }

    // Ctrl+B: Bevel selected edges/vertices
    if (code === 'KeyB' && (e.ctrlKey || e.metaKey) && !e.altKey) {
      e.preventDefault();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('blender-elt:edit-bevel'));
      }
      return true;
    }

    // Ctrl+R: Loop cut preview and commit
    if (code === 'KeyR' && (e.ctrlKey || e.metaKey) && !e.altKey) {
      e.preventDefault();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('blender-elt:edit-loopcut'));
      }
      return true;
    }

    // K: Knife tool activation and cutting
    if (code === 'KeyK' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('blender-elt:edit-knife'));
      }
      return true;
    }

    // X or Delete: Delete action/prompt
    if (
      (code === 'KeyX' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTransformActive) ||
      code === 'Delete'
    ) {
      e.preventDefault();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('blender-elt:edit-delete'));
      }
      return true;
    }
  }

  // Mode toggle: Tab key (toggle between 'object' and 'edit' mode on active mesh)
  if (code === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    if (config.mode === 'edit') {
      setMode('object');
    } else {
      const activeNodeId = sceneStore.getState().activeNodeId;
      if (activeNodeId) {
        const node = sceneStore.getState().getNodeById(activeNodeId);
        if (node && node.type === 'mesh') {
          setMode('edit');
        }
      }
    }
    return true;
  }

  // A: Select All, Alt+A: Deselect All
  if (code === 'KeyA' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (e.altKey) {
      if (isEditMode) {
        selectionStore.getState().deselectAllEditElements();
      } else {
        sceneStore.getState().deselectAll();
      }
    } else {
      if (isEditMode) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('blender-elt:edit-select-all'));
        }
      } else {
        const allNodeIds = Object.keys(sceneStore.getState().nodes);
        sceneStore.getState().selectMultiple(allNodeIds);
        selectionStore.getState().selectMultipleObjects(allNodeIds);
      }
    }
    return true;
  }

  // Standard Blender Navigation & Gizmo Hotkeys
  if (code === 'KeyG' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    setGizmoType('translate');
    if (isEditMode && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('blender-elt:edit-modal-transform', {
          detail: { type: 'translate' },
        }),
      );
    }
    return true;
  } else if (code === 'KeyR' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    setGizmoType('rotate');
    if (isEditMode && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('blender-elt:edit-modal-transform', {
          detail: { type: 'rotate' },
        }),
      );
    }
    return true;
  } else if (code === 'KeyS' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    setGizmoType('scale');
    if (isEditMode && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('blender-elt:edit-modal-transform', {
          detail: { type: 'scale' },
        }),
      );
    }
    return true;
  }

  // Axis Locking hotkeys (X, Y, Z) to constrain transformations
  if (code === 'KeyX' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
    if (isTransformActive) {
      e.preventDefault();
      toggleAxisLock('X');
      return true;
    }
  } else if (code === 'KeyY' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
    if (isTransformActive) {
      e.preventDefault();
      toggleAxisLock('Y');
      return true;
    }
  } else if (code === 'KeyZ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.shiftKey) {
      e.preventDefault();
      setShadingMode(config.shadingMode === 'wireframe' ? 'solid' : 'wireframe');
      return true;
    } else if (isTransformActive) {
      e.preventDefault();
      toggleAxisLock('Z');
      return true;
    } else {
      e.preventDefault();
      setShadingMode(config.shadingMode === 'wireframe' ? 'solid' : 'wireframe');
      return true;
    }
  }

  // Escape clears axis constraint
  if (code === 'Escape') {
    if (axisLock !== null) {
      e.preventDefault();
      setAxisLock(null);
      return true;
    }
  }

  // Camera framing: F (in non-sculpt mode) or Numpad Decimal or Period
  if (config.mode !== 'sculpt' && code === 'KeyF') {
    e.preventDefault();
    focusSelection();
    return true;
  } else if (code === 'NumpadDecimal' || key === '.') {
    e.preventDefault();
    focusSelection();
    return true;
  }

  // Snapping toggle: Shift + Tab
  if (code === 'Tab' && e.shiftKey) {
    e.preventDefault();
    toggleSnapping();
    return true;
  }

  // Standard viewpoints via Numpad
  if (code === 'Numpad1' || (code === 'Digit1' && e.altKey)) {
    e.preventDefault();
    setStandardViewpoint(e.ctrlKey ? 'back' : 'front');
    return true;
  } else if (code === 'Numpad3' || (code === 'Digit3' && e.altKey)) {
    e.preventDefault();
    setStandardViewpoint(e.ctrlKey ? 'left' : 'right');
    return true;
  } else if (code === 'Numpad7' || (code === 'Digit7' && e.altKey)) {
    e.preventDefault();
    setStandardViewpoint(e.ctrlKey ? 'bottom' : 'top');
    return true;
  } else if (code === 'Numpad5' || (code === 'Digit5' && e.altKey)) {
    e.preventDefault();
    toggleCameraProjection();
    return true;
  } else if (code === 'Numpad0' || (code === 'Digit0' && e.altKey)) {
    e.preventDefault();
    setStandardViewpoint('camera');
    return true;
  }

  return false;
}

export function useViewportHotkeys(enabled = true) {
  const {
    setGizmoType,
    setShadingMode,
    config,
    setMode,
    toggleCameraProjection,
    toggleSnapping,
    axisLock,
    setAxisLock,
    toggleAxisLock,
    sceneStore,
    selectionStore,
    setIsSculptModalActive,
  } = useViewportContext();

  const { focusSelection, setStandardViewpoint } = useCameraControls();

  // Refs for tracking temporary sculpt hotkey state across keydown/keyup
  const previousBrushRef = useRef<SculptBrushType | null>(null);
  const wasCtrlInvertedRef = useRef<boolean>(false);
  const activeModalCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const isSculptMode = config.mode === 'sculpt';

    const enterModalAdjustment = (mode: 'radius' | 'strength', startClientX: number) => {
      // Clean up any existing modal handler first
      if (activeModalCleanupRef.current) {
        activeModalCleanupRef.current();
      }

      setIsSculptModalActive(true, mode);

      const state = sculptStore.getState();
      const currentBrush = state.brushConfigs[state.activeBrush];
      const initialRadius = currentBrush.radius;
      const initialStrength = currentBrush.strength;

      const handleModalPointerMove = (moveEvent: PointerEvent | MouseEvent) => {
        const deltaX = moveEvent.clientX - startClientX;
        if (mode === 'radius') {
          // Adjust radius: scale by sensitivity relative to start
          const sensitivity = 0.005;
          const newRadius = Math.max(0.001, initialRadius + deltaX * sensitivity);
          state.setRadius(newRadius);
        } else {
          // Adjust strength: 0.0 to 1.0
          const sensitivity = 0.003;
          const newStrength = Math.max(0.0, Math.min(1.0, initialStrength + deltaX * sensitivity));
          state.setStrength(newStrength);
        }
      };

      const cleanupModal = (commit: boolean) => {
        window.removeEventListener('pointermove', handleModalPointerMove);
        window.removeEventListener('pointerdown', handleModalPointerDown, true);
        window.removeEventListener('keydown', handleModalKeyDown, true);

        if (!commit) {
          // Revert to initial values on cancel
          if (mode === 'radius') {
            state.setRadius(initialRadius);
          } else {
            state.setStrength(initialStrength);
          }
        }

        setIsSculptModalActive(false, null);
        activeModalCleanupRef.current = null;
      };

      const handleModalPointerDown = (downEvent: PointerEvent | MouseEvent) => {
        downEvent.preventDefault();
        downEvent.stopPropagation();
        // Left click commits, right click cancels
        cleanupModal(downEvent.button === 0);
      };

      const handleModalKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.code === 'Escape') {
          keyEvent.preventDefault();
          keyEvent.stopPropagation();
          cleanupModal(false);
        } else if (keyEvent.code === 'Enter' || keyEvent.code === 'Space') {
          keyEvent.preventDefault();
          keyEvent.stopPropagation();
          cleanupModal(true);
        }
      };

      window.addEventListener('pointermove', handleModalPointerMove);
      window.addEventListener('pointerdown', handleModalPointerDown, true);
      window.addEventListener('keydown', handleModalKeyDown, true);

      activeModalCleanupRef.current = () => cleanupModal(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is focused on an input element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const code = e.code;

      // 1. Sculpt Mode Hotkeys
      if (isSculptMode) {
        // Hold Shift: temporarily switch active brush to Smooth
        if (code === 'ShiftLeft' || code === 'ShiftRight' || e.key === 'Shift') {
          if (!previousBrushRef.current && !e.repeat) {
            const currentBrush = sculptStore.getState().activeBrush;
            if (currentBrush !== 'smooth') {
              previousBrushRef.current = currentBrush;
              sculptStore.getState().setActiveBrush('smooth');
            }
          }
        }

        // Hold Ctrl: inverts brush stroke direction (add <-> subtract)
        if (code === 'ControlLeft' || code === 'ControlRight' || e.key === 'Control') {
          if (!wasCtrlInvertedRef.current && !e.repeat) {
            wasCtrlInvertedRef.current = true;
            sculptStore.getState().toggleDirection();
          }
        }

        // 'F' modal brush adjustment: 'Shift+F' = strength, 'F' = radius
        if (code === 'KeyF' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          const startX = window.innerWidth / 2;
          if (e.shiftKey) {
            enterModalAdjustment('strength', startX);
          } else {
            enterModalAdjustment('radius', startX);
          }
          return;
        }
      }

      handleViewportHotkeyEvent(e, {
        config,
        sceneStore,
        selectionStore,
        setMode,
        setGizmoType,
        setShadingMode,
        axisLock,
        setAxisLock,
        toggleAxisLock,
        focusSelection,
        setStandardViewpoint,
        toggleCameraProjection,
        toggleSnapping,
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;

      if (isSculptMode) {
        // Release Shift: restore previously active brush
        if (code === 'ShiftLeft' || code === 'ShiftRight' || e.key === 'Shift') {
          if (previousBrushRef.current) {
            sculptStore.getState().setActiveBrush(previousBrushRef.current);
            previousBrushRef.current = null;
          }
        }

        // Release Ctrl: restore previous direction
        if (code === 'ControlLeft' || code === 'ControlRight' || e.key === 'Control') {
          if (wasCtrlInvertedRef.current) {
            sculptStore.getState().toggleDirection();
            wasCtrlInvertedRef.current = false;
          }
        }
      }
    };

    const handleWindowBlur = () => {
      // Revert temporary modifiers if window loses focus
      if (previousBrushRef.current) {
        sculptStore.getState().setActiveBrush(previousBrushRef.current);
        previousBrushRef.current = null;
      }
      if (wasCtrlInvertedRef.current) {
        sculptStore.getState().toggleDirection();
        wasCtrlInvertedRef.current = false;
      }
      if (activeModalCleanupRef.current) {
        activeModalCleanupRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);

      if (activeModalCleanupRef.current) {
        activeModalCleanupRef.current();
      }
      if (previousBrushRef.current) {
        sculptStore.getState().setActiveBrush(previousBrushRef.current);
        previousBrushRef.current = null;
      }
      if (wasCtrlInvertedRef.current) {
        sculptStore.getState().toggleDirection();
        wasCtrlInvertedRef.current = false;
      }
    };
  }, [
    enabled,
    config.mode,
    config.shadingMode,
    config.gizmoType,
    axisLock,
    setMode,
    setGizmoType,
    setShadingMode,
    setAxisLock,
    toggleAxisLock,
    sceneStore,
    selectionStore,
    focusSelection,
    setStandardViewpoint,
    toggleCameraProjection,
    toggleSnapping,
    setIsSculptModalActive,
  ]);
}

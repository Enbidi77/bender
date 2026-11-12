import { useEffect, useRef } from 'react';
import type { SculptBrushType } from '@blender-elt/contracts';
import { sculptStore } from '@blender-elt/sculpting';
import { useViewportContext } from '../context/ViewportContext.js';
import { useCameraControls } from './useCameraControls.js';

export function useViewportHotkeys(enabled = true) {
  const {
    setGizmoType,
    setShadingMode,
    config,
    toggleCameraProjection,
    toggleSnapping,
    axisLock,
    setAxisLock,
    toggleAxisLock,
    sceneStore,
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
      const key = e.key.toLowerCase();
      const hasActiveNode = Boolean(sceneStore.getState().activeNodeId);
      const isTransformActive = config.gizmoType !== 'none' && hasActiveNode;

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

      // 2. Standard Blender Navigation & Gizmo Hotkeys
      if (code === 'KeyG' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setGizmoType('translate');
      } else if (code === 'KeyR' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setGizmoType('rotate');
      } else if (code === 'KeyS' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setGizmoType('scale');
      }

      // Axis Locking hotkeys (X, Y, Z) to constrain transformations
      if (code === 'KeyX' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (isTransformActive) {
          e.preventDefault();
          toggleAxisLock('X');
        }
      } else if (code === 'KeyY' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (isTransformActive) {
          e.preventDefault();
          toggleAxisLock('Y');
        }
      } else if (code === 'KeyZ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.shiftKey) {
          e.preventDefault();
          setShadingMode(config.shadingMode === 'wireframe' ? 'solid' : 'wireframe');
        } else if (isTransformActive) {
          e.preventDefault();
          toggleAxisLock('Z');
        } else {
          e.preventDefault();
          setShadingMode(config.shadingMode === 'wireframe' ? 'solid' : 'wireframe');
        }
      }

      // Escape clears axis constraint
      if (code === 'Escape') {
        if (axisLock !== null) {
          e.preventDefault();
          setAxisLock(null);
        }
      }

      // Camera framing: F (in non-sculpt mode) or Numpad Decimal or Period
      if (!isSculptMode && code === 'KeyF') {
        e.preventDefault();
        focusSelection();
      } else if (code === 'NumpadDecimal' || key === '.') {
        e.preventDefault();
        focusSelection();
      }

      // Snapping toggle: Shift + Tab
      if (code === 'Tab' && e.shiftKey) {
        e.preventDefault();
        toggleSnapping();
      }

      // Standard viewpoints via Numpad
      if (code === 'Numpad1' || (code === 'Digit1' && e.altKey)) {
        e.preventDefault();
        setStandardViewpoint(e.ctrlKey ? 'back' : 'front');
      } else if (code === 'Numpad3' || (code === 'Digit3' && e.altKey)) {
        e.preventDefault();
        setStandardViewpoint(e.ctrlKey ? 'left' : 'right');
      } else if (code === 'Numpad7' || (code === 'Digit7' && e.altKey)) {
        e.preventDefault();
        setStandardViewpoint(e.ctrlKey ? 'bottom' : 'top');
      } else if (code === 'Numpad5' || (code === 'Digit5' && e.altKey)) {
        e.preventDefault();
        toggleCameraProjection();
      } else if (code === 'Numpad0' || (code === 'Digit0' && e.altKey)) {
        e.preventDefault();
        setStandardViewpoint('camera');
      }
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
    setGizmoType,
    setShadingMode,
    setAxisLock,
    toggleAxisLock,
    sceneStore,
    focusSelection,
    setStandardViewpoint,
    toggleCameraProjection,
    toggleSnapping,
    setIsSculptModalActive,
  ]);
}

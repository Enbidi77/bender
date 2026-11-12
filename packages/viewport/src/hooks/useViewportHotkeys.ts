import { useEffect } from 'react';
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
  } = useViewportContext();

  const { focusSelection, setStandardViewpoint } = useCameraControls();

  useEffect(() => {
    if (!enabled) return;

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

      // Check standard Blender navigation & manipulation hotkeys
      const code = e.code;
      const key = e.key.toLowerCase();
      const hasActiveNode = Boolean(sceneStore.getState().activeNodeId);
      const isTransformActive = config.gizmoType !== 'none' && hasActiveNode;

      // Gizmo transformations
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

      // Camera framing: F or Numpad Decimal or Period
      if (code === 'KeyF' || code === 'NumpadDecimal' || key === '.') {
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

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    enabled,
    setGizmoType,
    setShadingMode,
    config.shadingMode,
    config.gizmoType,
    axisLock,
    setAxisLock,
    toggleAxisLock,
    sceneStore,
    focusSelection,
    setStandardViewpoint,
    toggleCameraProjection,
    toggleSnapping,
  ]);
}

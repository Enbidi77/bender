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

      // Wireframe toggle via Z (Shift+Z or Z toggle)
      if (code === 'KeyZ' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShadingMode(config.shadingMode === 'wireframe' ? 'solid' : 'wireframe');
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
    focusSelection,
    setStandardViewpoint,
    toggleCameraProjection,
    toggleSnapping,
  ]);
}

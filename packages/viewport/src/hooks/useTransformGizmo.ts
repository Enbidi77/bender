import { useCallback } from 'react';
import { useViewportContext } from '../context/ViewportContext.js';

export function useTransformGizmo() {
  const {
    config,
    setGizmoType,
    setTransformSpace,
    snapConfig,
    setSnapConfig,
    toggleSnapping,
    isGizmoDragging,
  } = useViewportContext();

  const setTranslateMode = useCallback(() => setGizmoType('translate'), [setGizmoType]);
  const setRotateMode = useCallback(() => setGizmoType('rotate'), [setGizmoType]);
  const setScaleMode = useCallback(() => setGizmoType('scale'), [setGizmoType]);
  const setSelectMode = useCallback(() => setGizmoType('none'), [setGizmoType]);

  const toggleSpace = useCallback(() => {
    setTransformSpace(config.transformSpace === 'world' ? 'local' : 'world');
  }, [config.transformSpace, setTransformSpace]);

  const setTranslationSnap = useCallback(
    (step: number) => setSnapConfig({ translationSnap: step }),
    [setSnapConfig],
  );

  const setRotationSnapDegrees = useCallback(
    (deg: number) => setSnapConfig({ rotationSnap: (deg * Math.PI) / 180 }),
    [setSnapConfig],
  );

  return {
    gizmoType: config.gizmoType,
    transformSpace: config.transformSpace,
    snapConfig,
    isGizmoDragging,
    setGizmoType,
    setTransformSpace,
    setTranslateMode,
    setRotateMode,
    setScaleMode,
    setSelectMode,
    toggleSpace,
    toggleSnapping,
    setSnapConfig,
    setTranslationSnap,
    setRotationSnapDegrees,
  };
}

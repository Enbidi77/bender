import React, { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useViewportContext, type OrbitControlsInstance } from '../context/ViewportContext.js';

export const NavigationControls: React.FC = () => {
  const { orbitControlsRef, isGizmoDragging, isSculptStrokeActive, isSculptModalActive } =
    useViewportContext();
  const controlsRef = useRef<OrbitControlsInstance | null>(null);

  useEffect(() => {
    if (controlsRef.current) {
      orbitControlsRef.current = controlsRef.current;
    }
    return () => {
      orbitControlsRef.current = null;
    };
  }, [orbitControlsRef]);

  // Suppress OrbitControls while transform gizmo is dragged, an active sculpt stroke is in progress,
  // or interactive modal radius/strength hotkey adjustment is active.
  const isNavigationEnabled = !isGizmoDragging && !isSculptStrokeActive && !isSculptModalActive;

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={isNavigationEnabled}
      enableDamping
      dampingFactor={0.08}
      screenSpacePanning
      minDistance={0.1}
      maxDistance={2000}
    />
  );
};

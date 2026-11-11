import React, { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useViewportContext, type OrbitControlsInstance } from '../context/ViewportContext.js';

export const NavigationControls: React.FC = () => {
  const { orbitControlsRef, isGizmoDragging } = useViewportContext();
  const controlsRef = useRef<OrbitControlsInstance | null>(null);

  useEffect(() => {
    if (controlsRef.current) {
      orbitControlsRef.current = controlsRef.current;
    }
    return () => {
      orbitControlsRef.current = null;
    };
  }, [orbitControlsRef]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={!isGizmoDragging}
      enableDamping
      dampingFactor={0.08}
      screenSpacePanning
      minDistance={0.1}
      maxDistance={2000}
    />
  );
};

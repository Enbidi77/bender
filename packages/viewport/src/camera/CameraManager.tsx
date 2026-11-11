import React, { useEffect, useRef } from 'react';
import { PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useViewportContext } from '../context/ViewportContext.js';

export const CameraManager: React.FC = () => {
  const { cameraProjection, cameraRef } = useViewportContext();
  const { camera, set } = useThree();

  const perspCamRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orthoCamRef = useRef<THREE.OrthographicCamera | null>(null);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera, cameraRef]);

  // When switching projection, preserve position and target
  useEffect(() => {
    if (cameraProjection === 'perspective' && perspCamRef.current) {
      if (orthoCamRef.current) {
        perspCamRef.current.position.copy(orthoCamRef.current.position);
        perspCamRef.current.rotation.copy(orthoCamRef.current.rotation);
        perspCamRef.current.up.copy(orthoCamRef.current.up);
      }
      set({ camera: perspCamRef.current });
      cameraRef.current = perspCamRef.current;
    } else if (cameraProjection === 'orthographic' && orthoCamRef.current) {
      if (perspCamRef.current) {
        orthoCamRef.current.position.copy(perspCamRef.current.position);
        orthoCamRef.current.rotation.copy(perspCamRef.current.rotation);
        orthoCamRef.current.up.copy(perspCamRef.current.up);
      }
      set({ camera: orthoCamRef.current });
      cameraRef.current = orthoCamRef.current;
    }
  }, [cameraProjection, set, cameraRef]);

  return (
    <>
      <PerspectiveCamera
        ref={perspCamRef}
        makeDefault={cameraProjection === 'perspective'}
        fov={50}
        near={0.1}
        far={1000}
        position={[7.35889, 4.95831, 6.92579]}
      />
      <OrthographicCamera
        ref={orthoCamRef}
        makeDefault={cameraProjection === 'orthographic'}
        zoom={60}
        near={-1000}
        far={1000}
        position={[7.35889, 4.95831, 6.92579]}
      />
    </>
  );
};

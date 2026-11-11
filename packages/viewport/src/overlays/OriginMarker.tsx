import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useViewportContext } from '../context/ViewportContext.js';

export const OriginMarker: React.FC = () => {
  const { config } = useViewportContext();

  const ringGeo = useMemo(() => {
    return new THREE.RingGeometry(0.18, 0.22, 32);
  }, []);

  if (!config.showFloor) {
    return null;
  }

  return (
    <group position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={ringGeo}>
        <meshBasicMaterial color="#ffffff" opacity={0.6} transparent depthTest={false} />
      </mesh>
    </group>
  );
};

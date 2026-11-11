import React from 'react';
import { useViewportContext } from '../context/ViewportContext.js';
import { StudioLighting } from './StudioLighting.js';

export const ViewportLighting: React.FC = () => {
  const { config } = useViewportContext();
  const { shadingMode } = config;

  switch (shadingMode) {
    case 'wireframe':
      return <ambientLight intensity={0.8} color="#ffffff" />;

    case 'solid':
      return <StudioLighting />;

    case 'material':
      return (
        <group name="material-preview-lighting">
          <ambientLight intensity={0.7} color="#ffffff" />
          <directionalLight position={[5, 10, 7]} intensity={1.5} color="#ffffff" />
          <directionalLight position={[-5, 5, -5]} intensity={0.8} color="#94a3b8" />
          <directionalLight position={[0, -5, 5]} intensity={0.3} color="#64748b" />
          <hemisphereLight args={['#ffffff', '#334155', 0.6]} />
        </group>
      );

    case 'rendered':
      return (
        <group name="rendered-mode-lighting">
          {/* Subtle global ambient so unlit regions aren't pure black */}
          <ambientLight intensity={0.15} color="#ffffff" />
        </group>
      );

    default:
      return <StudioLighting />;
  }
};

import React from 'react';
import { Grid } from '@react-three/drei';
import { useViewportContext } from '../context/ViewportContext.js';

export const GridFloor: React.FC = () => {
  const { config } = useViewportContext();
  const { grid, showFloor } = config;

  if (!showFloor || !grid.visible) {
    return null;
  }

  return (
    <group position={[0, -0.001, 0]}>
      <Grid
        args={[grid.size, grid.size]}
        cellSize={1}
        cellThickness={0.7}
        cellColor={grid.colorGrid}
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor={grid.colorCenterLine}
        fadeDistance={grid.fadeDistance ?? 45}
        fadeStrength={1.5}
        infiniteGrid
      />
    </group>
  );
};

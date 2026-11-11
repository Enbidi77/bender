import React, { useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useViewportContext } from './context/ViewportContext.js';
import { CameraManager } from './camera/CameraManager.js';
import { NavigationControls } from './camera/NavigationControls.js';
import { ViewportLighting } from './lighting/ViewportLighting.js';
import { GridFloor } from './overlays/GridFloor.js';
import { CoordinateAxes } from './overlays/CoordinateAxes.js';
import { OriginMarker } from './overlays/OriginMarker.js';
import { SceneRenderer } from './renderer/SceneRenderer.js';
import { SelectionHighlight } from './gizmos/SelectionHighlight.js';
import { TransformGizmo } from './gizmos/TransformGizmo.js';

export const ViewportCanvas: React.FC = () => {
  const { config, sceneStore } = useViewportContext();

  const handlePointerMissed = useCallback(() => {
    // Clicking empty space in the 3D viewport deselects all objects
    sceneStore.getState().deselectAll();
  }, [sceneStore]);

  return (
    <Canvas
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      }}
      shadows={config.shadingMode === 'rendered'}
      onPointerMissed={handlePointerMissed}
      className="w-full h-full block"
      onCreated={({ gl, scene }) => {
        scene.background = new THREE.Color('#1d1e22');
        gl.toneMapping =
          config.shadingMode === 'rendered' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
        gl.toneMappingExposure = 1.0;
      }}
    >
      {/* Cameras and Navigation */}
      <CameraManager />
      <NavigationControls />

      {/* Shading mode dynamic lighting */}
      <ViewportLighting />

      {/* Overlays */}
      <GridFloor />
      <CoordinateAxes />
      <OriginMarker />

      {/* Scene Graph Objects */}
      <SceneRenderer />

      {/* Selection outline and transform gizmo */}
      <SelectionHighlight />
      <TransformGizmo />
    </Canvas>
  );
};

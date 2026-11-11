import { useCallback } from 'react';
import * as THREE from 'three';
import { useViewportContext } from '../context/ViewportContext.js';
import type { StandardViewpoint } from '../types.js';
import { VIEWPOINT_CONFIGS } from '../constants.js';

export function useCameraControls() {
  const {
    orbitControlsRef,
    cameraRef,
    sceneStore,
    cameraProjection,
    setCameraProjection,
    toggleCameraProjection,
    activeViewpoint,
    setActiveViewpoint,
    focusOnNode,
    focusOnBox,
  } = useViewportContext();

  /**
   * Focus camera onto currently selected object or specific node
   */
  const focusSelection = useCallback(
    (nodeId?: string | null) => {
      focusOnNode(nodeId);
    },
    [focusOnNode],
  );

  /**
   * Set one of standard camera views (Front, Right, Top, etc.)
   */
  const setStandardViewpoint = useCallback(
    (viewpoint: StandardViewpoint) => {
      const controls = orbitControlsRef.current;
      const camera = cameraRef.current;
      if (!controls || !camera) return;

      setActiveViewpoint(viewpoint);
      const target = controls.target.clone();

      if (viewpoint === 'camera') {
        // Look through the first camera node in the scene, or active camera node
        const state = sceneStore.getState();
        const nodes = Object.values(state.nodes);
        const cameraNode =
          state.activeNodeId && state.nodes[state.activeNodeId]?.type === 'camera'
            ? state.nodes[state.activeNodeId]
            : nodes.find((n) => n.type === 'camera');

        if (cameraNode) {
          const pos = cameraNode.transform.position;
          const rot = cameraNode.transform.rotation;
          camera.position.set(pos.x, pos.y, pos.z);
          camera.rotation.set(rot.x, rot.y, rot.z, rot.order ?? 'XYZ');

          // Direction forward in right-handed Three.js is -Z
          const forward = new THREE.Vector3(0, 0, -1).applyEuler(
            new THREE.Euler(rot.x, rot.y, rot.z, rot.order ?? 'XYZ'),
          );
          controls.target.copy(camera.position).addScaledVector(forward, 10);
          controls.update();
          return;
        }
      }

      const preset = VIEWPOINT_CONFIGS[viewpoint];
      if (!preset) return;

      // Maintain current distance to target
      const currentDist = Math.max(camera.position.distanceTo(target), 5);
      const dir = new THREE.Vector3(...preset.position).normalize();

      camera.position.copy(target).addScaledVector(dir, currentDist);
      if (preset.up) {
        camera.up.set(...preset.up);
      } else {
        camera.up.set(0, 1, 0);
      }

      if (preset.isOrtho !== undefined) {
        setCameraProjection(preset.isOrtho ? 'orthographic' : 'perspective');
      }

      controls.update();
    },
    [orbitControlsRef, cameraRef, sceneStore, setActiveViewpoint, setCameraProjection],
  );

  /**
   * Reset camera to default perspective view
   */
  const resetCamera = useCallback(() => {
    const controls = orbitControlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;

    controls.target.set(0, 0, 0);
    camera.position.set(7.35889, 4.95831, 6.92579);
    camera.up.set(0, 1, 0);
    setCameraProjection('perspective');
    setActiveViewpoint('perspective');
    controls.update();
  }, [orbitControlsRef, cameraRef, setCameraProjection, setActiveViewpoint]);

  return {
    cameraProjection,
    activeViewpoint,
    focusSelection,
    focusOnBox,
    setStandardViewpoint,
    resetCamera,
    toggleCameraProjection,
  };
}

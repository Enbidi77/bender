import React, { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useViewportContext } from '../context/ViewportContext.js';
import { EditViewportBridge } from './EditViewportBridge.js';
import { EditInputController } from './EditInputController.js';
import { EditOverlays } from './EditOverlays.js';

export interface EditViewportLayerProps {
  bridge?: EditViewportBridge;
}

/**
 * EditViewportLayer
 * Interactive layer mounted in ViewportCanvas. Active when config.mode === 'edit'.
 * Bridges scene mesh data, sub-element selection, pointer/marquee picking,
 * and renders point cloud/wireframe/face overlays.
 */
export const EditViewportLayer: React.FC<EditViewportLayerProps> = ({ bridge: externalBridge }) => {
  const { gl, camera } = useThree();
  const { sceneStore, selectionStore, sceneObjectsRef, commandManager, config } =
    useViewportContext();

  const internalBridge = useMemo(
    () =>
      new EditViewportBridge({
        sceneStore,
        selectionStore,
        sceneObjectsRef,
        commandManager,
      }),
    [sceneStore, selectionStore, sceneObjectsRef, commandManager],
  );

  const bridge = externalBridge ?? internalBridge;

  // Synchronize active mesh target on each render
  useEffect(() => {
    if (config.mode === 'edit') {
      bridge.syncActiveMesh();
    }
  });

  // Attach EditInputController to Canvas DOM element
  useEffect(() => {
    const controller = new EditInputController({
      bridge,
      domElement: gl.domElement,
      cameraGetter: () => camera,
      getEnabled: () => config.mode === 'edit',
    });

    return () => {
      controller.detach();
    };
  }, [bridge, gl.domElement, camera, config.mode]);

  if (config.mode !== 'edit') {
    return null;
  }

  return <EditOverlays bridge={bridge} showNormals={config.showNormalsOverlay} />;
};

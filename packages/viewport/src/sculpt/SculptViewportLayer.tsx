import React, { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useViewportContext } from '../context/ViewportContext.js';
import { SculptViewportBridge } from './SculptViewportBridge.js';
import { SculptInputController } from './SculptInputController.js';
import { BrushCursor } from './BrushCursor.js';

export interface SculptViewportLayerProps {
  bridge?: SculptViewportBridge;
}

export const SculptViewportLayer: React.FC<SculptViewportLayerProps> = ({
  bridge: externalBridge,
}) => {
  const { gl, camera } = useThree();
  const { sceneStore, sceneObjectsRef, commandManager, config, setIsSculptStrokeActive } =
    useViewportContext();

  const internalBridge = useMemo(
    () =>
      new SculptViewportBridge({
        sceneStore,
        sceneObjectsRef,
        commandManager,
      }),
    [sceneStore, sceneObjectsRef, commandManager],
  );

  const bridge = externalBridge ?? internalBridge;

  // Synchronize active sculpt target mesh on each render/selection change
  useEffect(() => {
    bridge.syncActiveMesh();
  });

  // Attach SculptInputController to WebGL Canvas DOM element
  useEffect(() => {
    const controller = new SculptInputController({
      bridge,
      domElement: gl.domElement,
      cameraGetter: () => camera,
      setIsSculptStrokeActive,
      getEnabled: () => config.mode === 'sculpt',
    });

    return () => {
      controller.detach();
    };
  }, [bridge, gl.domElement, camera, setIsSculptStrokeActive, config.mode]);

  return <BrushCursor bridge={bridge} />;
};

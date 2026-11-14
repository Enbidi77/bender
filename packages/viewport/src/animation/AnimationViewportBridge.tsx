import React from 'react';
import { useAnimationSync, type UseAnimationSyncOptions } from './useAnimationSync.js';

export interface AnimationViewportBridgeProps extends UseAnimationSyncOptions {
  children?: React.ReactNode;
}

/**
 * R3F component that synchronizes timelineStore frame evaluation to 3D scene objects and sceneStore.
 * Mounts inside ViewportCanvas.
 */
export const AnimationViewportBridge: React.FC<AnimationViewportBridgeProps> = ({
  timelineStore,
  syncSceneStore,
  children,
}) => {
  useAnimationSync({
    timelineStore,
    syncSceneStore,
  });

  return <>{children ?? null}</>;
};

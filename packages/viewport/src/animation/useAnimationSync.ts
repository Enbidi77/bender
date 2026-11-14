import { useEffect, useRef, useCallback } from 'react';
import {
  type TimelineStore,
  type TimelineState,
  timelineStore as defaultTimelineStore,
  evaluateNodeTransform,
} from '@blender-elt/animation';
import type { AnimationTrack, IAnimationAction, Vector3, Euler } from '@blender-elt/contracts';
import { useViewportContext } from '../context/ViewportContext.js';

export interface UseAnimationSyncOptions {
  timelineStore?: TimelineStore;
  syncSceneStore?: boolean;
}

/**
 * Extracts and consolidates all active animation channels/tracks for each target node from TimelineState
 */
export function getActiveChannelsForNode(
  timelineState: TimelineState,
  nodeId: string,
): AnimationTrack[] {
  const tracks: AnimationTrack[] = [];

  // 1. Check active action channels
  if (timelineState.activeActionId && timelineState.actions[timelineState.activeActionId]) {
    const action = timelineState.actions[timelineState.activeActionId] as IAnimationAction;
    if (Array.isArray(action.channels)) {
      for (const chan of action.channels) {
        if (chan.targetNodeId === nodeId && !chan.muted) {
          tracks.push(chan as unknown as AnimationTrack);
        }
      }
    }
  }

  // 2. Check other actions in state
  for (const [actId, action] of Object.entries(timelineState.actions || {})) {
    if (actId === timelineState.activeActionId) continue;
    const animAction = action as IAnimationAction;
    if (Array.isArray(animAction.channels)) {
      for (const chan of animAction.channels) {
        if (chan.targetNodeId === nodeId && !chan.muted) {
          if (
            !tracks.some((t) => (t.propertyPath || t.property) === (chan.propertyPath || chan.name))
          ) {
            tracks.push(chan as unknown as AnimationTrack);
          }
        }
      }
    }
  }

  // 3. Check legacy tracks
  if (Array.isArray(timelineState.tracks)) {
    for (const track of timelineState.tracks) {
      if (track.targetNodeId === nodeId && !track.muted) {
        if (
          !tracks.some(
            (t) => (t.propertyPath || t.property) === (track.propertyPath || track.property),
          )
        ) {
          tracks.push(track);
        }
      }
    }
  }

  return tracks;
}

/**
 * Extracts all unique node IDs that have animation tracks/channels
 */
export function getAnimatedNodeIds(timelineState: TimelineState): string[] {
  const nodeIds = new Set<string>();

  if (timelineState.actions) {
    for (const action of Object.values(timelineState.actions)) {
      const animAction = action as IAnimationAction;
      if (animAction.targetNodeId) nodeIds.add(animAction.targetNodeId);
      if (Array.isArray(animAction.channels)) {
        for (const chan of animAction.channels) {
          if (chan.targetNodeId) nodeIds.add(chan.targetNodeId);
        }
      }
    }
  }

  if (Array.isArray(timelineState.tracks)) {
    for (const track of timelineState.tracks) {
      if (track.targetNodeId) nodeIds.add(track.targetNodeId);
    }
  }

  return Array.from(nodeIds);
}

/**
 * Hook to synchronize timelineStore playback / scrubbing with 3D scene objects and sceneStore
 */
export function useAnimationSync(options?: UseAnimationSyncOptions): {
  currentFrame: number;
  syncFrame: (frame: number) => void;
} {
  const { sceneStore, sceneObjectsRef } = useViewportContext();
  const store = options?.timelineStore ?? defaultTimelineStore;
  const syncSceneStore = options?.syncSceneStore ?? true;

  const lastEvaluatedFrameRef = useRef<number | null>(null);

  const syncFrame = useCallback(
    (frame: number) => {
      const state = store.getState();
      const nodeIds = getAnimatedNodeIds(state);

      for (const nodeId of nodeIds) {
        const tracks = getActiveChannelsForNode(state, nodeId);
        if (tracks.length === 0) continue;

        const evaluated = evaluateNodeTransform(tracks, nodeId, frame);
        const hasTransform = evaluated.position || evaluated.rotation || evaluated.scale;
        if (!hasTransform) continue;

        // 1. Update Three.js Object3D reference directly (for 60fps render)
        const threeObj = sceneObjectsRef?.current?.get(nodeId);
        if (threeObj) {
          if (evaluated.position) {
            if (evaluated.position.x !== undefined) threeObj.position.x = evaluated.position.x;
            if (evaluated.position.y !== undefined) threeObj.position.y = evaluated.position.y;
            if (evaluated.position.z !== undefined) threeObj.position.z = evaluated.position.z;
          }
          if (evaluated.rotation) {
            if (evaluated.rotation.x !== undefined) threeObj.rotation.x = evaluated.rotation.x;
            if (evaluated.rotation.y !== undefined) threeObj.rotation.y = evaluated.rotation.y;
            if (evaluated.rotation.z !== undefined) threeObj.rotation.z = evaluated.rotation.z;
          }
          if (evaluated.scale) {
            if (evaluated.scale.x !== undefined) threeObj.scale.x = evaluated.scale.x;
            if (evaluated.scale.y !== undefined) threeObj.scale.y = evaluated.scale.y;
            if (evaluated.scale.z !== undefined) threeObj.scale.z = evaluated.scale.z;
          }
          threeObj.updateMatrix();
          threeObj.updateMatrixWorld(true);
        }

        // 2. Update sceneStore state machine
        if (syncSceneStore && sceneStore) {
          const s = sceneStore.getState();
          const targetNode = s.nodes[nodeId];
          if (targetNode) {
            const partialTransform: {
              position?: Vector3;
              rotation?: Euler;
              scale?: Vector3;
            } = {};

            if (evaluated.position) {
              partialTransform.position = {
                x: evaluated.position.x ?? targetNode.transform.position.x,
                y: evaluated.position.y ?? targetNode.transform.position.y,
                z: evaluated.position.z ?? targetNode.transform.position.z,
              };
            }
            if (evaluated.rotation) {
              partialTransform.rotation = {
                x: evaluated.rotation.x ?? targetNode.transform.rotation.x,
                y: evaluated.rotation.y ?? targetNode.transform.rotation.y,
                z: evaluated.rotation.z ?? targetNode.transform.rotation.z,
                order: targetNode.transform.rotation.order ?? 'XYZ',
              };
            }
            if (evaluated.scale) {
              partialTransform.scale = {
                x: evaluated.scale.x ?? targetNode.transform.scale.x,
                y: evaluated.scale.y ?? targetNode.transform.scale.y,
                z: evaluated.scale.z ?? targetNode.transform.scale.z,
              };
            }

            if (typeof (s as any).updateNodeTransform === 'function') {
              (s as any).updateNodeTransform(nodeId, partialTransform);
            } else if (typeof s.setTransform === 'function') {
              s.setTransform(nodeId, partialTransform);
            }
          }
        }
      }

      lastEvaluatedFrameRef.current = frame;
    },
    [store, sceneStore, sceneObjectsRef, syncSceneStore],
  );

  // Subscribe to timelineStore state changes
  useEffect(() => {
    // Initial evaluation on mount
    syncFrame(store.getState().currentFrame);

    const unsubscribe = store.subscribe((state: TimelineState) => {
      syncFrame(state.currentFrame);
    });

    return () => {
      unsubscribe();
    };
  }, [store, syncFrame]);

  return {
    currentFrame: store.getState().currentFrame,
    syncFrame,
  };
}

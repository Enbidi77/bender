import type {
  AnimationTimeline,
  AnimationTrack,
  AnimationProperty,
  IKeyframe,
  KeyframeInterpolation,
  PlaybackState,
} from '@blender-elt/contracts';

export type {
  AnimationTimeline,
  AnimationTrack,
  AnimationProperty,
  IKeyframe,
  KeyframeInterpolation,
  PlaybackState,
};

export * from './interpolation.js';
export * from './tracks.js';
export * from './timeline-store.js';
export * from './playback-controller.js';

import { interpolateLinear } from './interpolation.js';

/**
 * Creates default AnimationTimeline structure for persistence or state
 */
export function createDefaultTimeline(): AnimationTimeline {
  return {
    currentFrame: 1,
    startFrame: 1,
    endFrame: 250,
    fps: 24,
    playbackState: 'stopped',
    isPlaying: false,
    loop: true,
    tracks: [],
  };
}

/**
 * Linearly interpolates between two numbers
 */
export function lerp(a: number, b: number, t: number): number {
  return interpolateLinear(a, b, t);
}

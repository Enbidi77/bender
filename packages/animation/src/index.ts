import type {
  AnimationProperty,
  AnimationPropertyPath,
  AnimationTimeline,
  AnimationTrack,
  BezierHandle,
  ExtrapolationMode,
  IActionGroup,
  IAnimationAction,
  IAnimationChannel,
  IAnimationConstraint,
  IBone,
  IBonePose,
  IConstraint,
  IFCurveModifier,
  IKeyframe,
  INLAStrip,
  INLATrack,
  IPoseChannel,
  IPoseState,
  KeyframeHandleType,
  KeyframeInterpolation,
  KeyframeType,
  PlaybackState,
} from '@blender-elt/contracts';

export type {
  AnimationProperty,
  AnimationPropertyPath,
  AnimationTimeline,
  AnimationTrack,
  BezierHandle,
  ExtrapolationMode,
  IActionGroup,
  IAnimationAction,
  IAnimationChannel,
  IAnimationConstraint,
  IBone,
  IBonePose,
  IConstraint,
  IFCurveModifier,
  IKeyframe,
  INLAStrip,
  INLATrack,
  IPoseChannel,
  IPoseState,
  KeyframeHandleType,
  KeyframeInterpolation,
  KeyframeType,
  PlaybackState,
};

export * from './interpolation.js';
export * from './bezier-evaluator.js';
export * from './extrapolation.js';
export * from './modifiers.js';
export * from './ik-solver.js';
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
    actions: {},
    activeActionId: undefined,
  };
}

/**
 * Linearly interpolates between two numbers
 */
export function lerp(a: number, b: number, t: number): number {
  return interpolateLinear(a, b, t);
}

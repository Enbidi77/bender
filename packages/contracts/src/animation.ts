/**
 * Interpolation curve types for keyframes
 */
export type KeyframeInterpolation =
  'linear' | 'bezier' | 'step' | 'ease-in' | 'ease-out' | 'ease-in-out';

/**
 * Single animation keyframe
 */
export interface IKeyframe<T = number | number[]> {
  frame: number;
  time: number; // in seconds
  value: T;
  interpolation?: KeyframeInterpolation;
  inTangent?: [number, number];
  outTangent?: [number, number];
}

/**
 * Animated property identifier
 */
export type AnimationProperty =
  | 'position.x'
  | 'position.y'
  | 'position.z'
  | 'rotation.x'
  | 'rotation.y'
  | 'rotation.z'
  | 'scale.x'
  | 'scale.y'
  | 'scale.z'
  | 'material.color'
  | 'material.roughness'
  | 'material.metalness'
  | string;

/**
 * Animation track targeting a node property
 */
export interface AnimationTrack {
  id: string;
  name: string;
  targetNodeId: string;
  property: AnimationProperty;
  keyframes: IKeyframe[];
  color?: string;
  muted?: boolean;
}

/**
 * Playback runtime state
 */
export type PlaybackState = 'playing' | 'paused' | 'stopped' | 'looping';

/**
 * Timeline and animation manager state
 */
export interface AnimationTimeline {
  currentFrame: number;
  startFrame: number;
  endFrame: number;
  fps: number;
  playbackState: PlaybackState;
  isPlaying: boolean;
  loop: boolean;
  tracks: AnimationTrack[];
}

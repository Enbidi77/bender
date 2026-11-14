import type { Vector3, Quaternion, Euler } from './scene.js';

/**
 * Interpolation curve types for keyframes
 */
export type KeyframeInterpolation =
  'constant' | 'linear' | 'bezier' | 'step' | 'ease-in' | 'ease-out' | 'ease-in-out';

/**
 * Bezier Tangent Handle Types (matching Blender)
 */
export type KeyframeHandleType = 'auto' | 'aligned' | 'vector' | 'free';

/**
 * Keyframe Semantic Types (for Dope Sheet visual styling)
 */
export type KeyframeType = 'keyframe' | 'breakdown' | 'extreme' | 'jitter';

/**
 * 2D Handle coordinate relative to keyframe (dt in frames, dv in value units)
 */
export interface BezierHandle {
  frame: number; // Time coordinate
  value: number; // Value coordinate
}

/**
 * Single animation keyframe
 */
export interface IKeyframe<T = number | number[]> {
  id?: string;
  frame: number;
  time: number; // in seconds
  value: T;
  interpolation?: KeyframeInterpolation;
  handleTypeLeft?: KeyframeHandleType;
  handleTypeRight?: KeyframeHandleType;
  handleLeft?: BezierHandle; // Incoming control point
  handleRight?: BezierHandle; // Outgoing control point
  keyframeType?: KeyframeType;
  selected?: boolean;
  handleLeftSelected?: boolean;
  handleRightSelected?: boolean;
  inTangent?: [number, number]; // legacy backward compatibility
  outTangent?: [number, number]; // legacy backward compatibility
}

/**
 * Curve extrapolation modes outside the first and last keyframe
 */
export type ExtrapolationMode = 'constant' | 'linear' | 'cyclic' | 'cyclic_offset';

/**
 * Animated property identifier
 */
export type AnimationProperty =
  | 'position'
  | 'position.x'
  | 'position.y'
  | 'position.z'
  | 'rotation'
  | 'rotation.x'
  | 'rotation.y'
  | 'rotation.z'
  | 'rotation.w'
  | 'scale'
  | 'scale.x'
  | 'scale.y'
  | 'scale.z'
  | 'material.color'
  | 'material.color.r'
  | 'material.color.g'
  | 'material.color.b'
  | 'material.roughness'
  | 'material.metalness'
  | 'material.opacity'
  | 'light.intensity'
  | 'light.color.r'
  | 'light.color.g'
  | 'light.color.b'
  | 'camera.fov'
  | string;

export type AnimationPropertyPath = AnimationProperty;

/**
 * F-Curve Modifier Types
 */
export type FCurveModifierType =
  'noise' | 'cycles' | 'limits' | 'stepped' | 'envelope' | 'generator';

export interface BaseFCurveModifier {
  id: string;
  type: FCurveModifierType;
  name: string;
  enabled: boolean;
  influence: number; // 0.0 to 1.0 blend
}

export interface NoiseFCurveModifier extends BaseFCurveModifier {
  type: 'noise';
  scale: number; // Frequency
  strength: number; // Amplitude
  phase: number; // Time offset
  depth: number; // Octaves
}

export interface CyclesFCurveModifier extends BaseFCurveModifier {
  type: 'cycles';
  modeBefore: 'repeat' | 'repeat_offset';
  countBefore: number; // 0 = infinite
  modeAfter: 'repeat' | 'repeat_offset';
  countAfter: number;
}

export interface LimitsFCurveModifier extends BaseFCurveModifier {
  type: 'limits';
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
}

export interface SteppedFCurveModifier extends BaseFCurveModifier {
  type: 'stepped';
  stepSize: number; // Hold values every N frames
  offset: number;
}

export interface EnvelopeFCurveModifier extends BaseFCurveModifier {
  type: 'envelope';
  min?: number;
  max?: number;
  referenceValue?: number;
}

export interface GeneratorFCurveModifier extends BaseFCurveModifier {
  type: 'generator';
  coefficients: number[]; // Polynomial: a0 + a1*x + a2*x^2 + ...
}

export type IFCurveModifier =
  | NoiseFCurveModifier
  | CyclesFCurveModifier
  | LimitsFCurveModifier
  | SteppedFCurveModifier
  | EnvelopeFCurveModifier
  | GeneratorFCurveModifier;

/**
 * F-Curve Animation Channel targeting a single scalar or vector property
 */
export interface IAnimationChannel {
  id: string;
  name: string;
  targetNodeId: string;
  propertyPath: AnimationPropertyPath;
  keyframes: IKeyframe[];
  interpolation: KeyframeInterpolation;
  extrapolation: ExtrapolationMode;
  color: string;
  muted?: boolean;
  locked?: boolean;
  modifiers?: IFCurveModifier[];
}

/**
 * Animation track targeting a node property (backward compatible with IAnimationChannel)
 */
export interface AnimationTrack {
  id: string;
  name: string;
  targetNodeId: string;
  property: AnimationProperty;
  propertyPath?: AnimationPropertyPath;
  keyframes: IKeyframe[];
  color?: string;
  muted?: boolean;
  locked?: boolean;
  interpolation?: KeyframeInterpolation;
  extrapolation?: ExtrapolationMode;
  modifiers?: IFCurveModifier[];
}

/**
 * Logical channel group within an action (e.g. "Transform", "LocRotScale")
 */
export interface IActionGroup {
  id: string;
  name: string;
  color?: string;
  channelIds: string[];
  isExpanded?: boolean;
}

/**
 * Animation Action / Clip container grouping multiple F-Curves / Channels
 */
export interface IAnimationAction {
  id: string;
  name: string;
  targetNodeId?: string;
  groups: IActionGroup[];
  channels: IAnimationChannel[];
  frameRange: [number, number];
  isLooping?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * NLA Strip representing an action instance on the non-linear timeline
 */
export interface INLAStrip {
  id: string;
  name: string;
  actionId: string;
  startFrame: number;
  endFrame: number;
  actionStartFrame: number;
  actionEndFrame: number;
  playbackSpeed: number; // 1.0 = normal
  repeatCount: number; // 1.0 = play once
  blendMode: 'replace' | 'add' | 'multiply';
  isMuted: boolean;
}

/**
 * NLA Track containing sequential or overlapping NLA strips
 */
export interface INLATrack {
  id: string;
  name: string;
  strips: INLAStrip[];
  isMuted: boolean;
  isSolo: boolean;
  isLocked: boolean;
}

/**
 * Constraint Types
 */
export type ConstraintType =
  | 'copy_location'
  | 'copy_rotation'
  | 'copy_scale'
  | 'copy_transforms'
  | 'look_at'
  | 'limit_location'
  | 'limit_rotation'
  | 'limit_distance'
  | 'ik'
  | 'inverse_kinematics';

export interface BaseConstraint {
  id: string;
  type: ConstraintType;
  name: string;
  enabled: boolean;
  influence: number; // 0.0 to 1.0
}

export interface CopyLocationConstraint extends BaseConstraint {
  type: 'copy_location';
  targetNodeId: string;
  subTarget?: string;
  copyX?: boolean;
  copyY?: boolean;
  copyZ?: boolean;
  invertX?: boolean;
  invertY?: boolean;
  invertZ?: boolean;
  space?: 'world' | 'local';
}

export interface CopyRotationConstraint extends BaseConstraint {
  type: 'copy_rotation';
  targetNodeId: string;
  subTarget?: string;
  copyX?: boolean;
  copyY?: boolean;
  copyZ?: boolean;
  invertX?: boolean;
  invertY?: boolean;
  invertZ?: boolean;
  space?: 'world' | 'local';
}

export interface CopyScaleConstraint extends BaseConstraint {
  type: 'copy_scale';
  targetNodeId: string;
  subTarget?: string;
  copyX?: boolean;
  copyY?: boolean;
  copyZ?: boolean;
  space?: 'world' | 'local';
}

export interface CopyTransformsConstraint extends BaseConstraint {
  type: 'copy_transforms';
  targetNodeId: string;
  subTarget?: string;
  space?: 'world' | 'local';
}

export interface LookAtConstraint extends BaseConstraint {
  type: 'look_at';
  targetNodeId: string;
  subTarget?: string;
  trackAxis?: '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z';
  upAxis?: 'X' | 'Y' | 'Z';
}

export interface LimitLocationConstraint extends BaseConstraint {
  type: 'limit_location';
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  minZ?: number;
  maxZ?: number;
  space?: 'world' | 'local';
}

export interface LimitRotationConstraint extends BaseConstraint {
  type: 'limit_rotation';
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  minZ?: number;
  maxZ?: number;
  space?: 'world' | 'local';
}

export interface InverseKinematicsConstraint extends BaseConstraint {
  type: 'ik' | 'inverse_kinematics';
  targetNodeId: string;
  targetSubTarget?: string;
  poleTargetNodeId?: string;
  poleSubTarget?: string;
  poleAngle?: number; // radians
  chainLength: number; // 0 = all ancestors
  iterations?: number;
  tolerance?: number;
}

export type IConstraint =
  | CopyLocationConstraint
  | CopyRotationConstraint
  | CopyScaleConstraint
  | CopyTransformsConstraint
  | LookAtConstraint
  | LimitLocationConstraint
  | LimitRotationConstraint
  | InverseKinematicsConstraint;

export type IAnimationConstraint = IConstraint;

/**
 * Bone pose representation in Pose Mode
 */
export interface IBonePose {
  boneId: string;
  position?: Vector3;
  rotation?: Quaternion | Euler;
  scale?: Vector3;
  constraints?: IConstraint[];
}

export type IPoseChannel = IBonePose;

export interface IPoseState {
  armatureId: string;
  channels: Record<string, IPoseChannel>;
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
  activeActionId?: string;
  actions?: Record<string, IAnimationAction>;
  nlaTracks?: INLATrack[];
}

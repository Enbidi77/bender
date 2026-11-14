# Blender-ELT Animation System: Data Model Specification

**Document Version:** 1.0.0  
**Target Packages:** `@blender-elt/contracts`, `@blender-elt/animation`, `@blender-elt/persistence`  
**Status:** Production Data Specification

---

## 1. Overview & Hierarchy

The Blender-ELT animation data model mirrors Blender's modern animation hierarchy:

```
AnimationTimeline
 └── actions: Record<string, IAnimationAction>
      └── IAnimationAction
           ├── groups: IActionGroup[]
           └── channels: IAnimationChannel[] (F-Curves)
                ├── modifiers: IFCurveModifier[]
                └── keyframes: IKeyframe[]
                     ├── handleLeft: BezierHandle
                     └── handleRight: BezierHandle
```

---

## 2. Core TypeScript Contracts (`@blender-elt/contracts`)

### 2.1 Keyframe Data Structure & Tangent Control Points

```typescript
export type KeyframeInterpolation =
  | 'constant' // Step hold until next key
  | 'linear' // Straight line interpolation
  | 'bezier' // Cubic Bezier spline with control handles
  | 'step'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out';

export type KeyframeHandleType =
  | 'auto' // Clamped Catmull-Rom smooth tangents
  | 'aligned' // Colinear 180° opposing tangent handles
  | 'vector' // Tangents point directly toward adjacent keyframe
  | 'free'; // Independent angle and length per handle

export type KeyframeType =
  | 'keyframe' // Standard white/yellow diamond
  | 'breakdown' // Cyan diamond (in-between pose)
  | 'extreme' // Red diamond (pose extreme)
  | 'jitter'; // Green diamond (noise/jitter)

export interface BezierHandle {
  frame: number; // Relative time offset in frames (Δt)
  value: number; // Relative value offset (Δv)
}

export interface IKeyframe<T = number> {
  id: string;
  frame: number; // Time in frames (can be fractional during retiming)
  time: number; // Time in seconds: (frame - 1) / fps
  value: T; // Scalar number or number[] tuple
  interpolation?: KeyframeInterpolation; // Segment interpolation towards next keyframe
  handleTypeLeft?: KeyframeHandleType; // Tangent handle type for incoming slope
  handleTypeRight?: KeyframeHandleType; // Tangent handle type for outgoing slope
  handleLeft?: BezierHandle; // Incoming control point (Δt_L, Δv_L)
  handleRight?: BezierHandle; // Outgoing control point (Δt_R, Δv_R)
  keyframeType?: KeyframeType; // Dope Sheet semantic coloring
  selected?: boolean; // Keyframe selection state in Dope Sheet/Graph Editor
  handleLeftSelected?: boolean; // Left handle knob selection
  handleRightSelected?: boolean; // Right handle knob selection
}
```

### 2.2 F-Curves & Animation Channels

An `IAnimationChannel` represents an individual scalar or vector animation track targeting a specific property path on a scene node:

```typescript
export type AnimationPropertyPath =
  | 'position.x'
  | 'position.y'
  | 'position.z'
  | 'rotation.x'
  | 'rotation.y'
  | 'rotation.z'
  | 'rotation.w'
  | 'scale.x'
  | 'scale.y'
  | 'scale.z'
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

export type ExtrapolationMode =
  | 'constant' // Hold boundary value indefinitely
  | 'linear' // Project boundary tangent slope into infinity
  | 'cyclic' // Loop keyframes periodically
  | 'cyclic_offset'; // Loop keyframes and accumulate endpoint delta

export interface IAnimationChannel {
  id: string;
  name: string;
  targetNodeId: string;
  propertyPath: AnimationPropertyPath;
  keyframes: IKeyframe[];
  interpolation: KeyframeInterpolation;
  extrapolation: ExtrapolationMode;
  color: string; // Hex color for Graph Editor curve rendering
  muted?: boolean;
  locked?: boolean;
  modifiers?: IFCurveModifier[];
}
```

### 2.3 Action Groups & Animation Actions (Clips)

```typescript
export interface IActionGroup {
  id: string;
  name: string;
  color?: string;
  channelIds: string[];
  isExpanded?: boolean;
}

export interface IAnimationAction {
  id: string;
  name: string;
  targetNodeId?: string; // Default target node ID (optional)
  groups: IActionGroup[];
  channels: IAnimationChannel[];
  frameRange: [number, number]; // [startFrame, endFrame]
  isLooping?: boolean;
  metadata?: Record<string, unknown>;
}
```

### 2.4 Non-Linear Animation (NLA) Containers

```typescript
export interface INLAStrip {
  id: string;
  name: string;
  actionId: string;
  startFrame: number;
  endFrame: number;
  actionStartFrame: number;
  actionEndFrame: number;
  playbackSpeed: number; // 1.0 = normal
  repeatCount: number; // 1.0 = once
  blendMode: 'replace' | 'add' | 'multiply';
  isMuted: boolean;
}

export interface INLATrack {
  id: string;
  name: string;
  strips: INLAStrip[];
  isMuted: boolean;
  isSolo: boolean;
  isLocked: boolean;
}
```

---

## 3. F-Curve Modifier Stack (`IFCurveModifier`)

Modifiers process curve evaluations algorithmically in a non-destructive pipeline:

```typescript
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
  stepSize: number; // Hold every N frames (stop-motion / anime 2s)
  offset: number;
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
  | GeneratorFCurveModifier;
```

---

## 4. Top-Level Timeline Data Model (`AnimationTimeline`)

```typescript
export type PlaybackState = 'playing' | 'paused' | 'stopped' | 'looping';

export interface AnimationTimeline {
  currentFrame: number; // Active playhead frame (1-based index)
  startFrame: number; // Playback start boundary (default: 1)
  endFrame: number; // Playback end boundary (default: 250)
  fps: number; // Framerate (default: 24)
  playbackState: PlaybackState;
  isPlaying: boolean;
  loop: boolean;
  tracks: AnimationTrack[]; // Legacy tracks (backward compatibility)
  actions?: Record<string, IAnimationAction>;
  activeActionId?: string;
  nlaTracks?: INLATrack[];
}
```

---

## 5. Persistence Serialization (`.belt` Schema v1.1.0)

In `@blender-elt/persistence`, all models are strictly typed using Zod schemas (`AnimationTimelineSchema`, `AnimationActionSchema`, `AnimationChannelSchema`, `KeyframeSchema`).

During project save:

1. `buildProjectDocument(state, name)` calls `timelineStore.getTimeline()`.
2. The entire timeline data tree is serialized into the `.belt` JSON document.
3. Upon opening, `timelineStore.loadTimeline(doc.timeline)` rehydrates all actions, channels, handles, and keyframes with 100% fidelity.

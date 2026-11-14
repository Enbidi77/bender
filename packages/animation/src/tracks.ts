import type {
  AnimationProperty,
  AnimationPropertyPath,
  AnimationTrack,
  ExtrapolationMode,
  IAnimationChannel,
  IKeyframe,
  KeyframeInterpolation,
} from '@blender-elt/contracts';
import { interpolateValue } from './interpolation.js';
import { computeAutoHandles, evaluateBezierKeyframeSegment } from './bezier-evaluator.js';
import { evaluateExtrapolation } from './extrapolation.js';
import { evaluateModifierStack } from './modifiers.js';

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface NodeTransformEvaluation {
  position?: Partial<Vector3Like>;
  rotation?: Partial<Vector3Like>;
  scale?: Partial<Vector3Like>;
}

/**
 * Creates an empty animation track targeting a node property
 */
export function createTrack(
  targetNodeId: string,
  property: AnimationProperty,
  name?: string,
  keyframes: IKeyframe[] = [],
  id?: string,
): AnimationTrack {
  return {
    id: id ?? `track_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name ?? `${property}`,
    targetNodeId,
    property,
    propertyPath: property,
    keyframes: [...keyframes].sort((a, b) => a.frame - b.frame),
    interpolation: 'linear',
    extrapolation: 'constant',
  };
}

/**
 * Creates a modern animation channel targeting a node property path
 */
export function createChannel(
  targetNodeId: string,
  propertyPath: AnimationPropertyPath,
  options?: Partial<Omit<IAnimationChannel, 'id' | 'targetNodeId' | 'propertyPath'>>,
): IAnimationChannel {
  return {
    id: `chan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: options?.name ?? `${propertyPath}`,
    targetNodeId,
    propertyPath,
    keyframes: options?.keyframes ? [...options.keyframes].sort((a, b) => a.frame - b.frame) : [],
    interpolation: options?.interpolation ?? 'bezier',
    extrapolation: options?.extrapolation ?? 'constant',
    color: options?.color ?? '#4772b3',
    muted: options?.muted ?? false,
    locked: options?.locked ?? false,
    modifiers: options?.modifiers ?? [],
  };
}

/**
 * Updates automatic tangent handles for keyframes in a track/channel.
 */
export function recalculateAutoHandles(keyframes: IKeyframe[]): void {
  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i];
    if (kf.interpolation === 'bezier') {
      const isAutoLeft = !kf.handleTypeLeft || kf.handleTypeLeft === 'auto';
      const isAutoRight = !kf.handleTypeRight || kf.handleTypeRight === 'auto';

      if ((isAutoLeft && !kf.handleLeft) || (isAutoRight && !kf.handleRight)) {
        const prev = i > 0 ? keyframes[i - 1] : null;
        const next = i < keyframes.length - 1 ? keyframes[i + 1] : null;
        const auto = computeAutoHandles(prev, kf, next);

        if (isAutoLeft && !kf.handleLeft) {
          kf.handleLeft = auto.handleLeft;
          kf.handleTypeLeft = 'auto';
        }
        if (isAutoRight && !kf.handleRight) {
          kf.handleRight = auto.handleRight;
          kf.handleTypeRight = 'auto';
        }
      }
    }
  }
}

/**
 * Inserts or updates a keyframe in an animation track
 */
export function insertKeyframeToTrack(
  track: AnimationTrack,
  keyframe: Omit<IKeyframe, 'time'> & { time?: number },
  fps: number = 24,
): void {
  const time = keyframe.time ?? (keyframe.frame - 1) / fps;
  const id = keyframe.id ?? `kf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newKf: IKeyframe = {
    ...keyframe,
    id,
    frame: keyframe.frame,
    time,
    value: keyframe.value,
    interpolation: keyframe.interpolation ?? track.interpolation ?? 'linear',
  };

  const existingIdx = track.keyframes.findIndex((k) => k.frame === keyframe.frame);
  if (existingIdx >= 0) {
    track.keyframes[existingIdx] = { ...track.keyframes[existingIdx], ...newKf };
  } else {
    track.keyframes.push(newKf);
    track.keyframes.sort((a, b) => a.frame - b.frame);
  }

  recalculateAutoHandles(track.keyframes);
}

/**
 * Inserts or updates a keyframe in an animation channel
 */
export function insertKeyframeToChannel(
  channel: IAnimationChannel,
  keyframe: Omit<IKeyframe, 'time'> & { time?: number },
  fps: number = 24,
): void {
  insertKeyframeToTrack(channel as unknown as AnimationTrack, keyframe, fps);
}

/**
 * Removes a keyframe at a specified frame from an animation track
 */
export function removeKeyframeFromTrack(track: AnimationTrack, frame: number): boolean {
  const initialLength = track.keyframes.length;
  track.keyframes = track.keyframes.filter((k) => k.frame !== frame);
  const changed = track.keyframes.length < initialLength;
  if (changed) {
    recalculateAutoHandles(track.keyframes);
  }
  return changed;
}

/**
 * Evaluates scalar or vector value inside the keyframe bounds without extrapolation or modifiers.
 */
function evaluateRawKeyframes(
  sorted: IKeyframe[],
  frame: number,
  fallbackInterpolation: KeyframeInterpolation = 'linear',
): number | number[] | null {
  if (sorted.length === 0) return null;

  if (frame <= sorted[0].frame) {
    return sorted[0].value;
  }

  if (frame >= sorted[sorted.length - 1].frame) {
    return sorted[sorted.length - 1].value;
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const kfA = sorted[i];
    const kfB = sorted[i + 1];

    if (frame >= kfA.frame && frame <= kfB.frame) {
      const span = kfB.frame - kfA.frame;
      if (span === 0) return kfA.value;

      const interpolation = kfA.interpolation ?? fallbackInterpolation;

      // Cubic Bezier evaluation for scalar values
      if (interpolation === 'bezier') {
        if (typeof kfA.value === 'number' && typeof kfB.value === 'number') {
          return evaluateBezierKeyframeSegment(kfA, kfB, frame);
        }
        if (Array.isArray(kfA.value) && Array.isArray(kfB.value)) {
          const aArr = kfA.value;
          const bArr = kfB.value;
          return aArr.map((vA, compIdx) => {
            const vB = bArr[compIdx] ?? vA;
            const singleKfA: IKeyframe = { ...kfA, value: vA };
            const singleKfB: IKeyframe = { ...kfB, value: vB };
            return evaluateBezierKeyframeSegment(singleKfA, singleKfB, frame);
          });
        }
      }

      // Other interpolation curves (linear, step, ease-in, ease-out, ease-in-out)
      const t = (frame - kfA.frame) / span;
      return interpolateValue(kfA.value, kfB.value, t, interpolation);
    }
  }

  return null;
}

/**
 * Evaluates an animation track or channel at a specific frame, applying interpolation,
 * extrapolation, and F-Curve modifier stacks.
 */
export function evaluateChannel(
  channel: IAnimationChannel | AnimationTrack,
  frame: number,
): number | number[] | null {
  if (!channel.keyframes || channel.keyframes.length === 0) {
    return null;
  }

  const sorted = [...channel.keyframes].sort((a, b) => a.frame - b.frame);
  const extrapolation: ExtrapolationMode = channel.extrapolation ?? 'constant';
  const fallbackInterp = channel.interpolation ?? 'linear';

  const firstKf = sorted[0];
  const lastKf = sorted[sorted.length - 1];

  let rawVal: number | number[] | null = null;

  // Handle extrapolation when outside [firstKf.frame, lastKf.frame]
  if (frame < firstKf.frame || frame > lastKf.frame) {
    if (typeof firstKf.value === 'number' && typeof lastKf.value === 'number') {
      rawVal = evaluateExtrapolation(sorted, frame, extrapolation, (f) => {
        const v = evaluateRawKeyframes(sorted, f, fallbackInterp);
        return typeof v === 'number' ? v : (v?.[0] ?? 0);
      });
    } else if (Array.isArray(firstKf.value) && Array.isArray(lastKf.value)) {
      const len = Math.max(firstKf.value.length, lastKf.value.length);
      const vec: number[] = [];
      for (let c = 0; c < len; c++) {
        const compSorted = sorted.map((k) => {
          const kVal = k.value;
          const numVal = Array.isArray(kVal) ? (kVal[c] ?? 0) : typeof kVal === 'number' ? kVal : 0;
          return {
            ...k,
            value: numVal,
          };
        });
        const compVal = evaluateExtrapolation(compSorted, frame, extrapolation, (f) => {
          const v = evaluateRawKeyframes(compSorted, f, fallbackInterp);
          return typeof v === 'number' ? v : (v?.[0] ?? 0);
        });
        vec.push(compVal);
      }
      rawVal = vec;
    } else {
      rawVal = evaluateRawKeyframes(sorted, frame, fallbackInterp);
    }
  } else {
    rawVal = evaluateRawKeyframes(sorted, frame, fallbackInterp);
  }

  if (rawVal === null) return null;

  // Apply F-Curve modifiers if present
  if (channel.modifiers && channel.modifiers.length > 0) {
    if (typeof rawVal === 'number') {
      return evaluateModifierStack(rawVal, channel.modifiers, frame, (f) => {
        const sample = evaluateChannel({ ...channel, modifiers: [] }, f);
        return typeof sample === 'number' ? sample : (sample?.[0] ?? 0);
      });
    }
    if (Array.isArray(rawVal)) {
      return rawVal.map((v) =>
        evaluateModifierStack(v, channel.modifiers, frame, (f) => {
          const sample = evaluateChannel({ ...channel, modifiers: [] }, f);
          return typeof sample === 'number' ? sample : (sample?.[0] ?? 0);
        }),
      );
    }
  }

  return rawVal;
}

/**
 * Backward-compatible track evaluation wrapper
 */
export function evaluateTrack(track: AnimationTrack, frame: number): number | number[] | null {
  return evaluateChannel(track, frame);
}

/**
 * Evaluates all tracks targeting a node and compiles position, rotation, and scale transforms
 */
export function evaluateNodeTransform(
  tracks: AnimationTrack[],
  nodeId: string,
  frame: number,
): NodeTransformEvaluation {
  const result: NodeTransformEvaluation = {};

  const nodeTracks = tracks.filter((t) => t.targetNodeId === nodeId && !t.muted);

  for (const track of nodeTracks) {
    const val = evaluateTrack(track, frame);
    if (val === null) continue;

    const prop = track.propertyPath ?? track.property;

    switch (prop) {
      case 'position':
        if (Array.isArray(val) && val.length >= 3) {
          result.position = { x: val[0], y: val[1], z: val[2] };
        }
        break;
      case 'position.x':
        if (typeof val === 'number') {
          result.position = { ...result.position, x: val };
        }
        break;
      case 'position.y':
        if (typeof val === 'number') {
          result.position = { ...result.position, y: val };
        }
        break;
      case 'position.z':
        if (typeof val === 'number') {
          result.position = { ...result.position, z: val };
        }
        break;

      case 'rotation':
        if (Array.isArray(val) && val.length >= 3) {
          result.rotation = { x: val[0], y: val[1], z: val[2] };
        }
        break;
      case 'rotation.x':
        if (typeof val === 'number') {
          result.rotation = { ...result.rotation, x: val };
        }
        break;
      case 'rotation.y':
        if (typeof val === 'number') {
          result.rotation = { ...result.rotation, y: val };
        }
        break;
      case 'rotation.z':
        if (typeof val === 'number') {
          result.rotation = { ...result.rotation, z: val };
        }
        break;

      case 'scale':
        if (Array.isArray(val) && val.length >= 3) {
          result.scale = { x: val[0], y: val[1], z: val[2] };
        }
        break;
      case 'scale.x':
        if (typeof val === 'number') {
          result.scale = { ...result.scale, x: val };
        }
        break;
      case 'scale.y':
        if (typeof val === 'number') {
          result.scale = { ...result.scale, y: val };
        }
        break;
      case 'scale.z':
        if (typeof val === 'number') {
          result.scale = { ...result.scale, z: val };
        }
        break;
    }
  }

  return result;
}

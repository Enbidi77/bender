import type {
  AnimationTrack,
  AnimationProperty,
  IKeyframe,
  KeyframeInterpolation,
} from '@blender-elt/contracts';
import { interpolateValue } from './interpolation.js';

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
    keyframes: [...keyframes].sort((a, b) => a.frame - b.frame),
  };
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
  const newKf: IKeyframe = {
    frame: keyframe.frame,
    time,
    value: keyframe.value,
    interpolation: keyframe.interpolation ?? 'linear',
    inTangent: keyframe.inTangent,
    outTangent: keyframe.outTangent,
  };

  const existingIdx = track.keyframes.findIndex((k) => k.frame === keyframe.frame);
  if (existingIdx >= 0) {
    track.keyframes[existingIdx] = newKf;
  } else {
    track.keyframes.push(newKf);
    track.keyframes.sort((a, b) => a.frame - b.frame);
  }
}

/**
 * Removes a keyframe at a specified frame from an animation track
 */
export function removeKeyframeFromTrack(track: AnimationTrack, frame: number): boolean {
  const initialLength = track.keyframes.length;
  track.keyframes = track.keyframes.filter((k) => k.frame !== frame);
  return track.keyframes.length < initialLength;
}

/**
 * Evaluates an animation track's value at a specific frame
 */
export function evaluateTrack(track: AnimationTrack, frame: number): number | number[] | null {
  if (!track.keyframes || track.keyframes.length === 0) {
    return null;
  }

  // Sorted keyframes
  const sorted = [...track.keyframes].sort((a, b) => a.frame - b.frame);

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

      const t = (frame - kfA.frame) / span;
      const interpolation: KeyframeInterpolation = kfA.interpolation ?? 'linear';

      return interpolateValue(kfA.value, kfB.value, t, interpolation);
    }
  }

  return null;
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

    switch (track.property) {
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

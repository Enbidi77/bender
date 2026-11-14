import type { ExtrapolationMode, IKeyframe } from '@blender-elt/contracts';

/**
 * Calculates outgoing slope at a boundary keyframe.
 */
function getBoundarySlope(
  kf: IKeyframe,
  neighborKf: IKeyframe | undefined,
  isStart: boolean,
): number {
  const kfVal = typeof kf.value === 'number' ? kf.value : (kf.value?.[0] ?? 0);

  if (isStart) {
    if (kf.handleLeft && Math.abs(kf.handleLeft.frame) > 1e-6) {
      return kf.handleLeft.value / kf.handleLeft.frame;
    }
    if (kf.inTangent && Math.abs(kf.inTangent[0]) > 1e-6) {
      return kf.inTangent[1] / kf.inTangent[0];
    }
    if (neighborKf) {
      const nVal =
        typeof neighborKf.value === 'number' ? neighborKf.value : (neighborKf.value?.[0] ?? 0);
      const span = neighborKf.frame - kf.frame;
      return Math.abs(span) > 1e-6 ? (nVal - kfVal) / span : 0;
    }
  } else {
    if (kf.handleRight && Math.abs(kf.handleRight.frame) > 1e-6) {
      return kf.handleRight.value / kf.handleRight.frame;
    }
    if (kf.outTangent && Math.abs(kf.outTangent[0]) > 1e-6) {
      return kf.outTangent[1] / kf.outTangent[0];
    }
    if (neighborKf) {
      const nVal =
        typeof neighborKf.value === 'number' ? neighborKf.value : (neighborKf.value?.[0] ?? 0);
      const span = kf.frame - neighborKf.frame;
      return Math.abs(span) > 1e-6 ? (kfVal - nVal) / span : 0;
    }
  }

  return 0;
}

/**
 * Evaluates extrapolation outside keyframe bounds according to ExtrapolationMode.
 *
 * @param sortedKeyframes - Array of keyframes sorted by frame ascending
 * @param frame - Target frame to evaluate (outside [first.frame, last.frame])
 * @param mode - Extrapolation mode: 'constant' | 'linear' | 'cyclic' | 'cyclic_offset'
 * @param evaluateInsideRange - Callback evaluating a frame strictly within [first.frame, last.frame]
 */
export function evaluateExtrapolation(
  sortedKeyframes: IKeyframe[],
  frame: number,
  mode: ExtrapolationMode = 'constant',
  evaluateInsideRange: (f: number) => number,
): number {
  if (sortedKeyframes.length === 0) {
    return 0;
  }

  const firstKf = sortedKeyframes[0];
  const lastKf = sortedKeyframes[sortedKeyframes.length - 1];

  const firstVal = typeof firstKf.value === 'number' ? firstKf.value : (firstKf.value?.[0] ?? 0);
  const lastVal = typeof lastKf.value === 'number' ? lastKf.value : (lastKf.value?.[0] ?? 0);

  // If only one keyframe or degenerate frame range, clamp to that value
  if (sortedKeyframes.length === 1 || firstKf.frame >= lastKf.frame) {
    return frame <= firstKf.frame ? firstVal : lastVal;
  }

  // Inside range: delegate directly to curve evaluator
  if (frame >= firstKf.frame && frame <= lastKf.frame) {
    return evaluateInsideRange(frame);
  }

  const period = lastKf.frame - firstKf.frame;

  switch (mode) {
    case 'linear': {
      if (frame < firstKf.frame) {
        const neighbor = sortedKeyframes[1];
        const slope = getBoundarySlope(firstKf, neighbor, true);
        return firstVal + (frame - firstKf.frame) * slope;
      } else {
        const neighbor = sortedKeyframes[sortedKeyframes.length - 2];
        const slope = getBoundarySlope(lastKf, neighbor, false);
        return lastVal + (frame - lastKf.frame) * slope;
      }
    }

    case 'cyclic': {
      if (period <= 0) return firstVal;
      // Modulo arithmetic mapping frame to [firstKf.frame, lastKf.frame]
      const rem = (((frame - firstKf.frame) % period) + period) % period;
      const wrappedFrame = firstKf.frame + rem;
      return evaluateInsideRange(wrappedFrame);
    }

    case 'cyclic_offset': {
      if (period <= 0) return firstVal;
      const cycles = Math.floor((frame - firstKf.frame) / period);
      const deltaY = lastVal - firstVal;
      const wrappedFrame = frame - cycles * period;
      const sampledVal = evaluateInsideRange(wrappedFrame);
      return sampledVal + cycles * deltaY;
    }

    case 'constant':
    default: {
      return frame < firstKf.frame ? firstVal : lastVal;
    }
  }
}

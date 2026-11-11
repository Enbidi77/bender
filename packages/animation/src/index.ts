import type {
  AnimationTimeline,
  AnimationTrack,
  IKeyframe,
  PlaybackState,
} from '@blender-elt/contracts';

export type { AnimationTimeline, AnimationTrack, IKeyframe, PlaybackState };

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
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Evaluates an animation track's value at a specific frame
 */
export function evaluateTrack(track: AnimationTrack, frame: number): number | number[] | null {
  if (!track.keyframes || track.keyframes.length === 0) {
    return null;
  }

  // Sort keyframes ascending
  const sorted = [...track.keyframes].sort((a, b) => a.frame - b.frame);

  if (frame <= sorted[0].frame) {
    return sorted[0].value as number | number[];
  }

  if (frame >= sorted[sorted.length - 1].frame) {
    return sorted[sorted.length - 1].value as number | number[];
  }

  // Find surrounding keyframes
  for (let i = 0; i < sorted.length - 1; i++) {
    const kfA = sorted[i];
    const kfB = sorted[i + 1];

    if (frame >= kfA.frame && frame <= kfB.frame) {
      const span = kfB.frame - kfA.frame;
      if (span === 0) return kfA.value as number | number[];

      const t = (frame - kfA.frame) / span;

      if (kfA.interpolation === 'step') {
        return kfA.value as number | number[];
      }

      if (typeof kfA.value === 'number' && typeof kfB.value === 'number') {
        return lerp(kfA.value, kfB.value, t);
      }

      if (Array.isArray(kfA.value) && Array.isArray(kfB.value)) {
        return (kfA.value as number[]).map((val: number, idx: number) =>
          lerp(val, (kfB.value as number[])[idx] ?? val, t),
        );
      }

      return kfA.value as number | number[];
    }
  }

  return null;
}

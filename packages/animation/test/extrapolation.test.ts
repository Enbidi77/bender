import { describe, it, expect } from 'vitest';
import { evaluateExtrapolation } from '../src/extrapolation.js';
import type { IKeyframe } from '@blender-elt/contracts';

describe('Curve Extrapolation Engine', () => {
  const keyframes: IKeyframe[] = [
    {
      id: 'k1',
      frame: 10,
      time: 0.4,
      value: 0,
      handleLeft: { frame: -3, value: -6 },
      handleRight: { frame: 3, value: 6 },
    },
    { id: 'k2', frame: 20, time: 0.8, value: 50 },
    {
      id: 'k3',
      frame: 30,
      time: 1.2,
      value: 100,
      handleLeft: { frame: -3, value: -6 },
      handleRight: { frame: 3, value: 6 },
    },
  ];

  // Helper linear evaluator inside [10, 30]
  const sampleInner = (f: number) => {
    const t = (f - 10) / (30 - 10);
    return 0 + 100 * t;
  };

  it('evaluates constant extrapolation by holding boundary values', () => {
    // Before first keyframe
    expect(evaluateExtrapolation(keyframes, 0, 'constant', sampleInner)).toBe(0);
    expect(evaluateExtrapolation(keyframes, -50, 'constant', sampleInner)).toBe(0);

    // Inside range delegates to sampleInner
    expect(evaluateExtrapolation(keyframes, 20, 'constant', sampleInner)).toBe(50);

    // After last keyframe
    expect(evaluateExtrapolation(keyframes, 35, 'constant', sampleInner)).toBe(100);
    expect(evaluateExtrapolation(keyframes, 100, 'constant', sampleInner)).toBe(100);
  });

  it('evaluates linear extrapolation projecting boundary tangents', () => {
    // k1 has handleLeft (-3, -6) -> slope is -6 / -3 = 2
    // For frame 0 (10 frames before frame 10): 0 + (0 - 10) * 2 = -20
    expect(evaluateExtrapolation(keyframes, 0, 'linear', sampleInner)).toBeCloseTo(-20, 2);

    // k3 has handleRight (3, 6) -> slope is 6 / 3 = 2
    // For frame 40 (10 frames after frame 30): 100 + (40 - 30) * 2 = 120
    expect(evaluateExtrapolation(keyframes, 40, 'linear', sampleInner)).toBeCloseTo(120, 2);
  });

  it('evaluates cyclic extrapolation looping within boundary period', () => {
    // Period is (30 - 10) = 20 frames
    // Frame 35 wraps to 10 + (35 - 10) % 20 = 10 + 5 = 15
    // Value at 15 is 25
    expect(evaluateExtrapolation(keyframes, 35, 'cyclic', sampleInner)).toBeCloseTo(25, 2);

    // Frame 50 wraps to 10 + (50 - 10) % 20 = 10 + 0 = 10 -> value 0
    expect(evaluateExtrapolation(keyframes, 50, 'cyclic', sampleInner)).toBeCloseTo(0, 2);

    // Frame 0 (negative direction) wraps to 10 + ((-10 % 20) + 20) % 20 = 10 + 10 = 20 -> value 50
    expect(evaluateExtrapolation(keyframes, 0, 'cyclic', sampleInner)).toBeCloseTo(50, 2);
  });

  it('evaluates cyclic with offset accumulating delta each loop', () => {
    // Period is 20 frames, Delta Y is (100 - 0) = 100
    // Frame 40 is 1 cycle ahead: cycles = floor((40 - 10)/20) = 1
    // Wrapped frame = 40 - 1 * 20 = 20 (inner value 50)
    // Total value = 50 + 1 * 100 = 150
    expect(evaluateExtrapolation(keyframes, 40, 'cyclic_offset', sampleInner)).toBeCloseTo(150, 2);

    // Frame 50: cycles = 2, wrapped frame = 10 (inner value 0)
    // Total value = 0 + 2 * 100 = 200
    expect(evaluateExtrapolation(keyframes, 50, 'cyclic_offset', sampleInner)).toBeCloseTo(200, 2);

    // Frame 0: cycles = floor((0 - 10)/20) = -1
    // Wrapped frame = 0 - (-1) * 20 = 20 (inner value 50)
    // Total value = 50 + (-1) * 100 = -50
    expect(evaluateExtrapolation(keyframes, 0, 'cyclic_offset', sampleInner)).toBeCloseTo(-50, 2);
  });

  it('handles single keyframe edge case cleanly', () => {
    const singleKey: IKeyframe[] = [{ id: 'k1', frame: 5, time: 0.2, value: 42 }];
    expect(evaluateExtrapolation(singleKey, 0, 'constant', () => 42)).toBe(42);
    expect(evaluateExtrapolation(singleKey, 10, 'cyclic', () => 42)).toBe(42);
    expect(evaluateExtrapolation(singleKey, 10, 'linear', () => 42)).toBe(42);
  });
});

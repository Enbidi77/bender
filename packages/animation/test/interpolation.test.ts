import { describe, it, expect } from 'vitest';
import {
  interpolateLinear,
  interpolateStep,
  interpolateEaseInOut,
  interpolateEaseIn,
  interpolateEaseOut,
  interpolateCubicBezier,
  interpolateValue,
} from '../src/index.js';

describe('Keyframe Interpolation Engine', () => {
  it('performs linear interpolation', () => {
    expect(interpolateLinear(0, 100, 0)).toBe(0);
    expect(interpolateLinear(0, 100, 0.5)).toBe(50);
    expect(interpolateLinear(0, 100, 1)).toBe(100);
    // Clamping
    expect(interpolateLinear(0, 100, -0.2)).toBe(0);
    expect(interpolateLinear(0, 100, 1.5)).toBe(100);
  });

  it('performs step interpolation', () => {
    expect(interpolateStep(10, 20, 0)).toBe(10);
    expect(interpolateStep(10, 20, 0.99)).toBe(10);
    expect(interpolateStep(10, 20, 1.0)).toBe(20);
  });

  it('performs ease-in-out interpolation', () => {
    expect(interpolateEaseInOut(0, 100, 0)).toBe(0);
    expect(interpolateEaseInOut(0, 100, 0.5)).toBe(50);
    expect(interpolateEaseInOut(0, 100, 1)).toBe(100);

    // Ease-in-out moves slower at beginning than linear
    expect(interpolateEaseInOut(0, 100, 0.25)).toBeLessThan(25);
    // Ease-in-out moves faster around middle
    expect(interpolateEaseInOut(0, 100, 0.75)).toBeGreaterThan(75);
  });

  it('evaluates cubic bezier parametric curve', () => {
    const val = interpolateCubicBezier(0, 0, 1, 1, 0.5);
    expect(val).toBeCloseTo(0.5, 3);
  });

  it('interpolates vector values across keyframes', () => {
    const v1 = [0, 10, 20];
    const v2 = [100, 20, 40];
    const result = interpolateValue(v1, v2, 0.5, 'linear') as number[];
    expect(result).toEqual([50, 15, 30]);

    const stepResult = interpolateValue(v1, v2, 0.5, 'step') as number[];
    expect(stepResult).toEqual([0, 10, 20]);
  });
});

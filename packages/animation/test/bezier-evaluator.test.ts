import { describe, it, expect } from 'vitest';
import {
  evaluateCubicBezier2D,
  computeAutoHandles,
  computeVectorHandles,
  applyHandleConstraints,
  evaluateBezierKeyframeSegment,
  resolveIncomingHandle,
  resolveOutgoingHandle,
} from '../src/bezier-evaluator.js';
import type { IKeyframe } from '@blender-elt/contracts';

describe('Bezier Curve Evaluator & Tangent Mathematics', () => {
  it('evaluates straight linear control points with exact 1:1 mapping', () => {
    const p0: [number, number] = [0, 0];
    const p1: [number, number] = [1, 1];
    const p2: [number, number] = [2, 2];
    const p3: [number, number] = [3, 3];

    expect(evaluateCubicBezier2D(p0, p1, p2, p3, 0)).toBeCloseTo(0, 5);
    expect(evaluateCubicBezier2D(p0, p1, p2, p3, 1.5)).toBeCloseTo(1.5, 5);
    expect(evaluateCubicBezier2D(p0, p1, p2, p3, 3)).toBeCloseTo(3, 5);
  });

  it('evaluates standard smooth ease-in-out S-curve', () => {
    const p0: [number, number] = [0, 0];
    const p1: [number, number] = [0.42, 0];
    const p2: [number, number] = [0.58, 1];
    const p3: [number, number] = [1, 1];

    const mid = evaluateCubicBezier2D(p0, p1, p2, p3, 0.5);
    expect(mid).toBeCloseTo(0.5, 3);

    // Ease-in: slower at start than linear
    const early = evaluateCubicBezier2D(p0, p1, p2, p3, 0.25);
    expect(early).toBeLessThan(0.25);

    // Ease-out: faster around 0.75 than linear
    const late = evaluateCubicBezier2D(p0, p1, p2, p3, 0.75);
    expect(late).toBeGreaterThan(0.75);
  });

  it('clamps and handles boundary and degenerate conditions gracefully', () => {
    const p0: [number, number] = [10, 50];
    const p1: [number, number] = [13, 50];
    const p2: [number, number] = [17, 100];
    const p3: [number, number] = [20, 100];

    // Clamping before p0 and after p3
    expect(evaluateCubicBezier2D(p0, p1, p2, p3, 5)).toBe(50);
    expect(evaluateCubicBezier2D(p0, p1, p2, p3, 25)).toBe(100);

    // Zero-length segment (p0.x == p3.x)
    const degen: [number, number] = [5, 42];
    expect(evaluateCubicBezier2D(degen, degen, degen, degen, 5)).toBe(42);
  });

  it('maintains numerical stability with steep or vertical tangent handles', () => {
    // Extreme steep tangents where Newton-Raphson fallback to bisection is exercised
    const p0: [number, number] = [0, 0];
    const p1: [number, number] = [0.001, 100];
    const p2: [number, number] = [0.999, 0];
    const p3: [number, number] = [1, 100];

    for (let x = 0; x <= 1; x += 0.1) {
      const y = evaluateCubicBezier2D(p0, p1, p2, p3, x);
      expect(Number.isFinite(y)).toBe(true);
      expect(Number.isNaN(y)).toBe(false);
    }
  });

  it('computes Catmull-Rom automatic handles with local extrema overshoot clamping', () => {
    const kf0: IKeyframe = { id: 'k0', frame: 1, time: 0, value: 0 };
    const kf1: IKeyframe = { id: 'k1', frame: 10, time: 0.375, value: 50 };
    const kf2: IKeyframe = { id: 'k2', frame: 19, time: 0.75, value: 100 };

    // Linear ascending sequence: slope is (100 - 0) / (19 - 1) = 50 / 9
    const auto1 = computeAutoHandles(kf0, kf1, kf2);
    expect(auto1.handleLeft.frame).toBeCloseTo(-3, 3);
    expect(auto1.handleRight.frame).toBeCloseTo(3, 3);
    expect(auto1.handleLeft.value).toBeLessThan(0);
    expect(auto1.handleRight.value).toBeGreaterThan(0);

    // Local peak: 0 -> 100 -> 0 (monotonicity clamping should force slope to zero)
    const kfPeak: IKeyframe = { id: 'kp', frame: 10, time: 0.375, value: 100 };
    const kfEnd: IKeyframe = { id: 'ke', frame: 20, time: 0.75, value: 0 };
    const peakHandles = computeAutoHandles(kf0, kfPeak, kfEnd);

    // Tangent at peak must be flat (dy = 0) to avoid overshoot
    expect(peakHandles.handleLeft.value).toBe(0);
    expect(peakHandles.handleRight.value).toBe(0);
  });

  it('computes vector handles pointing directly toward neighboring keyframes', () => {
    const kf0: IKeyframe = { id: 'k0', frame: 1, time: 0, value: 0 };
    const kf1: IKeyframe = { id: 'k1', frame: 10, time: 0.375, value: 90 };
    const kf2: IKeyframe = { id: 'k2', frame: 19, time: 0.75, value: 0 };

    const vectorHandles = computeVectorHandles(kf0, kf1, kf2);
    // Span left is (10 - 1) = 9, dt = -3; val left is (90 - 0) = 90, dv = -30
    expect(vectorHandles.handleLeft.frame).toBeCloseTo(-3, 3);
    expect(vectorHandles.handleLeft.value).toBeCloseTo(-30, 3);

    // Span right is (19 - 10) = 9, dt = 3; val right is (0 - 90) = -90, dv = -30
    expect(vectorHandles.handleRight.frame).toBeCloseTo(3, 3);
    expect(vectorHandles.handleRight.value).toBeCloseTo(-30, 3);
  });

  it('enforces aligned handle constraints keeping left and right handles collinear', () => {
    const kf: IKeyframe = {
      id: 'k1',
      frame: 10,
      time: 0.375,
      value: 50,
      handleTypeLeft: 'aligned',
      handleTypeRight: 'aligned',
      handleLeft: { frame: -3, value: -10 },
      handleRight: { frame: 3, value: 10 },
    };

    // Edit right handle angle: raise it to (3, 30)
    kf.handleRight = { frame: 3, value: 30 };
    applyHandleConstraints(kf, 'right');

    // Left handle must now point exactly opposite in direction
    const rightAngle = Math.atan2(kf.handleRight.value, kf.handleRight.frame);
    const leftAngle = Math.atan2(kf.handleLeft!.value, kf.handleLeft!.frame);
    const angleDiff = Math.abs(Math.abs(rightAngle - leftAngle) - Math.PI);
    expect(angleDiff).toBeCloseTo(0, 4);
  });

  it('evaluates Bezier segment between two keyframes', () => {
    const kfA: IKeyframe = {
      id: 'ka',
      frame: 1,
      time: 0,
      value: 0,
      interpolation: 'bezier',
      handleRight: { frame: 3, value: 0 },
    };
    const kfB: IKeyframe = {
      id: 'kb',
      frame: 10,
      time: 0.375,
      value: 100,
      interpolation: 'bezier',
      handleLeft: { frame: -3, value: 0 },
    };

    const startVal = evaluateBezierKeyframeSegment(kfA, kfB, 1);
    const midVal = evaluateBezierKeyframeSegment(kfA, kfB, 5.5);
    const endVal = evaluateBezierKeyframeSegment(kfA, kfB, 10);

    expect(startVal).toBeCloseTo(0, 3);
    expect(midVal).toBeCloseTo(50, 2);
    expect(endVal).toBeCloseTo(100, 3);
  });

  it('correctly resolves relative handle representations into absolute control points', () => {
    const kf: IKeyframe = {
      id: 'k1',
      frame: 20,
      time: 0.8,
      value: 100,
      handleRight: { frame: 5, value: 10 },
      handleLeft: { frame: -5, value: -10 },
    };

    const outP = resolveOutgoingHandle(kf);
    expect(outP[0]).toBe(25);
    expect(outP[1]).toBe(110);

    const inP = resolveIncomingHandle(kf);
    expect(inP[0]).toBe(15);
    expect(inP[1]).toBe(90);
  });
});

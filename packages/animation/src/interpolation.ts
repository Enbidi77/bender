import type { KeyframeInterpolation } from '@blender-elt/contracts';

/**
 * Linearly interpolates between a and b
 */
export function interpolateLinear(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Step interpolation: holds value a until t reaches 1.0
 */
export function interpolateStep(a: number, b: number, t: number): number {
  return t >= 1.0 ? b : a;
}

/**
 * Standard cubic ease-in-out interpolation
 */
export function interpolateEaseInOut(a: number, b: number, t: number): number {
  const clampedT = Math.max(0, Math.min(1, t));
  // Smoothstep 3t^2 - 2t^3
  const smooth = clampedT * clampedT * (3 - 2 * clampedT);
  return a + (b - a) * smooth;
}

/**
 * Ease-in interpolation (quadratic curve)
 */
export function interpolateEaseIn(a: number, b: number, t: number): number {
  const clampedT = Math.max(0, Math.min(1, t));
  return a + (b - a) * (clampedT * clampedT);
}

/**
 * Ease-out interpolation
 */
export function interpolateEaseOut(a: number, b: number, t: number): number {
  const clampedT = Math.max(0, Math.min(1, t));
  return a + (b - a) * (1 - (1 - clampedT) * (1 - clampedT));
}

/**
 * Evaluates a 1D cubic Bezier curve with control points
 */
export function interpolateCubicBezier(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const clampedT = Math.max(0, Math.min(1, t));
  const u = 1 - clampedT;
  const tt = clampedT * clampedT;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * clampedT;

  return uuu * p0 + 3 * uu * clampedT * p1 + 3 * u * tt * p2 + ttt * p3;
}

/**
 * Solves cubic bezier timing curve for parameter t
 */
export function solveCubicBezierTiming(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number,
): number {
  // Newton-Raphson approximation for finding parameter u such that BezierX(u) = t
  let u = Math.max(0, Math.min(1, t));
  for (let i = 0; i < 8; i++) {
    const currentX = interpolateCubicBezier(0, x1, x2, 1, u);
    const diff = currentX - t;
    if (Math.abs(diff) < 1e-5) break;

    // Derivative dX/du
    const dX = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2);

    if (Math.abs(dX) < 1e-6) break;
    u -= diff / dX;
    u = Math.max(0, Math.min(1, u));
  }

  return interpolateCubicBezier(0, y1, y2, 1, u);
}

/**
 * Interpolates scalar or vector values using the given interpolation method
 */
export function interpolateValue(
  valA: number | number[],
  valB: number | number[],
  t: number,
  interpolation: KeyframeInterpolation = 'linear',
): number | number[] {
  const clampedT = Math.max(0, Math.min(1, t));

  const interpolateScalar = (a: number, b: number): number => {
    switch (interpolation) {
      case 'step':
        return interpolateStep(a, b, clampedT);
      case 'ease-in-out':
        return interpolateEaseInOut(a, b, clampedT);
      case 'ease-in':
        return interpolateEaseIn(a, b, clampedT);
      case 'ease-out':
        return interpolateEaseOut(a, b, clampedT);
      case 'bezier': {
        // Standard blender ease-in-out bezier control points (0.42, 0.0, 0.58, 1.0)
        const progress = solveCubicBezierTiming(0.42, 0.0, 0.58, 1.0, clampedT);
        return a + (b - a) * progress;
      }
      case 'linear':
      default:
        return interpolateLinear(a, b, clampedT);
    }
  };

  if (typeof valA === 'number' && typeof valB === 'number') {
    return interpolateScalar(valA, valB);
  }

  if (Array.isArray(valA) && Array.isArray(valB)) {
    return valA.map((va, idx) => {
      const vb = valB[idx] ?? va;
      return interpolateScalar(va, vb);
    });
  }

  return valA;
}

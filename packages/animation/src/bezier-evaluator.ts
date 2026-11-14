import type { BezierHandle, IKeyframe, KeyframeHandleType } from '@blender-elt/contracts';

/**
 * 2D Point tuple [x, y] representing (frame, value)
 */
export type Point2D = [number, number];

/**
 * Evaluates a 2D cubic Bezier curve segment at coordinate x using Newton-Raphson root finding.
 *
 * Given four 2D control points:
 * P0: Start keyframe (x0, y0)
 * P1: First control handle (x1, y1)
 * P2: Second control handle (x2, y2)
 * P3: End keyframe (x3, y3)
 *
 * Solves for parameter u in [0, 1] such that B_x(u) = x, then returns B_y(u).
 */
export function evaluateCubicBezier2D(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  x: number,
  epsilon: number = 1e-7,
  maxIterations: number = 16,
): number {
  const [x0, y0] = p0;
  const [x1Raw, y1] = p1;
  const [x2Raw, y2] = p2;
  const [x3, y3] = p3;

  // Handle degenerate horizontal bounds
  if (Math.abs(x3 - x0) < 1e-9) {
    return y0;
  }

  // Clamping at segment ends
  if (x <= x0) return y0;
  if (x >= x3) return y3;

  // Ensure handles do not invert time order
  const minX = Math.min(x0, x3);
  const maxX = Math.max(x0, x3);
  const x1 = Math.max(minX, Math.min(maxX, x1Raw));
  const x2 = Math.max(minX, Math.min(maxX, x2Raw));

  // Polynomial coefficients for x(u) = ax * u^3 + bx * u^2 + cx * u + d
  const cx = 3 * (x1 - x0);
  const bx = 3 * (x2 - x1) - cx;
  const ax = x3 - x0 - cx - bx;

  // Initial estimate for u using linear parameterization
  let u = (x - x0) / (x3 - x0);
  u = Math.max(0, Math.min(1, u));

  let solved = false;

  // Newton-Raphson root finding
  for (let i = 0; i < maxIterations; i++) {
    const curX = ((ax * u + bx) * u + cx) * u + x0;
    const diff = curX - x;
    if (Math.abs(diff) < epsilon) {
      solved = true;
      break;
    }

    // Derivative dx/du = 3 * ax * u^2 + 2 * bx * u + cx
    const dx = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(dx) < 1e-6) {
      break; // Derivative too small, switch to bisection
    }

    const nextU = u - diff / dx;
    if (nextU < 0 || nextU > 1) {
      break; // Stepped out of bounds, switch to bisection
    }

    if (Math.abs(nextU - u) < epsilon) {
      u = nextU;
      solved = true;
      break;
    }

    u = nextU;
  }

  // Robust bisection fallback if Newton-Raphson failed to converge
  if (!solved) {
    let low = 0;
    let high = 1;
    for (let i = 0; i < 24; i++) {
      u = (low + high) * 0.5;
      const curX = ((ax * u + bx) * u + cx) * u + x0;
      const diff = curX - x;
      if (Math.abs(diff) < epsilon) {
        break;
      }
      if (diff > 0) {
        high = u;
      } else {
        low = u;
      }
    }
  }

  // Evaluate y(u) = ay * u^3 + by * u^2 + cy * u + y0
  const cy = 3 * (y1 - y0);
  const by = 3 * (y2 - y1) - cy;
  const ay = y3 - y0 - cy - by;

  return ((ay * u + by) * u + cy) * u + y0;
}

/**
 * Resolves absolute handle coordinates for a keyframe's outgoing control point.
 */
export function resolveOutgoingHandle(kf: IKeyframe, nextKf?: IKeyframe): Point2D {
  const kfVal = typeof kf.value === 'number' ? kf.value : (kf.value?.[0] ?? 0);

  if (kf.handleRight) {
    const h = kf.handleRight;
    return [kf.frame + h.frame, kfVal + h.value];
  }

  if (kf.outTangent) {
    return [kf.frame + kf.outTangent[0], kfVal + kf.outTangent[1]];
  }

  // Default Catmull-Rom 1/3 distance
  const nextFrame = nextKf ? nextKf.frame : kf.frame + 1;
  const dt = Math.max(0.001, (nextFrame - kf.frame) / 3);
  return [kf.frame + dt, kfVal];
}

/**
 * Resolves absolute handle coordinates for a keyframe's incoming control point.
 */
export function resolveIncomingHandle(kf: IKeyframe, prevKf?: IKeyframe): Point2D {
  const kfVal = typeof kf.value === 'number' ? kf.value : (kf.value?.[0] ?? 0);

  if (kf.handleLeft) {
    const h = kf.handleLeft;
    return [kf.frame + h.frame, kfVal + h.value];
  }

  if (kf.inTangent) {
    return [kf.frame + kf.inTangent[0], kfVal + kf.inTangent[1]];
  }

  // Default Catmull-Rom 1/3 distance
  const prevFrame = prevKf ? prevKf.frame : kf.frame - 1;
  const dt = -Math.max(0.001, (kf.frame - prevFrame) / 3);
  return [kf.frame + dt, kfVal];
}

/**
 * Evaluates a cubic Bezier curve between two adjacent keyframes.
 */
export function evaluateBezierKeyframeSegment(
  kf0: IKeyframe,
  kf1: IKeyframe,
  frame: number,
): number {
  const y0 = typeof kf0.value === 'number' ? kf0.value : (kf0.value?.[0] ?? 0);
  const y1 = typeof kf1.value === 'number' ? kf1.value : (kf1.value?.[0] ?? 0);

  const p0: Point2D = [kf0.frame, y0];
  const p1 = resolveOutgoingHandle(kf0, kf1);
  const p2 = resolveIncomingHandle(kf1, kf0);
  const p3: Point2D = [kf1.frame, y1];

  return evaluateCubicBezier2D(p0, p1, p2, p3, frame);
}

/**
 * Computes automatic tangent handles (Catmull-Rom / Fritsch-Carlson smooth tangents)
 * for a keyframe given its previous and next neighbors.
 * Returns relative handle offsets (dt, dv).
 */
export function computeAutoHandles(
  prevKf: IKeyframe | null,
  currentKf: IKeyframe,
  nextKf: IKeyframe | null,
): { handleLeft: BezierHandle; handleRight: BezierHandle } {
  const curFrame = currentKf.frame;
  const curVal =
    typeof currentKf.value === 'number' ? currentKf.value : (currentKf.value?.[0] ?? 0);

  // Single keyframe or no neighbors: flat tangents
  if (!prevKf && !nextKf) {
    return {
      handleLeft: { frame: -1, value: 0 },
      handleRight: { frame: 1, value: 0 },
    };
  }

  // First keyframe: flat horizontal tangent towards next
  if (!prevKf && nextKf) {
    const nextVal = typeof nextKf.value === 'number' ? nextKf.value : (nextKf.value?.[0] ?? 0);
    const dtR = Math.max(0.001, (nextKf.frame - curFrame) / 3);
    const slope = (nextVal - curVal) / Math.max(0.001, nextKf.frame - curFrame);
    const dvR = slope === 0 ? 0 : slope * dtR * 0.5;
    return {
      handleLeft: { frame: -dtR, value: dvR === 0 ? 0 : -dvR },
      handleRight: { frame: dtR, value: dvR === 0 ? 0 : dvR },
    };
  }

  // Last keyframe: flat horizontal tangent from prev
  if (prevKf && !nextKf) {
    const prevVal = typeof prevKf.value === 'number' ? prevKf.value : (prevKf.value?.[0] ?? 0);
    const dtL = -Math.max(0.001, (curFrame - prevKf.frame) / 3);
    const slope = (curVal - prevVal) / Math.max(0.001, curFrame - prevKf.frame);
    const dvL = slope === 0 ? 0 : slope * dtL * 0.5;
    return {
      handleLeft: { frame: dtL, value: dvL === 0 ? 0 : dvL },
      handleRight: { frame: -dtL, value: dvL === 0 ? 0 : -dvL },
    };
  }

  // Both neighbors exist: Catmull-Rom with monotonicity clamping
  const prevVal = typeof prevKf!.value === 'number' ? prevKf!.value : (prevKf!.value?.[0] ?? 0);
  const nextVal = typeof nextKf!.value === 'number' ? nextKf!.value : (nextKf!.value?.[0] ?? 0);

  const d1 = (curVal - prevVal) / Math.max(0.001, curFrame - prevKf!.frame);
  const d2 = (nextVal - curVal) / Math.max(0.001, nextKf!.frame - curFrame);

  let slope: number;
  // Local extremum: clamp slope to zero to eliminate overshoot
  if (d1 * d2 <= 0) {
    slope = 0;
  } else {
    // Harmonic mean / Fritsch-Carlson smooth slope
    const totalSpan = Math.max(0.001, nextKf!.frame - prevKf!.frame);
    slope = (nextVal - prevVal) / totalSpan;

    // Limit slope so tangent stays monotonic
    const maxSlope = 3 * Math.min(Math.abs(d1), Math.abs(d2));
    if (Math.abs(slope) > maxSlope) {
      slope = Math.sign(slope) * maxSlope;
    }
  }

  const dtL = -Math.max(0.001, (curFrame - prevKf!.frame) / 3);
  const dvL = slope === 0 ? 0 : slope * dtL;

  const dtR = Math.max(0.001, (nextKf!.frame - curFrame) / 3);
  const dvR = slope === 0 ? 0 : slope * dtR;

  return {
    handleLeft: { frame: dtL, value: dvL === 0 ? 0 : dvL },
    handleRight: { frame: dtR, value: dvR === 0 ? 0 : dvR },
  };
}

/**
 * Computes vector handles pointing directly toward adjacent keyframes.
 */
export function computeVectorHandles(
  prevKf: IKeyframe | null,
  currentKf: IKeyframe,
  nextKf: IKeyframe | null,
): { handleLeft: BezierHandle; handleRight: BezierHandle } {
  const curFrame = currentKf.frame;
  const curVal =
    typeof currentKf.value === 'number' ? currentKf.value : (currentKf.value?.[0] ?? 0);

  let handleLeft: BezierHandle;
  if (prevKf) {
    const prevVal = typeof prevKf.value === 'number' ? prevKf.value : (prevKf.value?.[0] ?? 0);
    const dvL = -(curVal - prevVal) / 3;
    handleLeft = {
      frame: -(curFrame - prevKf.frame) / 3,
      value: dvL === 0 ? 0 : dvL,
    };
  } else {
    handleLeft = { frame: -1, value: 0 };
  }

  let handleRight: BezierHandle;
  if (nextKf) {
    const nextVal = typeof nextKf.value === 'number' ? nextKf.value : (nextKf.value?.[0] ?? 0);
    const dvR = (nextVal - curVal) / 3;
    handleRight = {
      frame: (nextKf.frame - curFrame) / 3,
      value: dvR === 0 ? 0 : dvR,
    };
  } else {
    handleRight = { frame: 1, value: 0 };
  }

  return { handleLeft, handleRight };
}

/**
 * Enforces collinearity constraints on a keyframe's handles (e.g. 'aligned').
 * When one handle is moved, updates the opposite handle to maintain 180-degree opposition.
 */
export function applyHandleConstraints(
  kf: IKeyframe,
  editedHandle: 'left' | 'right',
  type?: KeyframeHandleType,
): void {
  const handleType =
    type ?? (editedHandle === 'left' ? kf.handleTypeLeft : kf.handleTypeRight) ?? 'aligned';

  if (handleType === 'free') {
    return; // Independent handles
  }

  if (handleType === 'aligned' || handleType === 'auto') {
    if (editedHandle === 'right' && kf.handleRight && kf.handleLeft) {
      const angle = Math.atan2(kf.handleRight.value, kf.handleRight.frame);
      const leftLen = Math.hypot(kf.handleLeft.frame, kf.handleLeft.value) || 1;
      const oppAngle = angle + Math.PI;
      kf.handleLeft.frame = Math.cos(oppAngle) * leftLen;
      kf.handleLeft.value = Math.sin(oppAngle) * leftLen;
    } else if (editedHandle === 'left' && kf.handleLeft && kf.handleRight) {
      const angle = Math.atan2(kf.handleLeft.value, kf.handleLeft.frame);
      const rightLen = Math.hypot(kf.handleRight.frame, kf.handleRight.value) || 1;
      const oppAngle = angle + Math.PI;
      kf.handleRight.frame = Math.cos(oppAngle) * rightLen;
      kf.handleRight.value = Math.sin(oppAngle) * rightLen;
    }
  }
}

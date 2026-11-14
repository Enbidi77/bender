import type { Vector3 } from '@blender-elt/contracts';

/**
 * 3D Vector Math Helpers
 */
export function vAdd(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vSub(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vScale(a: Vector3, s: number): Vector3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function vDot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vCross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function vLengthSq(a: Vector3): number {
  return a.x * a.x + a.y * a.y + a.z * a.z;
}

export function vLength(a: Vector3): number {
  return Math.sqrt(vLengthSq(a));
}

export function vDist(a: Vector3, b: Vector3): number {
  return vLength(vSub(a, b));
}

export function vNormalize(a: Vector3): Vector3 {
  const len = vLength(a);
  if (len < 1e-9) return { x: 0, y: 1, z: 0 };
  return vScale(a, 1 / len);
}

/**
 * Rotates vector v around an arbitrary normalized axis by angle (radians).
 * Rodrigues' rotation formula.
 */
export function vRotateAroundAxis(v: Vector3, axis: Vector3, angle: number): Vector3 {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const dot = vDot(axis, v);
  const cross = vCross(axis, v);

  return {
    x: v.x * cosA + cross.x * sinA + axis.x * dot * (1 - cosA),
    y: v.y * cosA + cross.y * sinA + axis.y * dot * (1 - cosA),
    z: v.z * cosA + cross.z * sinA + axis.z * dot * (1 - cosA),
  };
}

export interface TwoBoneIKOptions {
  root: Vector3; // Shoulder / Hip joint
  joint: Vector3; // Elbow / Knee joint
  end: Vector3; // Wrist / Ankle joint
  target: Vector3; // Target position
  poleTarget?: Vector3; // Pole direction target
  poleAngle?: number; // Radians to rotate bending plane
}

export interface TwoBoneIKResult {
  root: Vector3;
  joint: Vector3;
  end: Vector3;
  reached: boolean;
}

/**
 * Analytical 2-bone Inverse Kinematics solver using the Law of Cosines.
 * Computes exact joint bending for arms and legs.
 */
export function solveTwoBoneIK(options: TwoBoneIKOptions): TwoBoneIKResult {
  const { root, joint, end, target, poleTarget, poleAngle = 0 } = options;

  const l1 = vDist(root, joint);
  const l2 = vDist(joint, end);

  const toTarget = vSub(target, root);
  const d = vLength(toTarget);
  const dir = d > 1e-6 ? vScale(toTarget, 1 / d) : { x: 0, y: 1, z: 0 };

  // Case 1: Unreachable target (fully stretched)
  if (d >= l1 + l2) {
    const jointPos = vAdd(root, vScale(dir, l1));
    const endPos = vAdd(root, vScale(dir, l1 + l2));
    return {
      root,
      joint: jointPos,
      end: endPos,
      reached: false,
    };
  }

  // Case 2: Target closer than minimum fold distance |l1 - l2|
  const minReach = Math.abs(l1 - l2);
  if (d <= minReach) {
    const jointPos = vAdd(root, vScale(dir, l1));
    const endPos = vAdd(root, vScale(dir, minReach));
    return {
      root,
      joint: jointPos,
      end: endPos,
      reached: false,
    };
  }

  // Case 3: Valid triangle solved via Law of Cosines
  // l2^2 = l1^2 + d^2 - 2 * l1 * d * cos(alpha)
  const cosAlpha = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const alpha = Math.acos(cosAlpha);

  // Determine bending plane using pole target or initial joint position
  const poleHint = poleTarget ? vSub(poleTarget, root) : vSub(joint, root);
  let normal = vCross(dir, poleHint);

  if (vLengthSq(normal) < 1e-8) {
    // If pole vector is collinear with target direction, pick arbitrary perpendicular
    const arbitrary = Math.abs(dir.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    normal = vCross(dir, arbitrary);
  }
  const normUnit = vNormalize(normal);

  // Vector perpendicular to target line in bending plane
  let bendDir = vCross(normUnit, dir);
  if (vDot(bendDir, poleHint) < 0) {
    bendDir = vScale(bendDir, -1);
  }

  // Apply pole angle rotation around target line if specified
  if (Math.abs(poleAngle) > 1e-6) {
    bendDir = vRotateAroundAxis(bendDir, dir, poleAngle);
  }

  // Joint position computed by trigonometry
  const jointPos = vAdd(
    root,
    vAdd(vScale(dir, l1 * Math.cos(alpha)), vScale(bendDir, l1 * Math.sin(alpha))),
  );

  return {
    root,
    joint: jointPos,
    end: { ...target },
    reached: true,
  };
}

export interface FABRIKChainOptions {
  joints: Vector3[];
  target: Vector3;
  tolerance?: number;
  maxIterations?: number;
}

export interface FABRIKChainResult {
  joints: Vector3[];
  reached: boolean;
  iterations: number;
}

/**
 * Forward And Backward Reaching Inverse Kinematics (FABRIK) solver for N-bone chains.
 */
export function solveFABRIK(options: FABRIKChainOptions): FABRIKChainResult {
  const { joints, target, tolerance = 1e-4, maxIterations = 20 } = options;

  if (joints.length < 2) {
    return {
      joints: joints.map((j) => ({ ...j })),
      reached: true,
      iterations: 0,
    };
  }

  const n = joints.length;
  const p: Vector3[] = joints.map((j) => ({ ...j }));

  // Pre-calculate bone segment lengths and total reach
  const lengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < n - 1; i++) {
    const len = vDist(p[i], p[i + 1]);
    lengths.push(len);
    totalLength += len;
  }

  const rootPos = { ...p[0] };
  const distToTarget = vDist(rootPos, target);

  // If target is unreachable, stretch fully toward target
  if (distToTarget >= totalLength) {
    const dir = vNormalize(vSub(target, rootPos));
    for (let i = 0; i < n - 1; i++) {
      p[i + 1] = vAdd(p[i], vScale(dir, lengths[i]));
    }
    return {
      joints: p,
      reached: false,
      iterations: 1,
    };
  }

  // Iterative forward and backward reaching
  let iter = 0;
  let reached = false;

  for (; iter < maxIterations; iter++) {
    // Check if end-effector has reached target within tolerance
    if (vDist(p[n - 1], target) <= tolerance) {
      reached = true;
      break;
    }

    // Stage 1: Forward reaching (from target backward to root)
    p[n - 1] = { ...target };
    for (let i = n - 2; i >= 0; i--) {
      const segLen = vDist(p[i + 1], p[i]);
      const lambda = segLen > 1e-9 ? lengths[i] / segLen : 0;
      p[i] = vAdd(vScale(p[i + 1], 1 - lambda), vScale(p[i], lambda));
    }

    // Stage 2: Backward reaching (from root forward to target)
    p[0] = { ...rootPos };
    for (let i = 0; i < n - 1; i++) {
      const segLen = vDist(p[i + 1], p[i]);
      const lambda = segLen > 1e-9 ? lengths[i] / segLen : 0;
      p[i + 1] = vAdd(vScale(p[i], 1 - lambda), vScale(p[i + 1], lambda));
    }
  }

  if (vDist(p[n - 1], target) <= tolerance) {
    reached = true;
  }

  return {
    joints: p,
    reached,
    iterations: iter,
  };
}

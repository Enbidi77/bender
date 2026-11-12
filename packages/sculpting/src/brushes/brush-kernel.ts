import * as THREE from 'three';
import type {
  BrushFalloffType,
  SculptBrushConfig,
  SculptStrokePoint,
} from '@blender-elt/contracts';

/**
 * Computes the normalized attenuation factor [0, 1] for a vertex at distance d from stroke center.
 */
export function computeFalloff(dist: number, radius: number, profile: BrushFalloffType): number {
  if (radius <= 0) return 0.0;
  if (dist >= radius) return 0.0;
  if (dist <= 0) return 1.0;

  const t = Math.max(0.0, Math.min(1.0, dist / radius));

  switch (profile) {
    case 'smooth': {
      // Blender standard smooth falloff: (1 - t^2)^3
      const oneMinusTSq = 1.0 - t * t;
      return oneMinusTSq * oneMinusTSq * oneMinusTSq;
    }
    case 'sphere': {
      // Spherical dome profile: sqrt(1 - t^2)
      return Math.sqrt(Math.max(0.0, 1.0 - t * t));
    }
    case 'sharp': {
      // Needle-sharp peak: (1 - t)^3
      const oneMinusT = 1.0 - t;
      return oneMinusT * oneMinusT * oneMinusT;
    }
    case 'linear': {
      // Straight line from 1.0 at center to 0.0 at perimeter
      return 1.0 - t;
    }
    case 'constant': {
      // 1.0 inside radius, 0.0 outside
      return 1.0;
    }
    default: {
      const oneMinusTSq = 1.0 - t * t;
      return oneMinusTSq * oneMinusTSq * oneMinusTSq;
    }
  }
}

/**
 * Calculates effective displacement scale considering brush strength, falloff, and vertex mask.
 * Mask = 0.0 => 100% deformation.
 * Mask = 1.0 => 0% deformation (vertex is locked).
 */
export function calculateEffectiveFactor(
  falloff: number,
  strength: number,
  maskWeight: number,
): number {
  const maskProtection = 1.0 - Math.max(0.0, Math.min(1.0, maskWeight));
  return falloff * strength * maskProtection;
}

/**
 * Normalizes stylus pressure and derives modulated radius and strength.
 */
export function evaluateBrushDynamics(
  config: SculptBrushConfig,
  strokePoint: SculptStrokePoint,
): { radius: number; strength: number } {
  let radius = config.radius;
  let strength = config.strength;

  if (config.useStylusPressure && strokePoint.pressure > 0) {
    const p = Math.max(0.05, Math.min(1.0, strokePoint.pressure));
    if (config.pressureAffectsSize ?? true) {
      radius = config.radius * p;
    }
    if (config.pressureAffectsStrength ?? true) {
      strength = config.strength * p;
    }
  }

  return { radius, strength };
}

/**
 * Helper to compute the average normal and plane for hit vertices.
 */
export function computeAveragePlane(
  positions: Float32Array,
  indices: number[],
  hitCenter: THREE.Vector3,
  defaultNormal: THREE.Vector3,
): { planePoint: THREE.Vector3; planeNormal: THREE.Vector3 } {
  if (indices.length === 0) {
    return {
      planePoint: hitCenter.clone(),
      planeNormal: defaultNormal.clone(),
    };
  }

  const planePoint = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (const idx of indices) {
    const pIdx = idx * 3;
    v.set(positions[pIdx], positions[pIdx + 1], positions[pIdx + 2]);
    planePoint.add(v);
  }
  planePoint.divideScalar(indices.length);

  return {
    planePoint,
    planeNormal: defaultNormal.clone().normalize(),
  };
}

import * as THREE from 'three';
import type { SculptStrokePoint } from '@blender-elt/contracts';

/**
 * Linearly and spherically interpolates intermediate stroke samples between two points
 * based on brush spacing distance.
 */
export function interpolateStrokePoints(
  p1: SculptStrokePoint,
  p2: SculptStrokePoint,
  stepDistance: number,
): SculptStrokePoint[] {
  if (stepDistance <= 0) return [p2];

  const pos1 = new THREE.Vector3(p1.point.x, p1.point.y, p1.point.z);
  const pos2 = new THREE.Vector3(p2.point.x, p2.point.y, p2.point.z);
  const totalDist = pos1.distanceTo(pos2);

  if (totalDist < stepDistance) {
    return [];
  }

  const norm1 = new THREE.Vector3(p1.normal.x, p1.normal.y, p1.normal.z).normalize();
  const norm2 = new THREE.Vector3(p2.normal.x, p2.normal.y, p2.normal.z).normalize();

  const steps = Math.floor(totalDist / stepDistance);
  const results: SculptStrokePoint[] = [];

  for (let i = 1; i <= steps; i++) {
    const t = (i * stepDistance) / totalDist;
    const interPos = new THREE.Vector3().lerpVectors(pos1, pos2, t);
    const interNorm = new THREE.Vector3().lerpVectors(norm1, norm2, t).normalize();
    const interPressure = p1.pressure + (p2.pressure - p1.pressure) * t;
    const interTime = p1.timestamp + (p2.timestamp - p1.timestamp) * t;

    results.push({
      point: { x: interPos.x, y: interPos.y, z: interPos.z },
      normal: { x: interNorm.x, y: interNorm.y, z: interNorm.z },
      pressure: interPressure,
      timestamp: interTime,
    });
  }

  return results;
}

/**
 * Smooth stroke / Lazy mouse stabilizer filter.
 */
export function applyStrokeStabilizer(
  currentPos: THREE.Vector3,
  previousPos: THREE.Vector3,
  smoothFactor: number,
): THREE.Vector3 {
  const factor = Math.max(0.0, Math.min(0.95, smoothFactor));
  return new THREE.Vector3().lerpVectors(currentPos, previousPos, factor);
}

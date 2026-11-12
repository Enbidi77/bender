import * as THREE from 'three';
import type { ISculptBrush, SculptBrushContext } from './brush-definition.js';
import { computeFalloff, calculateEffectiveFactor, evaluateBrushDynamics } from './brush-kernel.js';

export class ClayStripsBrush implements ISculptBrush {
  public readonly type = 'clay-strips';
  public readonly name = 'Clay Strips';
  public readonly description = 'Applies directional clay ribbons oriented along stroke motion';

  public apply(ctx: SculptBrushContext): void {
    const { buffer, spatialIndex, config, strokePoint, strokeDirection } = ctx;
    const { radius, strength } = evaluateBrushDynamics(config, strokePoint);
    if (radius <= 0 || strength <= 0) return;

    const hit = new THREE.Vector3(strokePoint.point.x, strokePoint.point.y, strokePoint.point.z);
    const normal = new THREE.Vector3(
      strokePoint.normal.x,
      strokePoint.normal.y,
      strokePoint.normal.z,
    ).normalize();

    // Determine strip tangent and bitangent
    let tangent = strokeDirection
      ? strokeDirection.clone().normalize()
      : new THREE.Vector3(1, 0, 0);
    // Project tangent perpendicular to normal
    tangent.addScaledVector(normal, -tangent.dot(normal));
    if (tangent.lengthSq() < 1e-6) {
      tangent = new THREE.Vector3(0, 1, 0).cross(normal);
      if (tangent.lengthSq() < 1e-6) {
        tangent = new THREE.Vector3(1, 0, 0).cross(normal);
      }
    }
    tangent.normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

    const sign = config.direction === 'subtract' ? -1.0 : 1.0;
    const targetHeight = sign * radius * 0.25;

    const query = spatialIndex.queryRadius(hit, radius);
    const v = new THREE.Vector3();
    const diff = new THREE.Vector3();

    for (const item of query) {
      const vIdx = item.index;
      const mask = buffer.getMask(vIdx);
      if (mask >= 1.0) continue;

      buffer.getVertex(vIdx, v);
      diff.subVectors(v, hit);

      // Rectangular profile along tangent and bitangent
      const u = Math.abs(diff.dot(tangent)) / radius;
      const w = Math.abs(diff.dot(bitangent)) / (radius * 0.6); // Slightly narrower width for strips
      if (u > 1.0 || w > 1.0) continue;

      const profile = Math.max(0.0, 1.0 - u * u) * Math.max(0.0, 1.0 - w * w);
      const falloff = computeFalloff(item.dist, radius, config.falloff) * profile;
      const factor = calculateEffectiveFactor(falloff, strength, mask);
      if (factor <= 1e-6) continue;

      const currentHeight = diff.dot(normal);
      let deltaHeight: number;
      if (sign > 0) {
        const remaining = targetHeight - currentHeight;
        if (remaining <= 0) continue;
        deltaHeight = Math.min(remaining, factor * radius * 0.18);
      } else {
        const remaining = targetHeight - currentHeight;
        if (remaining >= 0) continue;
        deltaHeight = Math.max(remaining, -factor * radius * 0.18);
      }

      v.addScaledVector(normal, deltaHeight);
      buffer.setVertex(vIdx, v.x, v.y, v.z);
    }
  }
}

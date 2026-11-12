import * as THREE from 'three';
import type { ISculptBrush, SculptBrushContext } from './brush-definition.js';
import { computeFalloff, calculateEffectiveFactor, evaluateBrushDynamics } from './brush-kernel.js';

export class ScrapeBrush implements ISculptBrush {
  public readonly type = 'scrape';
  public readonly name = 'Scrape';
  public readonly description = 'Trims peaks above the hit plane (or fills valleys below)';

  public apply(ctx: SculptBrushContext): void {
    const { buffer, spatialIndex, config, strokePoint } = ctx;
    const { radius, strength } = evaluateBrushDynamics(config, strokePoint);
    if (radius <= 0 || strength <= 0) return;

    const hit = new THREE.Vector3(strokePoint.point.x, strokePoint.point.y, strokePoint.point.z);
    const normal = new THREE.Vector3(
      strokePoint.normal.x,
      strokePoint.normal.y,
      strokePoint.normal.z,
    ).normalize();

    const sign = config.direction === 'subtract' ? -1.0 : 1.0;
    const query = spatialIndex.queryRadius(hit, radius);
    const v = new THREE.Vector3();
    const diff = new THREE.Vector3();

    for (const item of query) {
      const vIdx = item.index;
      const mask = buffer.getMask(vIdx);
      if (mask >= 1.0) continue;

      const falloff = computeFalloff(item.dist, radius, config.falloff);
      const factor = calculateEffectiveFactor(falloff, strength, mask);
      if (factor <= 1e-6) continue;

      buffer.getVertex(vIdx, v);
      diff.subVectors(v, hit);

      const distToPlane = diff.dot(normal);

      if (sign > 0) {
        // Scrape mode: only vertices above the plane (distToPlane > 0)
        if (distToPlane <= 0) continue;
        v.addScaledVector(normal, -distToPlane * factor * 0.5);
      } else {
        // Fill mode: only vertices below the plane (distToPlane < 0)
        if (distToPlane >= 0) continue;
        v.addScaledVector(normal, -distToPlane * factor * 0.5);
      }

      buffer.setVertex(vIdx, v.x, v.y, v.z);
    }
  }
}

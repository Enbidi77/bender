import * as THREE from 'three';
import type { ISculptBrush, SculptBrushContext } from './brush-definition.js';
import { computeFalloff, calculateEffectiveFactor, evaluateBrushDynamics } from './brush-kernel.js';

export class FlattenBrush implements ISculptBrush {
  public readonly type = 'flatten';
  public readonly name = 'Flatten';
  public readonly description = 'Projects vertices toward the average plane of the affected area';

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

      // Distance from the plane defined by (hit, normal)
      const distToPlane = diff.dot(normal);

      // Project toward plane
      v.addScaledVector(normal, -distToPlane * factor * 0.4);
      buffer.setVertex(vIdx, v.x, v.y, v.z);
    }
  }
}

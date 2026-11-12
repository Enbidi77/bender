import * as THREE from 'three';
import type { ISculptBrush, SculptBrushContext } from './brush-definition.js';
import { computeFalloff, calculateEffectiveFactor, evaluateBrushDynamics } from './brush-kernel.js';

export class ClayBrush implements ISculptBrush {
  public readonly type = 'clay';
  public readonly name = 'Clay';
  public readonly description = 'Builds up or tears down surface toward a limiting plane';

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
    const maxOffset = radius * 0.3 * (config.planeOffset ?? 1.0);
    const targetHeight = sign * maxOffset;

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
      const currentHeight = diff.dot(normal);

      // Desired displacement towards targetHeight
      let deltaHeight: number;
      if (sign > 0) {
        // Build up, but don't exceed target plane
        const remaining = targetHeight - currentHeight;
        if (remaining <= 0) continue;
        deltaHeight = Math.min(remaining, factor * radius * 0.15);
      } else {
        // Dig down, but don't exceed target plane
        const remaining = targetHeight - currentHeight;
        if (remaining >= 0) continue;
        deltaHeight = Math.max(remaining, -factor * radius * 0.15);
      }

      v.addScaledVector(normal, deltaHeight);
      buffer.setVertex(vIdx, v.x, v.y, v.z);
    }
  }
}

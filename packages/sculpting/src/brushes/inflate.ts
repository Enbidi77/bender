import * as THREE from 'three';
import type { ISculptBrush, SculptBrushContext } from './brush-definition.js';
import { computeFalloff, calculateEffectiveFactor, evaluateBrushDynamics } from './brush-kernel.js';

export class InflateBrush implements ISculptBrush {
  public readonly type = 'inflate';
  public readonly name = 'Inflate';
  public readonly description =
    'Displaces vertices along individual vertex normals (volumetric inflate/deflate)';

  public apply(ctx: SculptBrushContext): void {
    const { buffer, spatialIndex, config, strokePoint } = ctx;
    const { radius, strength } = evaluateBrushDynamics(config, strokePoint);
    if (radius <= 0 || strength <= 0) return;

    const hit = new THREE.Vector3(strokePoint.point.x, strokePoint.point.y, strokePoint.point.z);
    const sign = config.direction === 'subtract' ? -1.0 : 1.0;
    const query = spatialIndex.queryRadius(hit, radius);

    const v = new THREE.Vector3();
    const n = new THREE.Vector3();

    for (const item of query) {
      const vIdx = item.index;
      const mask = buffer.getMask(vIdx);
      if (mask >= 1.0) continue;

      const falloff = computeFalloff(item.dist, radius, config.falloff);
      const factor = calculateEffectiveFactor(falloff, strength, mask);
      if (factor <= 1e-6) continue;

      buffer.getVertex(vIdx, v);
      buffer.getNormal(vIdx, n);

      v.addScaledVector(n, sign * factor * radius * 0.2);
      buffer.setVertex(vIdx, v.x, v.y, v.z);
    }
  }
}

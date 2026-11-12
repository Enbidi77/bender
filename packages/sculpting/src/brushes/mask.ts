import * as THREE from 'three';
import type { ISculptBrush, SculptBrushContext } from './brush-definition.js';
import { computeFalloff, evaluateBrushDynamics } from './brush-kernel.js';

export class MaskBrush implements ISculptBrush {
  public readonly type = 'mask';
  public readonly name = 'Mask';
  public readonly description =
    'Paints protective scalar mask weights onto vertices (0.0=free, 1.0=locked)';

  public apply(ctx: SculptBrushContext): void {
    const { buffer, spatialIndex, config, strokePoint } = ctx;
    const { radius, strength } = evaluateBrushDynamics(config, strokePoint);
    if (radius <= 0 || strength <= 0) return;

    const hit = new THREE.Vector3(strokePoint.point.x, strokePoint.point.y, strokePoint.point.z);
    const sign = config.direction === 'subtract' ? -1.0 : 1.0;
    const query = spatialIndex.queryRadius(hit, radius);

    for (const item of query) {
      const vIdx = item.index;
      const currentMask = buffer.getMask(vIdx);

      const falloff = computeFalloff(item.dist, radius, config.falloff);
      const delta = sign * falloff * strength;

      const newMask = Math.max(0.0, Math.min(1.0, currentMask + delta));
      buffer.setMask(vIdx, newMask);
    }
  }
}

import * as THREE from 'three';
import type { ISculptBrush, SculptBrushContext } from './brush-definition.js';
import { computeFalloff, calculateEffectiveFactor, evaluateBrushDynamics } from './brush-kernel.js';

export class BlobBrush implements ISculptBrush {
  public readonly type = 'blob';
  public readonly name = 'Blob';
  public readonly description = 'Produces spherical surface bulges pushing radially outward';

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
    const radial = new THREE.Vector3();

    for (const item of query) {
      const vIdx = item.index;
      const mask = buffer.getMask(vIdx);
      if (mask >= 1.0) continue;

      // Blob uses spherical falloff
      const falloff = computeFalloff(item.dist, radius, 'sphere');
      const factor = calculateEffectiveFactor(falloff, strength, mask);
      if (factor <= 1e-6) continue;

      buffer.getVertex(vIdx, v);
      radial.subVectors(v, hit);

      // Blend spherical radial direction with surface normal
      if (radial.lengthSq() > 1e-6) {
        radial.normalize();
      } else {
        radial.copy(normal);
      }

      const dispDir = normal.clone().lerp(radial, 0.4).normalize();
      v.addScaledVector(dispDir, sign * factor * radius * 0.22);

      buffer.setVertex(vIdx, v.x, v.y, v.z);
    }
  }
}

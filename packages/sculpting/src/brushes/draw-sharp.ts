import * as THREE from 'three';
import type { ISculptBrush, SculptBrushContext } from './brush-definition.js';
import { computeFalloff, calculateEffectiveFactor, evaluateBrushDynamics } from './brush-kernel.js';

export class DrawSharpBrush implements ISculptBrush {
  public readonly type = 'draw-sharp';
  public readonly name = 'Draw Sharp';
  public readonly description = 'Produces sharp, crisp creases and ridges';

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
    const toCenter = new THREE.Vector3();

    for (const item of query) {
      const vIdx = item.index;
      const mask = buffer.getMask(vIdx);
      if (mask >= 1.0) continue;

      // Force sharp falloff profile for Draw Sharp
      const falloff = computeFalloff(item.dist, radius, 'sharp');
      const factor = calculateEffectiveFactor(falloff, strength, mask);
      if (factor <= 1e-6) continue;

      buffer.getVertex(vIdx, v);

      // Normal displacement
      const disp = normal.clone().multiplyScalar(sign * factor * radius * 0.25);
      v.add(disp);

      // Slight pinch toward center to sharpen ridge/crease
      toCenter.subVectors(hit, v);
      // Project onto tangent plane perpendicular to normal
      toCenter.addScaledVector(normal, -toCenter.dot(normal));
      v.addScaledVector(toCenter, factor * 0.15);

      buffer.setVertex(vIdx, v.x, v.y, v.z);
    }
  }
}

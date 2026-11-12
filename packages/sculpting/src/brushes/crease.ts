import * as THREE from 'three';
import type { ISculptBrush, SculptBrushContext } from './brush-definition.js';
import { computeFalloff, calculateEffectiveFactor, evaluateBrushDynamics } from './brush-kernel.js';

export class CreaseBrush implements ISculptBrush {
  public readonly type = 'crease';
  public readonly name = 'Crease';
  public readonly description =
    'Pinches vertices inward while creating an indented or raised valley/ridge';

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

    // Default crease pushes inward (negative displacement) in 'add' mode, or outward in 'subtract' mode
    const sign = config.direction === 'subtract' ? 1.0 : -1.0;
    const pinchFactor = config.creasePinch ?? 0.5;

    const query = spatialIndex.queryRadius(hit, radius);
    const v = new THREE.Vector3();
    const toCenter = new THREE.Vector3();

    for (const item of query) {
      const vIdx = item.index;
      const mask = buffer.getMask(vIdx);
      if (mask >= 1.0) continue;

      const falloff = computeFalloff(item.dist, radius, 'sharp');
      const factor = calculateEffectiveFactor(falloff, strength, mask);
      if (factor <= 1e-6) continue;

      buffer.getVertex(vIdx, v);

      // Normal displacement (indents or elevates)
      v.addScaledVector(normal, sign * factor * radius * 0.25);

      // Pinch displacement (contracts towards center along tangent plane)
      toCenter.subVectors(hit, v);
      toCenter.addScaledVector(normal, -toCenter.dot(normal)); // remove normal component
      v.addScaledVector(toCenter, factor * pinchFactor * 0.4);

      buffer.setVertex(vIdx, v.x, v.y, v.z);
    }
  }
}

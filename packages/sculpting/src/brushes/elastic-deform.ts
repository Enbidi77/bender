import * as THREE from 'three';
import type { ISculptBrush, SculptBrushContext } from './brush-definition.js';
import { computeFalloff, calculateEffectiveFactor, evaluateBrushDynamics } from './brush-kernel.js';

interface ElasticVertexSnapshot {
  index: number;
  initialPos: THREE.Vector3;
  initialDist: number;
}

export class ElasticDeformBrush implements ISculptBrush {
  public readonly type = 'elastic-deform';
  public readonly name = 'Elastic Deform';
  public readonly description = 'Volume-preserving elastic deformation based on Kelvinlet dynamics';

  private startHit: THREE.Vector3 | null = null;
  private affectedVertices: ElasticVertexSnapshot[] = [];

  public onStrokeBegin(ctx: SculptBrushContext): void {
    const { buffer, spatialIndex, config, strokePoint } = ctx;
    const { radius } = evaluateBrushDynamics(config, strokePoint);
    if (radius <= 0) return;

    this.startHit = new THREE.Vector3(
      strokePoint.point.x,
      strokePoint.point.y,
      strokePoint.point.z,
    );
    this.affectedVertices = [];

    const query = spatialIndex.queryRadius(this.startHit, radius);
    for (const item of query) {
      const v = buffer.getVertex(item.index);
      this.affectedVertices.push({
        index: item.index,
        initialPos: v.clone(),
        initialDist: item.dist,
      });
    }
  }

  public apply(ctx: SculptBrushContext): void {
    if (!this.startHit || this.affectedVertices.length === 0) {
      this.onStrokeBegin(ctx);
    }
    if (!this.startHit) return;

    const { buffer, config, strokePoint } = ctx;
    const { radius, strength } = evaluateBrushDynamics(config, strokePoint);
    if (radius <= 0 || strength <= 0) return;

    const currHit = new THREE.Vector3(
      strokePoint.point.x,
      strokePoint.point.y,
      strokePoint.point.z,
    );
    const dragDelta = currHit.clone().sub(this.startHit);

    const v = new THREE.Vector3();
    const r = radius;

    for (const item of this.affectedVertices) {
      const mask = buffer.getMask(item.index);
      if (mask >= 1.0) continue;

      const rSq = item.initialDist * item.initialDist;
      const epsSq = r * r * 0.25;

      // Regularized Kelvinlet displacement kernel:
      // u(r) ~ ((2*eps^2 + r^2) / (eps^2 + r^2)^(3/2))
      const denom = Math.pow(epsSq + rSq, 1.5);
      const kelvinFactor = denom > 1e-6 ? (2.0 * epsSq + rSq) / denom : 1.0;
      const normalizedKernel = kelvinFactor * Math.sqrt(epsSq);

      const falloff = computeFalloff(item.initialDist, radius, 'smooth') * normalizedKernel;
      const factor = calculateEffectiveFactor(falloff, strength, mask);
      if (factor <= 1e-6) continue;

      v.copy(item.initialPos).addScaledVector(dragDelta, factor);
      buffer.setVertex(item.index, v.x, v.y, v.z);
    }
  }

  public onStrokeEnd(): void {
    this.startHit = null;
    this.affectedVertices = [];
  }
}

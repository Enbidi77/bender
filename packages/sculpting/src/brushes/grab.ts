import * as THREE from 'three';
import type { ISculptBrush, SculptBrushContext } from './brush-definition.js';
import { computeFalloff, calculateEffectiveFactor, evaluateBrushDynamics } from './brush-kernel.js';

interface GrabVertexSnapshot {
  index: number;
  initialPos: THREE.Vector3;
  initialDist: number;
}

export class GrabBrush implements ISculptBrush {
  public readonly type = 'grab';
  public readonly name = 'Grab';
  public readonly description =
    'Translates vertices within radius by mouse drag vector with falloff';

  private startHit: THREE.Vector3 | null = null;
  private affectedVertices: GrabVertexSnapshot[] = [];

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
    for (const item of this.affectedVertices) {
      const mask = buffer.getMask(item.index);
      if (mask >= 1.0) continue;

      const falloff = computeFalloff(item.initialDist, radius, config.falloff);
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

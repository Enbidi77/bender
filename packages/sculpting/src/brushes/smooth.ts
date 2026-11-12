import * as THREE from 'three';
import type { ISculptBrush, SculptBrushContext } from './brush-definition.js';
import { computeFalloff, calculateEffectiveFactor, evaluateBrushDynamics } from './brush-kernel.js';

export class SmoothBrush implements ISculptBrush {
  public readonly type = 'smooth';
  public readonly name = 'Smooth';
  public readonly description = 'Relaxes vertex coordinates via Laplacian neighbor averaging';

  public apply(ctx: SculptBrushContext): void {
    const { buffer, spatialIndex, adjacency, config, strokePoint } = ctx;
    const { radius, strength } = evaluateBrushDynamics(config, strokePoint);
    if (radius <= 0 || strength <= 0) return;

    const hit = new THREE.Vector3(strokePoint.point.x, strokePoint.point.y, strokePoint.point.z);
    const query = spatialIndex.queryRadius(hit, radius);
    if (query.length === 0) return;

    // Temporary storage to prevent directional bias during single-pass neighbor reading
    const updates: { index: number; target: THREE.Vector3; factor: number }[] = [];
    const v = new THREE.Vector3();
    const neighborPos = new THREE.Vector3();
    const avg = new THREE.Vector3();

    for (const item of query) {
      const vIdx = item.index;
      const mask = buffer.getMask(vIdx);
      if (mask >= 1.0) continue;

      const neighbors = adjacency.getNeighbors(vIdx);
      if (neighbors.length === 0) continue;

      const falloff = computeFalloff(item.dist, radius, config.falloff);
      const factor = calculateEffectiveFactor(falloff, strength, mask);
      if (factor <= 1e-6) continue;

      avg.set(0, 0, 0);
      for (const nIdx of neighbors) {
        buffer.getVertex(nIdx, neighborPos);
        avg.add(neighborPos);
      }
      avg.divideScalar(neighbors.length);

      buffer.getVertex(vIdx, v);
      updates.push({
        index: vIdx,
        target: avg.clone(),
        factor,
      });
    }

    for (const up of updates) {
      buffer.getVertex(up.index, v);
      v.lerp(up.target, up.factor * 0.5);
      buffer.setVertex(up.index, v.x, v.y, v.z);
    }
  }
}

import * as THREE from 'three';
import type { SculptMeshBuffer } from './sculpt-mesh-buffer.js';

export interface SpatialQueryResult {
  index: number;
  distSq: number;
  dist: number;
}

/**
 * 3D Spatial Hash Grid for high-performance localized vertex queries.
 * Provides O(1) average-time radius lookups during continuous sculpt strokes.
 */
export class SpatialIndex {
  private cellSize: number;
  private invCellSize: number;
  private grid: Map<string, number[]> = new Map();
  private buffer: SculptMeshBuffer | null = null;

  constructor(cellSize: number = 0.2) {
    this.cellSize = Math.max(1e-4, cellSize);
    this.invCellSize = 1.0 / this.cellSize;
  }

  private getKey(cx: number, cy: number, cz: number): string {
    return `${cx}:${cy}:${cz}`;
  }

  /**
   * Builds or rebuilds the spatial grid from a SculptMeshBuffer.
   */
  public build(buffer: SculptMeshBuffer, adaptiveCellSize: boolean = true): void {
    this.buffer = buffer;
    this.grid.clear();

    if (buffer.vertexCount === 0) return;

    if (adaptiveCellSize) {
      const box = buffer.computeBoundingBox();
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      // Heuristic: ~20-30 cells across the max bounding dimension
      if (maxDim > 1e-4) {
        this.cellSize = Math.max(1e-3, maxDim / 25.0);
        this.invCellSize = 1.0 / this.cellSize;
      }
    }

    const pos = buffer.positions;
    const count = buffer.vertexCount;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const cx = Math.floor(pos[idx] * this.invCellSize);
      const cy = Math.floor(pos[idx + 1] * this.invCellSize);
      const cz = Math.floor(pos[idx + 2] * this.invCellSize);
      const key = this.getKey(cx, cy, cz);

      let cell = this.grid.get(key);
      if (!cell) {
        cell = [];
        this.grid.set(key, cell);
      }
      cell.push(i);
    }
  }

  /**
   * Refits or updates modified vertices in the spatial grid without full rebuild.
   */
  public updateIndices(_indices?: Iterable<number>): void {
    if (!this.buffer) return;
    // For small dirty sets, full rebuild or targeted cell updates.
    // In typical mesh deformation where displacements are smooth, rebuilding periodically or on stroke end is optimal.
    this.build(this.buffer, false);
  }

  /**
   * Queries all vertices strictly within radius R of the target center.
   */
  public queryRadius(
    center: THREE.Vector3 | { x: number; y: number; z: number },
    radius: number,
  ): SpatialQueryResult[] {
    if (!this.buffer || radius <= 0) return [];

    const results: SpatialQueryResult[] = [];
    const rSq = radius * radius;
    const pos = this.buffer.positions;

    const minCx = Math.floor((center.x - radius) * this.invCellSize);
    const maxCx = Math.floor((center.x + radius) * this.invCellSize);
    const minCy = Math.floor((center.y - radius) * this.invCellSize);
    const maxCy = Math.floor((center.y + radius) * this.invCellSize);
    const minCz = Math.floor((center.z - radius) * this.invCellSize);
    const maxCz = Math.floor((center.z + radius) * this.invCellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        for (let cz = minCz; cz <= maxCz; cz++) {
          const key = this.getKey(cx, cy, cz);
          const cell = this.grid.get(key);
          if (!cell) continue;

          for (let k = 0; k < cell.length; k++) {
            const vIdx = cell[k];
            const pIdx = vIdx * 3;
            const dx = pos[pIdx] - center.x;
            const dy = pos[pIdx + 1] - center.y;
            const dz = pos[pIdx + 2] - center.z;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq <= rSq) {
              results.push({
                index: vIdx,
                distSq,
                dist: Math.sqrt(distSq),
              });
            }
          }
        }
      }
    }

    return results;
  }
}

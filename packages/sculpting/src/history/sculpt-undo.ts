import type { SculptMeshDelta } from '@blender-elt/contracts';
import type { SculptMeshBuffer } from '../geometry/sculpt-mesh-buffer.js';

interface VertexInitialState {
  x: number;
  y: number;
  z: number;
  mask: number;
}

/**
 * Tracks initial vertex positions and masks prior to modification during a sculpt stroke,
 * constructing a sparse, memory-efficient SculptMeshDelta on stroke completion.
 */
export class SculptUndoTracker {
  private nodeId: string;
  private buffer: SculptMeshBuffer;
  private initialStates: Map<number, VertexInitialState> = new Map();

  constructor(nodeId: string, buffer: SculptMeshBuffer) {
    this.nodeId = nodeId;
    this.buffer = buffer;
  }

  /**
   * Records vertex original state before it is modified by a brush.
   * Only records on first touch.
   */
  public captureVertex(index: number): void {
    if (!this.initialStates.has(index)) {
      const idx = index * 3;
      this.initialStates.set(index, {
        x: this.buffer.positions[idx],
        y: this.buffer.positions[idx + 1],
        z: this.buffer.positions[idx + 2],
        mask: this.buffer.getMask(index),
      });
    }
  }

  /**
   * Captures multiple vertices prior to modification.
   */
  public captureVertices(indices: Iterable<number>): void {
    for (const idx of indices) {
      this.captureVertex(idx);
    }
  }

  /**
   * Finalizes tracked changes into a sparse SculptMeshDelta.
   */
  public buildDelta(): SculptMeshDelta | null {
    const dirty = this.buffer.getDirtyIndices();
    if (dirty.length === 0) return null;

    // Filter to only vertices whose positions or masks actually changed
    const changedIndices: number[] = [];
    const eps = 1e-7;

    for (const vIdx of dirty) {
      const init = this.initialStates.get(vIdx);
      if (!init) continue;

      const pIdx = vIdx * 3;
      const dx = Math.abs(this.buffer.positions[pIdx] - init.x);
      const dy = Math.abs(this.buffer.positions[pIdx + 1] - init.y);
      const dz = Math.abs(this.buffer.positions[pIdx + 2] - init.z);
      const dm = Math.abs(this.buffer.getMask(vIdx) - init.mask);

      if (dx > eps || dy > eps || dz > eps || dm > eps) {
        changedIndices.push(vIdx);
      }
    }

    if (changedIndices.length === 0) return null;

    const count = changedIndices.length;
    const indices = new Uint32Array(count);
    const oldPositions = new Float32Array(count * 3);
    const newPositions = new Float32Array(count * 3);
    const oldMasks = new Float32Array(count);
    const newMasks = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const vIdx = changedIndices[i];
      indices[i] = vIdx;

      const init = this.initialStates.get(vIdx)!;
      const oldIdx = i * 3;
      oldPositions[oldIdx] = init.x;
      oldPositions[oldIdx + 1] = init.y;
      oldPositions[oldIdx + 2] = init.z;
      oldMasks[i] = init.mask;

      const pIdx = vIdx * 3;
      newPositions[oldIdx] = this.buffer.positions[pIdx];
      newPositions[oldIdx + 1] = this.buffer.positions[pIdx + 1];
      newPositions[oldIdx + 2] = this.buffer.positions[pIdx + 2];
      newMasks[i] = this.buffer.getMask(vIdx);
    }

    return {
      nodeId: this.nodeId,
      indices,
      oldPositions,
      newPositions,
      oldMasks,
      newMasks,
    };
  }

  public reset(): void {
    this.initialStates.clear();
  }
}

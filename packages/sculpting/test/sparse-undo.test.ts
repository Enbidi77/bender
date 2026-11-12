import { describe, it, expect } from 'vitest';
import { SculptMeshBuffer } from '../src/geometry/sculpt-mesh-buffer.js';
import { SculptUndoTracker } from '../src/history/sculpt-undo.js';
import { SculptStrokeCommand } from '../src/history/sculpt-stroke-command.js';
import type { CommandContext } from '@blender-elt/contracts';

describe('Sparse Undo/Redo & Delta Tracker', () => {
  function createDenseBuffer(count: number = 100): SculptMeshBuffer {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = i * 0.1;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }
    return new SculptMeshBuffer(positions);
  }

  it('records only modified vertices in SculptMeshDelta (sparse efficiency)', () => {
    const count = 1000;
    const buffer = createDenseBuffer(count);
    const tracker = new SculptUndoTracker('test-node', buffer);

    // Track vertex 5 and vertex 42
    tracker.captureVertex(5);
    tracker.captureVertex(42);

    // Modify only vertex 42
    buffer.setVertex(42, 4.2, 1.5, 0.8);

    const delta = tracker.buildDelta();
    expect(delta).not.toBeNull();
    // Vertex 5 was captured but not modified, so delta should contain strictly 1 vertex!
    expect(delta!.indices.length).toBe(1);
    expect(delta!.indices[0]).toBe(42);
    expect(delta!.oldPositions[0]).toBeCloseTo(4.2, 5); // 42 * 0.1
    expect(delta!.oldPositions[1]).toBe(0.0);
    expect(delta!.oldPositions[2]).toBe(0.0);

    expect(delta!.newPositions[0]).toBeCloseTo(4.2, 5);
    expect(delta!.newPositions[1]).toBeCloseTo(1.5, 5);
    expect(delta!.newPositions[2]).toBeCloseTo(0.8, 5);
  });

  it('SculptStrokeCommand restores exact initial positions on undo and reapplies on redo', () => {
    const buffer = createDenseBuffer(10);
    const tracker = new SculptUndoTracker('node-1', buffer);

    const initialV3 = buffer.getVertex(3);
    expect(initialV3.y).toBe(0.0);

    tracker.captureVertex(3);
    buffer.setVertex(3, 0.3, 2.5, -1.0);

    const delta = tracker.buildDelta()!;
    expect(delta).toBeDefined();

    const cmd = new SculptStrokeCommand(delta, 'Draw', buffer);
    const mockCtx: CommandContext = {
      state: {},
      dispatch: () => {},
    };

    // Undo -> positions should return exactly to 0.0
    cmd.undo(mockCtx);
    const restoredV3 = buffer.getVertex(3);
    expect(restoredV3.x).toBeCloseTo(0.3, 5);
    expect(restoredV3.y).toBe(0.0);
    expect(restoredV3.z).toBe(0.0);

    // Redo -> positions should reapply
    cmd.redo(mockCtx);
    const redoneV3 = buffer.getVertex(3);
    expect(redoneV3.y).toBe(2.5);
    expect(redoneV3.z).toBe(-1.0);
  });
});

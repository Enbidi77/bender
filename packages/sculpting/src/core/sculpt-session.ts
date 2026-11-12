import * as THREE from 'three';
import type { IMeshData, SculptStrokePoint } from '@blender-elt/contracts';
import { SculptMeshBuffer } from '../geometry/sculpt-mesh-buffer.js';
import { SpatialIndex } from '../geometry/spatial-index.js';
import { MeshAdjacency } from '../geometry/adjacency.js';
import { recomputeDirtyNormals } from '../geometry/normals.js';
import { BrushRegistry } from '../brushes/brush-registry.js';
import { StrokeSession } from '../strokes/stroke-session.js';
import { getSymmetricPoints } from '../strokes/symmetry.js';
import { SculptUndoTracker } from '../history/sculpt-undo.js';
import { SculptStrokeCommand } from '../history/sculpt-stroke-command.js';
import { sculptStore } from './sculpt-store.js';

export class SculptSession {
  private nodeId: string | null = null;
  private buffer: SculptMeshBuffer | null = null;
  private spatialIndex: SpatialIndex = new SpatialIndex();
  private adjacency: MeshAdjacency = new MeshAdjacency();
  private undoTracker: SculptUndoTracker | null = null;
  private activeStroke: StrokeSession | null = null;

  public attachMesh(
    nodeId: string,
    meshSource: IMeshData | SculptMeshBuffer | THREE.BufferGeometry,
  ): void {
    this.nodeId = nodeId;

    if (meshSource instanceof SculptMeshBuffer) {
      this.buffer = meshSource;
    } else if ('isBufferGeometry' in (meshSource as any)) {
      this.buffer = SculptMeshBuffer.fromBufferGeometry(meshSource as THREE.BufferGeometry);
    } else {
      this.buffer = SculptMeshBuffer.fromMeshData(meshSource as IMeshData);
    }

    this.spatialIndex.build(this.buffer);
    this.adjacency.build(this.buffer);
    this.undoTracker = new SculptUndoTracker(nodeId, this.buffer);

    sculptStore.getState().setActiveNodeId(nodeId);
    sculptStore.getState().setMeshMetrics(this.buffer.vertexCount, this.buffer.triangleCount);
  }

  public detachMesh(): void {
    this.cancelStroke();
    this.nodeId = null;
    this.buffer = null;
    this.undoTracker = null;
    sculptStore.getState().setActiveNodeId(null);
    sculptStore.getState().setMeshMetrics(0, 0);
  }

  public getBuffer(): SculptMeshBuffer | null {
    return this.buffer;
  }

  public getNodeId(): string | null {
    return this.nodeId;
  }

  public isStroking(): boolean {
    return this.activeStroke !== null;
  }

  public beginStroke(point: SculptStrokePoint): boolean {
    if (!this.buffer || !this.nodeId || !this.undoTracker) return false;

    const state = sculptStore.getState();
    const activeBrushType = state.activeBrush;
    const config = state.brushConfigs[activeBrushType];
    const strokeSettings = state.strokeSettings;
    const symmetry = state.symmetry;

    const brush = BrushRegistry.getInstance().get(activeBrushType);

    this.activeStroke = new StrokeSession({
      buffer: this.buffer,
      spatialIndex: this.spatialIndex,
      adjacency: this.adjacency,
      brush,
      config,
      strokeSettings,
      symmetry,
    });

    this.captureAffectedArea(point, config.radius);

    state.setIsStroking(true);
    this.activeStroke.begin(point);
    this.updateNormalsAndDirty();

    return true;
  }

  public updateStroke(point: SculptStrokePoint): void {
    if (!this.activeStroke || !this.buffer) return;

    const state = sculptStore.getState();
    const config = state.brushConfigs[state.activeBrush];

    this.captureAffectedArea(point, config.radius);
    this.activeStroke.update(point);
    this.updateNormalsAndDirty();
  }

  public endStroke(): SculptStrokeCommand | null {
    if (!this.activeStroke || !this.buffer || !this.undoTracker) return null;

    const duration = this.activeStroke.end();
    sculptStore.getState().setLastStrokeDuration(duration);
    sculptStore.getState().setIsStroking(false);

    // Finalize normals for any remaining dirty vertices
    this.updateNormalsAndDirty();

    // Rebuild spatial index with updated vertex positions
    this.spatialIndex.build(this.buffer, false);

    // Build sparse undo delta
    const delta = this.undoTracker.buildDelta();
    let command: SculptStrokeCommand | null = null;

    if (delta) {
      const brushName = sculptStore.getState().activeBrush;
      command = new SculptStrokeCommand(delta, brushName, this.buffer);
    }

    this.activeStroke = null;
    this.undoTracker.reset();
    this.buffer.clearDirty();

    return command;
  }

  public cancelStroke(): void {
    if (!this.activeStroke || !this.buffer || !this.undoTracker) return;

    // Restore any modified vertices to initial state
    const delta = this.undoTracker.buildDelta();
    if (delta) {
      const count = delta.indices.length;
      for (let i = 0; i < count; i++) {
        const vIdx = delta.indices[i];
        const pIdx = i * 3;
        this.buffer.setVertex(
          vIdx,
          delta.oldPositions[pIdx],
          delta.oldPositions[pIdx + 1],
          delta.oldPositions[pIdx + 2],
        );
        if (delta.oldMasks) {
          this.buffer.setMask(vIdx, delta.oldMasks[i]);
        }
      }
      this.buffer.computeVertexNormals();
      this.spatialIndex.build(this.buffer, false);
    }

    sculptStore.getState().setIsStroking(false);
    this.activeStroke = null;
    this.undoTracker.reset();
    this.buffer.clearDirty();
  }

  private captureAffectedArea(center: SculptStrokePoint, radius: number): void {
    if (!this.undoTracker) return;

    // Primary point query
    const query = this.spatialIndex.queryRadius(center.point, radius * 1.5);
    for (const item of query) {
      this.undoTracker.captureVertex(item.index);
    }

    // Symmetry points query
    const symmetry = sculptStore.getState().symmetry;
    const echoes = getSymmetricPoints(center, symmetry);
    for (const echo of echoes) {
      const echoQuery = this.spatialIndex.queryRadius(echo.point, radius * 1.5);
      for (const item of echoQuery) {
        this.undoTracker.captureVertex(item.index);
      }
    }
  }

  private updateNormalsAndDirty(): void {
    if (!this.buffer || !this.buffer.hasDirty()) return;

    const dirtyIndices = this.buffer.getDirtyIndices();
    recomputeDirtyNormals(this.buffer, dirtyIndices, this.adjacency);
  }
}

// Global sculpt session instance for application-wide access
export const globalSculptSession = new SculptSession();

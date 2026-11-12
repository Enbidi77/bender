import type {
  ICommand,
  CommandContext,
  SculptMeshDelta,
  MeshNode,
  IMeshData,
} from '@blender-elt/contracts';
import type { SceneGraphState } from '@blender-elt/scene-core';
import type { SculptMeshBuffer } from '../geometry/sculpt-mesh-buffer.js';

let sculptCmdCounter = 0;
function uniqueSculptCommandId(): string {
  return `sculpt-${Date.now().toString(36)}-${(++sculptCmdCounter).toString(36)}`;
}

export class SculptStrokeCommand implements ICommand {
  public id: string;
  public name: string;
  public timestamp: number;
  public delta: SculptMeshDelta;

  // Optional target buffer reference for immediate in-memory undo/redo
  private bufferRef: SculptMeshBuffer | null = null;

  constructor(delta: SculptMeshDelta, brushName: string = 'Brush', buffer?: SculptMeshBuffer) {
    this.id = uniqueSculptCommandId();
    this.name = `Sculpt ${brushName}`;
    this.timestamp = Date.now();
    this.delta = delta;
    this.bufferRef = buffer ?? null;
  }

  public setBuffer(buffer: SculptMeshBuffer): void {
    this.bufferRef = buffer;
  }

  public execute(ctx: CommandContext): void {
    this.applyPositions(this.delta.newPositions, this.delta.newMasks, ctx);
  }

  public undo(ctx: CommandContext): void {
    this.applyPositions(this.delta.oldPositions, this.delta.oldMasks, ctx);
  }

  public redo(ctx: CommandContext): void {
    this.execute(ctx);
  }

  private applyPositions(
    positions: Float32Array,
    masks: Float32Array | undefined,
    ctx: CommandContext,
  ): void {
    const indices = this.delta.indices;
    const count = indices.length;

    // 1. Direct apply to in-memory SculptMeshBuffer if available
    if (this.bufferRef) {
      for (let i = 0; i < count; i++) {
        const vIdx = indices[i];
        const pIdx = i * 3;
        this.bufferRef.setVertex(vIdx, positions[pIdx], positions[pIdx + 1], positions[pIdx + 2]);
        if (masks) {
          this.bufferRef.setMask(vIdx, masks[i]);
        }
      }
      this.bufferRef.computeVertexNormals();
    }

    // 2. Synchronize SceneGraphState MeshNode metadata if context provided
    if (ctx && ctx.state && typeof (ctx.state as any).getNodeById === 'function') {
      const store = ctx.state as SceneGraphState;
      const node = store.getNodeById(this.delta.nodeId) as MeshNode | undefined;

      if (node && node.metadata && (node.metadata.meshData as IMeshData | undefined)) {
        const meshData = node.metadata.meshData as IMeshData;
        const targetVerts =
          meshData.vertices instanceof Float32Array
            ? meshData.vertices
            : new Float32Array(meshData.vertices);

        for (let i = 0; i < count; i++) {
          const vIdx = indices[i];
          const targetIdx = vIdx * 3;
          const pIdx = i * 3;
          targetVerts[targetIdx] = positions[pIdx];
          targetVerts[targetIdx + 1] = positions[pIdx + 1];
          targetVerts[targetIdx + 2] = positions[pIdx + 2];
        }

        meshData.vertices = targetVerts;
        store.updateNode(this.delta.nodeId, {
          metadata: {
            ...node.metadata,
            meshData,
          },
        });
      }
    }
  }
}

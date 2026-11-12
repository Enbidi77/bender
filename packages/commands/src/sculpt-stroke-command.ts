import type { CommandContext, SculptMeshDelta, MeshNode, IMeshData } from '@blender-elt/contracts';
import type { SceneGraphState } from '@blender-elt/scene-core';
import { BaseCommand } from './commands.js';

/**
 * Command encapsulating sparse sculpt mesh position and mask deltas for undo/redo.
 */
export class SculptStrokeCommand extends BaseCommand {
  public delta: SculptMeshDelta;

  constructor(delta: SculptMeshDelta, brushName: string = 'Brush') {
    super(`Sculpt ${brushName}`);
    this.delta = delta;
  }

  public execute(ctx: CommandContext): void {
    this.applyPositions(this.delta.newPositions, this.delta.newMasks, ctx);
  }

  public undo(ctx: CommandContext): void {
    this.applyPositions(this.delta.oldPositions, this.delta.oldMasks, ctx);
  }

  private applyPositions(
    positions: Float32Array,
    _masks: Float32Array | undefined,
    ctx: CommandContext,
  ): void {
    if (!ctx || !ctx.state) return;
    const store = ctx.state as SceneGraphState;
    if (typeof store.getNodeById !== 'function') return;

    const node = store.getNodeById(this.delta.nodeId) as MeshNode | undefined;
    if (node && node.metadata && (node.metadata.meshData as IMeshData | undefined)) {
      const meshData = node.metadata.meshData as IMeshData;
      const targetVerts =
        meshData.vertices instanceof Float32Array
          ? meshData.vertices
          : new Float32Array(meshData.vertices);

      const indices = this.delta.indices;
      const count = indices.length;

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

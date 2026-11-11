import type { ICommand, CommandContext, Transform } from '@blender-elt/contracts';
import { TransformObjectCommand as CoreTransformCommand } from '@blender-elt/commands';
import type { StoreApi } from 'zustand/vanilla';
import type { SceneGraphState } from '@blender-elt/scene-core';

export { CoreTransformCommand };

export interface TransformCommandOptions {
  nodeId: string;
  nodeName?: string;
  previousTransform: Transform;
  newTransform: Transform;
  sceneStore?: StoreApi<SceneGraphState>;
}

/**
 * Concrete command for modifying a 3D object's transform with undo / redo support.
 * Wraps @blender-elt/commands' TransformObjectCommand while allowing standalone execution.
 */
export class TransformObjectCommand implements ICommand {
  public readonly id: string;
  public readonly name: string;
  public readonly timestamp: number;

  public readonly nodeId: string;
  public readonly previousTransform: Transform;
  public readonly newTransform: Transform;
  private readonly sceneStore?: StoreApi<SceneGraphState>;
  private readonly coreCommand: CoreTransformCommand;

  constructor(
    nodeIdOrOptions: string | TransformCommandOptions,
    oldTransform?: Transform,
    newTransform?: Transform,
    sceneStore?: StoreApi<SceneGraphState>,
  ) {
    if (typeof nodeIdOrOptions === 'string') {
      this.nodeId = nodeIdOrOptions;
      this.previousTransform = JSON.parse(JSON.stringify(oldTransform!));
      this.newTransform = JSON.parse(JSON.stringify(newTransform!));
      this.sceneStore = sceneStore;
    } else {
      this.nodeId = nodeIdOrOptions.nodeId;
      this.previousTransform = JSON.parse(JSON.stringify(nodeIdOrOptions.previousTransform));
      this.newTransform = JSON.parse(JSON.stringify(nodeIdOrOptions.newTransform));
      this.sceneStore = nodeIdOrOptions.sceneStore;
    }

    this.id = `transform-${this.nodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.name = `Transform Object`;
    this.timestamp = Date.now();
    this.coreCommand = new CoreTransformCommand(
      this.nodeId,
      this.previousTransform,
      this.newTransform,
    );
  }

  public execute(ctx?: CommandContext): void {
    if (ctx && ctx.state) {
      this.coreCommand.execute(ctx);
      return;
    }

    if (this.sceneStore) {
      const state = this.sceneStore.getState();
      state.setTransform(this.nodeId, this.newTransform);
      return;
    }
  }

  public undo(ctx?: CommandContext): void {
    if (ctx && ctx.state) {
      this.coreCommand.undo(ctx);
      return;
    }

    if (this.sceneStore) {
      const state = this.sceneStore.getState();
      state.setTransform(this.nodeId, this.previousTransform);
      return;
    }
  }

  public redo(ctx?: CommandContext): void {
    this.execute(ctx);
  }
}

export function createTransformObjectCommand(options: TransformCommandOptions): TransformObjectCommand {
  return new TransformObjectCommand(options);
}

import type {
  ICommand,
  CommandContext,
  SceneNode,
  Transform,
  Vector3,
  MeshNode,
} from '@blender-elt/contracts';
import type { SceneGraphState } from '@blender-elt/scene-core';

let cmdCounter = 0;
function uniqueCommandId(name: string): string {
  return `${name.toLowerCase()}-${Date.now().toString(36)}-${(++cmdCounter).toString(36)}`;
}

export function getSceneState(ctx: CommandContext): SceneGraphState {
  if (ctx.state && typeof (ctx.state as any).addNode === 'function') {
    return ctx.state as SceneGraphState;
  }
  if ((ctx as any).store && typeof (ctx as any).store.getState === 'function') {
    return (ctx as any).store.getState() as SceneGraphState;
  }
  throw new Error('CommandContext does not contain a valid SceneGraphState');
}

/**
 * Base abstract command
 */
export abstract class BaseCommand implements ICommand {
  public id: string;
  public name: string;
  public timestamp: number;

  constructor(name: string) {
    this.id = uniqueCommandId(name);
    this.name = name;
    this.timestamp = Date.now();
  }

  abstract execute(ctx: CommandContext): Promise<void> | void;
  abstract undo(ctx: CommandContext): Promise<void> | void;

  redo(ctx: CommandContext): Promise<void> | void {
    return this.execute(ctx);
  }
}

/**
 * 1. CreateObjectCommand
 */
export class CreateObjectCommand extends BaseCommand {
  private node: SceneNode;
  private parentId: string | null;
  private collectionId: string | null;

  constructor(
    node: SceneNode,
    parentId: string | null = 'root',
    collectionId: string | null = null,
  ) {
    super(`Add ${node.name || 'Object'}`);
    this.node = { ...node };
    this.parentId = parentId;
    this.collectionId = collectionId;
  }

  public execute(ctx: CommandContext): void {
    const store = getSceneState(ctx);
    store.addNode(this.node, this.parentId, this.collectionId);
  }

  public undo(ctx: CommandContext): void {
    const store = getSceneState(ctx);
    store.removeNode(this.node.id);
  }
}

/**
 * 2. DeleteObjectCommand
 */
export class DeleteObjectCommand extends BaseCommand {
  private nodeId: string;
  private savedNode: SceneNode | null = null;
  private savedDescendants: SceneNode[] = [];
  private savedParentId: string | null = null;
  private savedCollectionId: string | null = null;

  constructor(nodeId: string) {
    super('Delete Object');
    this.nodeId = nodeId;
  }

  public execute(ctx: CommandContext): void {
    const store = getSceneState(ctx);
    const target = store.getNodeById(this.nodeId);
    if (!target) return;

    this.savedNode = { ...target };
    this.savedParentId = target.parentId;
    this.savedCollectionId = target.collectionId || null;
    this.savedDescendants = store.getNodeDescendants(this.nodeId).map((d) => ({ ...d }));

    store.removeNode(this.nodeId);
  }

  public undo(ctx: CommandContext): void {
    if (!this.savedNode) return;
    const store = getSceneState(ctx);

    // Restore primary node
    store.addNode(this.savedNode, this.savedParentId, this.savedCollectionId);

    // Restore descendants
    this.savedDescendants.forEach((d) => {
      store.addNode(d, d.parentId, d.collectionId);
    });
  }
}

/**
 * 3. TransformObjectCommand
 */
export class TransformObjectCommand extends BaseCommand {
  private nodeId: string;
  private oldTransform: Transform;
  private newTransform: Transform;

  constructor(nodeId: string, oldTransform: Transform, newTransform: Transform) {
    super('Transform Object');
    this.nodeId = nodeId;
    this.oldTransform = {
      position: { ...oldTransform.position },
      rotation: { ...oldTransform.rotation },
      scale: { ...oldTransform.scale },
    };
    this.newTransform = {
      position: { ...newTransform.position },
      rotation: { ...newTransform.rotation },
      scale: { ...newTransform.scale },
    };
  }

  public execute(ctx: CommandContext): void {
    const store = getSceneState(ctx);
    store.setTransform(this.nodeId, this.newTransform);
  }

  public undo(ctx: CommandContext): void {
    const store = getSceneState(ctx);
    store.setTransform(this.nodeId, this.oldTransform);
  }
}

/**
 * 4. DuplicateObjectCommand
 */
export class DuplicateObjectCommand extends BaseCommand {
  private sourceNodeId: string;
  private duplicatedNode: SceneNode | null = null;
  private offset: Vector3;

  constructor(sourceNodeId: string, options?: { offset?: Vector3 }) {
    super('Duplicate Object');
    this.sourceNodeId = sourceNodeId;
    this.offset = options?.offset || { x: 1, y: 0, z: 0 };
  }

  public execute(ctx: CommandContext): void {
    const store = getSceneState(ctx);
    if (!this.duplicatedNode) {
      const source = store.getNodeById(this.sourceNodeId);
      if (!source) return;

      const newId = `${source.id}-copy-${Date.now().toString(36)}`;
      const nameParts = source.name.split('.');
      const baseName = nameParts[0];
      const newName = `${baseName}.001`;

      this.duplicatedNode = {
        ...source,
        id: newId,
        name: newName,
        childrenIds: [],
        transform: {
          ...source.transform,
          position: {
            x: source.transform.position.x + this.offset.x,
            y: source.transform.position.y + this.offset.y,
            z: source.transform.position.z + this.offset.z,
          },
        },
      };
    }

    store.addNode(this.duplicatedNode, this.duplicatedNode.parentId, this.duplicatedNode.collectionId);
  }

  public undo(ctx: CommandContext): void {
    if (!this.duplicatedNode) return;
    const store = getSceneState(ctx);
    store.removeNode(this.duplicatedNode.id);
  }

  public getCreatedNode(): SceneNode | null {
    return this.duplicatedNode;
  }
}

/**
 * 5. ReparentObjectCommand
 */
export class ReparentObjectCommand extends BaseCommand {
  private nodeId: string;
  private newParentId: string | null;
  private oldParentId: string | null = null;

  constructor(nodeId: string, newParentId: string | null) {
    super('Reparent Object');
    this.nodeId = nodeId;
    this.newParentId = newParentId;
  }

  public execute(ctx: CommandContext): void {
    const store = getSceneState(ctx);
    const node = store.getNodeById(this.nodeId);
    if (!node) return;

    if (this.oldParentId === null) {
      this.oldParentId = node.parentId;
    }

    store.reparentNode(this.nodeId, this.newParentId);
  }

  public undo(ctx: CommandContext): void {
    const store = getSceneState(ctx);
    store.reparentNode(this.nodeId, this.oldParentId);
  }
}

/**
 * 6. AssignMaterialCommand
 */
export class AssignMaterialCommand extends BaseCommand {
  private nodeId: string;
  private newMaterialId: string;
  private oldMaterialId: string | undefined = undefined;

  constructor(nodeId: string, newMaterialId: string) {
    super('Assign Material');
    this.nodeId = nodeId;
    this.newMaterialId = newMaterialId;
  }

  public execute(ctx: CommandContext): void {
    const store = getSceneState(ctx);
    const node = store.getNodeById(this.nodeId);
    if (!node || node.type !== 'mesh') return;

    if (this.oldMaterialId === undefined) {
      this.oldMaterialId = (node as MeshNode).materialId;
    }

    store.updateNode(this.nodeId, { materialId: this.newMaterialId } as Partial<SceneNode>);
  }

  public undo(ctx: CommandContext): void {
    const store = getSceneState(ctx);
    store.updateNode(this.nodeId, { materialId: this.oldMaterialId } as Partial<SceneNode>);
  }
}

/**
 * 7. RenameObjectCommand
 */
export class RenameObjectCommand extends BaseCommand {
  private nodeId: string;
  private newName: string;
  private oldName: string | undefined = undefined;

  constructor(nodeId: string, newName: string) {
    super('Rename Object');
    this.nodeId = nodeId;
    this.newName = newName;
  }

  public execute(ctx: CommandContext): void {
    const store = getSceneState(ctx);
    const node = store.getNodeById(this.nodeId);
    if (!node) return;

    if (this.oldName === undefined) {
      this.oldName = node.name;
    }

    store.updateNode(this.nodeId, { name: this.newName });
  }

  public undo(ctx: CommandContext): void {
    if (this.oldName === undefined) return;
    const store = getSceneState(ctx);
    store.updateNode(this.nodeId, { name: this.oldName });
  }
}

/**
 * 8. SetVisibilityCommand
 */
export class SetVisibilityCommand extends BaseCommand {
  private nodeId: string;
  private visible: boolean;
  private oldVisible: boolean | undefined = undefined;

  constructor(nodeId: string, visible: boolean) {
    super(visible ? 'Show Object' : 'Hide Object');
    this.nodeId = nodeId;
    this.visible = visible;
  }

  public execute(ctx: CommandContext): void {
    const store = getSceneState(ctx);
    const node = store.getNodeById(this.nodeId);
    if (!node) return;

    if (this.oldVisible === undefined) {
      this.oldVisible = node.visible;
    }

    store.setNodeVisibility(this.nodeId, this.visible);
  }

  public undo(ctx: CommandContext): void {
    if (this.oldVisible === undefined) return;
    const store = getSceneState(ctx);
    store.setNodeVisibility(this.nodeId, this.oldVisible);
  }
}

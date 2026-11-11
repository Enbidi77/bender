import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSceneStore, createMeshNode } from '@blender-elt/scene-core';
import type { CommandContext } from '@blender-elt/contracts';
import {
  CommandManager,
  CreateObjectCommand,
  DeleteObjectCommand,
  TransformObjectCommand,
  DuplicateObjectCommand,
  ReparentObjectCommand,
  AssignMaterialCommand,
  RenameObjectCommand,
  SetVisibilityCommand,
} from '../src/index.js';

describe('packages/commands', () => {
  let manager: CommandManager;
  let store: ReturnType<typeof createSceneStore>;
  let context: CommandContext;

  beforeEach(() => {
    manager = new CommandManager(10);
    store = createSceneStore();
    context = {
      state: store.getState(),
      dispatch: vi.fn(),
    };
    // Keep context.state refreshed
    store.subscribe((state) => {
      context.state = state;
    });
  });

  describe('CommandManager History & State', () => {
    it('tracks undo and redo availability', async () => {
      expect(manager.canUndo).toBe(false);
      expect(manager.canRedo).toBe(false);

      const node = createMeshNode({ name: 'Cone' });
      const cmd = new CreateObjectCommand(node);

      await manager.execute(cmd, context);
      expect(manager.canUndo).toBe(true);
      expect(manager.canRedo).toBe(false);
      expect(manager.undoCount).toBe(1);
      expect(manager.lastCommandName).toBe('Add Cone');

      await manager.undo(context);
      expect(manager.canUndo).toBe(false);
      expect(manager.canRedo).toBe(true);

      await manager.redo(context);
      expect(manager.canUndo).toBe(true);
      expect(manager.canRedo).toBe(false);
    });

    it('respects maxHistory buffer length', async () => {
      const smallManager = new CommandManager(3);
      for (let i = 0; i < 5; i++) {
        const node = createMeshNode({ name: `Node-${i}` });
        await smallManager.execute(new CreateObjectCommand(node), context);
      }

      expect(smallManager.undoCount).toBe(3);
      expect(smallManager.undoHistory).toEqual(['Add Node-2', 'Add Node-3', 'Add Node-4']);
    });

    it('triggers event listeners on execute, undo, and redo', async () => {
      const onExecute = vi.fn();
      const onUndo = vi.fn();
      const onRedo = vi.fn();
      const onChange = vi.fn();

      manager.on('execute', onExecute);
      manager.on('undo', onUndo);
      manager.on('redo', onRedo);
      manager.on('change', onChange);

      const node = createMeshNode({ name: 'Torus' });
      const cmd = new CreateObjectCommand(node);

      await manager.execute(cmd, context);
      expect(onExecute).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledTimes(1);

      await manager.undo(context);
      expect(onUndo).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledTimes(2);

      await manager.redo(context);
      expect(onRedo).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('Concrete Commands', () => {
    it('CreateObjectCommand adds and removes an object', async () => {
      const node = createMeshNode({ id: 'custom-mesh', name: 'CustomMesh' });
      const cmd = new CreateObjectCommand(node);

      await manager.execute(cmd, context);
      expect(store.getState().getNodeById('custom-mesh')).toBeDefined();

      await manager.undo(context);
      expect(store.getState().getNodeById('custom-mesh')).toBeUndefined();

      await manager.redo(context);
      expect(store.getState().getNodeById('custom-mesh')).toBeDefined();
    });

    it('DeleteObjectCommand removes and restores an object with its hierarchy', async () => {
      const parent = createMeshNode({ id: 'del-parent', name: 'DelParent' });
      const child = createMeshNode({ id: 'del-child', name: 'DelChild' });

      store.getState().addNode(parent);
      store.getState().addNode(child, parent.id);

      const deleteCmd = new DeleteObjectCommand('del-parent');
      await manager.execute(deleteCmd, context);

      expect(store.getState().getNodeById('del-parent')).toBeUndefined();
      expect(store.getState().getNodeById('del-child')).toBeUndefined();

      await manager.undo(context);
      expect(store.getState().getNodeById('del-parent')).toBeDefined();
      expect(store.getState().getNodeById('del-child')).toBeDefined();
      expect(store.getState().getNodeById('del-child')?.parentId).toBe('del-parent');
    });

    it('TransformObjectCommand modifies and reverts object transform', async () => {
      const oldT = store.getState().getNodeById('cube-default')!.transform;
      const newT = {
        ...oldT,
        position: { x: 10, y: 20, z: 30 },
      };

      const cmd = new TransformObjectCommand('cube-default', oldT, newT);
      await manager.execute(cmd, context);

      expect(store.getState().getNodeById('cube-default')?.transform.position).toEqual({
        x: 10,
        y: 20,
        z: 30,
      });

      await manager.undo(context);
      expect(store.getState().getNodeById('cube-default')?.transform.position).toEqual(oldT.position);
    });

    it('DuplicateObjectCommand clones node with offset and undoes cleanly', async () => {
      const cmd = new DuplicateObjectCommand('cube-default', { offset: { x: 2, y: 0, z: 0 } });
      await manager.execute(cmd, context);

      const cloned = cmd.getCreatedNode();
      expect(cloned).toBeDefined();
      expect(store.getState().getNodeById(cloned!.id)).toBeDefined();
      expect(cloned?.transform.position.x).toBe(2);

      await manager.undo(context);
      expect(store.getState().getNodeById(cloned!.id)).toBeUndefined();
    });

    it('ReparentObjectCommand changes parent and reverts on undo', async () => {
      const parentA = createMeshNode({ id: 'parent-a', name: 'ParentA' });
      const parentB = createMeshNode({ id: 'parent-b', name: 'ParentB' });
      const item = createMeshNode({ id: 'item-1', name: 'Item1' });

      store.getState().addNode(parentA);
      store.getState().addNode(parentB);
      store.getState().addNode(item, parentA.id);

      expect(store.getState().getNodeById('item-1')?.parentId).toBe('parent-a');

      const cmd = new ReparentObjectCommand('item-1', 'parent-b');
      await manager.execute(cmd, context);

      expect(store.getState().getNodeById('item-1')?.parentId).toBe('parent-b');

      await manager.undo(context);
      expect(store.getState().getNodeById('item-1')?.parentId).toBe('parent-a');
    });

    it('AssignMaterialCommand updates material ID and reverts on undo', async () => {
      const initialMatId = (store.getState().getNodeById('cube-default') as any).materialId;
      const cmd = new AssignMaterialCommand('cube-default', 'mat-gold-preset');

      await manager.execute(cmd, context);
      expect((store.getState().getNodeById('cube-default') as any).materialId).toBe('mat-gold-preset');

      await manager.undo(context);
      expect((store.getState().getNodeById('cube-default') as any).materialId).toBe(initialMatId);
    });

    it('RenameObjectCommand renames object and reverts on undo', async () => {
      const cmd = new RenameObjectCommand('cube-default', 'HeroCube');

      await manager.execute(cmd, context);
      expect(store.getState().getNodeById('cube-default')?.name).toBe('HeroCube');

      await manager.undo(context);
      expect(store.getState().getNodeById('cube-default')?.name).toBe('Cube');
    });

    it('SetVisibilityCommand toggles node visibility and reverts on undo', async () => {
      expect(store.getState().getNodeById('cube-default')?.visible).toBe(true);

      const cmd = new SetVisibilityCommand('cube-default', false);
      await manager.execute(cmd, context);
      expect(store.getState().getNodeById('cube-default')?.visible).toBe(false);

      await manager.undo(context);
      expect(store.getState().getNodeById('cube-default')?.visible).toBe(true);
    });
  });
});

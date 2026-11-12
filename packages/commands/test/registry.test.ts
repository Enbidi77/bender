import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommandContext, CommandActionDefinition, ICommand } from '@blender-elt/contracts';
import { CommandRegistry, CompoundCommand, BaseCommand } from '../src/index.js';

class MockTestCommand extends BaseCommand {
  public executed = 0;
  public undone = 0;

  constructor(name: string) {
    super(name);
  }

  execute(): void {
    this.executed++;
  }

  undo(): void {
    this.undone++;
  }
}

describe('packages/commands - CommandRegistry & CompoundCommand', () => {
  let registry: CommandRegistry;
  let context: CommandContext;

  beforeEach(() => {
    registry = new CommandRegistry();
    context = {
      state: { mockNodeSelected: true },
      dispatch: vi.fn(),
    };
  });

  describe('CommandRegistry', () => {
    it('registers and retrieves actions', () => {
      const action: CommandActionDefinition = {
        id: 'object.delete',
        name: 'Delete Object',
        description: 'Deletes selected 3D object',
        category: 'object',
        shortcuts: [{ key: 'x' }, { key: 'Delete' }],
        menuPath: ['Object', 'Delete'],
        keywords: ['remove', 'trash'],
        execute: vi.fn(),
      };

      registry.register(action);
      expect(registry.get('object.delete')).toBe(action);
      expect(registry.getAll()).toHaveLength(1);
      expect(registry.getByCategory('object')).toHaveLength(1);
      expect(registry.getByCategory('mesh')).toHaveLength(0);
    });

    it('unregisters actions cleanly', () => {
      const action: CommandActionDefinition = {
        id: 'mesh.subdivide',
        name: 'Subdivide Mesh',
        category: 'mesh',
        execute: vi.fn(),
      };

      registry.register(action);
      expect(registry.get('mesh.subdivide')).toBeDefined();
      expect(registry.getByCategory('mesh')).toHaveLength(1);

      registry.unregister('mesh.subdivide');
      expect(registry.get('mesh.subdivide')).toBeUndefined();
      expect(registry.getByCategory('mesh')).toHaveLength(0);
    });

    it('checks availability predicate correctly', () => {
      const action: CommandActionDefinition = {
        id: 'object.duplicate',
        name: 'Duplicate',
        category: 'object',
        isAvailable: (ctx) => Boolean((ctx.state as any)?.mockNodeSelected),
        execute: vi.fn(),
      };

      registry.register(action);

      // Available when condition is met
      expect(registry.getAvailable(context)).toHaveLength(1);

      // Unavailable when condition is false
      const emptyContext: CommandContext = {
        state: { mockNodeSelected: false },
        dispatch: vi.fn(),
      };
      expect(registry.getAvailable(emptyContext)).toHaveLength(0);
    });

    it('searches actions across name, id, keywords, and menuPath', () => {
      registry.registerBatch([
        {
          id: 'mesh.add_cube',
          name: 'Add Cube',
          category: 'mesh',
          keywords: ['primitive', 'box'],
          menuPath: ['Add', 'Mesh', 'Cube'],
          execute: vi.fn(),
        },
        {
          id: 'mesh.add_sphere',
          name: 'Add UV Sphere',
          category: 'mesh',
          keywords: ['primitive', 'ball', 'round'],
          menuPath: ['Add', 'Mesh', 'Sphere'],
          execute: vi.fn(),
        },
        {
          id: 'view.toggle_wireframe',
          name: 'Toggle Wireframe',
          category: 'view',
          keywords: ['shading', 'lines'],
          execute: vi.fn(),
        },
      ]);

      expect(registry.search('cube')).toHaveLength(1);
      expect(registry.search('primitive')).toHaveLength(2);
      expect(registry.search('mesh')).toHaveLength(2);
      expect(registry.search('lines')).toHaveLength(1);
      expect(registry.search('nonexistent')).toHaveLength(0);
    });

    it('resolves shortcuts with modifiers and viewport mode scopes', () => {
      registry.registerBatch([
        {
          id: 'transform.grab',
          name: 'Grab / Move',
          category: 'transform',
          shortcuts: [{ key: 'g', scope: 'global' }],
          execute: vi.fn(),
        },
        {
          id: 'edit.extrude',
          name: 'Extrude Region',
          category: 'edit',
          shortcuts: [{ key: 'e', scope: 'edit' }],
          execute: vi.fn(),
        },
        {
          id: 'file.save',
          name: 'Save File',
          category: 'file',
          shortcuts: [{ key: 's', ctrl: true, scope: 'global' }],
          execute: vi.fn(),
        },
      ]);

      // 'g' in object mode
      const grabAction = registry.findActionByShortcut({ key: 'g' }, 'object');
      expect(grabAction?.id).toBe('transform.grab');

      // 'e' in object mode vs edit mode
      const extrudeInObject = registry.findActionByShortcut({ key: 'e' }, 'object');
      expect(extrudeInObject).toBeUndefined();

      const extrudeInEdit = registry.findActionByShortcut({ key: 'e' }, 'edit');
      expect(extrudeInEdit?.id).toBe('edit.extrude');

      // 's' with ctrlKey
      const saveAction = registry.findActionByShortcut({ key: 's', ctrlKey: true }, 'object');
      expect(saveAction?.id).toBe('file.save');

      // 's' without ctrlKey should not match save
      const noCtrlS = registry.findActionByShortcut({ key: 's', ctrlKey: false }, 'object');
      expect(noCtrlS).toBeUndefined();
    });

    it('executes registered command actions and handles guards', async () => {
      const mockFn = vi.fn();
      registry.register({
        id: 'custom.action',
        name: 'Custom Action',
        category: 'system',
        execute: mockFn,
      });

      await registry.executeCommand('custom.action', context, { testPayload: 123 });
      expect(mockFn).toHaveBeenCalledWith(context, { testPayload: 123 });

      // Throws for unregistered command
      await expect(registry.executeCommand('unknown.action', context)).rejects.toThrow(
        'CommandAction "unknown.action" is not registered',
      );
    });
  });

  describe('CompoundCommand', () => {
    it('executes in forward order and undoes in reverse order', async () => {
      const cmd1 = new MockTestCommand('Cmd 1');
      const cmd2 = new MockTestCommand('Cmd 2');
      const cmd3 = new MockTestCommand('Cmd 3');

      const compound = new CompoundCommand('Batch Operations', [cmd1, cmd2, cmd3]);
      expect(compound.type).toBe('compound');
      expect(compound.commands).toHaveLength(3);

      await compound.execute(context);
      expect(cmd1.executed).toBe(1);
      expect(cmd2.executed).toBe(1);
      expect(cmd3.executed).toBe(1);

      await compound.undo(context);
      expect(cmd1.undone).toBe(1);
      expect(cmd2.undone).toBe(1);
      expect(cmd3.undone).toBe(1);

      await compound.redo(context);
      expect(cmd1.executed).toBe(2);
      expect(cmd2.executed).toBe(2);
      expect(cmd3.executed).toBe(2);
    });
  });
});

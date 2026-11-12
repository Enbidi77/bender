import type {
  ICommand,
  CommandContext,
  ICommandRegistry,
  CommandActionDefinition,
  CommandCategory,
  ViewportMode,
  ICompoundCommand,
} from '@blender-elt/contracts';
import { BaseCommand } from './commands.js';

/**
 * Compound / Macro command grouping multiple commands for atomic undo and redo
 */
export class CompoundCommand extends BaseCommand implements ICompoundCommand {
  public type: 'compound' = 'compound';
  public commands: ICommand[];

  constructor(name: string, commands: ICommand[] = []) {
    super(name);
    this.commands = commands;
  }

  public add(command: ICommand): void {
    this.commands.push(command);
  }

  public async execute(ctx: CommandContext): Promise<void> {
    for (const cmd of this.commands) {
      await cmd.execute(ctx);
    }
  }

  public async undo(ctx: CommandContext): Promise<void> {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      await this.commands[i].undo(ctx);
    }
  }

  public async redo(ctx: CommandContext): Promise<void> {
    for (const cmd of this.commands) {
      if (cmd.redo) {
        await cmd.redo(ctx);
      } else {
        await cmd.execute(ctx);
      }
    }
  }
}

/**
 * Implementation of ICommandRegistry for managing searchable and executable actions
 */
export class CommandRegistry implements ICommandRegistry {
  private actions: Map<string, CommandActionDefinition> = new Map();
  private categoryIndex: Map<CommandCategory, Set<string>> = new Map();

  public register(action: CommandActionDefinition): void {
    this.actions.set(action.id, action);

    if (!this.categoryIndex.has(action.category)) {
      this.categoryIndex.set(action.category, new Set());
    }
    this.categoryIndex.get(action.category)!.add(action.id);
  }

  public registerBatch(actions: CommandActionDefinition[]): void {
    for (const action of actions) {
      this.register(action);
    }
  }

  public unregister(id: string): void {
    const action = this.actions.get(id);
    if (!action) return;

    this.actions.delete(id);
    const catSet = this.categoryIndex.get(action.category);
    if (catSet) {
      catSet.delete(id);
    }
  }

  public get(id: string): CommandActionDefinition | undefined {
    return this.actions.get(id);
  }

  public getAll(): CommandActionDefinition[] {
    return Array.from(this.actions.values());
  }

  public getByCategory(category: CommandCategory): CommandActionDefinition[] {
    const ids = this.categoryIndex.get(category);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.actions.get(id)!)
      .filter(Boolean);
  }

  public getAvailable(ctx: CommandContext): CommandActionDefinition[] {
    return this.getAll().filter((action) => {
      if (!action.isAvailable) return true;
      try {
        return action.isAvailable(ctx);
      } catch {
        return false;
      }
    });
  }

  public search(query: string, ctx?: CommandContext): CommandActionDefinition[] {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) {
      return ctx ? this.getAvailable(ctx) : this.getAll();
    }

    const matches = this.getAll().filter((action) => {
      if (action.name.toLowerCase().includes(cleanQuery)) return true;
      if (action.id.toLowerCase().includes(cleanQuery)) return true;
      if (action.description?.toLowerCase().includes(cleanQuery)) return true;
      if (action.category.toLowerCase().includes(cleanQuery)) return true;
      if (action.keywords?.some((k) => k.toLowerCase().includes(cleanQuery))) return true;
      if (action.menuPath?.some((m) => m.toLowerCase().includes(cleanQuery))) return true;
      return false;
    });

    if (ctx) {
      return matches.filter((action) => {
        if (!action.isAvailable) return true;
        try {
          return action.isAvailable(ctx);
        } catch {
          return false;
        }
      });
    }

    return matches;
  }

  public findActionByShortcut(
    event: {
      key: string;
      ctrlKey?: boolean;
      shiftKey?: boolean;
      altKey?: boolean;
      metaKey?: boolean;
    },
    mode: ViewportMode = 'object',
  ): CommandActionDefinition | undefined {
    const targetKey = event.key.toLowerCase();
    const ctrl = Boolean(event.ctrlKey);
    const shift = Boolean(event.shiftKey);
    const alt = Boolean(event.altKey);
    const meta = Boolean(event.metaKey);

    for (const action of this.actions.values()) {
      if (!action.shortcuts || action.shortcuts.length === 0) continue;

      for (const binding of action.shortcuts) {
        if (binding.key.toLowerCase() !== targetKey) continue;
        if (Boolean(binding.ctrl) !== ctrl) continue;
        if (Boolean(binding.shift) !== shift) continue;
        if (Boolean(binding.alt) !== alt) continue;
        if (Boolean(binding.meta) !== meta) continue;

        // Check scope
        const scope = binding.scope ?? 'global';
        if (scope === 'global' || scope === mode) {
          return action;
        }
      }
    }

    return undefined;
  }

  public async executeCommand(id: string, ctx: CommandContext, payload?: unknown): Promise<void> {
    const action = this.actions.get(id);
    if (!action) {
      throw new Error(`CommandAction "${id}" is not registered`);
    }

    if (action.isAvailable && !action.isAvailable(ctx)) {
      throw new Error(`CommandAction "${id}" is not available in the current context`);
    }

    await action.execute(ctx, payload);
  }
}

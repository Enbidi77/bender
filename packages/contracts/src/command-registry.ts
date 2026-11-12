import type { CommandContext, ICommand } from './commands.js';
import type { ViewportMode } from './viewport.js';

/**
 * Functional category for UI grouping and search filtering
 */
export type CommandCategory =
  | 'object'
  | 'mesh'
  | 'edit'
  | 'transform'
  | 'view'
  | 'file'
  | 'select'
  | 'modifier'
  | 'material'
  | 'animation'
  | 'system';

/**
 * Keyboard shortcut definition
 */
export interface KeyBinding {
  key: string; // e.g. 'g', 'r', 's', 'x', 'Delete', 'z', 'Space'
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  scope?: ViewportMode | 'global';
  description?: string;
}

/**
 * Metadata definition for an executable action in the Command Registry
 */
export interface CommandActionDefinition<TPayload = unknown> {
  id: string;
  name: string;
  description?: string;
  category: CommandCategory;
  icon?: string;
  shortcuts?: KeyBinding[];
  menuPath?: string[];
  keywords?: string[];
  isAvailable?: (ctx: CommandContext) => boolean;
  execute: (ctx: CommandContext, payload?: TPayload) => Promise<void> | void;
}

/**
 * Registry interface managing searchable and executable actions across desktop & web
 */
export interface ICommandRegistry {
  register(action: CommandActionDefinition): void;
  registerBatch(actions: CommandActionDefinition[]): void;
  unregister(id: string): void;
  get(id: string): CommandActionDefinition | undefined;
  getAll(): CommandActionDefinition[];
  getByCategory(category: CommandCategory): CommandActionDefinition[];
  getAvailable(ctx: CommandContext): CommandActionDefinition[];
  search(query: string, ctx?: CommandContext): CommandActionDefinition[];
  findActionByShortcut(
    event: {
      key: string;
      ctrlKey?: boolean;
      shiftKey?: boolean;
      altKey?: boolean;
      metaKey?: boolean;
    },
    mode?: ViewportMode,
  ): CommandActionDefinition | undefined;
}

/**
 * Compound / Macro command grouping multiple commands for atomic undo/redo
 */
export interface ICompoundCommand extends ICommand {
  type: 'compound';
  commands: ICommand[];
}

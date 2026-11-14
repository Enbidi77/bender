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
import { getTimelineStore } from './animation-commands.js';

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
 * Helper to collect all unique keyframe frame numbers from tracks and actions
 */
function getAllKeyframeFrames(store: ReturnType<typeof getTimelineStore>): number[] {
  const frames = new Set<number>();
  for (const t of store.tracks) {
    for (const kf of t.keyframes) {
      frames.add(kf.frame);
    }
  }
  for (const a of Object.values(store.actions)) {
    for (const ch of a.channels) {
      for (const kf of ch.keyframes) {
        frames.add(kf.frame);
      }
    }
  }
  return Array.from(frames).sort((a, b) => a - b);
}

/**
 * Built-in animation action definitions matching standard Blender keyboard shortcuts
 */
export const ANIMATION_ACTIONS: CommandActionDefinition[] = [
  {
    id: 'animation:insert-keyframe-menu',
    name: 'Insert Keyframe Menu',
    description: 'Open keyframe insertion menu (Location, Rotation, Scale)',
    category: 'animation',
    shortcuts: [{ key: 'i', scope: 'global' }],
    menuPath: ['Animation', 'Insert Keyframe'],
    keywords: ['keyframe', 'insert', 'location', 'rotation', 'scale', 'locrotscale'],
    execute: (ctx, payload) => {
      if (ctx.dispatch) {
        ctx.dispatch({ type: 'OPEN_KEYFRAME_MENU', payload });
      }
    },
  },
  {
    id: 'animation:delete-keyframe',
    name: 'Delete Keyframe',
    description: 'Delete keyframe at current frame for selected objects',
    category: 'animation',
    shortcuts: [{ key: 'i', alt: true, scope: 'global' }],
    menuPath: ['Animation', 'Delete Keyframe'],
    keywords: ['keyframe', 'delete', 'remove', 'clear'],
    execute: (ctx, payload) => {
      const store = getTimelineStore(ctx);
      const current = store.currentFrame;
      const targetId = (payload as { targetNodeId?: string } | undefined)?.targetNodeId;

      if (targetId) {
        for (const t of store.tracks) {
          if (t.targetNodeId === targetId) {
            store.removeKeyframe(t.id, current);
          }
        }
        for (const a of Object.values(store.actions)) {
          for (const ch of a.channels) {
            if (ch.targetNodeId === targetId) {
              store.removeKeyframe(ch.id, current);
            }
          }
        }
      }

      if (ctx.dispatch) {
        ctx.dispatch({
          type: 'DELETE_KEYFRAME',
          payload: { frame: current, targetNodeId: targetId },
        });
      }
    },
  },
  {
    id: 'animation:toggle-play',
    name: 'Toggle Play/Pause',
    description: 'Toggle timeline playback',
    category: 'animation',
    shortcuts: [
      { key: 'space', scope: 'global' },
      { key: ' ', scope: 'global' },
    ],
    menuPath: ['Animation', 'Toggle Play'],
    keywords: ['play', 'pause', 'playback', 'transport'],
    execute: (ctx) => {
      const store = getTimelineStore(ctx);
      store.togglePlay();
    },
  },
  {
    id: 'animation:prev-frame',
    name: 'Previous Frame',
    description: 'Step backward one frame',
    category: 'animation',
    shortcuts: [{ key: 'arrowleft', scope: 'global' }],
    menuPath: ['Animation', 'Previous Frame'],
    keywords: ['step', 'prev', 'frame', 'back'],
    execute: (ctx) => {
      const store = getTimelineStore(ctx);
      store.prevFrame();
    },
  },
  {
    id: 'animation:next-frame',
    name: 'Next Frame',
    description: 'Step forward one frame',
    category: 'animation',
    shortcuts: [{ key: 'arrowright', scope: 'global' }],
    menuPath: ['Animation', 'Next Frame'],
    keywords: ['step', 'next', 'frame', 'forward'],
    execute: (ctx) => {
      const store = getTimelineStore(ctx);
      store.nextFrame();
    },
  },
  {
    id: 'animation:jump-start',
    name: 'Jump to Start Frame',
    description: 'Jump to timeline start frame',
    category: 'animation',
    shortcuts: [{ key: 'arrowleft', shift: true, scope: 'global' }],
    menuPath: ['Animation', 'Jump to Start'],
    keywords: ['jump', 'start', 'first', 'beginning'],
    execute: (ctx) => {
      const store = getTimelineStore(ctx);
      store.jumpToStart();
    },
  },
  {
    id: 'animation:jump-end',
    name: 'Jump to End Frame',
    description: 'Jump to timeline end frame',
    category: 'animation',
    shortcuts: [{ key: 'arrowright', shift: true, scope: 'global' }],
    menuPath: ['Animation', 'Jump to End'],
    keywords: ['jump', 'end', 'last'],
    execute: (ctx) => {
      const store = getTimelineStore(ctx);
      store.jumpToEnd();
    },
  },
  {
    id: 'animation:prev-keyframe',
    name: 'Previous Keyframe',
    description: 'Jump to the previous keyframe on the timeline',
    category: 'animation',
    shortcuts: [{ key: 'arrowdown', scope: 'global' }],
    menuPath: ['Animation', 'Previous Keyframe'],
    keywords: ['keyframe', 'prev', 'jump'],
    execute: (ctx) => {
      const store = getTimelineStore(ctx);
      const current = store.currentFrame;
      const allFrames = getAllKeyframeFrames(store);
      const prev = allFrames.filter((f) => f < current).pop();
      if (prev !== undefined) {
        store.setFrame(prev);
      }
    },
  },
  {
    id: 'animation:next-keyframe',
    name: 'Next Keyframe',
    description: 'Jump to the next keyframe on the timeline',
    category: 'animation',
    shortcuts: [{ key: 'arrowup', scope: 'global' }],
    menuPath: ['Animation', 'Next Keyframe'],
    keywords: ['keyframe', 'next', 'jump'],
    execute: (ctx) => {
      const store = getTimelineStore(ctx);
      const current = store.currentFrame;
      const allFrames = getAllKeyframeFrames(store);
      const next = allFrames.find((f) => f > current);
      if (next !== undefined) {
        store.setFrame(next);
      }
    },
  },
  {
    id: 'animation:toggle-auto-key',
    name: 'Toggle Auto-Keying',
    description: 'Toggle automatic keyframing on transform changes',
    category: 'animation',
    shortcuts: [{ key: 'k', shift: true, alt: true, scope: 'global' }],
    menuPath: ['Animation', 'Auto-Keying'],
    keywords: ['auto-key', 'record', 'automatic'],
    execute: (ctx) => {
      const store = getTimelineStore(ctx);
      store.setAutoKeying(!store.autoKeyingEnabled);
    },
  },
];

/**
 * Registers all animation actions to a CommandRegistry instance
 */
export function registerAnimationActions(registry: CommandRegistry): void {
  registry.registerBatch(ANIMATION_ACTIONS);
}

/**
 * Implementation of ICommandRegistry for managing searchable and executable actions
 */
export class CommandRegistry implements ICommandRegistry {
  private actions: Map<string, CommandActionDefinition> = new Map();
  private categoryIndex: Map<CommandCategory, Set<string>> = new Map();

  constructor(options?: { registerBuiltIns?: boolean; registerAnimation?: boolean }) {
    if (options?.registerBuiltIns || options?.registerAnimation) {
      this.registerAnimationActions();
    }
  }

  public registerAnimationActions(): this {
    registerAnimationActions(this);
    return this;
  }

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

/**
 * Factory creating a CommandRegistry with built-in animation actions registered
 */
export function createDefaultCommandRegistry(): CommandRegistry {
  const reg = new CommandRegistry();
  reg.registerAnimationActions();
  return reg;
}

/**
 * Shared default CommandRegistry singleton
 */
export const defaultCommandRegistry = createDefaultCommandRegistry();

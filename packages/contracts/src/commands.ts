/**
 * Execution context provided to commands
 */
export interface CommandContext {
  state: unknown;
  dispatch: (action: unknown) => void;
  metadata?: Record<string, unknown>;
}

/**
 * Command pattern interface with undo/redo capabilities
 */
export interface ICommand {
  id: string;
  name: string;
  timestamp: number;
  execute(ctx: CommandContext): Promise<void> | void;
  undo(ctx: CommandContext): Promise<void> | void;
  redo?(ctx: CommandContext): Promise<void> | void;
}

/**
 * Undo / Redo history state
 */
export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  undoStackSize: number;
  redoStackSize: number;
  undoHistory: string[];
  redoHistory: string[];
  lastCommandName?: string;
}

/**
 * Definition factory for declaring repeatable commands
 */
export interface CommandDefinition<TPayload = unknown> {
  id: string;
  name: string;
  create(payload: TPayload): ICommand;
}

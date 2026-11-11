import type { ICommand, CommandContext, UndoRedoState } from '@blender-elt/contracts';

export class CommandManager {
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private maxHistory: number;
  private listeners: Set<(state: UndoRedoState) => void> = new Set();

  constructor(maxHistory = 100) {
    this.maxHistory = maxHistory;
  }

  public async execute(command: ICommand, context: CommandContext): Promise<void> {
    await command.execute(context);
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.notify();
  }

  public async undo(context: CommandContext): Promise<boolean> {
    const command = this.undoStack.pop();
    if (!command) return false;

    await command.undo(context);
    this.redoStack.push(command);
    this.notify();
    return true;
  }

  public async redo(context: CommandContext): Promise<boolean> {
    const command = this.redoStack.pop();
    if (!command) return false;

    if (command.redo) {
      await command.redo(context);
    } else {
      await command.execute(context);
    }
    this.undoStack.push(command);
    this.notify();
    return true;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  public getState(): UndoRedoState {
    return {
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      undoStackSize: this.undoStack.length,
      redoStackSize: this.redoStack.length,
      undoHistory: this.undoStack.map((c) => c.name),
      redoHistory: this.redoStack.map((c) => c.name),
      lastCommandName: this.undoStack[this.undoStack.length - 1]?.name,
    };
  }

  public subscribe(listener: (state: UndoRedoState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }
}

export abstract class BaseCommand implements ICommand {
  public id: string;
  public name: string;
  public timestamp: number;

  constructor(name: string) {
    this.id = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.name = name;
    this.timestamp = Date.now();
  }

  abstract execute(ctx: CommandContext): Promise<void> | void;
  abstract undo(ctx: CommandContext): Promise<void> | void;

  redo(ctx: CommandContext): Promise<void> | void {
    return this.execute(ctx);
  }
}

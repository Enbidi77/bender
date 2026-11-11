import type { ICommand, CommandContext, UndoRedoState } from '@blender-elt/contracts';

export type CommandEventType = 'execute' | 'undo' | 'redo' | 'change' | 'clear';
export type CommandEventListener = (state: UndoRedoState, command?: ICommand) => void;

export class CommandManager {
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private maxHistory: number;
  private listeners: Map<CommandEventType, Set<CommandEventListener>> = new Map();

  constructor(maxHistory = 100) {
    this.maxHistory = maxHistory;
    this.listeners.set('execute', new Set());
    this.listeners.set('undo', new Set());
    this.listeners.set('redo', new Set());
    this.listeners.set('change', new Set());
    this.listeners.set('clear', new Set());
  }

  public get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public get undoCount(): number {
    return this.undoStack.length;
  }

  public get redoCount(): number {
    return this.redoStack.length;
  }

  public get undoHistory(): string[] {
    return this.undoStack.map((c) => c.name);
  }

  public get redoHistory(): string[] {
    return this.redoStack.map((c) => c.name);
  }

  public get lastCommandName(): string | undefined {
    return this.undoStack[this.undoStack.length - 1]?.name;
  }

  public async execute(command: ICommand, context: CommandContext): Promise<void> {
    await command.execute(context);
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];

    this.emit('execute', command);
    this.emit('change', command);
  }

  public async undo(context: CommandContext): Promise<boolean> {
    const command = this.undoStack.pop();
    if (!command) return false;

    await command.undo(context);
    this.redoStack.push(command);

    this.emit('undo', command);
    this.emit('change', command);
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

    this.emit('redo', command);
    this.emit('change', command);
    return true;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.emit('clear');
    this.emit('change');
  }

  public getState(): UndoRedoState {
    return {
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      undoStackSize: this.undoCount,
      redoStackSize: this.redoCount,
      undoHistory: this.undoHistory,
      redoHistory: this.redoHistory,
      lastCommandName: this.lastCommandName,
    };
  }

  public on(event: CommandEventType, listener: CommandEventListener): () => void {
    const set = this.listeners.get(event);
    if (set) {
      set.add(listener);
    }
    return () => {
      set?.delete(listener);
    };
  }

  public subscribe(listener: (state: UndoRedoState) => void): () => void {
    const adapter = (st: UndoRedoState) => listener(st);
    this.on('change', adapter);
    listener(this.getState());
    return () => {
      const set = this.listeners.get('change');
      set?.delete(adapter);
    };
  }

  private emit(event: CommandEventType, command?: ICommand): void {
    const state = this.getState();
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((listener) => listener(state, command));
    }
  }
}

import type { ProjectDocument, ExportPayload, ExportResult } from './file-formats.js';

export type { ExportPayload, ExportResult };

/**
 * Filter item for file dialogs
 */
export interface FileDialogFilter {
  name: string;
  extensions: string[];
}

/**
 * Options when opening or saving via system dialogs
 */
export interface FileDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileDialogFilter[];
  buttonLabel?: string;
  properties?: Array<
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'promptToCreate'
    | 'noResolveAliases'
  >;
}

/**
 * IPC payloads for project file operations
 */
export interface SaveProjectPayload {
  filePath?: string;
  document: ProjectDocument;
}

export interface SaveProjectResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface OpenProjectPayload {
  filePath: string;
}

export interface OpenProjectResult {
  success: boolean;
  filePath?: string;
  document?: ProjectDocument;
  error?: string;
}

/**
 * System and platform diagnostic details
 */
export interface SystemInfo {
  platform: 'win32' | 'darwin' | 'linux';
  arch: string;
  nodeVersion: string;
  electronVersion: string;
  appVersion: string;
  memory: {
    total: number;
    free: number;
  };
}

/**
 * Bridge interface exposed via window.electronBridge / contextBridge
 */
export interface DesktopBridgeAPI {
  // File Dialogs
  showOpenDialog(options?: FileDialogOptions): Promise<{ canceled: boolean; filePaths: string[] }>;
  showSaveDialog(options?: FileDialogOptions): Promise<{ canceled: boolean; filePath?: string }>;

  // Project persistence
  saveProject(payload: SaveProjectPayload): Promise<SaveProjectResult>;
  openProject(payload: OpenProjectPayload): Promise<OpenProjectResult>;

  // Export / Import
  exportFile(payload: ExportPayload): Promise<ExportResult>;
  readFile(filePath: string): Promise<{ success: boolean; data?: Uint8Array; error?: string }>;

  // System & Window
  getSystemInfo(): Promise<SystemInfo>;
  minimize(): void;
  maximize(): void;
  close(): void;

  // Menu action event listener
  onMenuAction(callback: (action: string, payload?: unknown) => void): () => void;
}

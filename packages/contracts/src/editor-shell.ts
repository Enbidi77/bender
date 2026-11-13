import type {
  ProjectDocument,
  ImportOptions,
  ExportPayload,
  ExportResult,
} from './file-formats.js';

/**
 * Operating platform host environment
 */
export type PlatformType = 'desktop' | 'web';

/**
 * Capabilities queryable from platform host
 */
export interface PlatformCapabilities {
  nativeMenus: boolean;
  fileSystemAccess: boolean;
  windowControls: boolean;
  systemDialogs: boolean;
  offlineStorage: boolean;
}

/**
 * File system operations bridge implemented by platform adapters
 */
export interface PlatformFileSystemBridge {
  saveProject(
    doc: ProjectDocument,
    filePath?: string,
  ): Promise<{ success: boolean; filePath?: string; error?: string }>;
  openProject(
    filePath?: string,
  ): Promise<{ success: boolean; document?: ProjectDocument; filePath?: string; error?: string }>;
  exportScene(payload: ExportPayload): Promise<ExportResult>;
  importScene(
    options?: Partial<ImportOptions>,
  ): Promise<{ success: boolean; document?: ProjectDocument; error?: string }>;
}

/**
 * Unified bridge API across Desktop (Electron) and Web (Browser/IndexedDB)
 */
export interface IPlatformBridge {
  platform: PlatformType;
  capabilities: PlatformCapabilities;
  fileSystem: PlatformFileSystemBridge;
  window?: {
    minimize?(): void;
    maximize?(): void;
    close?(): void;
    isMaximized?(): Promise<boolean> | boolean;
    onMaximizedChange?(callback: (isMaximized: boolean) => void): () => void;
    setTitle?(title: string): void;
  };
  clipboard: {
    readText(): Promise<string>;
    writeText(text: string): Promise<void>;
  };
  notifications?: {
    notify(message: string, type?: 'info' | 'warning' | 'error' | 'success'): void;
  };
}

/**
 * Unified editor shell session state
 */
export interface EditorSessionState {
  projectName: string;
  filePath?: string;
  isDirty: boolean;
  activeWorkspaceId: string;
  statusMessage?: string;
  activeModals: {
    about: boolean;
    shortcuts: boolean;
    preferences: boolean;
    commandPalette: boolean;
  };
}

import type {
  IPlatformBridge,
  ProjectDocument,
  ExportPayload,
  ExportResult,
  ImportOptions,
} from '@blender-elt/contracts';

/**
 * Creates a mock / in-memory IPlatformBridge for testing, preview, or headless environments
 */
export function createMockPlatformBridge(overrides?: Partial<IPlatformBridge>): IPlatformBridge {
  let inMemoryDocument: ProjectDocument | undefined;
  let inMemoryClipboard = '';

  const defaultBridge: IPlatformBridge = {
    platform: 'web',
    capabilities: {
      nativeMenus: false,
      fileSystemAccess: true,
      windowControls: false,
      systemDialogs: false,
      offlineStorage: true,
    },
    fileSystem: {
      saveProject: async (doc: ProjectDocument, filePath?: string) => {
        inMemoryDocument = doc;
        return {
          success: true,
          filePath: filePath || 'mock-project.belt',
        };
      },
      openProject: async (filePath?: string) => {
        if (!inMemoryDocument) {
          return {
            success: false,
            error: 'No saved project available',
          };
        }
        return {
          success: true,
          document: inMemoryDocument,
          filePath: filePath || 'mock-project.belt',
        };
      },
      exportScene: async (payload: ExportPayload): Promise<ExportResult> => {
        return {
          success: true,
          filePath: payload.filePath,
        };
      },
      importScene: async (_options?: Partial<ImportOptions>) => {
        return {
          success: true,
          document: inMemoryDocument,
        };
      },
    },
    window: {
      minimize: () => {},
      maximize: () => {},
      close: () => {},
      setTitle: (_title: string) => {},
    },
    clipboard: {
      readText: async () => inMemoryClipboard,
      writeText: async (text: string) => {
        inMemoryClipboard = text;
      },
    },
    notifications: {
      notify: (message: string, type = 'info') => {
        if (type === 'error') {
          console.error(`[PlatformBridge] ${message}`);
        } else if (type === 'warning') {
          console.warn(`[PlatformBridge] ${message}`);
        } else {
          console.log(`[PlatformBridge] [${type}] ${message}`);
        }
      },
    },
  };

  return {
    ...defaultBridge,
    ...overrides,
    capabilities: {
      ...defaultBridge.capabilities,
      ...(overrides?.capabilities || {}),
    },
    fileSystem: {
      ...defaultBridge.fileSystem,
      ...(overrides?.fileSystem || {}),
    },
    clipboard: {
      ...defaultBridge.clipboard,
      ...(overrides?.clipboard || {}),
    },
  };
}

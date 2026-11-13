import type {
  IPlatformBridge,
  ProjectDocument,
  ExportPayload,
  ExportResult,
  ImportOptions,
} from '@blender-elt/contracts';
import {
  serializeProject,
  deserializeProject,
  createProjectMetadata,
} from '@blender-elt/persistence';
import { importScene } from '@blender-elt/file-formats';

// Helper to trigger browser download
function downloadBlob(data: Blob | string | Uint8Array, filename: string, mimeType: string): void {
  let blob: Blob;
  if (data instanceof Blob) {
    blob = data;
  } else if (typeof data === 'string') {
    blob = new Blob([data], { type: mimeType });
  } else {
    const ab = new ArrayBuffer(data.byteLength);
    new Uint8Array(ab).set(data);
    blob = new Blob([ab], { type: mimeType });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Helper to prompt user for a local file via browser file input
function selectLocalFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    input.onchange = () => {
      const file = input.files?.[0] || null;
      document.body.removeChild(input);
      resolve(file);
    };

    input.oncancel = () => {
      document.body.removeChild(input);
      resolve(null);
    };

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Creates the Desktop platform bridge implementing IPlatformBridge for Electron
 */
export function createDesktopPlatformBridge(): IPlatformBridge {
  const bridge = (window as any).electronBridge || (window as any).electronAPI;

  return {
    platform: 'desktop',
    capabilities: {
      nativeMenus: !!bridge?.onMenuAction,
      fileSystemAccess: true,
      windowControls: true,
      systemDialogs: true,
      offlineStorage: true,
    },
    fileSystem: {
      saveProject: async (doc: ProjectDocument, filePath?: string) => {
        if (bridge?.saveProject) {
          return await bridge.saveProject({
            filePath,
            document: doc,
          });
        }
        const serialized = serializeProject(doc);
        downloadBlob(serialized, filePath || 'project.belt', 'application/json');
        return { success: true, filePath: filePath || 'project.belt' };
      },
      openProject: async (filePath?: string) => {
        let path = filePath;
        if (!path && bridge?.showOpenDialog) {
          const res = await bridge.showOpenDialog({
            title: 'Open Project',
            filters: [{ name: 'Blender-ELT Project', extensions: ['belt', 'json'] }],
          });
          if (res.canceled || !res.filePaths?.[0]) {
            return { success: false, error: 'Cancelled' };
          }
          path = res.filePaths[0];
        }

        if (bridge?.openProject && path) {
          const result = await bridge.openProject({ filePath: path });
          if (result.success && result.document) {
            return { success: true, document: result.document, filePath: result.filePath };
          }
          return { success: false, error: result.error || 'Failed to open project' };
        }

        const file = await selectLocalFile('.belt,.json');
        if (!file) return { success: false, error: 'Cancelled' };
        try {
          const text = await file.text();
          const doc = deserializeProject(text);
          return { success: true, document: doc, filePath: file.name };
        } catch (err: unknown) {
          return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
      exportScene: async (payload: ExportPayload): Promise<ExportResult> => {
        const ext =
          payload.format === 'glb' ? 'glb' : payload.format === 'gltf' ? 'gltf' : payload.format;

        if (bridge?.showSaveDialog && bridge?.exportFile) {
          const dialogRes = await bridge.showSaveDialog({
            title: `Export ${payload.format.toUpperCase()}`,
            filters: [{ name: `${payload.format.toUpperCase()} File`, extensions: [ext] }],
          });
          if (dialogRes.canceled || !dialogRes.filePath) {
            return { success: false, filePath: '', error: 'Cancelled' };
          }
          const res = await bridge.exportFile({
            filePath: dialogRes.filePath,
            format: payload.format,
            data: payload.data,
          });
          return {
            success: res.success,
            filePath: dialogRes.filePath,
            error: res.error,
          };
        }

        downloadBlob(payload.data, payload.filePath, 'application/octet-stream');
        return { success: true, filePath: payload.filePath };
      },
      importScene: async (options?: Partial<ImportOptions>) => {
        const format = options?.format || 'gltf';
        let fileData: string | ArrayBuffer | Uint8Array;

        if (bridge?.showOpenDialog && bridge?.readFile) {
          const dialogRes = await bridge.showOpenDialog({
            title: `Import ${format.toUpperCase()}`,
            filters: [
              {
                name: `${format.toUpperCase()} File`,
                extensions: format === 'gltf' ? ['gltf', 'glb'] : [format],
              },
            ],
          });
          if (dialogRes.canceled || !dialogRes.filePaths?.[0]) {
            return { success: false, error: 'Cancelled' };
          }
          const readRes = await bridge.readFile(dialogRes.filePaths[0]);
          if (!readRes.success || !readRes.data) {
            return { success: false, error: readRes.error || 'Failed to read file' };
          }
          fileData = readRes.data;
        } else {
          const file = await selectLocalFile(`.${format}${format === 'gltf' ? ',.glb' : ''}`);
          if (!file) return { success: false, error: 'Cancelled' };
          if (format === 'obj') {
            fileData = await file.text();
          } else {
            fileData = await file.arrayBuffer();
          }
        }

        const imported = await importScene(format, fileData);
        if (imported) {
          const doc: ProjectDocument = {
            version: '1.0.0',
            metadata: createProjectMetadata('Imported Scene'),
            root: imported.root || {
              id: 'root',
              name: 'Scene Root',
              type: 'root',
              childrenIds: Object.keys(imported.nodes || {}),
            },
            nodes: imported.nodes || {},
            collections: {},
            geometries: imported.geometries || {},
            materials: imported.materials || {},
          };
          return { success: true, document: doc };
        }
        return { success: false, error: 'Import failed' };
      },
    },
    window: {
      minimize: () => bridge?.minimize?.(),
      maximize: () => bridge?.maximize?.(),
      close: () => bridge?.close?.(),
      isMaximized: () => bridge?.isMaximized?.(),
      onMaximizedChange: (cb: (maximized: boolean) => void) => bridge?.onMaximizedChange?.(cb),
      setTitle: (title: string) => bridge?.setTitle?.(title),
    },
    clipboard: {
      readText: async () => navigator.clipboard.readText(),
      writeText: async (text: string) => navigator.clipboard.writeText(text),
    },
    notifications: {
      notify: (message: string, type = 'info') => {
        console.log(`[Desktop] [${type}] ${message}`);
      },
    },
  };
}

import type {
  IPlatformBridge,
  ProjectDocument,
  ExportPayload,
  ExportResult,
  ImportOptions,
} from '@blender-elt/contracts';
import { webProjectStorage } from '../storage/webProjectStorage';
import { downloadBlob, selectLocalFile } from '../utils/webFileOperations';
import {
  deserializeProject,
  serializeProject,
  createProjectMetadata,
} from '@blender-elt/persistence';
import { importScene } from '@blender-elt/file-formats';

export interface WebBridgeOptions {
  projectId: string;
  onNavigate: (url: string) => void;
  onProjectIdAssigned?: (newProjectId: string) => void;
}

/**
 * Creates the Web platform bridge implementing IPlatformBridge for browser and Next.js
 */
export function createWebPlatformBridge(options: WebBridgeOptions): IPlatformBridge {
  const { projectId, onNavigate, onProjectIdAssigned } = options;

  return {
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
        try {
          const actualId =
            projectId === 'new'
              ? `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
              : projectId;

          const name = doc.metadata?.name || 'Untitled Scene';
          await webProjectStorage.saveProject(actualId, name, doc);

          if (projectId === 'new' && onProjectIdAssigned) {
            onProjectIdAssigned(actualId);
          }

          if (filePath && filePath.endsWith('.belt')) {
            downloadBlob(serializeProject(doc), filePath, 'application/json');
          }

          return { success: true, filePath: actualId };
        } catch (err: unknown) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      },
      openProject: async (_filePath?: string) => {
        const file = await selectLocalFile('.belt,.json');
        if (!file) return { success: false, error: 'Cancelled' };
        try {
          const text = await file.text();
          const doc = deserializeProject(text);
          const newId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const name = doc.metadata?.name || file.name.replace(/\.[^/.]+$/, '');
          await webProjectStorage.saveProject(newId, name, doc);
          onNavigate(`/editor/${newId}`);
          return { success: true, document: doc, filePath: newId };
        } catch (err: unknown) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      },
      exportScene: async (payload: ExportPayload): Promise<ExportResult> => {
        const mime =
          payload.format === 'glb'
            ? 'model/gltf-binary'
            : payload.format === 'gltf'
              ? 'application/json'
              : 'text/plain';

        downloadBlob(payload.data, payload.filePath, mime);
        return { success: true, filePath: payload.filePath };
      },
      importScene: async (importOpts?: Partial<ImportOptions>) => {
        const format = (importOpts?.format || 'gltf') as 'gltf' | 'obj' | 'stl';
        const file = await selectLocalFile(`.${format}${format === 'gltf' ? ',.glb' : ''}`);
        if (!file) return { success: false, error: 'Cancelled' };

        const fileData = format === 'obj' ? await file.text() : await file.arrayBuffer();
        const imported = await importScene(format, fileData);

        if (imported) {
          const doc: ProjectDocument = {
            version: '1.0.0',
            metadata: createProjectMetadata(file.name.replace(/\.[^/.]+$/, '')),
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
        return { success: false, error: 'Failed to import file' };
      },
    },
    clipboard: {
      readText: async () => navigator.clipboard.readText(),
      writeText: async (text: string) => navigator.clipboard.writeText(text),
    },
    notifications: {
      notify: (message: string, type = 'info') => {
        console.log(`[Web] [${type}] ${message}`);
      },
    },
  };
}

import type {
  ProjectDocument,
  SupportedFileFormat,
  MaterialDefinition,
  IMeshData,
  MeshNode,
  PrimitiveType,
} from '@blender-elt/contracts';
import {
  serializeProject,
  deserializeProject,
  createProjectMetadata,
} from '@blender-elt/persistence';
import { exportScene, importScene } from '@blender-elt/file-formats';
import { createPrimitiveGeometry, bufferGeometryToMeshData } from '@blender-elt/modeling';
import type { SceneGraphState } from '@blender-elt/scene-core';

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

function buildProjectDocument(state: SceneGraphState): ProjectDocument {
  const geometries: Record<string, IMeshData> = {};
  const materials: Record<string, MaterialDefinition> = {};

  Object.values(state.nodes).forEach((n) => {
    if (n.type === 'mesh') {
      const mesh = n as MeshNode;
      const prim = (mesh.primitiveType || 'cube') as PrimitiveType;
      const geo = createPrimitiveGeometry(prim);
      geometries[mesh.geometryId || mesh.id] = bufferGeometryToMeshData(geo);
    }
  });

  return {
    version: '1.0.0',
    metadata: createProjectMetadata('Blender-ELT Project'),
    root: state.root,
    nodes: state.nodes,
    collections: state.collections,
    geometries,
    materials,
  };
}

/**
 * Saves current scene state to a .belt project document
 */
export async function saveProjectDocument(
  state: SceneGraphState,
  currentFilePath?: string,
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const doc = buildProjectDocument(state);
  const serialized = serializeProject(doc);

  // If running in Electron
  const bridge = window.electronBridge || window.electronAPI;
  if (bridge?.saveProject) {
    return await bridge.saveProject({
      filePath: currentFilePath,
      document: doc,
    });
  }

  // Web Browser fallback
  downloadBlob(serialized, 'project.belt', 'application/json');
  return { success: true, filePath: 'project.belt' };
}

/**
 * Loads a project document from disk or browser input
 */
export async function openProjectDocument(
  state: SceneGraphState,
  targetFilePath?: string,
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const bridge = window.electronBridge || window.electronAPI;

  if (bridge?.openProject) {
    let path = targetFilePath;
    if (!path && bridge.showOpenDialog) {
      const res = await bridge.showOpenDialog({
        title: 'Open Project',
        filters: [{ name: 'Blender-ELT Project', extensions: ['belt', 'json'] }],
      });
      if (res.canceled || !res.filePaths[0]) {
        return { success: false, error: 'Cancelled' };
      }
      path = res.filePaths[0];
    }

    if (path) {
      const result = await bridge.openProject({ filePath: path });
      if (result.success && result.document) {
        state.loadScene(
          result.document.root,
          result.document.nodes,
          result.document.collections || {},
        );
        return { success: true, filePath: result.filePath };
      }
      return { success: false, error: result.error || 'Failed to open project' };
    }
  }

  // Web Browser fallback
  const file = await selectLocalFile('.belt,.json');
  if (!file) return { success: false, error: 'Cancelled' };

  try {
    const text = await file.text();
    const doc = deserializeProject(text);
    state.loadScene(doc.root, doc.nodes, doc.collections || {});
    return { success: true, filePath: file.name };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Exports current scene to supported 3D file formats (GLTF, GLB, OBJ, STL)
 */
export async function exportSceneFile(
  state: SceneGraphState,
  format: SupportedFileFormat,
): Promise<{ success: boolean; error?: string }> {
  try {
    const doc = buildProjectDocument(state);
    const unifiedOutput = await exportScene(format, doc);

    const bridge = window.electronBridge || window.electronAPI;
    const ext = format === 'glb' ? 'glb' : format === 'gltf' ? 'gltf' : format;

    if (bridge?.showSaveDialog && bridge?.exportFile) {
      const dialogRes = await bridge.showSaveDialog({
        title: `Export ${format.toUpperCase()}`,
        filters: [{ name: `${format.toUpperCase()} File`, extensions: [ext] }],
      });
      if (dialogRes.canceled || !dialogRes.filePath) {
        return { success: false, error: 'Cancelled' };
      }
      return await bridge.exportFile({
        filePath: dialogRes.filePath,
        format,
        data: unifiedOutput.data,
      });
    }

    // Web fallback
    downloadBlob(unifiedOutput.data, `scene.${ext}`, unifiedOutput.mimeType);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Imports 3D file formats (GLTF, GLB, OBJ, STL) into the current scene
 */
export async function importSceneFile(
  state: SceneGraphState,
  format: 'gltf' | 'obj' | 'stl',
): Promise<{ success: boolean; error?: string }> {
  try {
    const bridge = window.electronBridge || window.electronAPI;
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
      if (dialogRes.canceled || !dialogRes.filePaths[0]) {
        return { success: false, error: 'Cancelled' };
      }
      const readRes = await bridge.readFile(dialogRes.filePaths[0]);
      if (!readRes.success || !readRes.data) {
        return { success: false, error: readRes.error || 'Failed to read file' };
      }
      fileData = readRes.data;
    } else {
      // Browser fallback
      const file = await selectLocalFile(`.${format}${format === 'gltf' ? ',.glb' : ''}`);
      if (!file) return { success: false, error: 'Cancelled' };
      if (format === 'obj') {
        fileData = await file.text();
      } else {
        fileData = await file.arrayBuffer();
      }
    }

    const imported = await importScene(format, fileData);
    if (imported && imported.nodes) {
      // Add imported nodes to current scene
      Object.values(imported.nodes).forEach((node) => {
        state.addNode(node, 'root');
      });
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

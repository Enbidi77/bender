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
import { webProjectStorage } from '../storage/webProjectStorage';

/**
 * Triggers browser download for a Blob, text, or binary data
 */
export function downloadBlob(
  data: Blob | string | Uint8Array,
  filename: string,
  mimeType: string,
): void {
  if (typeof window === 'undefined') return;

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

/**
 * Prompts user for a local file via browser file input
 */
export function selectLocalFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    input.onchange = () => {
      const file = input.files?.[0] || null;
      if (input.parentNode) {
        document.body.removeChild(input);
      }
      resolve(file);
    };

    input.oncancel = () => {
      if (input.parentNode) {
        document.body.removeChild(input);
      }
      resolve(null);
    };

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Builds a complete ProjectDocument from scene graph state
 */
export function buildProjectDocument(
  state: SceneGraphState,
  name: string = 'Untitled',
): ProjectDocument {
  const geometries: Record<string, IMeshData> = {};
  const materials: Record<string, MaterialDefinition> = {};

  Object.values(state.nodes).forEach((n) => {
    if (n.type === 'mesh') {
      const mesh = n as MeshNode;
      const prim = (mesh.primitiveType || 'cube') as PrimitiveType;
      const geo = createPrimitiveGeometry(prim);
      const rawMesh = bufferGeometryToMeshData(geo);
      geometries[mesh.geometryId || mesh.id] = {
        vertices: Array.from(rawMesh.vertices as any),
        normals: rawMesh.normals ? Array.from(rawMesh.normals as any) : undefined,
        uvs: rawMesh.uvs ? Array.from(rawMesh.uvs as any) : undefined,
        indices: rawMesh.indices ? Array.from(rawMesh.indices as any) : undefined,
      };
    }
  });

  return {
    version: '1.0.0',
    metadata: createProjectMetadata(name),
    root: state.root,
    nodes: state.nodes,
    collections: state.collections,
    geometries,
    materials,
  };
}

/**
 * Saves current scene to Web Storage (IndexedDB/localStorage) and optionally downloads .belt file
 */
export async function saveProjectDocumentWeb(
  state: SceneGraphState,
  projectId: string,
  projectName: string,
  options: { downloadFile?: boolean } = {},
): Promise<{ success: boolean; error?: string }> {
  try {
    const doc = buildProjectDocument(state, projectName);
    await webProjectStorage.saveProject(projectId, projectName, doc);

    if (options.downloadFile) {
      const serialized = serializeProject(doc);
      const safeName = projectName.endsWith('.belt') ? projectName : `${projectName}.belt`;
      downloadBlob(serialized, safeName, 'application/json');
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Loads a project document from a .belt or .json file selected by user
 */
export async function openProjectDocumentWeb(
  state: SceneGraphState,
): Promise<{ success: boolean; projectName?: string; projectId?: string; error?: string }> {
  const file = await selectLocalFile('.belt,.json');
  if (!file) return { success: false, error: 'Cancelled' };

  try {
    const text = await file.text();
    const doc = deserializeProject(text);
    state.loadScene(doc.root, doc.nodes, doc.collections || {});

    // Save as imported project in web storage
    const name = doc.metadata?.name || file.name.replace(/\.(belt|json)$/i, '');
    const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await webProjectStorage.saveProject(id, name, doc);

    return { success: true, projectName: name, projectId: id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Exports current scene to standard 3D formats (GLTF, GLB, OBJ, STL)
 */
export async function exportSceneFileWeb(
  state: SceneGraphState,
  format: SupportedFileFormat,
  sceneName: string = 'scene',
): Promise<{ success: boolean; error?: string }> {
  try {
    const doc = buildProjectDocument(state, sceneName);
    const unifiedOutput = await exportScene(format, doc);
    const ext = format === 'glb' ? 'glb' : format === 'gltf' ? 'gltf' : format;

    downloadBlob(unifiedOutput.data, `${sceneName}.${ext}`, unifiedOutput.mimeType);

    // If companion files exist (e.g. MTL for OBJ)
    if (unifiedOutput.companionFiles) {
      Object.entries(unifiedOutput.companionFiles).forEach(([name, content]) => {
        downloadBlob(content, name, 'text/plain');
      });
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Imports 3D file formats (GLTF, GLB, OBJ, STL) into the current scene
 */
export async function importSceneFileWeb(
  state: SceneGraphState,
  format: 'gltf' | 'obj' | 'stl',
): Promise<{ success: boolean; error?: string }> {
  try {
    const file = await selectLocalFile(`.${format}${format === 'gltf' ? ',.glb' : ''}`);
    if (!file) return { success: false, error: 'Cancelled' };

    let fileData: string | ArrayBuffer | Uint8Array;
    if (format === 'obj') {
      fileData = await file.text();
    } else {
      fileData = await file.arrayBuffer();
    }

    const imported = await importScene(format, fileData);
    if (imported && imported.nodes) {
      Object.values(imported.nodes).forEach((node) => {
        state.addNode(node, 'root');
      });
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

import type { ProjectDocument, ProjectMetadata } from '@blender-elt/contracts';
import { ProjectDocumentSchema } from './schema.js';
import type { IStorageAdapter } from './storage.js';

export const CURRENT_PROJECT_VERSION = '1.0.0';

/**
 * Creates default project metadata
 */
export function createProjectMetadata(name = 'Untitled Project', author = 'User'): ProjectMetadata {
  const now = new Date().toISOString();
  return {
    name,
    author,
    version: CURRENT_PROJECT_VERSION,
    createdAt: now,
    updatedAt: now,
    appVersion: '0.1.0',
    description: 'Blender-ELT 3D Project',
  };
}

/**
 * Creates a minimal default project document
 */
export function createDefaultProjectDocument(
  name = 'Untitled Project',
  author = 'User',
): ProjectDocument {
  return {
    version: CURRENT_PROJECT_VERSION,
    metadata: createProjectMetadata(name, author),
    root: {
      id: 'root',
      name: 'Scene Root',
      type: 'root',
      childrenIds: ['cube-default'],
      backgroundColor: '#1d1e22',
    },
    nodes: {
      'cube-default': {
        id: 'cube-default',
        name: 'Cube',
        type: 'mesh',
        geometryId: 'geo-cube-default',
        primitiveType: 'cube',
        materialId: 'mat-clay-default',
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
        parentId: 'root',
        childrenIds: [],
        castShadow: true,
        receiveShadow: true,
      },
    },
    geometries: {},
    materials: {},
    collections: {},
  };
}

/**
 * Validates arbitrary data against ProjectDocumentSchema
 */
export function validateProjectDocument(data: unknown): {
  success: boolean;
  data?: ProjectDocument;
  error?: string;
} {
  const result = ProjectDocumentSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as unknown as ProjectDocument };
  }
  const issues = (result.error as any).issues || (result.error as any).errors || [];
  const errorMessage =
    issues.length > 0
      ? issues.map((e: any) => `${e.path?.join('.') || 'root'}: ${e.message}`).join('; ')
      : result.error.message;
  return { success: false, error: errorMessage };
}

/**
 * Serializes ProjectDocument to JSON string (.belt)
 */
export function serializeProject(doc: ProjectDocument, options?: { pretty?: boolean }): string {
  const updatedDoc: ProjectDocument = {
    ...doc,
    version: CURRENT_PROJECT_VERSION,
    metadata: {
      ...doc.metadata,
      updatedAt: new Date().toISOString(),
    },
  };

  const validation = validateProjectDocument(updatedDoc);
  if (!validation.success) {
    throw new Error(`Cannot serialize invalid project document: ${validation.error}`);
  }

  const space = (options?.pretty ?? true) ? 2 : undefined;
  return JSON.stringify(updatedDoc, null, space);
}

/**
 * Deserializes JSON string into ProjectDocument with schema validation
 */
export function deserializeProject(jsonString: string): ProjectDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse JSON string: ${msg}`);
  }

  const validation = validateProjectDocument(parsed);
  if (!validation.success || !validation.data) {
    throw new Error(`Project schema validation failed: ${validation.error}`);
  }

  return validation.data;
}

/**
 * Helper to save a project document via a storage adapter
 */
export async function saveProject(
  adapter: IStorageAdapter,
  pathOrKey: string,
  doc: ProjectDocument,
  options?: { pretty?: boolean },
): Promise<void> {
  const serialized = serializeProject(doc, options);
  await adapter.write(pathOrKey, serialized);
}

/**
 * Helper to load a project document via a storage adapter
 */
export async function loadProject(
  adapter: IStorageAdapter,
  pathOrKey: string,
): Promise<ProjectDocument> {
  const content = await adapter.read(pathOrKey);
  return deserializeProject(content);
}

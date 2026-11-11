import type { ProjectDocument, ProjectMetadata } from '@blender-elt/contracts';

export const CURRENT_PROJECT_VERSION = '1.0.0';

/**
 * Serializes a ProjectDocument to formatted JSON string
 */
export function serializeProject(doc: ProjectDocument): string {
  const updatedDoc: ProjectDocument = {
    ...doc,
    version: CURRENT_PROJECT_VERSION,
    metadata: {
      ...doc.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
  return JSON.stringify(updatedDoc, null, 2);
}

/**
 * Deserializes JSON string into a ProjectDocument with validation
 */
export function deserializeProject(jsonString: string): ProjectDocument {
  try {
    const parsed = JSON.parse(jsonString);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid project file format: not an object');
    }

    if (!parsed.root || !parsed.nodes) {
      throw new Error('Invalid project file format: missing scene root or nodes');
    }

    return parsed as ProjectDocument;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load project document: ${msg}`);
  }
}

/**
 * Helper to initialize project metadata
 */
export function createProjectMetadata(name: string, author?: string): ProjectMetadata {
  const now = new Date().toISOString();
  return {
    name,
    author: author || 'User',
    version: CURRENT_PROJECT_VERSION,
    createdAt: now,
    updatedAt: now,
    appVersion: '0.1.0',
  };
}

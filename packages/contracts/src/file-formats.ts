import type { SceneNode, SceneRoot, SceneCollection } from './scene.js';
import type { MaterialDefinition } from './materials.js';
import type { AnimationTimeline } from './animation.js';
import type { ViewportConfig } from './viewport.js';
import type { IMeshData } from './modeling.js';

/**
 * Standard 3D file formats supported for import and export
 */
export type SupportedFileFormat = 'gltf' | 'glb' | 'obj' | 'stl';

/**
 * Import configuration options
 */
export interface ImportOptions {
  format: SupportedFileFormat;
  centerGeometry?: boolean;
  normalizeScale?: boolean;
  importMaterials?: boolean;
  importCameras?: boolean;
  importLights?: boolean;
  importAnimations?: boolean;
  upAxis?: 'Y' | 'Z';
}

/**
 * Export configuration options
 */
export interface ExportOptions {
  format: SupportedFileFormat;
  binary?: boolean;
  includeMaterials?: boolean;
  selectedOnly?: boolean;
  embedTextures?: boolean;
  includeAnimations?: boolean;
  prettyPrint?: boolean;
  upAxis?: 'Y' | 'Z';
}

/**
 * Project file document metadata
 */
export interface ProjectMetadata {
  name: string;
  author?: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  appVersion: string;
  description?: string;
}

/**
 * Complete serialized project document structure
 */
export interface ProjectDocument {
  version: string;
  metadata: ProjectMetadata;
  root: SceneRoot;
  nodes: Record<string, SceneNode>;
  geometries: Record<string, IMeshData>;
  materials: Record<string, MaterialDefinition>;
  collections?: Record<string, SceneCollection>;
  timeline?: AnimationTimeline;
  viewport?: ViewportConfig;
}

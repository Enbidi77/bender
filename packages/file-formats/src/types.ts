import type * as THREE from 'three';
import type {
  SupportedFileFormat,
  ImportOptions,
  ExportOptions,
  ProjectDocument,
  SceneNode,
  SceneRoot,
  IMeshData,
  MaterialDefinition,
  PBRMaterialConfig,
} from '@blender-elt/contracts';

export type {
  SupportedFileFormat,
  ImportOptions,
  ExportOptions,
  ProjectDocument,
  SceneNode,
  SceneRoot,
  IMeshData,
  MaterialDefinition,
  PBRMaterialConfig,
};

/**
 * Result structure when importing any 3D format or scene
 */
export interface ImportedSceneResult {
  root: SceneRoot;
  nodes: Record<string, SceneNode>;
  geometries: Record<string, IMeshData>;
  materials: Record<string, MaterialDefinition>;
  threeObject?: THREE.Object3D;
}

/**
 * Valid scene input representation for exporters
 */
export type ExportInput =
  | THREE.Object3D
  | ProjectDocument
  | {
      nodes: Record<string, SceneNode>;
      geometries: Record<string, IMeshData>;
      materials?: Record<string, MaterialDefinition>;
      root?: SceneRoot;
    };

/**
 * Result of OBJ format export with companion MTL
 */
export interface OBJExportResult {
  obj: string;
  mtl?: string;
  mtlFileName?: string;
}

/**
 * Unified export result
 */
export interface UnifiedExportOutput {
  format: SupportedFileFormat;
  data: string | Uint8Array;
  mimeType: string;
  companionFiles?: Record<string, string | Uint8Array>;
}

/**
 * Converter interface per file format
 */
export interface FileFormatConverter {
  format: SupportedFileFormat;
  export(input: ExportInput, options?: ExportOptions): Promise<string | Uint8Array>;
  import(
    data: string | ArrayBuffer | Uint8Array,
    options?: ImportOptions,
  ): Promise<ImportedSceneResult>;
}

import type { SupportedFileFormat, ImportOptions, ExportOptions } from '@blender-elt/contracts';

// Polyfills
export { ensureNodePolyfills } from './utils/polyfill.js';

// Types
export * from './types.js';

// Bridge & Converters
export {
  meshDataToBufferGeometry,
  bufferGeometryToMeshData,
  createDefaultPBRConfig,
  pbrConfigToThreeMaterial,
  threeMaterialToPBR,
  beltToThree,
  threeToBelt,
} from './bridge.js';

// GLTF & GLB
export { exportGLTF, exportGLB, importGLTF, importGLB } from './gltf.js';

// OBJ & MTL
export { exportOBJ, parseMTL, parseOBJToMeshData, importOBJ } from './obj.js';

// STL
export {
  exportSTL,
  exportBinarySTL,
  exportAsciiSTL,
  parseSTLToMeshData,
  importSTL,
} from './stl.js';

// Project (.belt / JSON)
export {
  CURRENT_PROJECT_VERSION,
  APP_VERSION,
  Vector3Schema,
  EulerSchema,
  TransformSchema,
  SceneRootSchema,
  MeshNodeSchema,
  CameraNodeSchema,
  LightNodeSchema,
  GroupNodeSchema,
  SceneNodeSchema,
  MeshDataSchema,
  PBRMaterialConfigSchema,
  MaterialDefinitionSchema,
  ProjectMetadataSchema,
  ProjectDocumentSchema,
  createProjectMetadata,
  validateProjectDocument,
  serializeProject,
  deserializeProject,
} from './project.js';

import { exportGLTF, exportGLB, importGLTF } from './gltf.js';
import { exportOBJ, importOBJ } from './obj.js';
import { exportSTL, importSTL } from './stl.js';
import type {
  ExportInput,
  ImportedSceneResult,
  UnifiedExportOutput,
  FileFormatConverter,
} from './types.js';

/**
 * Unified high-level scene export function supporting all standard formats
 */
export async function exportScene(
  format: SupportedFileFormat,
  input: ExportInput,
  options?: ExportOptions,
): Promise<UnifiedExportOutput> {
  switch (format) {
    case 'gltf': {
      const gltfData = await exportGLTF(input, options);
      const dataStr = typeof gltfData === 'string' ? gltfData : JSON.stringify(gltfData, null, 2);
      return {
        format: 'gltf',
        data: dataStr,
        mimeType: 'model/gltf+json',
      };
    }
    case 'glb': {
      const glbData = await exportGLB(input, options);
      return {
        format: 'glb',
        data: glbData,
        mimeType: 'model/gltf-binary',
      };
    }
    case 'obj': {
      const objResult = exportOBJ(input, options);
      const companionFiles: Record<string, string> = {};
      if (objResult.mtl && objResult.mtlFileName) {
        companionFiles[objResult.mtlFileName] = objResult.mtl;
      }
      return {
        format: 'obj',
        data: objResult.obj,
        mimeType: 'text/plain',
        companionFiles,
      };
    }
    case 'stl': {
      const stlData = exportSTL(input, options);
      return {
        format: 'stl',
        data: stlData,
        mimeType: typeof stlData === 'string' ? 'text/plain' : 'application/sla',
      };
    }
    default:
      throw new Error(`Unsupported export format: ${format as string}`);
  }
}

/**
 * Unified high-level scene import function supporting all standard formats
 */
export async function importScene(
  format: SupportedFileFormat,
  data: string | ArrayBuffer | Uint8Array,
  options?: ImportOptions,
): Promise<ImportedSceneResult> {
  switch (format) {
    case 'gltf':
    case 'glb':
      return importGLTF(data, options);
    case 'obj': {
      if (typeof data !== 'string') {
        const decoded =
          data instanceof Uint8Array
            ? new TextDecoder().decode(data)
            : new TextDecoder().decode(new Uint8Array(data));
        return importOBJ(decoded, undefined, options);
      }
      return importOBJ(data, undefined, options);
    }
    case 'stl':
      return importSTL(data, options);
    default:
      throw new Error(`Unsupported import format: ${format as string}`);
  }
}

/**
 * Helper returning converter adapter conforming to FileFormatConverter interface
 */
export function getFileFormatConverter(format: SupportedFileFormat): FileFormatConverter {
  return {
    format,
    export: async (input: ExportInput, options?: ExportOptions) => {
      const result = await exportScene(format, input, options);
      return result.data;
    },
    import: async (data: string | ArrayBuffer | Uint8Array, options?: ImportOptions) => {
      return importScene(format, data, options);
    },
  };
}

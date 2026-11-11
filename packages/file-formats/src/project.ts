import { z } from 'zod';
import type {
  ProjectDocument,
  ProjectMetadata,
  IMeshData,
} from '@blender-elt/contracts';

export const CURRENT_PROJECT_VERSION = '1.0.0';
export const APP_VERSION = '0.1.0';

/**
 * Zod Schemas for Domain Models
 */
export const Vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const EulerSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  order: z.enum(['XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX']).optional(),
});

export const TransformSchema = z.object({
  position: Vector3Schema,
  rotation: EulerSchema,
  scale: Vector3Schema,
});

export const SceneRootSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal('root'),
  childrenIds: z.array(z.string()),
  environment: z
    .object({
      preset: z.string().optional(),
      backgroundBlur: z.number().optional(),
      backgroundIntensity: z.number().optional(),
    })
    .optional(),
  backgroundColor: z.string().optional(),
});

export const BaseNodeFields = {
  id: z.string(),
  name: z.string(),
  transform: TransformSchema,
  visible: z.boolean(),
  locked: z.boolean(),
  parentId: z.string().nullable(),
  childrenIds: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()).optional(),
};

export const MeshNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal('mesh'),
  geometryId: z.string(),
  primitiveType: z.string().optional(),
  materialId: z.string().optional(),
  castShadow: z.boolean().optional(),
  receiveShadow: z.boolean().optional(),
});

export const CameraNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal('camera'),
  projection: z.enum(['perspective', 'orthographic']),
  fov: z.number(),
  near: z.number(),
  far: z.number(),
  zoom: z.number(),
  aspect: z.number().optional(),
});

export const LightNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal('light'),
  lightType: z.enum(['directional', 'point', 'spot', 'ambient', 'hemisphere']),
  color: z.string(),
  intensity: z.number(),
  distance: z.number().optional(),
  decay: z.number().optional(),
  castShadow: z.boolean().optional(),
  groundColor: z.string().optional(),
  angle: z.number().optional(),
  penumbra: z.number().optional(),
});

export const GroupNodeSchema = z.object({
  ...BaseNodeFields,
  type: z.literal('group'),
});

export const SceneNodeSchema = z.discriminatedUnion('type', [
  MeshNodeSchema,
  CameraNodeSchema,
  LightNodeSchema,
  GroupNodeSchema,
]);

/**
 * Number array or typed array validator for mesh buffers
 */
const NumberBufferSchema = z.union([
  z.array(z.number()),
  z.custom<Float32Array>((val) => val instanceof Float32Array || val instanceof Uint32Array || val instanceof Uint16Array, {
    message: 'Expected typed array or number array',
  }),
]);

export const MeshDataSchema = z.object({
  vertices: NumberBufferSchema,
  normals: NumberBufferSchema.optional(),
  uvs: NumberBufferSchema.optional(),
  indices: NumberBufferSchema.optional(),
});

export const TextureMapConfigSchema = z.object({
  url: z.string(),
  name: z.string().optional(),
  wrapS: z.enum(['repeat', 'clamp', 'mirrored']).optional(),
  wrapT: z.enum(['repeat', 'clamp', 'mirrored']).optional(),
  repeat: z.tuple([z.number(), z.number()]).optional(),
  offset: z.tuple([z.number(), z.number()]).optional(),
  rotation: z.number().optional(),
});

export const PBRMaterialConfigSchema = z.object({
  color: z.string(),
  roughness: z.number(),
  metalness: z.number(),
  emission: z.string(),
  emissionIntensity: z.number().optional(),
  opacity: z.number(),
  transparent: z.boolean(),
  wireframe: z.boolean(),
  clearcoat: z.number().optional(),
  clearcoatRoughness: z.number().optional(),
  transmission: z.number().optional(),
  ior: z.number().optional(),
  map: TextureMapConfigSchema.optional(),
  normalMap: TextureMapConfigSchema.optional(),
  roughnessMap: TextureMapConfigSchema.optional(),
  metalnessMap: TextureMapConfigSchema.optional(),
  aoMap: TextureMapConfigSchema.optional(),
  emissiveMap: TextureMapConfigSchema.optional(),
});

export const MaterialPresetSchema = z.enum([
  'default-clay',
  'matte-clay',
  'glossy-plastic',
  'brushed-metal',
  'glass',
  'gold',
  'chrome',
  'rough-wood',
  'rubber',
  'copper',
  'car-paint',
]);

export const MaterialDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['pbr', 'basic', 'standard']),
  config: PBRMaterialConfigSchema,
  preset: MaterialPresetSchema.optional(),
});

export const KeyframeSchema = z.object({
  frame: z.number(),
  time: z.number(),
  value: z.union([z.number(), z.array(z.number())]),
  interpolation: z.enum(['linear', 'bezier', 'step', 'ease-in', 'ease-out', 'ease-in-out']).optional(),
  inTangent: z.tuple([z.number(), z.number()]).optional(),
  outTangent: z.tuple([z.number(), z.number()]).optional(),
});

export const AnimationTrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetNodeId: z.string(),
  property: z.string(),
  keyframes: z.array(KeyframeSchema),
  color: z.string().optional(),
  muted: z.boolean().optional(),
});

export const AnimationTimelineSchema = z.object({
  currentFrame: z.number(),
  startFrame: z.number(),
  endFrame: z.number(),
  fps: z.number(),
  playbackState: z.enum(['playing', 'paused', 'stopped', 'looping']),
  isPlaying: z.boolean(),
  loop: z.boolean(),
  tracks: z.array(AnimationTrackSchema),
});

export const ViewportConfigSchema = z.object({
  mode: z.enum(['object', 'edit', 'sculpt', 'vertex-paint', 'weight-paint', 'texture-paint']),
  gizmoType: z.enum(['translate', 'rotate', 'scale', 'none']),
  transformSpace: z.enum(['world', 'local']),
  shadingMode: z.enum(['wireframe', 'solid', 'material', 'rendered']),
  grid: z.object({
    visible: z.boolean(),
    size: z.number(),
    divisions: z.number(),
    colorCenterLine: z.string(),
    colorGrid: z.string(),
    showAxes: z.boolean(),
    fadeDistance: z.number().optional(),
  }),
  showWireframeOverlay: z.boolean(),
  showNormalsOverlay: z.boolean(),
  showFloor: z.boolean(),
});

export const ProjectMetadataSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  author: z.string().optional(),
  version: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  appVersion: z.string(),
  description: z.string().optional(),
});

export const ProjectDocumentSchema = z.object({
  version: z.string(),
  metadata: ProjectMetadataSchema,
  root: SceneRootSchema,
  nodes: z.record(z.string(), SceneNodeSchema),
  geometries: z.record(z.string(), MeshDataSchema),
  materials: z.record(z.string(), MaterialDefinitionSchema),
  timeline: AnimationTimelineSchema.optional(),
  viewport: ViewportConfigSchema.optional(),
});

/**
 * Creates default project metadata
 */
export function createProjectMetadata(name = 'Untitled Project', author = 'Blender-ELT User'): ProjectMetadata {
  const now = new Date().toISOString();
  return {
    name,
    author,
    version: CURRENT_PROJECT_VERSION,
    createdAt: now,
    updatedAt: now,
    appVersion: APP_VERSION,
  };
}

/**
 * Converts typed array buffers in IMeshData to regular arrays for clean JSON serialization
 */
function normalizeMeshDataForSerialization(geo: IMeshData): IMeshData {
  return {
    vertices: Array.isArray(geo.vertices) ? geo.vertices : Array.from(geo.vertices),
    normals: geo.normals
      ? Array.isArray(geo.normals)
        ? geo.normals
        : Array.from(geo.normals)
      : undefined,
    uvs: geo.uvs
      ? Array.isArray(geo.uvs)
        ? geo.uvs
        : Array.from(geo.uvs)
      : undefined,
    indices: geo.indices
      ? Array.isArray(geo.indices)
        ? geo.indices
        : Array.from(geo.indices)
      : undefined,
  };
}

/**
 * Validates any object against ProjectDocument schema with formatted errors
 */
export function validateProjectDocument(
  data: unknown
): { success: true; data: ProjectDocument } | { success: false; errors: string[] } {
  const parseResult = ProjectDocumentSchema.safeParse(data);
  if (parseResult.success) {
    return {
      success: true,
      data: parseResult.data as unknown as ProjectDocument,
    };
  }

  const errors = parseResult.error.issues.map(
    (issue) => `[${issue.path.join('.') || 'root'}]: ${issue.message}`
  );
  return { success: false, errors };
}

/**
 * Serializes a ProjectDocument to formatted JSON string (.belt file format)
 */
export function serializeProject(
  doc: ProjectDocument,
  options?: { pretty?: boolean }
): string {
  // Normalize geometries to ensure clean JSON arrays
  const normalizedGeometries: Record<string, IMeshData> = {};
  for (const [id, geo] of Object.entries(doc.geometries)) {
    normalizedGeometries[id] = normalizeMeshDataForSerialization(geo);
  }

  const updatedDoc: ProjectDocument = {
    ...doc,
    version: CURRENT_PROJECT_VERSION,
    metadata: {
      ...doc.metadata,
      updatedAt: new Date().toISOString(),
      version: CURRENT_PROJECT_VERSION,
    },
    geometries: normalizedGeometries,
  };

  const validation = validateProjectDocument(updatedDoc);
  if (!validation.success) {
    throw new Error(`Invalid ProjectDocument schema: \n${validation.errors.join('\n')}`);
  }

  return JSON.stringify(updatedDoc, null, options?.pretty === false ? 0 : 2);
}

/**
 * Deserializes JSON or .belt string into a validated ProjectDocument
 */
export function deserializeProject(jsonString: string): ProjectDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse .belt project JSON: ${msg}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid project file format: root must be a JSON object');
  }

  const rawDoc = parsed as Record<string, unknown>;

  // Check version compatibility
  const version = (rawDoc.version as string) || (rawDoc.metadata as Record<string, unknown>)?.version;
  if (!version) {
    throw new Error('Invalid project file format: missing version identifier');
  }

  const validation = validateProjectDocument(parsed);
  if (!validation.success) {
    throw new Error(`Project validation error:\n${validation.errors.join('\n')}`);
  }

  // Restore TypedArrays in geometries for optimal performance
  const doc = validation.data;
  const restoredGeometries: Record<string, IMeshData> = {};
  for (const [id, geo] of Object.entries(doc.geometries)) {
    restoredGeometries[id] = {
      vertices: geo.vertices instanceof Float32Array ? geo.vertices : new Float32Array(geo.vertices),
      normals: geo.normals
        ? geo.normals instanceof Float32Array
          ? geo.normals
          : new Float32Array(geo.normals)
        : undefined,
      uvs: geo.uvs
        ? geo.uvs instanceof Float32Array
          ? geo.uvs
          : new Float32Array(geo.uvs)
        : undefined,
      indices: geo.indices
        ? geo.indices instanceof Uint32Array || geo.indices instanceof Uint16Array
          ? geo.indices
          : new Uint32Array(geo.indices)
        : undefined,
    };
  }

  return {
    ...doc,
    geometries: restoredGeometries,
  };
}

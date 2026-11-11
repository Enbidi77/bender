import { z } from 'zod';

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

export const QuaternionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  w: z.number(),
});

export const TransformSchema = z.object({
  position: Vector3Schema,
  rotation: EulerSchema,
  scale: Vector3Schema,
});

export const ProjectMetadataSchema = z.object({
  name: z.string(),
  author: z.string().optional(),
  version: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  appVersion: z.string(),
  description: z.string().optional(),
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

export const SceneCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  visible: z.boolean(),
  locked: z.boolean(),
  color: z.string().optional(),
  nodeIds: z.array(z.string()),
});

export const BaseNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['mesh', 'camera', 'light', 'group', 'collection', 'root']),
  transform: TransformSchema,
  visible: z.boolean(),
  locked: z.boolean(),
  parentId: z.string().nullable(),
  childrenIds: z.array(z.string()),
  collectionId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const MeshNodeSchema = BaseNodeSchema.extend({
  type: z.literal('mesh'),
  geometryId: z.string(),
  primitiveType: z.string().optional(),
  materialId: z.string().optional(),
  castShadow: z.boolean().optional(),
  receiveShadow: z.boolean().optional(),
});

export const CameraNodeSchema = BaseNodeSchema.extend({
  type: z.literal('camera'),
  projection: z.enum(['perspective', 'orthographic']),
  fov: z.number(),
  near: z.number(),
  far: z.number(),
  zoom: z.number(),
  aspect: z.number().optional(),
});

export const LightNodeSchema = BaseNodeSchema.extend({
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

export const SceneNodeSchema = z.union([
  MeshNodeSchema,
  CameraNodeSchema,
  LightNodeSchema,
  BaseNodeSchema,
]);

export const IMeshDataSchema = z.object({
  vertices: z
    .union([z.array(z.number()), z.instanceof(Float32Array)])
    .transform((v) => (Array.isArray(v) ? v : Array.from(v))),
  normals: z
    .union([z.array(z.number()), z.instanceof(Float32Array)])
    .transform((v) => (Array.isArray(v) ? v : Array.from(v)))
    .optional(),
  uvs: z
    .union([z.array(z.number()), z.instanceof(Float32Array)])
    .transform((v) => (Array.isArray(v) ? v : Array.from(v)))
    .optional(),
  indices: z
    .union([z.array(z.number()), z.instanceof(Uint32Array), z.instanceof(Uint16Array)])
    .transform((v) => (Array.isArray(v) ? v : Array.from(v)))
    .optional(),
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
});

export const MaterialDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['pbr', 'basic', 'standard']),
  config: PBRMaterialConfigSchema,
  preset: z.string().optional(),
});

export const ProjectDocumentSchema = z.object({
  version: z.string(),
  metadata: ProjectMetadataSchema,
  root: SceneRootSchema,
  nodes: z.record(z.string(), SceneNodeSchema),
  geometries: z.record(z.string(), IMeshDataSchema).default({}),
  materials: z.record(z.string(), MaterialDefinitionSchema).default({}),
  collections: z.record(z.string(), SceneCollectionSchema).optional().default({}),
  timeline: z.any().optional(),
  viewport: z.any().optional(),
});

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

/**
 * Modifier Schemas (10 standard geometry modifier configs)
 */
export const BaseModifierSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum([
    'subdivision',
    'mirror',
    'array',
    'bevel',
    'solidify',
    'boolean',
    'displace',
    'decimate',
    'wireframe',
    'smooth',
  ]),
  enabled: z.boolean(),
  showInViewport: z.boolean(),
  showInRender: z.boolean(),
  showInEditMode: z.boolean().optional(),
  order: z.number(),
});

export const SubdivisionModifierSchema = BaseModifierSchema.extend({
  type: z.literal('subdivision'),
  levels: z.number(),
  renderLevels: z.number(),
  algorithm: z.enum(['catmull-clark', 'simple']),
  uvSmooth: z.enum(['none', 'preserve-corners', 'all']).optional(),
});

export const MirrorModifierSchema = BaseModifierSchema.extend({
  type: z.literal('mirror'),
  axis: z.object({
    x: z.boolean(),
    y: z.boolean(),
    z: z.boolean(),
  }),
  mirrorObjectId: z.string().nullable().optional(),
  clip: z.boolean(),
  merge: z.boolean(),
  mergeThreshold: z.number(),
});

export const ArrayModifierSchema = BaseModifierSchema.extend({
  type: z.literal('array'),
  count: z.number(),
  useRelativeOffset: z.boolean(),
  relativeOffset: Vector3Schema,
  useConstantOffset: z.boolean().optional(),
  constantOffset: Vector3Schema.optional(),
  offsetObjectId: z.string().nullable().optional(),
});

export const BevelModifierSchema = BaseModifierSchema.extend({
  type: z.literal('bevel'),
  width: z.number(),
  segments: z.number(),
  profile: z.number(),
  affect: z.enum(['edges', 'vertices']),
  limitMethod: z.enum(['none', 'angle', 'weight']).optional(),
  angleLimit: z.number().optional(),
});

export const SolidifyModifierSchema = BaseModifierSchema.extend({
  type: z.literal('solidify'),
  thickness: z.number(),
  offset: z.number(),
  rim: z.boolean(),
  evenThickness: z.boolean().optional(),
});

export const BooleanModifierSchema = BaseModifierSchema.extend({
  type: z.literal('boolean'),
  operation: z.enum(['union', 'difference', 'intersect']),
  targetNodeId: z.string(),
  solver: z.enum(['fast', 'exact']).optional(),
});

export const DisplaceModifierSchema = BaseModifierSchema.extend({
  type: z.literal('displace'),
  strength: z.number(),
  midlevel: z.number(),
  direction: z.enum(['normal', 'x', 'y', 'z']),
  textureId: z.string().nullable().optional(),
});

export const DecimateModifierSchema = BaseModifierSchema.extend({
  type: z.literal('decimate'),
  ratio: z.number(),
  method: z.enum(['collapse', 'unsubdivide', 'planar']),
  angleLimit: z.number().optional(),
});

export const WireframeModifierSchema = BaseModifierSchema.extend({
  type: z.literal('wireframe'),
  thickness: z.number(),
  offset: z.number().optional(),
  replaceOriginal: z.boolean(),
});

export const SmoothModifierSchema = BaseModifierSchema.extend({
  type: z.literal('smooth'),
  factor: z.number(),
  repeat: z.number(),
  axes: z
    .object({
      x: z.boolean(),
      y: z.boolean(),
      z: z.boolean(),
    })
    .optional(),
});

export const ModifierConfigSchema = z.discriminatedUnion('type', [
  SubdivisionModifierSchema,
  MirrorModifierSchema,
  ArrayModifierSchema,
  BevelModifierSchema,
  SolidifyModifierSchema,
  BooleanModifierSchema,
  DisplaceModifierSchema,
  DecimateModifierSchema,
  WireframeModifierSchema,
  SmoothModifierSchema,
]);

export const MeshNodeSchema = BaseNodeSchema.extend({
  type: z.literal('mesh'),
  geometryId: z.string(),
  primitiveType: z.string().optional(),
  materialId: z.string().optional(),
  castShadow: z.boolean().optional(),
  receiveShadow: z.boolean().optional(),
  modifiers: z.array(ModifierConfigSchema).optional(),
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

/**
 * Selection Schemas
 */
export const Cursor3DSchema = z.object({
  position: Vector3Schema,
  rotation: EulerSchema,
});

export const PivotPointSchema = z.enum([
  'bounding-box-center',
  'median-point',
  'individual-origins',
  '3d-cursor',
  'active-element',
]);

export const ObjectSelectionStateSchema = z.object({
  activeNodeId: z.string().nullable(),
  selectedNodeIds: z.array(z.string()),
  selectionOrder: z.array(z.string()),
});

export const EditMeshSelectionStateSchema = z.object({
  elementModes: z.array(z.enum(['vertex', 'edge', 'face'])),
  selectedVertexIndices: z.array(z.number()),
  selectedEdgeIndices: z.array(z.number()),
  selectedFaceIndices: z.array(z.number()),
  activeVertexIndex: z.number().nullable(),
  activeEdgeIndex: z.number().nullable(),
  activeFaceIndex: z.number().nullable(),
});

export const UnifiedSelectionModelSchema = z.object({
  object: ObjectSelectionStateSchema,
  edit: EditMeshSelectionStateSchema,
  pivotPoint: PivotPointSchema,
  cursor3D: Cursor3DSchema,
});

/**
 * Workspace Layout Schemas
 */
export const EditorAreaTypeSchema = z.enum([
  'viewport-3d',
  'outliner',
  'properties',
  'timeline',
  'shader-editor',
  'uv-editor',
  'graph-editor',
  'asset-browser',
  'console',
]);

export const DockPanelNodeSchema = z.object({
  id: z.string(),
  type: z.literal('panel'),
  areaType: EditorAreaTypeSchema,
  activeTabId: z.string().optional(),
  tabs: z.array(EditorAreaTypeSchema).optional(),
  collapsed: z.boolean().optional(),
  minWidth: z.number().optional(),
  minHeight: z.number().optional(),
});

export type DockAreaNodeType =
  | z.infer<typeof DockPanelNodeSchema>
  | {
      id: string;
      type: 'split';
      direction: 'horizontal' | 'vertical';
      ratio: number;
      first: DockAreaNodeType;
      second: DockAreaNodeType;
    };

export const DockAreaNodeSchema: z.ZodType<DockAreaNodeType> = z.lazy(() =>
  z.union([
    DockPanelNodeSchema,
    z.object({
      id: z.string(),
      type: z.literal('split'),
      direction: z.enum(['horizontal', 'vertical']),
      ratio: z.number(),
      first: DockAreaNodeSchema,
      second: DockAreaNodeSchema,
    }),
  ]),
);

export const WorkspaceDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().optional(),
  defaultMode: z.enum([
    'object',
    'edit',
    'sculpt',
    'vertex-paint',
    'weight-paint',
    'texture-paint',
  ]),
  layout: DockAreaNodeSchema,
  viewportConfig: z.record(z.string(), z.unknown()).optional(),
  order: z.number(),
});

export const WorkspaceLayoutConfigSchema = z.object({
  activeWorkspaceId: z.string(),
  workspaces: z.record(z.string(), WorkspaceDefinitionSchema),
  customWorkspaces: z.record(z.string(), WorkspaceDefinitionSchema).optional(),
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
  workspace: WorkspaceLayoutConfigSchema.optional(),
  selection: UnifiedSelectionModelSchema.optional(),
});

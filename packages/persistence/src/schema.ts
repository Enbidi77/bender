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
  type: z.enum(['mesh', 'camera', 'light', 'group', 'collection', 'root', 'armature', 'bone']),
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

export const BoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  childrenIds: z.array(z.string()),
  head: Vector3Schema,
  tail: Vector3Schema,
  roll: z.number(),
  length: z.number(),
  connected: z.boolean(),
  deform: z.boolean(),
});

export const ArmatureNodeSchema = BaseNodeSchema.extend({
  type: z.literal('armature'),
  bones: z.record(z.string(), BoneSchema).default({}),
  rootBoneIds: z.array(z.string()).default([]),
});

export const BoneNodeSchema = BaseNodeSchema.extend({
  type: z.literal('bone'),
  armatureId: z.string(),
  head: Vector3Schema,
  tail: Vector3Schema,
  roll: z.number(),
  length: z.number(),
  connected: z.boolean(),
  deform: z.boolean(),
});

export const SceneNodeSchema = z.union([
  MeshNodeSchema,
  CameraNodeSchema,
  LightNodeSchema,
  ArmatureNodeSchema,
  BoneNodeSchema,
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

/**
 * Animation Schemas matching @blender-elt/contracts
 */
export const BezierHandleSchema = z.object({
  frame: z.number(),
  value: z.number(),
});

export const KeyframeInterpolationSchema = z.enum([
  'constant',
  'linear',
  'bezier',
  'step',
  'ease-in',
  'ease-out',
  'ease-in-out',
]);

export const KeyframeHandleTypeSchema = z.enum(['auto', 'aligned', 'vector', 'free']);

export const KeyframeTypeSchema = z.enum(['keyframe', 'breakdown', 'extreme', 'jitter']);

export const KeyframeSchema = z.object({
  id: z.string().optional(),
  frame: z.number(),
  time: z.number().optional().default(0),
  value: z.union([z.number(), z.array(z.number())]),
  interpolation: KeyframeInterpolationSchema.optional(),
  handleTypeLeft: KeyframeHandleTypeSchema.optional(),
  handleTypeRight: KeyframeHandleTypeSchema.optional(),
  handleLeft: BezierHandleSchema.optional(),
  handleRight: BezierHandleSchema.optional(),
  keyframeType: KeyframeTypeSchema.optional(),
  selected: z.boolean().optional(),
  handleLeftSelected: z.boolean().optional(),
  handleRightSelected: z.boolean().optional(),
  inTangent: z.tuple([z.number(), z.number()]).optional(),
  outTangent: z.tuple([z.number(), z.number()]).optional(),
});

export const ExtrapolationModeSchema = z.enum(['constant', 'linear', 'cyclic', 'cyclic_offset']);

export const FCurveModifierTypeSchema = z.enum([
  'noise',
  'cycles',
  'limits',
  'stepped',
  'envelope',
  'generator',
]);

export const BaseFCurveModifierSchema = z.object({
  id: z.string(),
  type: FCurveModifierTypeSchema,
  name: z.string(),
  enabled: z.boolean().default(true),
  influence: z.number().min(0).max(1).default(1),
});

export const NoiseFCurveModifierSchema = BaseFCurveModifierSchema.extend({
  type: z.literal('noise'),
  scale: z.number().default(1),
  strength: z.number().default(1),
  phase: z.number().default(0),
  depth: z.number().default(1),
});

export const CyclesFCurveModifierSchema = BaseFCurveModifierSchema.extend({
  type: z.literal('cycles'),
  modeBefore: z.enum(['repeat', 'repeat_offset']).default('repeat'),
  countBefore: z.number().default(0),
  modeAfter: z.enum(['repeat', 'repeat_offset']).default('repeat'),
  countAfter: z.number().default(0),
});

export const LimitsFCurveModifierSchema = BaseFCurveModifierSchema.extend({
  type: z.literal('limits'),
  minX: z.number().optional(),
  maxX: z.number().optional(),
  minY: z.number().optional(),
  maxY: z.number().optional(),
});

export const SteppedFCurveModifierSchema = BaseFCurveModifierSchema.extend({
  type: z.literal('stepped'),
  stepSize: z.number().default(2),
  offset: z.number().default(0),
});

export const EnvelopeFCurveModifierSchema = BaseFCurveModifierSchema.extend({
  type: z.literal('envelope'),
  min: z.number().optional(),
  max: z.number().optional(),
  referenceValue: z.number().optional(),
});

export const GeneratorFCurveModifierSchema = BaseFCurveModifierSchema.extend({
  type: z.literal('generator'),
  coefficients: z.array(z.number()),
});

export const FCurveModifierSchema = z.discriminatedUnion('type', [
  NoiseFCurveModifierSchema,
  CyclesFCurveModifierSchema,
  LimitsFCurveModifierSchema,
  SteppedFCurveModifierSchema,
  EnvelopeFCurveModifierSchema,
  GeneratorFCurveModifierSchema,
]);

export const IFCurveModifierSchema = FCurveModifierSchema;

export const AnimationChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetNodeId: z.string(),
  propertyPath: z.string(),
  keyframes: z.array(KeyframeSchema).default([]),
  interpolation: KeyframeInterpolationSchema.default('bezier'),
  extrapolation: ExtrapolationModeSchema.default('constant'),
  color: z.string().default('#4772b3'),
  muted: z.boolean().optional().default(false),
  locked: z.boolean().optional().default(false),
  modifiers: z.array(FCurveModifierSchema).optional().default([]),
});

export const AnimationTrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetNodeId: z.string(),
  property: z.string().optional(),
  propertyPath: z.string().optional(),
  keyframes: z.array(KeyframeSchema).default([]),
  color: z.string().optional().default('#4772b3'),
  muted: z.boolean().optional().default(false),
  locked: z.boolean().optional().default(false),
  interpolation: KeyframeInterpolationSchema.optional().default('linear'),
  extrapolation: ExtrapolationModeSchema.optional().default('constant'),
  modifiers: z.array(FCurveModifierSchema).optional().default([]),
});

export const ActionGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  channelIds: z.array(z.string()).default([]),
  isExpanded: z.boolean().optional().default(true),
});

export const AnimationActionSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetNodeId: z.string().optional(),
  groups: z.array(ActionGroupSchema).optional().default([]),
  channels: z.array(AnimationChannelSchema).default([]),
  frameRange: z.tuple([z.number(), z.number()]).default([1, 250]),
  isLooping: z.boolean().optional().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const NLAStripSchema = z.object({
  id: z.string(),
  name: z.string(),
  actionId: z.string(),
  startFrame: z.number(),
  endFrame: z.number(),
  actionStartFrame: z.number(),
  actionEndFrame: z.number(),
  playbackSpeed: z.number().default(1),
  repeatCount: z.number().default(1),
  blendMode: z.enum(['replace', 'add', 'multiply']).default('replace'),
  isMuted: z.boolean().default(false),
});

export const NLATrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  strips: z.array(NLAStripSchema).default([]),
  isMuted: z.boolean().default(false),
  isSolo: z.boolean().default(false),
  isLocked: z.boolean().default(false),
});

export const PlaybackStateSchema = z.enum(['playing', 'paused', 'stopped', 'looping']);

export const AnimationTimelineSchema = z.object({
  currentFrame: z.number().default(1),
  startFrame: z.number().default(1),
  endFrame: z.number().default(250),
  fps: z.number().default(24),
  playbackState: PlaybackStateSchema.optional().default('stopped'),
  isPlaying: z.boolean().optional().default(false),
  loop: z.boolean().default(true),
  tracks: z.array(AnimationTrackSchema).default([]),
  activeActionId: z.string().optional(),
  actions: z.record(z.string(), AnimationActionSchema).default({}),
  nlaTracks: z.array(NLATrackSchema).optional().default([]),
});

export type BezierHandleDto = z.infer<typeof BezierHandleSchema>;
export type KeyframeDto = z.infer<typeof KeyframeSchema>;
export type FCurveModifierDto = z.infer<typeof FCurveModifierSchema>;
export type AnimationChannelDto = z.infer<typeof AnimationChannelSchema>;
export type AnimationActionDto = z.infer<typeof AnimationActionSchema>;
export type AnimationTimelineDto = z.infer<typeof AnimationTimelineSchema>;

export const ProjectDocumentSchema = z.object({
  version: z.string(),
  metadata: ProjectMetadataSchema,
  root: SceneRootSchema,
  nodes: z.record(z.string(), SceneNodeSchema),
  geometries: z.record(z.string(), IMeshDataSchema).default({}),
  materials: z.record(z.string(), MaterialDefinitionSchema).default({}),
  collections: z.record(z.string(), SceneCollectionSchema).optional().default({}),
  timeline: AnimationTimelineSchema.optional(),
  viewport: z.any().optional(),
  workspace: WorkspaceLayoutConfigSchema.optional(),
  selection: UnifiedSelectionModelSchema.optional(),
});

import type { ModifierConfig } from './modifiers.js';

/**
 * 3D math and vector contracts
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Euler {
  x: number;
  y: number;
  z: number;
  order?: 'XYZ' | 'XZY' | 'YXZ' | 'YZX' | 'ZXY' | 'ZYX';
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Transform {
  position: Vector3;
  rotation: Euler;
  scale: Vector3;
}

/**
 * Scene Graph Node Definitions
 */
export type NodeType =
  'mesh' | 'camera' | 'light' | 'group' | 'collection' | 'root' | 'armature' | 'bone';

export interface BaseSceneNode {
  id: string;
  name: string;
  type: NodeType;
  transform: Transform;
  visible: boolean;
  locked: boolean;
  parentId: string | null;
  childrenIds: string[];
  collectionId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CollectionNode extends BaseSceneNode {
  type: 'collection';
  color?: string;
}

export interface SceneCollection {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color?: string;
  nodeIds: string[];
}

export interface MeshNode extends BaseSceneNode {
  type: 'mesh';
  geometryId: string;
  primitiveType?: string;
  materialId?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
  modifiers?: ModifierConfig[];
}

export type CameraProjection = 'perspective' | 'orthographic';

export interface CameraNode extends BaseSceneNode {
  type: 'camera';
  projection: CameraProjection;
  fov: number;
  near: number;
  far: number;
  zoom: number;
  aspect?: number;
}

export type LightType = 'directional' | 'point' | 'spot' | 'ambient' | 'hemisphere';

export interface LightNode extends BaseSceneNode {
  type: 'light';
  lightType: LightType;
  color: string;
  intensity: number;
  distance?: number;
  decay?: number;
  castShadow?: boolean;
  groundColor?: string;
  angle?: number;
  penumbra?: number;
}

export interface GroupNode extends BaseSceneNode {
  type: 'group';
}

/**
 * Skeletal Armature & Bone structures
 */
export interface BoneTransform {
  head: Vector3;
  tail: Vector3;
  roll: number;
  length?: number;
}

export interface IBone {
  id: string;
  name: string;
  parentId: string | null;
  childrenIds: string[];
  head: Vector3;
  tail: Vector3;
  roll: number;
  length: number;
  connected: boolean;
  deform: boolean;
}

export interface IArmatureNode extends BaseSceneNode {
  type: 'armature';
  bones: Record<string, IBone>;
  rootBoneIds: string[];
}

export interface IBoneNode extends BaseSceneNode {
  type: 'bone';
  armatureId: string;
  head: Vector3;
  tail: Vector3;
  roll: number;
  length: number;
  connected: boolean;
  deform: boolean;
}

export type ArmatureNode = IArmatureNode;
export type BoneNode = IBoneNode;

export interface SceneRoot {
  id: string;
  name: string;
  type: 'root';
  childrenIds: string[];
  environment?: {
    preset?: string;
    backgroundBlur?: number;
    backgroundIntensity?: number;
  };
  backgroundColor?: string;
}

export type SceneNode =
  MeshNode | CameraNode | LightNode | GroupNode | CollectionNode | IArmatureNode | IBoneNode;

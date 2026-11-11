import type {
  MeshNode,
  LightNode,
  CameraNode,
  LightType,
  CameraProjection,
  Transform,
  SceneCollection,
} from '@blender-elt/contracts';
import { createDefaultTransform } from './transform.js';

let counter = 0;
function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(++counter).toString(36)}`;
}

export function createMeshNode(params: {
  id?: string;
  name?: string;
  geometryId?: string;
  primitiveType?: string;
  materialId?: string;
  transform?: Partial<Transform>;
  parentId?: string | null;
  collectionId?: string | null;
  castShadow?: boolean;
  receiveShadow?: boolean;
}): MeshNode {
  return {
    id: params.id || uniqueId('mesh'),
    name: params.name || 'Mesh',
    type: 'mesh',
    geometryId: params.geometryId || uniqueId('geo'),
    primitiveType: params.primitiveType || 'cube',
    materialId: params.materialId || 'mat-default',
    transform: { ...createDefaultTransform(), ...params.transform },
    visible: true,
    locked: false,
    parentId: params.parentId !== undefined ? params.parentId : 'root',
    childrenIds: [],
    collectionId: params.collectionId || null,
    castShadow: params.castShadow ?? true,
    receiveShadow: params.receiveShadow ?? true,
  };
}

export function createLightNode(params: {
  id?: string;
  name?: string;
  lightType: LightType;
  color?: string;
  intensity?: number;
  distance?: number;
  decay?: number;
  castShadow?: boolean;
  groundColor?: string;
  angle?: number;
  penumbra?: number;
  transform?: Partial<Transform>;
  parentId?: string | null;
  collectionId?: string | null;
}): LightNode {
  return {
    id: params.id || uniqueId('light'),
    name: params.name || `${params.lightType.charAt(0).toUpperCase() + params.lightType.slice(1)} Light`,
    type: 'light',
    lightType: params.lightType,
    color: params.color || '#ffffff',
    intensity: params.intensity ?? 1000,
    distance: params.distance,
    decay: params.decay ?? 2,
    castShadow: params.castShadow ?? true,
    groundColor: params.groundColor,
    angle: params.angle,
    penumbra: params.penumbra,
    transform: { ...createDefaultTransform(), ...params.transform },
    visible: true,
    locked: false,
    parentId: params.parentId !== undefined ? params.parentId : 'root',
    childrenIds: [],
    collectionId: params.collectionId || null,
  };
}

export function createCameraNode(params: {
  id?: string;
  name?: string;
  projection?: CameraProjection;
  fov?: number;
  near?: number;
  far?: number;
  zoom?: number;
  transform?: Partial<Transform>;
  parentId?: string | null;
  collectionId?: string | null;
}): CameraNode {
  return {
    id: params.id || uniqueId('camera'),
    name: params.name || 'Camera',
    type: 'camera',
    projection: params.projection || 'perspective',
    fov: params.fov ?? 50,
    near: params.near ?? 0.1,
    far: params.far ?? 1000,
    zoom: params.zoom ?? 1,
    transform: { ...createDefaultTransform(), ...params.transform },
    visible: true,
    locked: false,
    parentId: params.parentId !== undefined ? params.parentId : 'root',
    childrenIds: [],
    collectionId: params.collectionId || null,
  };
}

export function createCollection(params: {
  id?: string;
  name: string;
  color?: string;
  visible?: boolean;
  locked?: boolean;
  nodeIds?: string[];
}): SceneCollection {
  return {
    id: params.id || uniqueId('col'),
    name: params.name,
    color: params.color || '#4772b3',
    visible: params.visible ?? true,
    locked: params.locked ?? false,
    nodeIds: params.nodeIds ? [...params.nodeIds] : [],
  };
}

import * as THREE from 'three';
import type {
  SceneNode,
  MeshNode,
  CameraNode,
  LightNode,
  GroupNode,
  SceneRoot,
  IMeshData,
  MaterialDefinition,
  PBRMaterialConfig,
  Transform,
} from '@blender-elt/contracts';
import type { ImportedSceneResult } from './types.js';

/**
 * Converts domain IMeshData to a Three.js BufferGeometry
 */
export function meshDataToBufferGeometry(meshData: IMeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  const vertices =
    meshData.vertices instanceof Float32Array
      ? meshData.vertices
      : new Float32Array(meshData.vertices);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

  if (meshData.normals && meshData.normals.length > 0) {
    const normals =
      meshData.normals instanceof Float32Array
        ? meshData.normals
        : new Float32Array(meshData.normals);
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  } else {
    geometry.computeVertexNormals();
  }

  if (meshData.uvs && meshData.uvs.length > 0) {
    const uvs =
      meshData.uvs instanceof Float32Array
        ? meshData.uvs
        : new Float32Array(meshData.uvs);
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }

  if (meshData.indices && meshData.indices.length > 0) {
    const indices =
      meshData.indices instanceof Uint32Array || meshData.indices instanceof Uint16Array
        ? meshData.indices
        : new Uint32Array(meshData.indices);
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  }

  return geometry;
}

/**
 * Converts a Three.js BufferGeometry to domain IMeshData
 */
export function bufferGeometryToMeshData(geometry: THREE.BufferGeometry): IMeshData {
  const posAttr = geometry.getAttribute('position');
  if (!posAttr) {
    return {
      vertices: new Float32Array(0),
    };
  }

  const vertices = new Float32Array(posAttr.array);

  const normalAttr = geometry.getAttribute('normal');
  const normals = normalAttr ? new Float32Array(normalAttr.array) : undefined;

  const uvAttr = geometry.getAttribute('uv');
  const uvs = uvAttr ? new Float32Array(uvAttr.array) : undefined;

  const indexAttr = geometry.getIndex();
  let indices: Uint32Array | undefined;
  if (indexAttr) {
    indices = new Uint32Array(indexAttr.array);
  }

  return {
    vertices,
    normals,
    uvs,
    indices,
  };
}

/**
 * Creates default PBR material configuration
 */
export function createDefaultPBRConfig(): PBRMaterialConfig {
  return {
    color: '#808080',
    roughness: 0.5,
    metalness: 0.0,
    emission: '#000000',
    emissionIntensity: 0.0,
    opacity: 1.0,
    transparent: false,
    wireframe: false,
  };
}

/**
 * Converts domain PBRMaterialConfig to Three.js MeshStandardMaterial
 */
export function pbrConfigToThreeMaterial(
  config: PBRMaterialConfig,
  name = 'Material'
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.color),
    roughness: config.roughness,
    metalness: config.metalness,
    emissive: new THREE.Color(config.emission),
    emissiveIntensity: config.emissionIntensity ?? 0,
    opacity: config.opacity,
    transparent: config.transparent,
    wireframe: config.wireframe,
  });
  mat.name = name;
  return mat;
}

/**
 * Converts a Three.js Material to domain PBRMaterialConfig
 */
export function threeMaterialToPBR(mat: THREE.Material): {
  config: PBRMaterialConfig;
  name: string;
} {
  const base = createDefaultPBRConfig();
  const name = mat.name || 'ImportedMaterial';

  base.opacity = mat.opacity;
  base.transparent = mat.transparent;

  if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
    base.color = `#${mat.color.getHexString()}`;
    base.roughness = mat.roughness;
    base.metalness = mat.metalness;
    base.emission = `#${mat.emissive.getHexString()}`;
    base.emissionIntensity = mat.emissiveIntensity;
    base.wireframe = mat.wireframe;
  } else if (mat instanceof THREE.MeshBasicMaterial) {
    base.color = `#${mat.color.getHexString()}`;
    base.wireframe = mat.wireframe;
  } else if (mat instanceof THREE.MeshPhongMaterial || mat instanceof THREE.MeshLambertMaterial) {
    base.color = `#${mat.color.getHexString()}`;
    base.wireframe = mat.wireframe;
    if ('emissive' in mat && mat.emissive instanceof THREE.Color) {
      base.emission = `#${mat.emissive.getHexString()}`;
    }
  }

  return { config: base, name };
}

/**
 * Converts Blender-ELT domain nodes and geometries into a Three.js scene graph
 */
export function beltToThree(input: {
  nodes: Record<string, SceneNode>;
  geometries: Record<string, IMeshData>;
  materials?: Record<string, MaterialDefinition>;
  root?: SceneRoot;
}): THREE.Group {
  const container = new THREE.Group();
  container.name = input.root?.name ?? 'RootCollection';

  const nodeMap = new Map<string, THREE.Object3D>();
  const geometries = input.geometries;
  const materials = input.materials ?? {};

  // First pass: Instantiate Three.js objects
  for (const [id, node] of Object.entries(input.nodes)) {
    let obj: THREE.Object3D;

    if (node.type === 'mesh') {
      const meshNode = node as MeshNode;
      const meshData = geometries[meshNode.geometryId];
      const geo = meshData ? meshDataToBufferGeometry(meshData) : new THREE.BufferGeometry();

      let mat: THREE.Material;
      if (meshNode.materialId && materials[meshNode.materialId]) {
        mat = pbrConfigToThreeMaterial(materials[meshNode.materialId].config, materials[meshNode.materialId].name);
      } else {
        mat = pbrConfigToThreeMaterial(createDefaultPBRConfig(), 'DefaultMaterial');
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = !!meshNode.castShadow;
      mesh.receiveShadow = !!meshNode.receiveShadow;
      obj = mesh;
    } else if (node.type === 'camera') {
      const camNode = node as CameraNode;
      if (camNode.projection === 'orthographic') {
        obj = new THREE.OrthographicCamera(-5, 5, 5, -5, camNode.near, camNode.far);
      } else {
        obj = new THREE.PerspectiveCamera(camNode.fov, camNode.aspect ?? 1.0, camNode.near, camNode.far);
      }
    } else if (node.type === 'light') {
      const lightNode = node as LightNode;
      const color = new THREE.Color(lightNode.color);
      switch (lightNode.lightType) {
        case 'directional':
          obj = new THREE.DirectionalLight(color, lightNode.intensity);
          break;
        case 'point':
          obj = new THREE.PointLight(color, lightNode.intensity, lightNode.distance, lightNode.decay);
          break;
        case 'spot':
          obj = new THREE.SpotLight(color, lightNode.intensity, lightNode.distance, lightNode.angle, lightNode.penumbra, lightNode.decay);
          break;
        case 'ambient':
          obj = new THREE.AmbientLight(color, lightNode.intensity);
          break;
        case 'hemisphere':
          obj = new THREE.HemisphereLight(color, new THREE.Color(lightNode.groundColor || '#444444'), lightNode.intensity);
          break;
        default:
          obj = new THREE.DirectionalLight(color, lightNode.intensity);
      }
    } else {
      obj = new THREE.Group();
    }

    obj.name = node.name;
    obj.userData = { beltId: id, ...node.metadata };
    obj.visible = node.visible;

    // Apply transform
    obj.position.set(node.transform.position.x, node.transform.position.y, node.transform.position.z);
    obj.rotation.set(
      node.transform.rotation.x,
      node.transform.rotation.y,
      node.transform.rotation.z,
      node.transform.rotation.order || 'XYZ'
    );
    obj.scale.set(node.transform.scale.x, node.transform.scale.y, node.transform.scale.z);

    nodeMap.set(id, obj);
  }

  // Second pass: Assemble hierarchy
  for (const [id, node] of Object.entries(input.nodes)) {
    const obj = nodeMap.get(id);
    if (!obj) continue;

    if (node.parentId && nodeMap.has(node.parentId)) {
      const parentObj = nodeMap.get(node.parentId);
      parentObj?.add(obj);
    } else {
      container.add(obj);
    }
  }

  return container;
}

/**
 * Converts a Three.js scene or object hierarchy into Blender-ELT domain model
 */
export function threeToBelt(
  rootObj: THREE.Object3D,
  options?: { sceneName?: string }
): ImportedSceneResult {
  const nodes: Record<string, SceneNode> = {};
  const geometries: Record<string, IMeshData> = {};
  const materials: Record<string, MaterialDefinition> = {};
  const rootChildrenIds: string[] = [];

  let nextId = 1;
  const generateId = (prefix: string) => `${prefix}-${nextId++}`;

  const getTransform = (obj: THREE.Object3D): Transform => {
    return {
      position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rotation: {
        x: obj.rotation.x,
        y: obj.rotation.y,
        z: obj.rotation.z,
        order: (obj.rotation.order as 'XYZ') || 'XYZ',
      },
      scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
    };
  };

  const processObject = (
    obj: THREE.Object3D,
    parentId: string | null = null
  ): string => {
    const id = (obj.userData?.beltId as string) || generateId('node');
    const name = obj.name || `Object-${id}`;
    const transform = getTransform(obj);
    const childrenIds: string[] = [];

    let node: SceneNode;

    if (obj instanceof THREE.Mesh) {
      const geoId = generateId('geo');
      const meshData = bufferGeometryToMeshData(obj.geometry);
      geometries[geoId] = meshData;

      let materialId: string | undefined;
      const rawMat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      if (rawMat) {
        materialId = generateId('mat');
        const { config, name: matName } = threeMaterialToPBR(rawMat);
        materials[materialId] = {
          id: materialId,
          name: matName,
          type: 'pbr',
          config,
        };
      }

      const meshNode: MeshNode = {
        id,
        name,
        type: 'mesh',
        geometryId: geoId,
        materialId,
        transform,
        visible: obj.visible,
        locked: false,
        parentId,
        childrenIds: [],
        castShadow: obj.castShadow,
        receiveShadow: obj.receiveShadow,
      };
      node = meshNode;
    } else if (obj instanceof THREE.PerspectiveCamera || obj instanceof THREE.OrthographicCamera) {
      const isOrtho = obj instanceof THREE.OrthographicCamera;
      const camNode: CameraNode = {
        id,
        name,
        type: 'camera',
        projection: isOrtho ? 'orthographic' : 'perspective',
        fov: isOrtho ? 50 : obj.fov,
        near: obj.near,
        far: obj.far,
        zoom: obj.zoom,
        aspect: isOrtho ? undefined : obj.aspect,
        transform,
        visible: obj.visible,
        locked: false,
        parentId,
        childrenIds: [],
      };
      node = camNode;
    } else if (obj instanceof THREE.Light) {
      let lightType: 'directional' | 'point' | 'spot' | 'ambient' | 'hemisphere' = 'point';
      if (obj instanceof THREE.DirectionalLight) lightType = 'directional';
      else if (obj instanceof THREE.SpotLight) lightType = 'spot';
      else if (obj instanceof THREE.AmbientLight) lightType = 'ambient';
      else if (obj instanceof THREE.HemisphereLight) lightType = 'hemisphere';

      const lightNode: LightNode = {
        id,
        name,
        type: 'light',
        lightType,
        color: `#${obj.color.getHexString()}`,
        intensity: obj.intensity,
        transform,
        visible: obj.visible,
        locked: false,
        parentId,
        childrenIds: [],
      };
      node = lightNode;
    } else {
      const grpNode: GroupNode = {
        id,
        name,
        type: 'group',
        transform,
        visible: obj.visible,
        locked: false,
        parentId,
        childrenIds: [],
      };
      node = grpNode;
    }

    // Process children
    for (const child of obj.children) {
      const childId = processObject(child, id);
      childrenIds.push(childId);
    }
    node.childrenIds = childrenIds;
    nodes[id] = node;

    return id;
  };

  // If rootObj is a Group or Scene with children, process each child as top-level
  if (rootObj.type === 'Scene' || (rootObj.type === 'Group' && (!rootObj.name || rootObj.name === 'RootCollection'))) {
    for (const child of rootObj.children) {
      const childId = processObject(child, null);
      rootChildrenIds.push(childId);
    }
  } else {
    const childId = processObject(rootObj, null);
    rootChildrenIds.push(childId);
  }

  const root: SceneRoot = {
    id: 'root',
    name: options?.sceneName || 'Scene Collection',
    type: 'root',
    childrenIds: rootChildrenIds,
    backgroundColor: '#1d1e22',
  };

  return {
    root,
    nodes,
    geometries,
    materials,
    threeObject: rootObj,
  };
}

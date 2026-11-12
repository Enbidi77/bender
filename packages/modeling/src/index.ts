import * as THREE from 'three';
import type {
  PrimitiveType,
  PrimitiveParameters,
  IMeshData,
  VertexData,
  EdgeData,
  FaceData,
  EditModeSelection,
  EditElementMode,
  MeshOperation,
  MeshOperationType,
} from '@blender-elt/contracts';

export type {
  PrimitiveType,
  PrimitiveParameters,
  IMeshData,
  VertexData,
  EdgeData,
  FaceData,
  EditModeSelection,
  EditElementMode,
  MeshOperation,
  MeshOperationType,
};

export * from './primitives/index.js';
export * from './topology/index.js';
export * from './modifiers/index.js';

import { MeshTopology } from './topology/mesh-topology.js';

/**
 * Generates raw THREE.BufferGeometry for a primitive type
 */
export function createPrimitiveGeometry(
  type: PrimitiveType,
  params?: PrimitiveParameters,
): THREE.BufferGeometry {
  switch (type) {
    case 'cube': {
      const p = params?.cube;
      return new THREE.BoxGeometry(
        p?.width ?? 2,
        p?.height ?? 2,
        p?.depth ?? 2,
        p?.widthSegments ?? 1,
        p?.heightSegments ?? 1,
        p?.depthSegments ?? 1,
      );
    }
    case 'sphere': {
      const p = params?.sphere;
      return new THREE.SphereGeometry(
        p?.radius ?? 1,
        p?.widthSegments ?? 32,
        p?.heightSegments ?? 16,
      );
    }
    case 'plane': {
      const p = params?.plane;
      return new THREE.PlaneGeometry(
        p?.width ?? 2,
        p?.height ?? 2,
        p?.widthSegments ?? 1,
        p?.heightSegments ?? 1,
      );
    }
    case 'cylinder': {
      const p = params?.cylinder;
      return new THREE.CylinderGeometry(
        p?.radiusTop ?? 1,
        p?.radiusBottom ?? 1,
        p?.height ?? 2,
        p?.radialSegments ?? 32,
        p?.heightSegments ?? 1,
      );
    }
    case 'cone': {
      const p = params?.cone;
      return new THREE.ConeGeometry(p?.radius ?? 1, p?.height ?? 2, p?.radialSegments ?? 32);
    }
    case 'torus': {
      const p = params?.torus;
      return new THREE.TorusGeometry(
        p?.radius ?? 1,
        p?.tube ?? 0.4,
        p?.radialSegments ?? 16,
        p?.tubularSegments ?? 32,
      );
    }
    default:
      return new THREE.BoxGeometry(2, 2, 2);
  }
}

/**
 * Converts serialized IMeshData to Three.js BufferGeometry
 */
export function meshDataToBufferGeometry(data: IMeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const vertices =
    data.vertices instanceof Float32Array ? data.vertices : new Float32Array(data.vertices);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

  if (data.normals && data.normals.length > 0) {
    const normals =
      data.normals instanceof Float32Array ? data.normals : new Float32Array(data.normals);
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  } else {
    geometry.computeVertexNormals();
  }

  if (data.uvs && data.uvs.length > 0) {
    const uvs = data.uvs instanceof Float32Array ? data.uvs : new Float32Array(data.uvs);
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }

  if (data.indices && data.indices.length > 0) {
    if (data.indices instanceof Uint16Array || data.indices instanceof Uint32Array) {
      geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    } else {
      geometry.setIndex(Array.from(data.indices));
    }
  }

  return geometry;
}

/**
 * Extracts topological elements (vertices, edges, faces) for edit mode
 */
export function extractTopology(data: IMeshData): {
  vertices: VertexData[];
  edges: EdgeData[];
  faces: FaceData[];
} {
  const topology = MeshTopology.fromMeshData(data);
  return {
    vertices: topology.vertices,
    edges: topology.edges,
    faces: topology.faces,
  };
}

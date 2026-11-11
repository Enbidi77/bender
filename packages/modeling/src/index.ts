import * as THREE from 'three';
import type {
  PrimitiveType,
  PrimitiveParameters,
  IMeshData,
  VertexData,
  EdgeData,
  FaceData,
  EditModeSelection,
} from '@blender-elt/contracts';

export type {
  PrimitiveType,
  PrimitiveParameters,
  IMeshData,
  VertexData,
  EdgeData,
  FaceData,
  EditModeSelection,
};

/**
 * Generates raw IMeshData for a primitive type
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
 * Converts Three.js BufferGeometry to serialized IMeshData
 */
export function bufferGeometryToMeshData(geometry: THREE.BufferGeometry): IMeshData {
  const positionAttr = geometry.getAttribute('position');
  const normalAttr = geometry.getAttribute('normal');
  const uvAttr = geometry.getAttribute('uv');
  const indexAttr = geometry.getIndex();

  return {
    vertices: positionAttr ? Array.from(positionAttr.array) : [],
    normals: normalAttr ? Array.from(normalAttr.array) : undefined,
    uvs: uvAttr ? Array.from(uvAttr.array) : undefined,
    indices: indexAttr ? Array.from(indexAttr.array) : undefined,
  };
}

/**
 * Converts serialized IMeshData to Three.js BufferGeometry
 */
export function meshDataToBufferGeometry(data: IMeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array(data.vertices);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

  if (data.normals && data.normals.length > 0) {
    const normals = new Float32Array(data.normals);
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  } else {
    geometry.computeVertexNormals();
  }

  if (data.uvs && data.uvs.length > 0) {
    const uvs = new Float32Array(data.uvs);
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }

  if (data.indices && data.indices.length > 0) {
    geometry.setIndex(Array.from(data.indices));
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
  const vertices: VertexData[] = [];
  const coords = data.vertices;
  const numVertices = Math.floor(coords.length / 3);

  for (let i = 0; i < numVertices; i++) {
    vertices.push({
      index: i,
      position: {
        x: coords[i * 3],
        y: coords[i * 3 + 1],
        z: coords[i * 3 + 2],
      },
    });
  }

  const faces: FaceData[] = [];
  const edgesMap = new Map<string, EdgeData>();
  let edgeIndex = 0;

  const addEdge = (v1: number, v2: number): number => {
    const key = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;
    if (!edgesMap.has(key)) {
      edgesMap.set(key, { index: edgeIndex++, v1, v2 });
    }
    return edgesMap.get(key)!.index;
  };

  if (data.indices && data.indices.length >= 3) {
    const indices = Array.from(data.indices);
    for (let i = 0; i < indices.length; i += 3) {
      const v0 = indices[i];
      const v1 = indices[i + 1];
      const v2 = indices[i + 2];
      const e0 = addEdge(v0, v1);
      const e1 = addEdge(v1, v2);
      const e2 = addEdge(v2, v0);

      faces.push({
        index: faces.length,
        vertexIndices: [v0, v1, v2],
        edgeIndices: [e0, e1, e2],
      });
    }
  }

  return {
    vertices,
    edges: Array.from(edgesMap.values()),
    faces,
  };
}

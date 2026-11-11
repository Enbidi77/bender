import * as THREE from 'three';
import type { IMeshData } from '@blender-elt/contracts';

/**
 * Parameters for Cube primitive generator
 */
export interface CubeParameters {
  width?: number;
  height?: number;
  depth?: number;
  size?: number;
  widthSegments?: number;
  heightSegments?: number;
  depthSegments?: number;
}

/**
 * Converts a Three.js BufferGeometry to a complete IMeshData with typed arrays
 */
export function bufferGeometryToMeshData(geometry: THREE.BufferGeometry): IMeshData {
  const posAttr = geometry.getAttribute('position');
  if (!posAttr) {
    throw new Error('Geometry has no position attribute');
  }

  const vertices = new Float32Array(posAttr.array);

  const normAttr = geometry.getAttribute('normal');
  const normals = normAttr ? new Float32Array(normAttr.array) : new Float32Array(vertices.length);

  const uvAttr = geometry.getAttribute('uv');
  const uvs = uvAttr ? new Float32Array(uvAttr.array) : new Float32Array((vertices.length / 3) * 2);

  const indexAttr = geometry.getIndex();
  let indices: Uint16Array | Uint32Array;

  if (indexAttr) {
    if (posAttr.count > 65535 || indexAttr.array instanceof Uint32Array) {
      indices = new Uint32Array(indexAttr.array);
    } else {
      indices = new Uint16Array(indexAttr.array);
    }
  } else {
    // Generate sequential indices for non-indexed geometry
    const count = posAttr.count;
    indices = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
    for (let i = 0; i < count; i++) {
      indices[i] = i;
    }
  }

  return {
    vertices,
    normals,
    uvs,
    indices,
  };
}

/**
 * Generates IMeshData for a cube / box primitive
 */
export function generateCube(params?: CubeParameters): IMeshData {
  const size = params?.size;
  const width = params?.width ?? size ?? 2;
  const height = params?.height ?? size ?? 2;
  const depth = params?.depth ?? size ?? 2;
  const widthSegments = params?.widthSegments ?? 1;
  const heightSegments = params?.heightSegments ?? 1;
  const depthSegments = params?.depthSegments ?? 1;

  const geom = new THREE.BoxGeometry(
    width,
    height,
    depth,
    widthSegments,
    heightSegments,
    depthSegments,
  );

  const meshData = bufferGeometryToMeshData(geom);
  geom.dispose();
  return meshData;
}

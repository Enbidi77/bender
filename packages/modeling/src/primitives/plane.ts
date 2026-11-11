import * as THREE from 'three';
import type { IMeshData } from '@blender-elt/contracts';
import { bufferGeometryToMeshData } from './cube.js';

export interface PlaneParameters {
  width?: number;
  height?: number;
  size?: number;
  widthSegments?: number;
  heightSegments?: number;
}

/**
 * Generates IMeshData for a plane primitive
 */
export function generatePlane(params?: PlaneParameters): IMeshData {
  const size = params?.size;
  const width = params?.width ?? size ?? 2;
  const height = params?.height ?? size ?? 2;
  const widthSegments = params?.widthSegments ?? 1;
  const heightSegments = params?.heightSegments ?? 1;

  const geom = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);

  const meshData = bufferGeometryToMeshData(geom);
  geom.dispose();
  return meshData;
}

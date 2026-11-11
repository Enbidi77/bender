import * as THREE from 'three';
import type { IMeshData } from '@blender-elt/contracts';
import { bufferGeometryToMeshData } from './cube.js';

export interface ConeParameters {
  radius?: number;
  height?: number;
  radialSegments?: number;
  heightSegments?: number;
  openEnded?: boolean;
}

/**
 * Generates IMeshData for a cone primitive
 */
export function generateCone(params?: ConeParameters): IMeshData {
  const radius = params?.radius ?? 1;
  const height = params?.height ?? 2;
  const radialSegments = params?.radialSegments ?? 32;
  const heightSegments = params?.heightSegments ?? 1;
  const openEnded = params?.openEnded ?? false;

  const geom = new THREE.ConeGeometry(radius, height, radialSegments, heightSegments, openEnded);

  const meshData = bufferGeometryToMeshData(geom);
  geom.dispose();
  return meshData;
}

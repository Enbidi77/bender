import * as THREE from 'three';
import type { IMeshData } from '@blender-elt/contracts';
import { bufferGeometryToMeshData } from './cube.js';

export interface CylinderParameters {
  radiusTop?: number;
  radiusBottom?: number;
  radius?: number;
  height?: number;
  radialSegments?: number;
  heightSegments?: number;
  openEnded?: boolean;
}

/**
 * Generates IMeshData for a cylinder primitive
 */
export function generateCylinder(params?: CylinderParameters): IMeshData {
  const radius = params?.radius ?? 1;
  const radiusTop = params?.radiusTop ?? radius;
  const radiusBottom = params?.radiusBottom ?? radius;
  const height = params?.height ?? 2;
  const radialSegments = params?.radialSegments ?? 32;
  const heightSegments = params?.heightSegments ?? 1;
  const openEnded = params?.openEnded ?? false;

  const geom = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    radialSegments,
    heightSegments,
    openEnded,
  );

  const meshData = bufferGeometryToMeshData(geom);
  geom.dispose();
  return meshData;
}

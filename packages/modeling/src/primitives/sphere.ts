import * as THREE from 'three';
import type { IMeshData } from '@blender-elt/contracts';
import { bufferGeometryToMeshData } from './cube.js';

export interface SphereParameters {
  radius?: number;
  widthSegments?: number;
  heightSegments?: number;
  phiStart?: number;
  phiLength?: number;
  thetaStart?: number;
  thetaLength?: number;
}

/**
 * Generates IMeshData for a UV sphere primitive
 */
export function generateSphere(params?: SphereParameters): IMeshData {
  const radius = params?.radius ?? 1;
  const widthSegments = params?.widthSegments ?? 32;
  const heightSegments = params?.heightSegments ?? 16;
  const phiStart = params?.phiStart ?? 0;
  const phiLength = params?.phiLength ?? Math.PI * 2;
  const thetaStart = params?.thetaStart ?? 0;
  const thetaLength = params?.thetaLength ?? Math.PI;

  const geom = new THREE.SphereGeometry(
    radius,
    widthSegments,
    heightSegments,
    phiStart,
    phiLength,
    thetaStart,
    thetaLength,
  );

  const meshData = bufferGeometryToMeshData(geom);
  geom.dispose();
  return meshData;
}

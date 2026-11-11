import * as THREE from 'three';
import type { IMeshData } from '@blender-elt/contracts';
import { bufferGeometryToMeshData } from './cube.js';

export interface TorusParameters {
  radius?: number;
  tube?: number;
  radialSegments?: number;
  tubularSegments?: number;
  arc?: number;
}

/**
 * Generates IMeshData for a torus primitive
 */
export function generateTorus(params?: TorusParameters): IMeshData {
  const radius = params?.radius ?? 1;
  const tube = params?.tube ?? 0.4;
  const radialSegments = params?.radialSegments ?? 16;
  const tubularSegments = params?.tubularSegments ?? 32;
  const arc = params?.arc ?? Math.PI * 2;

  const geom = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments, arc);

  const meshData = bufferGeometryToMeshData(geom);
  geom.dispose();
  return meshData;
}

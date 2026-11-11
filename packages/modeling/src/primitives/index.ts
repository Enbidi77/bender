import type { PrimitiveType, PrimitiveParameters, IMeshData } from '@blender-elt/contracts';
import { generateCube, type CubeParameters, bufferGeometryToMeshData } from './cube.js';
import { generateSphere, type SphereParameters } from './sphere.js';
import { generateCylinder, type CylinderParameters } from './cylinder.js';
import { generateCone, type ConeParameters } from './cone.js';
import { generatePlane, type PlaneParameters } from './plane.js';
import { generateTorus, type TorusParameters } from './torus.js';

export {
  generateCube,
  generateSphere,
  generateCylinder,
  generateCone,
  generatePlane,
  generateTorus,
  bufferGeometryToMeshData,
};

export type {
  CubeParameters,
  SphereParameters,
  CylinderParameters,
  ConeParameters,
  PlaneParameters,
  TorusParameters,
};

/**
 * Unified procedural primitive generator function
 */
export function generatePrimitive(type: PrimitiveType, params?: PrimitiveParameters): IMeshData {
  switch (type) {
    case 'cube':
      return generateCube(params?.cube);
    case 'sphere':
      return generateSphere(params?.sphere);
    case 'cylinder':
      return generateCylinder(params?.cylinder);
    case 'cone':
      return generateCone(params?.cone);
    case 'plane':
      return generatePlane(params?.plane);
    case 'torus':
      return generateTorus(params?.torus);
    default:
      return generateCube();
  }
}

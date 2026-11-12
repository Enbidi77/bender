import type { ArrayModifier, Vector3 } from '@blender-elt/contracts';
import { MeshTopology } from '../topology/mesh-topology.js';

/**
 * Computes bounding box dimensions of a MeshTopology
 */
function computeBoundingBox(topology: MeshTopology): { min: Vector3; max: Vector3; size: Vector3 } {
  if (topology.vertices.length === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
      size: { x: 1, y: 1, z: 1 },
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const v of topology.vertices) {
    const p = v.position;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    size: {
      x: Math.max(maxX - minX, 0.001),
      y: Math.max(maxY - minY, 0.001),
      z: Math.max(maxZ - minZ, 0.001),
    },
  };
}

/**
 * Evaluates the Array Modifier on a MeshTopology
 */
export function evaluateArrayModifier(
  topology: MeshTopology,
  modifier: ArrayModifier,
): MeshTopology {
  if (modifier.count <= 1) {
    return topology.clone();
  }

  const result = topology.clone();
  const baseVertCount = topology.vertices.length;
  if (baseVertCount === 0) return result;

  const bbox = computeBoundingBox(topology);

  let deltaX = 0;
  let deltaY = 0;
  let deltaZ = 0;

  if (modifier.useRelativeOffset) {
    deltaX += modifier.relativeOffset.x * bbox.size.x;
    deltaY += modifier.relativeOffset.y * bbox.size.y;
    deltaZ += modifier.relativeOffset.z * bbox.size.z;
  }

  if (modifier.useConstantOffset && modifier.constantOffset) {
    deltaX += modifier.constantOffset.x;
    deltaY += modifier.constantOffset.y;
    deltaZ += modifier.constantOffset.z;
  }

  // If neither was configured, fallback to 1 unit offset along X
  if (!modifier.useRelativeOffset && !modifier.useConstantOffset) {
    deltaX = bbox.size.x;
  }

  for (let step = 1; step < modifier.count; step++) {
    const offsetX = deltaX * step;
    const offsetY = deltaY * step;
    const offsetZ = deltaZ * step;
    const vertexIndexBase = result.vertices.length;

    // Duplicate vertices with spatial translation
    for (let i = 0; i < baseVertCount; i++) {
      const srcV = topology.vertices[i];
      result.vertices.push({
        index: vertexIndexBase + i,
        position: {
          x: srcV.position.x + offsetX,
          y: srcV.position.y + offsetY,
          z: srcV.position.z + offsetZ,
        },
        normal: srcV.normal ? { ...srcV.normal } : undefined,
        uv: srcV.uv ? [srcV.uv[0], srcV.uv[1]] : undefined,
        selected: false,
      });
    }

    // Duplicate faces pointing to new vertex indices
    for (const srcFace of topology.faces) {
      result.faces.push({
        index: result.faces.length,
        vertexIndices: srcFace.vertexIndices.map((idx) => vertexIndexBase + idx),
        selected: false,
      });
    }
  }

  result.rebuildEdges();
  result.computeFaceNormals();
  result.computeVertexNormals();

  return result;
}

import type { SmoothModifier } from '@blender-elt/contracts';
import { MeshTopology } from '../topology/mesh-topology.js';

/**
 * Evaluates the Smooth Modifier (Laplacian mesh smoothing) on a MeshTopology
 */
export function evaluateSmoothModifier(
  topology: MeshTopology,
  modifier: SmoothModifier,
): MeshTopology {
  const result = topology.clone();
  const factor = Math.min(Math.max(modifier.factor, 0), 1);
  const repeat = Math.min(Math.max(modifier.repeat, 1), 20);

  if (factor === 0 || result.vertices.length === 0) {
    return result;
  }

  // Precompute vertex neighbor adjacency from edges
  const neighborMap = new Map<number, Set<number>>();
  for (const e of result.edges) {
    if (!neighborMap.has(e.v1)) neighborMap.set(e.v1, new Set());
    if (!neighborMap.has(e.v2)) neighborMap.set(e.v2, new Set());
    neighborMap.get(e.v1)!.add(e.v2);
    neighborMap.get(e.v2)!.add(e.v1);
  }

  const applyX = modifier.axes ? modifier.axes.x : true;
  const applyY = modifier.axes ? modifier.axes.y : true;
  const applyZ = modifier.axes ? modifier.axes.z : true;

  for (let iter = 0; iter < repeat; iter++) {
    // Collect new positions synchronously to avoid directional bias
    const nextPositions: Array<{ x: number; y: number; z: number }> = [];

    for (let i = 0; i < result.vertices.length; i++) {
      const v = result.vertices[i];
      const neighbors = neighborMap.get(v.index);
      if (!neighbors || neighbors.size === 0) {
        nextPositions.push({ ...v.position });
        continue;
      }

      let avgX = 0;
      let avgY = 0;
      let avgZ = 0;
      for (const n of neighbors) {
        const nV = result.vertices[n];
        avgX += nV.position.x;
        avgY += nV.position.y;
        avgZ += nV.position.z;
      }
      avgX /= neighbors.size;
      avgY /= neighbors.size;
      avgZ /= neighbors.size;

      nextPositions.push({
        x: applyX ? v.position.x + (avgX - v.position.x) * factor : v.position.x,
        y: applyY ? v.position.y + (avgY - v.position.y) * factor : v.position.y,
        z: applyZ ? v.position.z + (avgZ - v.position.z) * factor : v.position.z,
      });
    }

    // Apply next positions
    for (let i = 0; i < result.vertices.length; i++) {
      result.vertices[i].position = nextPositions[i];
    }
  }

  result.computeFaceNormals();
  result.computeVertexNormals();

  return result;
}

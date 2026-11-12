import type { MirrorModifier } from '@blender-elt/contracts';
import { MeshTopology } from '../topology/mesh-topology.js';

/**
 * Evaluates the Mirror Modifier on a MeshTopology
 */
export function evaluateMirrorModifier(
  topology: MeshTopology,
  modifier: MirrorModifier,
): MeshTopology {
  let current = topology.clone();

  const axes: Array<'x' | 'y' | 'z'> = [];
  if (modifier.axis.x) axes.push('x');
  if (modifier.axis.y) axes.push('y');
  if (modifier.axis.z) axes.push('z');

  if (axes.length === 0) {
    return current;
  }

  for (const axis of axes) {
    current = mirrorAlongAxis(
      current,
      axis,
      modifier.merge,
      modifier.mergeThreshold,
      modifier.clip,
    );
  }

  return current;
}

function mirrorAlongAxis(
  topology: MeshTopology,
  axis: 'x' | 'y' | 'z',
  merge: boolean,
  mergeThreshold: number,
  clip: boolean,
): MeshTopology {
  const result = topology.clone();
  const baseVertCount = topology.vertices.length;
  if (baseVertCount === 0) return result;

  // Vertex index mapping from original index to mirrored index
  const mirrorVertMap = new Map<number, number>();

  for (let i = 0; i < baseVertCount; i++) {
    const srcV = topology.vertices[i];
    const pos = { ...srcV.position };

    // Clipping constraint: prevent vertices from crossing mirror plane
    if (clip && pos[axis] < 0) {
      pos[axis] = 0;
      srcV.position[axis] = 0;
    }

    const distFromPlane = Math.abs(pos[axis]);

    if (merge && distFromPlane <= mergeThreshold) {
      // Snap vertex to symmetry plane and reuse the original vertex
      result.vertices[i].position[axis] = 0;
      mirrorVertMap.set(i, i);
    } else {
      // Create a new mirrored vertex
      const newPos = { ...pos };
      newPos[axis] = -pos[axis];

      const newIndex = result.vertices.length;
      result.vertices.push({
        index: newIndex,
        position: newPos,
        normal: srcV.normal
          ? {
              x: axis === 'x' ? -srcV.normal.x : srcV.normal.x,
              y: axis === 'y' ? -srcV.normal.y : srcV.normal.y,
              z: axis === 'z' ? -srcV.normal.z : srcV.normal.z,
            }
          : undefined,
        uv: srcV.uv ? [srcV.uv[0], srcV.uv[1]] : undefined,
        selected: false,
      });
      mirrorVertMap.set(i, newIndex);
    }
  }

  // Create mirrored faces with inverted vertex winding order to preserve outward normals
  for (const srcFace of topology.faces) {
    const mirroredIndices = srcFace.vertexIndices.map((idx) => mirrorVertMap.get(idx)!);

    // Skip degenerate faces (where merging collapsed multiple vertices into one)
    const uniqueVerts = new Set(mirroredIndices);
    if (uniqueVerts.size < 3) continue;

    // Reverse winding order
    const reversed = [...mirroredIndices].reverse();

    result.faces.push({
      index: result.faces.length,
      vertexIndices: reversed,
      selected: false,
    });
  }

  result.rebuildEdges();
  result.computeFaceNormals();
  result.computeVertexNormals();

  return result;
}

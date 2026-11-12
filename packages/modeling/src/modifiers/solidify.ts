import type { SolidifyModifier, Vector3 } from '@blender-elt/contracts';
import { MeshTopology } from '../topology/mesh-topology.js';

/**
 * Evaluates the Solidify Modifier on a MeshTopology
 */
export function evaluateSolidifyModifier(
  topology: MeshTopology,
  modifier: SolidifyModifier,
): MeshTopology {
  if (modifier.thickness === 0 || topology.faces.length === 0) {
    return topology.clone();
  }

  const result = topology.clone();
  const baseVertCount = topology.vertices.length;

  // Ensure vertex normals exist
  result.computeFaceNormals();
  result.computeVertexNormals();

  const thickness = modifier.thickness;
  // In Blender: offset = -1 means inner extrusion, +1 means outer extrusion
  const offsetMult = modifier.offset ?? -1;

  // Vertex mapping: original index -> extruded inner vertex index
  const innerVertIndices: number[] = [];

  for (let i = 0; i < baseVertCount; i++) {
    const srcV = result.vertices[i];
    const normal = srcV.normal || { x: 0, y: 1, z: 0 };
    const len = Math.hypot(normal.x, normal.y, normal.z) || 1;
    const nx = normal.x / len;
    const ny = normal.y / len;
    const nz = normal.z / len;

    // Extrude vertex along normal
    const extrudedPos: Vector3 = {
      x: srcV.position.x + nx * thickness * offsetMult,
      y: srcV.position.y + ny * thickness * offsetMult,
      z: srcV.position.z + nz * thickness * offsetMult,
    };

    const newIndex = result.vertices.length;
    result.vertices.push({
      index: newIndex,
      position: extrudedPos,
      normal: { x: -nx, y: -ny, z: -nz },
      uv: srcV.uv ? [srcV.uv[0], srcV.uv[1]] : undefined,
      selected: false,
    });
    innerVertIndices.push(newIndex);
  }

  // Generate inner shell faces with reversed winding
  const baseFacesCount = topology.faces.length;
  for (let f = 0; f < baseFacesCount; f++) {
    const srcFace = topology.faces[f];
    const innerFaceIndices = srcFace.vertexIndices.map((origIdx) => innerVertIndices[origIdx]);
    // Reverse winding order
    const reversed = [...innerFaceIndices].reverse();

    result.faces.push({
      index: result.faces.length,
      vertexIndices: reversed,
      selected: false,
    });
  }

  // Generate rim faces along boundary edges if requested
  if (modifier.rim) {
    // Find boundary edges (edges with face count === 1)
    const edgeFaceUsage = new Map<
      string,
      { v1: number; v2: number; count: number; faceIdx: number }
    >();

    for (let f = 0; f < baseFacesCount; f++) {
      const face = topology.faces[f];
      const vi = face.vertexIndices;
      for (let i = 0; i < vi.length; i++) {
        const vA = vi[i];
        const vB = vi[(i + 1) % vi.length];
        const minV = Math.min(vA, vB);
        const maxV = Math.max(vA, vB);
        const key = `${minV}_${maxV}`;

        const entry = edgeFaceUsage.get(key);
        if (entry) {
          entry.count++;
        } else {
          edgeFaceUsage.set(key, { v1: vA, v2: vB, count: 1, faceIdx: f });
        }
      }
    }

    // Boundary edges have count === 1
    for (const edge of edgeFaceUsage.values()) {
      if (edge.count === 1) {
        const vA = edge.v1;
        const vB = edge.v2;
        const vAInner = innerVertIndices[vA];
        const vBInner = innerVertIndices[vB];

        // Create two triangles connecting outer and inner boundary
        result.faces.push(
          {
            index: result.faces.length,
            vertexIndices: [vA, vB, vBInner],
            selected: false,
          },
          {
            index: result.faces.length + 1,
            vertexIndices: [vA, vBInner, vAInner],
            selected: false,
          },
        );
      }
    }
  }

  result.rebuildEdges();
  result.computeFaceNormals();
  result.computeVertexNormals();

  return result;
}

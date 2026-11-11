import type { MeshOperation } from '@blender-elt/contracts';
import type { MeshTopology } from './mesh-topology.js';

/**
 * Applies a declarative MeshOperation to a MeshTopology instance
 */
export function applyMeshOperation(topology: MeshTopology, operation: MeshOperation): void {
  switch (operation.type) {
    case 'extrude': {
      const distance =
        typeof operation.parameters.distance === 'number' ? operation.parameters.distance : 1.0;

      if (operation.targetIndices.length > 0) {
        for (const fIdx of operation.targetIndices) {
          topology.extrudeFace(fIdx, distance);
        }
      } else {
        topology.extrudeSelectedFaces(distance);
      }
      break;
    }

    case 'subdivide': {
      const iterations =
        typeof operation.parameters.iterations === 'number' ? operation.parameters.iterations : 1;
      topology.subdivide(iterations);
      break;
    }

    case 'flip-normals': {
      for (const face of topology.faces) {
        if (operation.targetIndices.length === 0 || operation.targetIndices.includes(face.index)) {
          face.vertexIndices.reverse();
        }
      }
      topology.computeFaceNormals();
      topology.computeVertexNormals();
      break;
    }

    case 'delete': {
      const targetIndices = new Set(operation.targetIndices);
      // Filter out deleted faces
      topology.faces = topology.faces
        .filter((f) => !targetIndices.has(f.index))
        .map((f, idx) => ({ ...f, index: idx }));
      topology.rebuildEdges();
      topology.computeFaceNormals();
      topology.computeVertexNormals();
      break;
    }

    case 'smooth': {
      // Laplacian smoothing on vertices
      const targetVerts =
        operation.targetIndices.length > 0
          ? operation.targetIndices
          : topology.vertices.map((v) => v.index);

      const factor =
        typeof operation.parameters.factor === 'number' ? operation.parameters.factor : 0.5;

      const neighborMap = new Map<number, Set<number>>();
      for (const e of topology.edges) {
        if (!neighborMap.has(e.v1)) neighborMap.set(e.v1, new Set());
        if (!neighborMap.has(e.v2)) neighborMap.set(e.v2, new Set());
        neighborMap.get(e.v1)!.add(e.v2);
        neighborMap.get(e.v2)!.add(e.v1);
      }

      for (const vIdx of targetVerts) {
        const neighbors = neighborMap.get(vIdx);
        if (!neighbors || neighbors.size === 0) continue;

        let avgX = 0;
        let avgY = 0;
        let avgZ = 0;
        for (const n of neighbors) {
          avgX += topology.vertices[n].position.x;
          avgY += topology.vertices[n].position.y;
          avgZ += topology.vertices[n].position.z;
        }
        avgX /= neighbors.size;
        avgY /= neighbors.size;
        avgZ /= neighbors.size;

        const pos = topology.vertices[vIdx].position;
        pos.x += (avgX - pos.x) * factor;
        pos.y += (avgY - pos.y) * factor;
        pos.z += (avgZ - pos.z) * factor;
      }

      topology.computeFaceNormals();
      topology.computeVertexNormals();
      break;
    }

    default:
      break;
  }
}

import type {
  MeshOperation,
  ExtrudeOperationParams,
  InsetOperationParams,
  BevelOperationParams,
  SubdivideOperationParams,
  MergeOperationParams,
  DeleteOperationParams,
  DissolveOperationParams,
  LoopCutOperationParams,
  KnifeCutOperationParams,
  SlideOperationParams,
} from '@blender-elt/contracts';
import type { MeshTopology } from './mesh-topology.js';

/**
 * Applies a declarative MeshOperation to a MeshTopology instance
 */
export function applyMeshOperation(topology: MeshTopology, operation: MeshOperation): void {
  switch (operation.type) {
    case 'extrude': {
      const p = operation.parameters as ExtrudeOperationParams;
      const distance = typeof p.distance === 'number' ? p.distance : 1.0;
      const targets =
        operation.targetIndices.length > 0
          ? operation.targetIndices
          : topology.getSelectedFaceIndices();

      if (p.individual) {
        topology.extrudeFacesIndividual(targets, distance, p.direction);
      } else {
        topology.extrudeFacesRegion(targets, distance, p.direction);
      }
      break;
    }

    case 'inset': {
      const p = operation.parameters as InsetOperationParams;
      const thickness = typeof p.thickness === 'number' ? p.thickness : 0.2;
      const depth = typeof p.depth === 'number' ? p.depth : 0;
      const individual = p.individual !== undefined ? p.individual : true;
      const targets =
        operation.targetIndices.length > 0
          ? operation.targetIndices
          : topology.getSelectedFaceIndices();

      topology.insetFaces(targets, thickness, depth, individual);
      break;
    }

    case 'bevel': {
      const p = operation.parameters as BevelOperationParams;
      const width = typeof p.width === 'number' ? p.width : 0.2;
      const segments = typeof p.segments === 'number' ? p.segments : 1;
      const mode = p.mode ?? 'edge';

      if (mode === 'vertex') {
        const targets =
          operation.targetIndices.length > 0
            ? operation.targetIndices
            : topology.getSelectedVertexIndices();
        topology.bevelVertices(targets, width, segments);
      } else {
        const targets =
          operation.targetIndices.length > 0
            ? operation.targetIndices
            : topology.getSelectedEdgeIndices();
        topology.bevelEdges(targets, width, segments);
      }
      break;
    }

    case 'subdivide': {
      const p = operation.parameters as SubdivideOperationParams;
      if (typeof p.cuts === 'number' && p.cuts > 0) {
        const targets =
          operation.targetIndices.length > 0
            ? operation.targetIndices
            : topology.getSelectedEdgeIndices();
        topology.subdivideEdges(targets, p.cuts);
      } else {
        const iterations = typeof p.iterations === 'number' ? p.iterations : 1;
        topology.subdivide(iterations);
      }
      break;
    }

    case 'flip-normals': {
      const targets =
        operation.targetIndices.length > 0
          ? operation.targetIndices
          : topology.getSelectedFaceIndices();
      topology.flipNormals(targets.length > 0 ? targets : undefined);
      break;
    }

    case 'triangulate': {
      const targets =
        operation.targetIndices.length > 0
          ? operation.targetIndices
          : topology.getSelectedFaceIndices();
      topology.triangulateFaces(targets.length > 0 ? targets : undefined);
      break;
    }

    case 'delete': {
      const p = operation.parameters as DeleteOperationParams;
      const targetType = p.target ?? 'faces';

      if (targetType === 'vertices') {
        const targets =
          operation.targetIndices.length > 0
            ? operation.targetIndices
            : topology.getSelectedVertexIndices();
        topology.deleteVertices(targets);
      } else if (targetType === 'edges') {
        const targets =
          operation.targetIndices.length > 0
            ? operation.targetIndices
            : topology.getSelectedEdgeIndices();
        topology.deleteEdges(targets, false);
      } else if (targetType === 'only-faces') {
        const targets =
          operation.targetIndices.length > 0
            ? operation.targetIndices
            : topology.getSelectedFaceIndices();
        topology.deleteFaces(targets, false);
      } else {
        // 'faces'
        const targets =
          operation.targetIndices.length > 0
            ? operation.targetIndices
            : topology.getSelectedFaceIndices();
        topology.deleteFaces(targets, true);
      }
      break;
    }

    case 'dissolve': {
      const p = operation.parameters as DissolveOperationParams;
      const targetType = p.target ?? 'faces';

      if (targetType === 'vertices') {
        const targets =
          operation.targetIndices.length > 0
            ? operation.targetIndices
            : topology.getSelectedVertexIndices();
        topology.dissolveVertices(targets);
      } else if (targetType === 'edges') {
        const targets =
          operation.targetIndices.length > 0
            ? operation.targetIndices
            : topology.getSelectedEdgeIndices();
        topology.dissolveEdges(targets);
      } else {
        const targets =
          operation.targetIndices.length > 0
            ? operation.targetIndices
            : topology.getSelectedFaceIndices();
        topology.dissolveFaces(targets);
      }
      break;
    }

    case 'smooth': {
      const targets =
        operation.targetIndices.length > 0
          ? operation.targetIndices
          : topology.getSelectedVertexIndices();

      const factor =
        typeof operation.parameters.factor === 'number' ? operation.parameters.factor : 0.5;
      const iterations =
        typeof operation.parameters.iterations === 'number' ? operation.parameters.iterations : 1;

      topology.smoothVertices(targets, factor, iterations);
      break;
    }

    case 'merge': {
      const p = operation.parameters as MergeOperationParams;
      const targets =
        operation.targetIndices.length > 0
          ? operation.targetIndices
          : topology.getSelectedVertexIndices();

      if (p.type === 'distance') {
        const dist = typeof p.distance === 'number' ? p.distance : 0.001;
        topology.mergeVerticesByDistance(dist, targets);
      } else {
        topology.mergeVerticesAtCenter(targets);
      }
      break;
    }

    case 'loopcut': {
      const p = operation.parameters as LoopCutOperationParams;
      const edgeIndex =
        typeof p.edgeIndex === 'number'
          ? p.edgeIndex
          : (operation.targetIndices[0] ?? topology.getSelectedEdgeIndices()[0] ?? 0);
      const factor = typeof p.factor === 'number' ? p.factor : 0.5;
      const cuts = typeof p.cuts === 'number' ? p.cuts : 1;
      topology.loopCut(edgeIndex, factor, cuts);
      break;
    }

    case 'knife-cut': {
      const p = operation.parameters as KnifeCutOperationParams;
      if (typeof p.edgeIndex === 'number') {
        const factor = typeof p.factor === 'number' ? p.factor : 0.5;
        topology.knifeSplitEdge(p.edgeIndex, factor);
      } else if (
        typeof p.v1 === 'number' &&
        typeof p.v2 === 'number' &&
        operation.targetIndices.length > 0
      ) {
        topology.knifeSplitFace(operation.targetIndices[0], p.v1, p.v2);
      }
      break;
    }

    case 'bridge-loops': {
      const loopA = (operation.parameters.loopA as number[]) ?? [];
      const loopB = (operation.parameters.loopB as number[]) ?? [];
      if (loopA.length > 0 && loopB.length > 0) {
        topology.bridgeEdgeLoops(loopA, loopB);
      }
      break;
    }

    case 'fill-loop': {
      const loopVerts =
        (operation.parameters.loopVertexIndices as number[]) ?? operation.targetIndices;
      if (loopVerts.length >= 3) {
        topology.fillBoundaryLoop(loopVerts);
      }
      break;
    }

    case 'slide': {
      const p = operation.parameters as unknown as SlideOperationParams;
      const factor = typeof p.factor === 'number' ? p.factor : 0.5;
      if (p.mode === 'vertex' && typeof p.edgeIndex === 'number') {
        const vIdx = operation.targetIndices[0] ?? 0;
        topology.slideVertex(vIdx, p.edgeIndex, factor);
      } else {
        const targets =
          operation.targetIndices.length > 0
            ? operation.targetIndices
            : topology.getSelectedEdgeIndices();
        topology.slideEdge(targets, factor);
      }
      break;
    }

    case 'create-edge': {
      const v1 = operation.parameters.v1 as number;
      const v2 = operation.parameters.v2 as number;
      if (typeof v1 === 'number' && typeof v2 === 'number') {
        topology.createEdge(v1, v2);
      }
      break;
    }

    default:
      break;
  }
}

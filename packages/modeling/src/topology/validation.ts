import type {
  VertexData,
  EdgeData,
  FaceData,
  TopologyValidationIssue,
  TopologyValidationResult,
  TopologyStats,
} from '@blender-elt/contracts';
import { buildAdjacency, getBoundaryEdges, getNonManifoldEdges } from './adjacency.js';
import { computeFaceArea, computeMeshSurfaceArea, computeBoundingBox } from './geometry-calc.js';

/**
 * Validates topological invariants and reports issues
 */
export function validateTopology(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
): TopologyValidationResult {
  const issues: TopologyValidationIssue[] = [];
  const numVertices = vertices.length;

  // 1. Check vertex bounds and unreferenced indices in edges
  const referencedVerticesInEdges = new Set<number>();
  for (const edge of edges) {
    if (edge.v1 < 0 || edge.v1 >= numVertices || edge.v2 < 0 || edge.v2 >= numVertices) {
      issues.push({
        severity: 'error',
        code: 'unreferenced-index',
        message: `Edge ${edge.index} references out-of-bounds vertices (${edge.v1}, ${edge.v2})`,
        elementIndices: [edge.index],
        elementType: 'edge',
      });
    } else {
      referencedVerticesInEdges.add(edge.v1);
      referencedVerticesInEdges.add(edge.v2);
    }
  }

  // 2. Check face vertices and degenerate faces
  const referencedVerticesInFaces = new Set<number>();
  for (const face of faces) {
    const vi = face.vertexIndices;
    if (vi.length < 3) {
      issues.push({
        severity: 'error',
        code: 'degenerate-face',
        message: `Face ${face.index} has fewer than 3 vertices (${vi.length})`,
        elementIndices: [face.index],
        elementType: 'face',
      });
      continue;
    }

    const uniqueSet = new Set(vi);
    if (uniqueSet.size !== vi.length) {
      issues.push({
        severity: 'error',
        code: 'degenerate-face',
        message: `Face ${face.index} contains duplicate vertex indices`,
        elementIndices: [face.index],
        elementType: 'face',
      });
    }

    for (const vIdx of vi) {
      if (vIdx < 0 || vIdx >= numVertices) {
        issues.push({
          severity: 'error',
          code: 'unreferenced-index',
          message: `Face ${face.index} references out-of-bounds vertex ${vIdx}`,
          elementIndices: [face.index],
          elementType: 'face',
        });
      } else {
        referencedVerticesInFaces.add(vIdx);
      }
    }

    const area = computeFaceArea(vi, vertices);
    if (area < 1e-9) {
      issues.push({
        severity: 'warning',
        code: 'zero-area-face',
        message: `Face ${face.index} has zero or near-zero surface area (${area.toExponential(2)})`,
        elementIndices: [face.index],
        elementType: 'face',
      });
    }
  }

  // 3. Check for dangling vertices
  for (let i = 0; i < numVertices; i++) {
    if (!referencedVerticesInFaces.has(i) && !referencedVerticesInEdges.has(i)) {
      issues.push({
        severity: 'warning',
        code: 'dangling-vertex',
        message: `Vertex ${i} is not referenced by any edge or face`,
        elementIndices: [i],
        elementType: 'vertex',
      });
    }
  }

  // 4. Build adjacency to check non-manifold edges and winding
  const adj = buildAdjacency(vertices, edges, faces);

  // Non-manifold edges
  for (const edge of edges) {
    const fList = adj.edgeToFaces.get(edge.index) || [];
    if (fList.length === 0) {
      issues.push({
        severity: 'warning',
        code: 'dangling-edge',
        message: `Edge ${edge.index} is not referenced by any face`,
        elementIndices: [edge.index],
        elementType: 'edge',
      });
    } else if (fList.length > 2) {
      issues.push({
        severity: 'warning',
        code: 'non-manifold-edge',
        message: `Edge ${edge.index} is non-manifold (shared by ${fList.length} faces)`,
        elementIndices: [edge.index],
        elementType: 'edge',
      });
    }
  }

  // 5. Winding consistency check on manifold shared edges
  for (const edge of edges) {
    const fList = adj.edgeToFaces.get(edge.index) || [];
    if (fList.length === 2) {
      const f1 = faces[fList[0]];
      const f2 = faces[fList[1]];
      if (!f1 || !f2) continue;

      const getEdgeDirection = (f: FaceData, v1: number, v2: number): number => {
        const vi = f.vertexIndices;
        const count = vi.length;
        for (let i = 0; i < count; i++) {
          const a = vi[i];
          const b = vi[(i + 1) % count];
          if (a === v1 && b === v2) return 1; // forward
          if (a === v2 && b === v1) return -1; // reverse
        }
        return 0;
      };

      const dir1 = getEdgeDirection(f1, edge.v1, edge.v2);
      const dir2 = getEdgeDirection(f2, edge.v1, edge.v2);

      // In a consistent 2-manifold orientation, opposite faces must traverse edge in opposite directions
      if (dir1 !== 0 && dir2 !== 0 && dir1 === dir2) {
        issues.push({
          severity: 'warning',
          code: 'inconsistent-winding',
          message: `Inconsistent winding orientation between Face ${f1.index} and Face ${f2.index} at Edge ${edge.index}`,
          elementIndices: [f1.index, f2.index],
          elementType: 'face',
        });
      }
    }
  }

  const hasErrors = issues.some((iss) => iss.severity === 'error');
  return {
    isValid: !hasErrors,
    issues,
  };
}

/**
 * Computes complete topological and geometric statistics
 */
export function getTopologyStats(
  vertices: VertexData[],
  edges: EdgeData[],
  faces: FaceData[],
): TopologyStats {
  const adj = buildAdjacency(vertices, edges, faces);
  const boundaryEdges = getBoundaryEdges(edges, adj.edgeToFaces);
  const nonManifoldEdges = getNonManifoldEdges(edges, adj.edgeToFaces);

  let triangleCount = 0;
  let quadCount = 0;
  let ngonCount = 0;

  for (const face of faces) {
    const count = face.vertexIndices.length;
    if (count === 3) triangleCount++;
    else if (count === 4) quadCount++;
    else if (count > 4) ngonCount++;
  }

  return {
    vertexCount: vertices.length,
    edgeCount: edges.length,
    faceCount: faces.length,
    triangleCount,
    quadCount,
    ngonCount,
    boundaryEdgeCount: boundaryEdges.length,
    nonManifoldEdgeCount: nonManifoldEdges.length,
    surfaceArea: computeMeshSurfaceArea(faces, vertices),
    boundingBox: computeBoundingBox(vertices),
  };
}

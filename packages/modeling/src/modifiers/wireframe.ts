import type { WireframeModifier, Vector3 } from '@blender-elt/contracts';
import { MeshTopology } from '../topology/mesh-topology.js';

/**
 * Generates an orthogonal vector to a given normalized direction
 */
function getOrthogonalVector(dir: Vector3): Vector3 {
  // If dir is close to Y axis, use X axis as reference
  if (Math.abs(dir.y) > 0.9) {
    return normalizeVector({ x: 1, y: 0, z: 0 });
  }
  return normalizeVector({
    x: -dir.z,
    y: 0,
    z: dir.x,
  });
}

function crossProduct(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalizeVector(v: Vector3): Vector3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Evaluates the Wireframe Modifier on a MeshTopology
 */
export function evaluateWireframeModifier(
  topology: MeshTopology,
  modifier: WireframeModifier,
): MeshTopology {
  const thickness = Math.max(modifier.thickness, 0.001);
  const radius = thickness * 0.5;

  const result = new MeshTopology();

  if (!modifier.replaceOriginal) {
    // Keep original geometry
    for (const v of topology.vertices) {
      result.vertices.push({ ...v, position: { ...v.position } });
    }
    for (const f of topology.faces) {
      result.faces.push({ ...f, vertexIndices: [...f.vertexIndices] });
    }
  }

  // Iterate over each edge and construct a 3D strut
  for (const edge of topology.edges) {
    const v0 = topology.vertices[edge.v1];
    const v1 = topology.vertices[edge.v2];
    if (!v0 || !v1) continue;

    const p0 = v0.position;
    const p1 = v1.position;

    const dir: Vector3 = {
      x: p1.x - p0.x,
      y: p1.y - p0.y,
      z: p1.z - p0.z,
    };
    const normDir = normalizeVector(dir);

    const u = getOrthogonalVector(normDir);
    const v = crossProduct(normDir, u);

    // Scale perpendiculars by radius
    const uR = { x: u.x * radius, y: u.y * radius, z: u.z * radius };
    const vR = { x: v.x * radius, y: v.y * radius, z: v.z * radius };

    const baseIdx = result.vertices.length;

    // 4 points around p0
    result.vertices.push(
      {
        index: baseIdx,
        position: { x: p0.x + uR.x, y: p0.y + uR.y, z: p0.z + uR.z },
        selected: false,
      },
      {
        index: baseIdx + 1,
        position: { x: p0.x + vR.x, y: p0.y + vR.y, z: p0.z + vR.z },
        selected: false,
      },
      {
        index: baseIdx + 2,
        position: { x: p0.x - uR.x, y: p0.y - uR.y, z: p0.z - uR.z },
        selected: false,
      },
      {
        index: baseIdx + 3,
        position: { x: p0.x - vR.x, y: p0.y - vR.y, z: p0.z - vR.z },
        selected: false,
      },
    );

    // 4 points around p1
    result.vertices.push(
      {
        index: baseIdx + 4,
        position: { x: p1.x + uR.x, y: p1.y + uR.y, z: p1.z + uR.z },
        selected: false,
      },
      {
        index: baseIdx + 5,
        position: { x: p1.x + vR.x, y: p1.y + vR.y, z: p1.z + vR.z },
        selected: false,
      },
      {
        index: baseIdx + 6,
        position: { x: p1.x - uR.x, y: p1.y - uR.y, z: p1.z - uR.z },
        selected: false,
      },
      {
        index: baseIdx + 7,
        position: { x: p1.x - vR.x, y: p1.y - vR.y, z: p1.z - vR.z },
        selected: false,
      },
    );

    // 4 sides around the strut
    for (let side = 0; side < 4; side++) {
      const nextSide = (side + 1) % 4;
      const b0 = baseIdx + side;
      const b1 = baseIdx + nextSide;
      const t1 = baseIdx + 4 + nextSide;
      const t0 = baseIdx + 4 + side;

      // Two triangles per side
      result.faces.push(
        { index: result.faces.length, vertexIndices: [b0, b1, t1], selected: false },
        { index: result.faces.length + 1, vertexIndices: [b0, t1, t0], selected: false },
      );
    }
  }

  result.rebuildEdges();
  result.computeFaceNormals();
  result.computeVertexNormals();

  return result;
}

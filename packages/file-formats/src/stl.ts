import * as THREE from 'three';
import type {
  ExportOptions,
  ImportOptions,
  IMeshData,
  MeshNode,
  SceneRoot,
} from '@blender-elt/contracts';
import { beltToThree, createDefaultPBRConfig } from './bridge.js';
import type { ExportInput, ImportedSceneResult } from './types.js';

/**
 * Resolves ExportInput into a Three.js Object3D
 */
function resolveThreeObject(input: ExportInput): THREE.Object3D {
  if (input instanceof THREE.Object3D) {
    return input;
  }
  return beltToThree(input);
}

/**
 * Triangle descriptor with world-space vertices and normal
 */
interface TriangleData {
  normal: [number, number, number];
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
}

/**
 * Collects all world-transformed triangles from a Three.js scene/object
 */
function collectTriangles(threeObject: THREE.Object3D, upAxis: 'Y' | 'Z' = 'Y'): TriangleData[] {
  const triangles: TriangleData[] = [];
  threeObject.updateMatrixWorld(true);

  threeObject.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.geometry) return;

    const geo = child.geometry;
    const posAttr = geo.getAttribute('position');
    if (!posAttr || posAttr.count === 0) return;

    const worldMatrix = child.matrixWorld;
    const indexAttr = geo.getIndex();

    const transformVertex = (idx: number): [number, number, number] => {
      const v = new THREE.Vector3().fromBufferAttribute(posAttr, idx);
      v.applyMatrix4(worldMatrix);

      let x = v.x;
      let y = v.y;
      let z = v.z;

      if (upAxis === 'Z') {
        const tempY = y;
        y = -z;
        z = tempY;
      }
      return [x, y, z];
    };

    const processTriangle = (i0: number, i1: number, i2: number) => {
      const a = transformVertex(i0);
      const b = transformVertex(i1);
      const c = transformVertex(i2);

      const va = new THREE.Vector3(a[0], a[1], a[2]);
      const vb = new THREE.Vector3(b[0], b[1], b[2]);
      const vc = new THREE.Vector3(c[0], c[1], c[2]);

      const edge1 = new THREE.Vector3().subVectors(vb, va);
      const edge2 = new THREE.Vector3().subVectors(vc, va);
      const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

      triangles.push({
        normal: [normal.x, normal.y, normal.z],
        a,
        b,
        c,
      });
    };

    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i += 3) {
        processTriangle(indexAttr.getX(i), indexAttr.getX(i + 1), indexAttr.getX(i + 2));
      }
    } else {
      for (let i = 0; i < posAttr.count; i += 3) {
        processTriangle(i, i + 1, i + 2);
      }
    }
  });

  return triangles;
}

/**
 * Exports scene meshes into binary STL format (Uint8Array)
 */
export function exportBinarySTL(input: ExportInput, options?: ExportOptions): Uint8Array {
  const threeObject = resolveThreeObject(input);
  const triangles = collectTriangles(threeObject, options?.upAxis || 'Y');

  const numTriangles = triangles.length;
  const bufferSize = 84 + numTriangles * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const dataView = new DataView(buffer);

  // 80 bytes header
  const headerStr = 'Blender-ELT Binary STL Export';
  for (let i = 0; i < 80; i++) {
    if (i < headerStr.length) {
      dataView.setUint8(i, headerStr.charCodeAt(i));
    } else {
      dataView.setUint8(i, 0);
    }
  }

  // 4 bytes triangle count
  dataView.setUint32(80, numTriangles, true);

  let offset = 84;
  for (const tri of triangles) {
    // Normal
    dataView.setFloat32(offset, tri.normal[0], true);
    dataView.setFloat32(offset + 4, tri.normal[1], true);
    dataView.setFloat32(offset + 8, tri.normal[2], true);
    offset += 12;

    // Vertex 1
    dataView.setFloat32(offset, tri.a[0], true);
    dataView.setFloat32(offset + 4, tri.a[1], true);
    dataView.setFloat32(offset + 8, tri.a[2], true);
    offset += 12;

    // Vertex 2
    dataView.setFloat32(offset, tri.b[0], true);
    dataView.setFloat32(offset + 4, tri.b[1], true);
    dataView.setFloat32(offset + 8, tri.b[2], true);
    offset += 12;

    // Vertex 3
    dataView.setFloat32(offset, tri.c[0], true);
    dataView.setFloat32(offset + 4, tri.c[1], true);
    dataView.setFloat32(offset + 8, tri.c[2], true);
    offset += 12;

    // 2 bytes attribute byte count
    dataView.setUint16(offset, 0, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

/**
 * Exports scene meshes into ASCII STL format (string)
 */
export function exportAsciiSTL(input: ExportInput, options?: ExportOptions): string {
  const threeObject = resolveThreeObject(input);
  const triangles = collectTriangles(threeObject, options?.upAxis || 'Y');

  let output = 'solid BlenderELT\n';

  for (const tri of triangles) {
    output += `  facet normal ${tri.normal[0].toFixed(6)} ${tri.normal[1].toFixed(6)} ${tri.normal[2].toFixed(6)}\n`;
    output += '    outer loop\n';
    output += `      vertex ${tri.a[0].toFixed(6)} ${tri.a[1].toFixed(6)} ${tri.a[2].toFixed(6)}\n`;
    output += `      vertex ${tri.b[0].toFixed(6)} ${tri.b[1].toFixed(6)} ${tri.b[2].toFixed(6)}\n`;
    output += `      vertex ${tri.c[0].toFixed(6)} ${tri.c[1].toFixed(6)} ${tri.c[2].toFixed(6)}\n`;
    output += '    endloop\n';
    output += '  endfacet\n';
  }

  output += 'endsolid BlenderELT\n';
  return output;
}

/**
 * Exports scene meshes into STL format (binary or ASCII)
 */
export function exportSTL(input: ExportInput, options?: ExportOptions): string | Uint8Array {
  if (options?.binary) {
    return exportBinarySTL(input, options);
  }
  return exportAsciiSTL(input, options);
}

/**
 * Checks if binary data corresponds to a valid binary STL file
 */
function isBinarySTL(buffer: ArrayBuffer | Uint8Array): boolean {
  const byteLength = buffer.byteLength;
  if (byteLength < 84) return false;

  const dataView =
    buffer instanceof DataView
      ? buffer
      : buffer instanceof Uint8Array
        ? new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
        : new DataView(buffer);

  const numTriangles = dataView.getUint32(80, true);
  const expectedSize = 84 + numTriangles * 50;

  return expectedSize === byteLength;
}

/**
 * Parses binary STL buffer into IMeshData
 */
function parseBinarySTLData(dataView: DataView): IMeshData {
  const numTriangles = dataView.getUint32(80, true);

  const vertices = new Float32Array(numTriangles * 9);
  const normals = new Float32Array(numTriangles * 9);
  const indices = new Uint32Array(numTriangles * 3);

  let offset = 84;
  let vOffset = 0;
  let iOffset = 0;

  for (let i = 0; i < numTriangles; i++) {
    // Normal
    const nx = dataView.getFloat32(offset, true);
    const ny = dataView.getFloat32(offset + 4, true);
    const nz = dataView.getFloat32(offset + 8, true);
    offset += 12;

    // Normal for 3 vertices
    for (let k = 0; k < 3; k++) {
      normals[vOffset + k * 3] = nx;
      normals[vOffset + k * 3 + 1] = ny;
      normals[vOffset + k * 3 + 2] = nz;
    }

    // Vertices
    for (let k = 0; k < 3; k++) {
      vertices[vOffset + k * 3] = dataView.getFloat32(offset, true);
      vertices[vOffset + k * 3 + 1] = dataView.getFloat32(offset + 4, true);
      vertices[vOffset + k * 3 + 2] = dataView.getFloat32(offset + 8, true);
      offset += 12;

      indices[iOffset++] = vOffset / 3 + k;
    }

    vOffset += 9;
    offset += 2; // Attribute byte count
  }

  return {
    vertices,
    normals,
    indices,
  };
}

/**
 * Parses ASCII STL string into IMeshData
 */
function parseAsciiSTLString(text: string): IMeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  let currentNormal: [number, number, number] = [0, 0, 0];
  let vertIndex = 0;

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const parts = line.split(/\s+/);
    const keyword = parts[0].toLowerCase();

    if (keyword === 'facet' && parts[1]?.toLowerCase() === 'normal') {
      const nx = parseFloat(parts[2] || '0');
      const ny = parseFloat(parts[3] || '0');
      const nz = parseFloat(parts[4] || '0');
      currentNormal = [nx, ny, nz];
    } else if (keyword === 'vertex') {
      const x = parseFloat(parts[1] || '0');
      const y = parseFloat(parts[2] || '0');
      const z = parseFloat(parts[3] || '0');

      positions.push(x, y, z);
      normals.push(currentNormal[0], currentNormal[1], currentNormal[2]);
      indices.push(vertIndex++);
    }
  }

  return {
    vertices: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}

/**
 * Parses binary or ASCII STL into domain IMeshData
 */
export function parseSTLToMeshData(data: string | ArrayBuffer | Uint8Array): IMeshData {
  if (typeof data === 'string') {
    return parseAsciiSTLString(data);
  }

  if (isBinarySTL(data)) {
    const dataView =
      data instanceof Uint8Array
        ? new DataView(data.buffer, data.byteOffset, data.byteLength)
        : new DataView(data);
    return parseBinarySTLData(dataView);
  }

  // Fallback: Try decoding as UTF-8 ASCII text
  const text =
    data instanceof Uint8Array
      ? new TextDecoder().decode(data)
      : new TextDecoder().decode(new Uint8Array(data));

  return parseAsciiSTLString(text);
}

/**
 * Imports binary or ASCII STL file into Blender-ELT domain scene
 */
export function importSTL(
  data: string | ArrayBuffer | Uint8Array,
  options?: ImportOptions,
): ImportedSceneResult {
  const meshData = parseSTLToMeshData(data);
  const geoId = 'geo-stl-1';
  const matId = 'mat-stl-default';
  const nodeId = 'mesh-stl-1';

  // Apply optional geometry centering / normalization
  if (options?.centerGeometry || options?.normalizeScale) {
    const verts = meshData.vertices as Float32Array;
    if (verts.length > 0) {
      let minX = Infinity,
        minY = Infinity,
        minZ = Infinity;
      let maxX = -Infinity,
        maxY = -Infinity,
        maxZ = -Infinity;

      for (let i = 0; i < verts.length; i += 3) {
        minX = Math.min(minX, verts[i]);
        minY = Math.min(minY, verts[i + 1]);
        minZ = Math.min(minZ, verts[i + 2]);
        maxX = Math.max(maxX, verts[i]);
        maxY = Math.max(maxY, verts[i + 1]);
        maxZ = Math.max(maxZ, verts[i + 2]);
      }

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const cz = (minZ + maxZ) / 2;
      const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ);

      if (options.centerGeometry) {
        for (let i = 0; i < verts.length; i += 3) {
          verts[i] -= cx;
          verts[i + 1] -= cy;
          verts[i + 2] -= cz;
        }
      }

      if (options.normalizeScale && maxDim > 0) {
        const factor = 2 / maxDim;
        for (let i = 0; i < verts.length; i++) {
          verts[i] *= factor;
        }
      }
    }
  }

  const defaultMat = {
    id: matId,
    name: 'STL Material',
    type: 'pbr' as const,
    config: createDefaultPBRConfig(),
  };

  const node: MeshNode = {
    id: nodeId,
    name: 'ImportedSTL',
    type: 'mesh',
    geometryId: geoId,
    materialId: matId,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
      scale: { x: 1, y: 1, z: 1 },
    },
    visible: true,
    locked: false,
    parentId: null,
    childrenIds: [],
  };

  const root: SceneRoot = {
    id: 'root',
    name: 'STL Import',
    type: 'root',
    childrenIds: [nodeId],
  };

  return {
    root,
    nodes: { [nodeId]: node },
    geometries: { [geoId]: meshData },
    materials: { [matId]: defaultMat },
  };
}

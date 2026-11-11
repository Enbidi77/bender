import * as THREE from 'three';
import type {
  ExportOptions,
  ImportOptions,
  IMeshData,
  MaterialDefinition,
  SceneNode,
  MeshNode,
  SceneRoot,
} from '@blender-elt/contracts';
import { beltToThree, createDefaultPBRConfig, threeMaterialToPBR } from './bridge.js';
import type { ExportInput, ImportedSceneResult, OBJExportResult } from './types.js';

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
 * Converts RGB hex string to normalized RGB float tuple [r, g, b]
 */
function hexToRGB(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return [r, g, b];
  }
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [r, g, b];
}

/**
 * Converts normalized RGB float tuple [r, g, b] to hex string '#rrggbb'
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n * 255)));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Exports scene or domain mesh nodes into Wavefront .obj format with companion .mtl
 */
export function exportOBJ(
  input: ExportInput,
  options?: ExportOptions & { mtlFileName?: string }
): OBJExportResult {
  const threeObject = resolveThreeObject(input);
  const upAxis = options?.upAxis || 'Y';
  const includeMaterials = options?.includeMaterials ?? true;
  const mtlFileName = options?.mtlFileName || 'materials.mtl';

  let objOutput = '# Wavefront OBJ exported by Blender-ELT\n';
  if (includeMaterials) {
    objOutput += `mtllib ${mtlFileName}\n\n`;
  }

  const materialsMap = new Map<string, THREE.Material>();

  let vertexOffset = 1;
  let normalOffset = 1;
  let uvOffset = 1;

  threeObject.updateMatrixWorld(true);

  threeObject.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.geometry) return;

    const mesh = child;
    const geo = mesh.geometry;
    const posAttr = geo.getAttribute('position');
    if (!posAttr || posAttr.count === 0) return;

    const normalAttr = geo.getAttribute('normal');
    const uvAttr = geo.getAttribute('uv');
    const indexAttr = geo.getIndex();

    const meshName = mesh.name || `Mesh_${mesh.id}`;
    objOutput += `o ${meshName}\n`;

    // Handle Material
    const rawMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (includeMaterials && rawMat) {
      const matName = rawMat.name || `Mat_${rawMat.id}`;
      objOutput += `usemtl ${matName}\n`;
      materialsMap.set(matName, rawMat);
    }

    // World transform matrices
    const worldMatrix = mesh.matrixWorld;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);

    // Export Positions (v)
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      v.applyMatrix4(worldMatrix);

      let x = v.x;
      let y = v.y;
      let z = v.z;

      if (upAxis === 'Z') {
        // Convert Y-up to Z-up: (x, y, z) -> (x, -z, y)
        const tempY = y;
        y = -z;
        z = tempY;
      }

      objOutput += `v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`;
    }

    // Export Normals (vn)
    const hasNormals = normalAttr && normalAttr.count > 0;
    if (hasNormals) {
      const n = new THREE.Vector3();
      for (let i = 0; i < normalAttr.count; i++) {
        n.fromBufferAttribute(normalAttr, i);
        n.applyMatrix3(normalMatrix).normalize();

        let nx = n.x;
        let ny = n.y;
        let nz = n.z;

        if (upAxis === 'Z') {
          const tempNy = ny;
          ny = -nz;
          nz = tempNy;
        }

        objOutput += `vn ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}\n`;
      }
    }

    // Export Texture Coords (vt)
    const hasUVs = uvAttr && uvAttr.count > 0;
    if (hasUVs) {
      for (let i = 0; i < uvAttr.count; i++) {
        const u = uvAttr.getX(i);
        const uCoord = uvAttr.getY(i);
        objOutput += `vt ${u.toFixed(6)} ${uCoord.toFixed(6)}\n`;
      }
    }

    // Export Faces (f)
    const formatFaceVertex = (idx: number) => {
      const vIdx = idx + vertexOffset;
      const vtPart = hasUVs ? (idx + uvOffset).toString() : '';
      const vnPart = hasNormals ? (idx + normalOffset).toString() : '';

      if (hasUVs && hasNormals) {
        return `${vIdx}/${vtPart}/${vnPart}`;
      } else if (hasUVs) {
        return `${vIdx}/${vtPart}`;
      } else if (hasNormals) {
        return `${vIdx}//${vnPart}`;
      }
      return `${vIdx}`;
    };

    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i += 3) {
        const a = indexAttr.getX(i);
        const b = indexAttr.getX(i + 1);
        const c = indexAttr.getX(i + 2);
        objOutput += `f ${formatFaceVertex(a)} ${formatFaceVertex(b)} ${formatFaceVertex(c)}\n`;
      }
    } else {
      for (let i = 0; i < posAttr.count; i += 3) {
        objOutput += `f ${formatFaceVertex(i)} ${formatFaceVertex(i + 1)} ${formatFaceVertex(i + 2)}\n`;
      }
    }

    vertexOffset += posAttr.count;
    if (hasNormals) normalOffset += normalAttr.count;
    if (hasUVs) uvOffset += uvAttr.count;

    objOutput += '\n';
  });

  // Generate companion MTL if requested
  let mtlOutput: string | undefined;
  if (includeMaterials && materialsMap.size > 0) {
    mtlOutput = '# Wavefront MTL exported by Blender-ELT\n\n';
    for (const [matName, mat] of materialsMap.entries()) {
      const { config } = threeMaterialToPBR(mat);
      const [dr, dg, db] = hexToRGB(config.color);
      const [er, eg, eb] = hexToRGB(config.emission);

      // Convert roughness to specular exponent Ns (0 to 1000)
      const ns = Math.round(Math.pow(1 - config.roughness, 2) * 1000);
      const opacity = config.opacity;

      mtlOutput += `newmtl ${matName}\n`;
      mtlOutput += `Ka 0.100000 0.100000 0.100000\n`;
      mtlOutput += `Kd ${dr.toFixed(6)} ${dg.toFixed(6)} ${db.toFixed(6)}\n`;
      mtlOutput += `Ks ${config.metalness.toFixed(6)} ${config.metalness.toFixed(6)} ${config.metalness.toFixed(6)}\n`;
      mtlOutput += `Ke ${er.toFixed(6)} ${eg.toFixed(6)} ${eb.toFixed(6)}\n`;
      mtlOutput += `Ns ${ns}\n`;
      mtlOutput += `d ${opacity.toFixed(6)}\n`;
      mtlOutput += `illum 2\n\n`;
    }
  }

  return {
    obj: objOutput,
    mtl: mtlOutput,
    mtlFileName: includeMaterials ? mtlFileName : undefined,
  };
}

/**
 * Parses Wavefront .mtl companion material definition text
 */
export function parseMTL(mtlText: string): Record<string, MaterialDefinition> {
  const materials: Record<string, MaterialDefinition> = {};
  let currentMat: MaterialDefinition | null = null;

  const lines = mtlText.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    const command = parts[0].toLowerCase();

    if (command === 'newmtl') {
      const name = parts.slice(1).join(' ') || 'Material';
      const id = `mat-${name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
      currentMat = {
        id,
        name,
        type: 'pbr',
        config: createDefaultPBRConfig(),
      };
      materials[name] = currentMat;
      materials[id] = currentMat;
    } else if (currentMat) {
      if (command === 'kd') {
        const r = parseFloat(parts[1] || '0.8');
        const g = parseFloat(parts[2] || '0.8');
        const b = parseFloat(parts[3] || '0.8');
        currentMat.config.color = rgbToHex(r, g, b);
      } else if (command === 'ke') {
        const r = parseFloat(parts[1] || '0');
        const g = parseFloat(parts[2] || '0');
        const b = parseFloat(parts[3] || '0');
        currentMat.config.emission = rgbToHex(r, g, b);
      } else if (command === 'ks') {
        const r = parseFloat(parts[1] || '0');
        currentMat.config.metalness = Math.max(0, Math.min(1, r));
      } else if (command === 'ns') {
        const ns = parseFloat(parts[1] || '0');
        currentMat.config.roughness = Math.max(0, Math.min(1, 1 - Math.sqrt(ns / 1000)));
      } else if (command === 'd') {
        currentMat.config.opacity = parseFloat(parts[1] || '1');
        currentMat.config.transparent = currentMat.config.opacity < 1;
      } else if (command === 'tr') {
        const tr = parseFloat(parts[1] || '0');
        currentMat.config.opacity = 1 - tr;
        currentMat.config.transparent = tr > 0;
      }
    }
  }

  return materials;
}

/**
 * Parses Wavefront .obj text format into domain IMeshData
 */
export function parseOBJToMeshData(objText: string): IMeshData {
  const rawPositions: [number, number, number][] = [];
  const rawNormals: [number, number, number][] = [];
  const rawUVs: [number, number][] = [];

  const outPositions: number[] = [];
  const outNormals: number[] = [];
  const outUVs: number[] = [];
  const outIndices: number[] = [];

  const vertexCache = new Map<string, number>();

  const resolveIndex = (idxStr: string, count: number): number => {
    const idx = parseInt(idxStr, 10);
    if (idx < 0) {
      return count + idx; // Relative index
    }
    return idx - 1; // 1-based index
  };

  const getOrCreateVertex = (faceVertexStr: string): number => {
    let cached = vertexCache.get(faceVertexStr);
    if (cached !== undefined) return cached;

    const parts = faceVertexStr.split('/');
    const vIndex = resolveIndex(parts[0], rawPositions.length);
    const vtIndex = parts[1] && parts[1].length > 0 ? resolveIndex(parts[1], rawUVs.length) : -1;
    const vnIndex = parts[2] && parts[2].length > 0 ? resolveIndex(parts[2], rawNormals.length) : -1;

    const pos = rawPositions[vIndex] || [0, 0, 0];
    outPositions.push(pos[0], pos[1], pos[2]);

    if (vnIndex >= 0 && rawNormals[vnIndex]) {
      const norm = rawNormals[vnIndex];
      outNormals.push(norm[0], norm[1], norm[2]);
    } else {
      outNormals.push(0, 1, 0);
    }

    if (vtIndex >= 0 && rawUVs[vtIndex]) {
      const uv = rawUVs[vtIndex];
      outUVs.push(uv[0], uv[1]);
    } else {
      outUVs.push(0, 0);
    }

    const newIndex = (outPositions.length / 3) - 1;
    vertexCache.set(faceVertexStr, newIndex);
    return newIndex;
  };

  const lines = objText.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    const type = parts[0].toLowerCase();

    if (type === 'v') {
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      rawPositions.push([x, y, z]);
    } else if (type === 'vn') {
      const nx = parseFloat(parts[1]);
      const ny = parseFloat(parts[2]);
      const nz = parseFloat(parts[3]);
      rawNormals.push([nx, ny, nz]);
    } else if (type === 'vt') {
      const u = parseFloat(parts[1]);
      const v = parseFloat(parts[2] || '0');
      rawUVs.push([u, v]);
    } else if (type === 'f') {
      const faceVertices = parts.slice(1).filter((s) => s.length > 0);
      if (faceVertices.length < 3) continue;

      // Triangulate polygon fan: (0, i, i + 1)
      const v0 = getOrCreateVertex(faceVertices[0]);
      for (let i = 1; i < faceVertices.length - 1; i++) {
        const v1 = getOrCreateVertex(faceVertices[i]);
        const v2 = getOrCreateVertex(faceVertices[i + 1]);
        outIndices.push(v0, v1, v2);
      }
    }
  }

  // Compute normals if none were supplied in OBJ
  const hasNormalsInFile = rawNormals.length > 0;
  const positionsFloat = new Float32Array(outPositions);
  const normalsFloat = new Float32Array(outNormals);
  const indicesArray = new Uint32Array(outIndices);

  if (!hasNormalsInFile && outPositions.length > 0) {
    // Generate face normals
    for (let i = 0; i < outIndices.length; i += 3) {
      const i0 = outIndices[i] * 3;
      const i1 = outIndices[i + 1] * 3;
      const i2 = outIndices[i + 2] * 3;

      const p0 = new THREE.Vector3(positionsFloat[i0], positionsFloat[i0 + 1], positionsFloat[i0 + 2]);
      const p1 = new THREE.Vector3(positionsFloat[i1], positionsFloat[i1 + 1], positionsFloat[i1 + 2]);
      const p2 = new THREE.Vector3(positionsFloat[i2], positionsFloat[i2 + 1], positionsFloat[i2 + 2]);

      const edge1 = new THREE.Vector3().subVectors(p1, p0);
      const edge2 = new THREE.Vector3().subVectors(p2, p0);
      const norm = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

      normalsFloat[i0] = norm.x;
      normalsFloat[i0 + 1] = norm.y;
      normalsFloat[i0 + 2] = norm.z;

      normalsFloat[i1] = norm.x;
      normalsFloat[i1 + 1] = norm.y;
      normalsFloat[i1 + 2] = norm.z;

      normalsFloat[i2] = norm.x;
      normalsFloat[i2 + 1] = norm.y;
      normalsFloat[i2 + 2] = norm.z;
    }
  }

  return {
    vertices: positionsFloat,
    normals: normalsFloat,
    uvs: rawUVs.length > 0 ? new Float32Array(outUVs) : undefined,
    indices: indicesArray,
  };
}

/**
 * Imports OBJ text with optional MTL into a complete Blender-ELT domain scene
 */
export function importOBJ(
  objContent: string,
  mtlContent?: string,
  options?: ImportOptions
): ImportedSceneResult {
  const materials = mtlContent ? parseMTL(mtlContent) : {};

  // Check if multiple objects or groups exist
  const hasMultipleObjects = /(?:^|\n)[og]\s+/m.test(objContent);

  const nodes: Record<string, SceneNode> = {};
  const geometries: Record<string, IMeshData> = {};
  const rootChildrenIds: string[] = [];

  if (!hasMultipleObjects) {
    const meshData = parseOBJToMeshData(objContent);
    const geoId = 'geo-obj-1';
    geometries[geoId] = meshData;

    let matId: string | undefined;
    const defaultMatName = Object.keys(materials)[0];
    if (defaultMatName && materials[defaultMatName]) {
      matId = materials[defaultMatName].id;
    }

    const nodeId = 'mesh-obj-1';
    const node: MeshNode = {
      id: nodeId,
      name: 'ImportedOBJ',
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
    nodes[nodeId] = node;
    rootChildrenIds.push(nodeId);
  } else {
    // Multi-object split
    const meshData = parseOBJToMeshData(objContent);
    const geoId = 'geo-obj-combined';
    geometries[geoId] = meshData;

    const nodeId = 'mesh-obj-1';
    const node: MeshNode = {
      id: nodeId,
      name: 'ImportedOBJ',
      type: 'mesh',
      geometryId: geoId,
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
    nodes[nodeId] = node;
    rootChildrenIds.push(nodeId);
  }

  // Handle center / normalize
  if (options?.centerGeometry || options?.normalizeScale) {
    for (const meshData of Object.values(geometries)) {
      const verts = meshData.vertices as Float32Array;
      if (verts.length === 0) continue;

      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

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

  const root: SceneRoot = {
    id: 'root',
    name: 'OBJ Import',
    type: 'root',
    childrenIds: rootChildrenIds,
  };

  return {
    root,
    nodes,
    geometries,
    materials,
  };
}

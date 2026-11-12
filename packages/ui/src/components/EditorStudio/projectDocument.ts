import type {
  ProjectDocument,
  MaterialDefinition,
  IMeshData,
  MeshNode,
  PrimitiveType,
  SceneNode,
} from '@blender-elt/contracts';
import { createProjectMetadata } from '@blender-elt/persistence';
import { createPrimitiveGeometry, bufferGeometryToMeshData } from '@blender-elt/modeling';
import type { SceneGraphState } from '@blender-elt/scene-core';

/**
 * Builds a serializable ProjectDocument from current SceneGraphState
 */
export function buildProjectDocument(
  state: SceneGraphState,
  name: string = 'Untitled.belt',
): ProjectDocument {
  const geometries: Record<string, IMeshData> = {};
  const materials: Record<string, MaterialDefinition> = {};

  Object.values(state.nodes).forEach((n) => {
    if (n.type === 'mesh') {
      const mesh = n as MeshNode;
      const prim = (mesh.primitiveType || 'cube') as PrimitiveType;
      const geo = createPrimitiveGeometry(prim);
      const rawMesh = bufferGeometryToMeshData(geo);
      geometries[mesh.geometryId || mesh.id] = {
        vertices: Array.from(rawMesh.vertices as any),
        normals: rawMesh.normals ? Array.from(rawMesh.normals as any) : undefined,
        uvs: rawMesh.uvs ? Array.from(rawMesh.uvs as any) : undefined,
        indices: rawMesh.indices ? Array.from(rawMesh.indices as any) : undefined,
      };
    }
  });

  return {
    version: '1.0.0',
    metadata: createProjectMetadata(name),
    root: state.root,
    nodes: state.nodes,
    collections: state.collections,
    geometries,
    materials,
  };
}

export interface PolycountStats {
  totalObjects: number;
  totalVertices: number;
  totalFaces: number;
}

/**
 * Computes polycount statistics across all mesh nodes in the scene
 */
export function calculateScenePolycounts(nodes: Record<string, SceneNode>): PolycountStats {
  const totalObjects = Object.keys(nodes).length;
  let totalVertices = 0;
  let totalFaces = 0;

  Object.values(nodes).forEach((n) => {
    if (n.type === 'mesh') {
      const prim = (n as any).primitiveType || 'cube';
      if (prim === 'sphere') {
        totalVertices += 482;
        totalFaces += 960;
      } else if (prim === 'cylinder') {
        totalVertices += 66;
        totalFaces += 64;
      } else if (prim === 'plane') {
        totalVertices += 4;
        totalFaces += 2;
      } else if (prim === 'torus') {
        totalVertices += 512;
        totalFaces += 1024;
      } else if (prim === 'cone') {
        totalVertices += 34;
        totalFaces += 33;
      } else {
        totalVertices += 8;
        totalFaces += 6;
      }
    }
  });

  return {
    totalObjects,
    totalVertices,
    totalFaces,
  };
}

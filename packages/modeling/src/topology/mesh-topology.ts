import * as THREE from 'three';
import type {
  IMeshData,
  VertexData,
  EdgeData,
  FaceData,
  EditElementMode,
  Vector3,
  TopologyValidationResult,
  TopologyStats,
} from '@blender-elt/contracts';
import {
  buildAdjacency,
  getBoundaryEdges,
  getBoundaryLoops,
  getNonManifoldEdges,
  getConnectedVertices,
  getConnectedFaces,
  verticesToEdges,
  edgesToFaces,
  facesToVertices,
  facesToEdges,
  growSelection,
  shrinkSelection,
  type TopologyAdjacency,
} from './adjacency.js';
import {
  computeFaceNormal,
  computeFaceCentroid,
  computeFaceArea,
  computeMeshSurfaceArea,
  computeEdgeLength,
  computeEdgeMidpoint,
} from './geometry-calc.js';
import { validateTopology, getTopologyStats } from './validation.js';
import {
  mergeVerticesAtCenter,
  mergeVerticesByDistance,
  smoothVertices,
  deleteVertices,
  dissolveVertices,
  slideVertex,
  reindexTopology,
} from './vertex-ops.js';
import {
  createEdgeBetweenVertices,
  subdivideEdges,
  getEdgeLoop,
  getEdgeRing,
  dissolveEdges,
  deleteEdges,
  slideEdge,
} from './edge-ops.js';
import {
  extrudeFacesRegion,
  extrudeFacesIndividual,
  insetFaces,
  triangulateFaces,
  flipNormals,
  deleteFaces,
  dissolveFaces,
  fillBoundaryLoop,
  bridgeEdgeLoops,
  bevelElements,
} from './face-ops.js';
import { loopCut, knifeSplitEdge, knifeSplitFace } from './topology-tools.js';

/**
 * Robust Mesh Topology data structure for editing, geometry queries, and advanced modeling operations
 */
export class MeshTopology {
  public vertices: VertexData[] = [];
  public edges: EdgeData[] = [];
  public faces: FaceData[] = [];
  public faceNormals: Vector3[] = [];

  constructor(vertices: VertexData[] = [], edges: EdgeData[] = [], faces: FaceData[] = []) {
    this.vertices = vertices;
    this.edges = edges;
    this.faces = faces;
    if (faces.length > 0) {
      if (this.edges.length === 0) {
        this.rebuildEdges();
      }
      this.computeFaceNormals();
      this.computeVertexNormals();
    }
  }

  /**
   * Constructs a MeshTopology instance from raw IMeshData
   */
  public static fromMeshData(data: IMeshData): MeshTopology {
    const rawVertices = data.vertices;
    const rawNormals = data.normals;
    const rawUvs = data.uvs;
    const rawIndices = data.indices;

    const numVertices = Math.floor(rawVertices.length / 3);
    const vertices: VertexData[] = [];

    for (let i = 0; i < numVertices; i++) {
      const px = rawVertices[i * 3];
      const py = rawVertices[i * 3 + 1];
      const pz = rawVertices[i * 3 + 2];

      let normal: Vector3 | undefined = undefined;
      if (rawNormals && rawNormals.length >= (i + 1) * 3) {
        normal = {
          x: rawNormals[i * 3],
          y: rawNormals[i * 3 + 1],
          z: rawNormals[i * 3 + 2],
        };
      }

      let uv: [number, number] | undefined = undefined;
      if (rawUvs && rawUvs.length >= (i + 1) * 2) {
        uv = [rawUvs[i * 2], rawUvs[i * 2 + 1]];
      }

      vertices.push({
        index: i,
        position: { x: px, y: py, z: pz },
        normal,
        uv,
        selected: false,
      });
    }

    const faces: FaceData[] = [];
    const edgeMap = new Map<string, EdgeData>();
    let edgeIndexCounter = 0;

    const getOrAddEdge = (v1: number, v2: number): number => {
      const minV = Math.min(v1, v2);
      const maxV = Math.max(v1, v2);
      const key = `${minV}_${maxV}`;
      const existing = edgeMap.get(key);
      if (existing) {
        return existing.index;
      }
      const newEdge: EdgeData = {
        index: edgeIndexCounter++,
        v1: minV,
        v2: maxV,
        selected: false,
      };
      edgeMap.set(key, newEdge);
      return newEdge.index;
    };

    if (rawIndices && rawIndices.length >= 3) {
      const indices = Array.from(rawIndices);
      for (let i = 0; i < indices.length; i += 3) {
        const v0 = indices[i];
        const v1 = indices[i + 1];
        const v2 = indices[i + 2];

        const e0 = getOrAddEdge(v0, v1);
        const e1 = getOrAddEdge(v1, v2);
        const e2 = getOrAddEdge(v2, v0);

        faces.push({
          index: faces.length,
          vertexIndices: [v0, v1, v2],
          edgeIndices: [e0, e1, e2],
          selected: false,
        });
      }
    } else {
      // Non-indexed triangle list
      for (let i = 0; i < numVertices; i += 3) {
        if (i + 2 < numVertices) {
          const v0 = i;
          const v1 = i + 1;
          const v2 = i + 2;

          const e0 = getOrAddEdge(v0, v1);
          const e1 = getOrAddEdge(v1, v2);
          const e2 = getOrAddEdge(v2, v0);

          faces.push({
            index: faces.length,
            vertexIndices: [v0, v1, v2],
            edgeIndices: [e0, e1, e2],
            selected: false,
          });
        }
      }
    }

    return new MeshTopology(vertices, Array.from(edgeMap.values()), faces);
  }

  /**
   * Serializes current topology back into IMeshData
   */
  public toMeshData(): IMeshData {
    const numVerts = this.vertices.length;
    const verticesArray = new Float32Array(numVerts * 3);
    const normalsArray = new Float32Array(numVerts * 3);
    const uvsArray = new Float32Array(numVerts * 2);

    for (let i = 0; i < numVerts; i++) {
      const v = this.vertices[i];
      verticesArray[i * 3] = v.position.x;
      verticesArray[i * 3 + 1] = v.position.y;
      verticesArray[i * 3 + 2] = v.position.z;

      if (v.normal) {
        normalsArray[i * 3] = v.normal.x;
        normalsArray[i * 3 + 1] = v.normal.y;
        normalsArray[i * 3 + 2] = v.normal.z;
      }

      if (v.uv) {
        uvsArray[i * 2] = v.uv[0];
        uvsArray[i * 2 + 1] = v.uv[1];
      }
    }

    // Triangulate any faces with > 3 vertices
    const triangleIndices: number[] = [];
    for (const face of this.faces) {
      const vi = face.vertexIndices;
      if (vi.length === 3) {
        triangleIndices.push(vi[0], vi[1], vi[2]);
      } else if (vi.length > 3) {
        // Fan triangulation
        for (let j = 1; j < vi.length - 1; j++) {
          triangleIndices.push(vi[0], vi[j], vi[j + 1]);
        }
      }
    }

    const indicesArray =
      numVerts > 65535 ? new Uint32Array(triangleIndices) : new Uint16Array(triangleIndices);

    return {
      vertices: verticesArray,
      normals: normalsArray,
      uvs: uvsArray,
      indices: indicesArray,
    };
  }

  /**
   * Computes face normals from vertex positions using Newell's method
   */
  public computeFaceNormals(): void {
    this.faceNormals = new Array(this.faces.length);

    for (let i = 0; i < this.faces.length; i++) {
      const face = this.faces[i];
      const normal = computeFaceNormal(face.vertexIndices, this.vertices);
      face.normal = normal;
      this.faceNormals[i] = normal;
    }
  }

  /**
   * Computes smooth vertex normals by averaging adjacent face normals
   */
  public computeVertexNormals(): void {
    const accum = this.vertices.map(() => new THREE.Vector3(0, 0, 0));

    for (const face of this.faces) {
      if (!face.normal) continue;
      const fn = new THREE.Vector3(face.normal.x, face.normal.y, face.normal.z);
      for (const vi of face.vertexIndices) {
        if (accum[vi]) {
          accum[vi].add(fn);
        }
      }
    }

    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i];
      const vec = accum[i];
      if (vec.lengthSq() > 0) {
        vec.normalize();
        v.normal = { x: vec.x, y: vec.y, z: vec.z };
      } else {
        v.normal = { x: 0, y: 1, z: 0 };
      }
    }
  }

  /**
   * Rebuilds unique edge map and links faces to their edges
   */
  public rebuildEdges(): void {
    const reindexed = reindexTopology(this.vertices, this.edges, this.faces);
    this.vertices = reindexed.vertices;
    this.edges = reindexed.edges;
    this.faces = reindexed.faces;
  }

  // --- Adjacency & Traversal Queries ---

  public getAdjacency(): TopologyAdjacency {
    return buildAdjacency(this.vertices, this.edges, this.faces);
  }

  public getBoundaryEdges(): EdgeData[] {
    const adj = this.getAdjacency();
    return getBoundaryEdges(this.edges, adj.edgeToFaces);
  }

  public getBoundaryLoops(): number[][] {
    const adj = this.getAdjacency();
    return getBoundaryLoops(this.edges, adj.edgeToFaces, this.vertices);
  }

  public getNonManifoldEdges(): EdgeData[] {
    const adj = this.getAdjacency();
    return getNonManifoldEdges(this.edges, adj.edgeToFaces);
  }

  public getConnectedVertices(startVertexIndex: number): number[] {
    const adj = this.getAdjacency();
    return getConnectedVertices(startVertexIndex, adj.vertexToEdges, this.edges);
  }

  public getConnectedFaces(startFaceIndex: number): number[] {
    const adj = this.getAdjacency();
    return getConnectedFaces(startFaceIndex, adj.faceToEdges, adj.edgeToFaces);
  }

  // --- Selection Conversion Helpers ---

  public verticesToEdges(vertexIndices?: number[]): number[] {
    const targets = vertexIndices ?? this.getSelectedVertexIndices();
    return verticesToEdges(targets, this.edges);
  }

  public edgesToFaces(edgeIndices?: number[]): number[] {
    const targets = edgeIndices ?? this.getSelectedEdgeIndices();
    return edgesToFaces(targets, this.faces);
  }

  public facesToVertices(faceIndices?: number[]): number[] {
    const targets = faceIndices ?? this.getSelectedFaceIndices();
    return facesToVertices(targets, this.faces);
  }

  public facesToEdges(faceIndices?: number[]): number[] {
    const targets = faceIndices ?? this.getSelectedFaceIndices();
    return facesToEdges(targets, this.faces);
  }

  public growSelection(mode: EditElementMode): number[] {
    const current = this.getSelection(mode);
    const adj = this.getAdjacency();
    const grown = growSelection(mode, current, adj, this.edges, this.faces);
    this.setSelection(mode, grown);
    return grown;
  }

  public shrinkSelection(mode: EditElementMode): number[] {
    const current = this.getSelection(mode);
    const adj = this.getAdjacency();
    const shrunk = shrinkSelection(mode, current, adj, this.edges, this.faces);
    this.setSelection(mode, shrunk);
    return shrunk;
  }

  // --- Validation and Statistics ---

  public validate(): TopologyValidationResult {
    return validateTopology(this.vertices, this.edges, this.faces);
  }

  public getStats(): TopologyStats {
    return getTopologyStats(this.vertices, this.edges, this.faces);
  }

  public getFaceNormal(faceIndex: number): Vector3 {
    const face = this.faces[faceIndex];
    if (!face) return { x: 0, y: 1, z: 0 };
    return computeFaceNormal(face.vertexIndices, this.vertices);
  }

  public getFaceCentroid(faceIndex: number): Vector3 {
    const face = this.faces[faceIndex];
    if (!face) return { x: 0, y: 0, z: 0 };
    return computeFaceCentroid(face.vertexIndices, this.vertices);
  }

  public getFaceArea(faceIndex: number): number {
    const face = this.faces[faceIndex];
    if (!face) return 0;
    return computeFaceArea(face.vertexIndices, this.vertices);
  }

  public getSurfaceArea(): number {
    return computeMeshSurfaceArea(this.faces, this.vertices);
  }

  public getEdgeLength(edgeIndex: number): number {
    const edge = this.edges[edgeIndex];
    if (!edge) return 0;
    return computeEdgeLength(edge, this.vertices);
  }

  public getEdgeMidpoint(edgeIndex: number): Vector3 {
    const edge = this.edges[edgeIndex];
    if (!edge) return { x: 0, y: 0, z: 0 };
    return computeEdgeMidpoint(edge, this.vertices);
  }

  // --- Selection Operations ---

  public selectVertex(index: number, selected: boolean = true): void {
    if (this.vertices[index]) {
      this.vertices[index].selected = selected;
    }
  }

  public selectEdge(index: number, selected: boolean = true): void {
    if (this.edges[index]) {
      this.edges[index].selected = selected;
    }
  }

  public selectFace(index: number, selected: boolean = true): void {
    if (this.faces[index]) {
      this.faces[index].selected = selected;
    }
  }

  public getSelectedVertices(): VertexData[] {
    return this.vertices.filter((v) => v.selected);
  }

  public getSelectedEdges(): EdgeData[] {
    return this.edges.filter((e) => e.selected);
  }

  public getSelectedFaces(): FaceData[] {
    return this.faces.filter((f) => f.selected);
  }

  public getSelectedVertexIndices(): number[] {
    return this.getSelectedVertices().map((v) => v.index);
  }

  public getSelectedEdgeIndices(): number[] {
    return this.getSelectedEdges().map((e) => e.index);
  }

  public getSelectedFaceIndices(): number[] {
    return this.getSelectedFaces().map((f) => f.index);
  }

  public selectAll(mode?: EditElementMode): void {
    if (!mode || mode === 'vertex') {
      this.vertices.forEach((v) => (v.selected = true));
    }
    if (!mode || mode === 'edge') {
      this.edges.forEach((e) => (e.selected = true));
    }
    if (!mode || mode === 'face') {
      this.faces.forEach((f) => (f.selected = true));
    }
  }

  public deselectAll(mode?: EditElementMode): void {
    if (!mode || mode === 'vertex') {
      this.vertices.forEach((v) => (v.selected = false));
    }
    if (!mode || mode === 'edge') {
      this.edges.forEach((e) => (e.selected = false));
    }
    if (!mode || mode === 'face') {
      this.faces.forEach((f) => (f.selected = false));
    }
  }

  public invertSelection(mode?: EditElementMode): void {
    if (!mode || mode === 'vertex') {
      this.vertices.forEach((v) => (v.selected = !v.selected));
    }
    if (!mode || mode === 'edge') {
      this.edges.forEach((e) => (e.selected = !e.selected));
    }
    if (!mode || mode === 'face') {
      this.faces.forEach((f) => (f.selected = !f.selected));
    }
  }

  public setSelection(mode: EditElementMode, indices: number[]): void {
    this.deselectAll(mode);
    const set = new Set(indices);
    if (mode === 'vertex') {
      this.vertices.forEach((v) => (v.selected = set.has(v.index)));
    } else if (mode === 'edge') {
      this.edges.forEach((e) => (e.selected = set.has(e.index)));
    } else if (mode === 'face') {
      this.faces.forEach((f) => (f.selected = set.has(f.index)));
    }
  }

  public getSelection(mode: EditElementMode): number[] {
    switch (mode) {
      case 'vertex':
        return this.getSelectedVertexIndices();
      case 'edge':
        return this.getSelectedEdgeIndices();
      case 'face':
        return this.getSelectedFaceIndices();
    }
  }

  public clearSelection(): void {
    this.deselectAll();
  }

  // --- Transformation Operations ---

  public translateVertices(vertexIndices: number[], delta: Vector3): void {
    for (const idx of vertexIndices) {
      const v = this.vertices[idx];
      if (v) {
        v.position.x += delta.x;
        v.position.y += delta.y;
        v.position.z += delta.z;
      }
    }
    this.computeFaceNormals();
    this.computeVertexNormals();
  }

  public scaleVertices(vertexIndices: number[], scale: Vector3, origin?: Vector3): void {
    const center = origin ?? this.getCentroid(vertexIndices);
    for (const idx of vertexIndices) {
      const v = this.vertices[idx];
      if (v) {
        v.position.x = center.x + (v.position.x - center.x) * scale.x;
        v.position.y = center.y + (v.position.y - center.y) * scale.y;
        v.position.z = center.z + (v.position.z - center.z) * scale.z;
      }
    }
    this.computeFaceNormals();
    this.computeVertexNormals();
  }

  public rotateVertices(vertexIndices: number[], anglesRad: Vector3, origin?: Vector3): void {
    const center = origin ?? this.getCentroid(vertexIndices);
    const euler = new THREE.Euler(anglesRad.x, anglesRad.y, anglesRad.z, 'XYZ');
    const rotMatrix = new THREE.Matrix4().makeRotationFromEuler(euler);

    const temp = new THREE.Vector3();
    for (const idx of vertexIndices) {
      const v = this.vertices[idx];
      if (v) {
        temp.set(v.position.x - center.x, v.position.y - center.y, v.position.z - center.z);
        temp.applyMatrix4(rotMatrix);
        v.position.x = center.x + temp.x;
        v.position.y = center.y + temp.y;
        v.position.z = center.z + temp.z;
      }
    }
    this.computeFaceNormals();
    this.computeVertexNormals();
  }

  public transformVertices(
    vertexIndices: number[],
    transform: {
      translation?: Vector3;
      rotation?: Vector3;
      scale?: Vector3;
      origin?: Vector3;
    },
  ): void {
    if (transform.scale) {
      this.scaleVertices(vertexIndices, transform.scale, transform.origin);
    }
    if (transform.rotation) {
      this.rotateVertices(vertexIndices, transform.rotation, transform.origin);
    }
    if (transform.translation) {
      this.translateVertices(vertexIndices, transform.translation);
    }
  }

  public getCentroid(vertexIndices?: number[]): Vector3 {
    const targets = vertexIndices ?? this.getSelectedVertexIndices();
    return computeFaceCentroid(
      targets.length > 0 ? targets : this.vertices.map((v) => v.index),
      this.vertices,
    );
  }

  // --- Core & Advanced Modeling Operations ---

  // Face Extrusion
  public extrudeFace(
    faceIndex: number,
    distance: number,
    customDirection?: Vector3,
  ): { newFaceIndices: number[]; newVertexIndices: number[] } {
    const result = extrudeFacesRegion(
      this.vertices,
      this.edges,
      this.faces,
      [faceIndex],
      distance,
      customDirection,
    );
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
    return {
      newFaceIndices: result.newFaceIndices,
      newVertexIndices: result.newVertexIndices,
    };
  }

  public extrudeFacesRegion(
    faceIndices: number[],
    distance: number,
    customDirection?: Vector3,
  ): { newFaceIndices: number[]; newVertexIndices: number[] } {
    const result = extrudeFacesRegion(
      this.vertices,
      this.edges,
      this.faces,
      faceIndices,
      distance,
      customDirection,
    );
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
    return {
      newFaceIndices: result.newFaceIndices,
      newVertexIndices: result.newVertexIndices,
    };
  }

  public extrudeFacesIndividual(
    faceIndices: number[],
    distance: number,
    customDirection?: Vector3,
  ): { newFaceIndices: number[]; newVertexIndices: number[] } {
    const result = extrudeFacesIndividual(
      this.vertices,
      this.edges,
      this.faces,
      faceIndices,
      distance,
      customDirection,
    );
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
    return {
      newFaceIndices: result.newFaceIndices,
      newVertexIndices: result.newVertexIndices,
    };
  }

  public extrudeSelectedFaces(
    distance: number,
    options?: { individual?: boolean; direction?: Vector3 },
  ): { newFaceIndices: number[]; newVertexIndices: number[] } {
    const selectedFaces = this.getSelectedFaceIndices();
    if (options?.individual) {
      return this.extrudeFacesIndividual(selectedFaces, distance, options?.direction);
    }
    return this.extrudeFacesRegion(selectedFaces, distance, options?.direction);
  }

  // Face Inset
  public insetFaces(
    faceIndices?: number[],
    thickness: number = 0.2,
    depth: number = 0,
    individual: boolean = true,
  ): { newFaceIndices: number[]; newVertexIndices: number[] } {
    const targets = faceIndices ?? this.getSelectedFaceIndices();
    const result = insetFaces(
      this.vertices,
      this.edges,
      this.faces,
      targets,
      thickness,
      depth,
      individual,
    );
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
    return {
      newFaceIndices: result.newFaceIndices,
      newVertexIndices: result.newVertexIndices,
    };
  }

  // Bevel
  public bevelEdges(
    edgeIndices?: number[],
    width: number = 0.2,
    segments: number = 1,
  ): { newFaceIndices: number[]; newVertexIndices: number[] } {
    const targets = edgeIndices ?? this.getSelectedEdgeIndices();
    const result = bevelElements(
      this.vertices,
      this.edges,
      this.faces,
      targets,
      'edge',
      width,
      segments,
    );
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
    return {
      newFaceIndices: result.newFaceIndices,
      newVertexIndices: result.newVertexIndices,
    };
  }

  public bevelVertices(
    vertexIndices?: number[],
    width: number = 0.2,
    segments: number = 1,
  ): { newFaceIndices: number[]; newVertexIndices: number[] } {
    const targets = vertexIndices ?? this.getSelectedVertexIndices();
    const result = bevelElements(
      this.vertices,
      this.edges,
      this.faces,
      targets,
      'vertex',
      width,
      segments,
    );
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
    return {
      newFaceIndices: result.newFaceIndices,
      newVertexIndices: result.newVertexIndices,
    };
  }

  // Triangulation & Normals
  public triangulateFaces(faceIndices?: number[]): { newFaceIndices: number[] } {
    const result = triangulateFaces(this.vertices, this.edges, this.faces, faceIndices);
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
    return { newFaceIndices: result.newFaceIndices };
  }

  public flipNormals(faceIndices?: number[]): void {
    const targets = faceIndices ?? this.getSelectedFaceIndices();
    flipNormals(this.faces, targets.length > 0 ? targets : undefined);
    this.computeFaceNormals();
    this.computeVertexNormals();
  }

  // Face Deletion & Dissolve
  public deleteFaces(faceIndices?: number[], deleteUnreferencedVertices: boolean = true): void {
    const targets = faceIndices ?? this.getSelectedFaceIndices();
    const result = deleteFaces(
      this.vertices,
      this.edges,
      this.faces,
      targets,
      deleteUnreferencedVertices,
    );
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
  }

  public dissolveFaces(faceIndices?: number[]): void {
    const targets = faceIndices ?? this.getSelectedFaceIndices();
    const result = dissolveFaces(this.vertices, this.edges, this.faces, targets);
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
  }

  // Boundary Fill & Bridge
  public fillBoundaryLoop(loopVertexIndices: number[]): number {
    const result = fillBoundaryLoop(this.vertices, this.edges, this.faces, loopVertexIndices);
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
    return result.newFaceIndices[0] ?? -1;
  }

  public bridgeEdgeLoops(loopA: number[], loopB: number[]): number[] {
    const result = bridgeEdgeLoops(this.vertices, this.edges, this.faces, loopA, loopB);
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
    return result.newFaceIndices;
  }

  // Vertex Operations
  public mergeVerticesAtCenter(vertexIndices?: number[]): void {
    const targets = vertexIndices ?? this.getSelectedVertexIndices();
    const result = mergeVerticesAtCenter(this.vertices, this.edges, this.faces, targets);
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
  }

  public mergeVerticesByDistance(distanceThreshold: number, vertexIndices?: number[]): void {
    const targets = vertexIndices ?? this.getSelectedVertexIndices();
    const result = mergeVerticesByDistance(
      this.vertices,
      this.edges,
      this.faces,
      distanceThreshold,
      targets.length > 0 ? targets : undefined,
    );
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
  }

  public smoothVertices(
    vertexIndices?: number[],
    factor: number = 0.5,
    iterations: number = 1,
  ): void {
    const targets = vertexIndices ?? this.getSelectedVertexIndices();
    this.vertices = smoothVertices(this.vertices, this.edges, targets, factor, iterations);
    this.computeFaceNormals();
    this.computeVertexNormals();
  }

  public dissolveVertices(vertexIndices?: number[]): void {
    const targets = vertexIndices ?? this.getSelectedVertexIndices();
    const result = dissolveVertices(this.vertices, this.edges, this.faces, targets);
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
  }

  public deleteVertices(vertexIndices?: number[]): void {
    const targets = vertexIndices ?? this.getSelectedVertexIndices();
    const result = deleteVertices(this.vertices, this.edges, this.faces, targets);
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
  }

  public slideVertex(vertexIndex: number, targetEdgeIndex: number, factor: number): void {
    const edge = this.edges[targetEdgeIndex];
    if (edge) {
      slideVertex(this.vertices, vertexIndex, edge, factor);
      this.computeFaceNormals();
      this.computeVertexNormals();
    }
  }

  // Edge Operations
  public createEdge(v1: number, v2: number): EdgeData {
    const result = createEdgeBetweenVertices(this.edges, v1, v2);
    return result.edge;
  }

  public subdivideEdges(edgeIndices?: number[], cuts: number = 1): void {
    const targets = edgeIndices ?? this.getSelectedEdgeIndices();
    const result = subdivideEdges(this.vertices, this.edges, this.faces, targets, cuts);
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
  }

  public subdivide(iterations: number = 1): void {
    for (let iter = 0; iter < iterations; iter++) {
      const midpointMap = new Map<string, number>();

      const getOrAddMidpoint = (v1: number, v2: number): number => {
        const minV = Math.min(v1, v2);
        const maxV = Math.max(v1, v2);
        const key = `${minV}_${maxV}`;
        const existing = midpointMap.get(key);
        if (existing !== undefined) {
          return existing;
        }

        const pA = this.vertices[minV].position;
        const pB = this.vertices[maxV].position;
        const uvA = this.vertices[minV].uv;
        const uvB = this.vertices[maxV].uv;

        const newIndex = this.vertices.length;
        const newVertex: VertexData = {
          index: newIndex,
          position: {
            x: (pA.x + pB.x) * 0.5,
            y: (pA.y + pB.y) * 0.5,
            z: (pA.z + pB.z) * 0.5,
          },
          uv: uvA && uvB ? [(uvA[0] + uvB[0]) * 0.5, (uvA[1] + uvB[1]) * 0.5] : undefined,
          selected: false,
        };
        this.vertices.push(newVertex);
        midpointMap.set(key, newIndex);
        return newIndex;
      };

      const newFaces: FaceData[] = [];

      for (const face of this.faces) {
        const vi = face.vertexIndices;
        if (vi.length === 3) {
          const v0 = vi[0];
          const v1 = vi[1];
          const v2 = vi[2];

          const m01 = getOrAddMidpoint(v0, v1);
          const m12 = getOrAddMidpoint(v1, v2);
          const m20 = getOrAddMidpoint(v2, v0);

          newFaces.push(
            { index: newFaces.length, vertexIndices: [v0, m01, m20], selected: face.selected },
            { index: newFaces.length + 1, vertexIndices: [m01, v1, m12], selected: face.selected },
            { index: newFaces.length + 2, vertexIndices: [m20, m12, v2], selected: face.selected },
            { index: newFaces.length + 3, vertexIndices: [m01, m12, m20], selected: face.selected },
          );
        } else if (vi.length === 4) {
          const v0 = vi[0];
          const v1 = vi[1];
          const v2 = vi[2];
          const v3 = vi[3];

          const m01 = getOrAddMidpoint(v0, v1);
          const m12 = getOrAddMidpoint(v1, v2);
          const m20 = getOrAddMidpoint(v2, v0);
          newFaces.push(
            { index: newFaces.length, vertexIndices: [v0, m01, m20], selected: face.selected },
            { index: newFaces.length + 1, vertexIndices: [m01, v1, m12], selected: face.selected },
            { index: newFaces.length + 2, vertexIndices: [m20, m12, v2], selected: face.selected },
            { index: newFaces.length + 3, vertexIndices: [m01, m12, m20], selected: face.selected },
          );

          const m23 = getOrAddMidpoint(v2, v3);
          const m30 = getOrAddMidpoint(v3, v0);
          newFaces.push(
            { index: newFaces.length, vertexIndices: [v0, m20, m30], selected: face.selected },
            { index: newFaces.length + 1, vertexIndices: [m20, v2, m23], selected: face.selected },
            { index: newFaces.length + 2, vertexIndices: [m30, m23, v3], selected: face.selected },
            { index: newFaces.length + 3, vertexIndices: [m20, m23, m30], selected: face.selected },
          );
        } else {
          newFaces.push({ ...face, index: newFaces.length });
        }
      }

      this.faces = newFaces;
      this.rebuildEdges();
      this.computeFaceNormals();
      this.computeVertexNormals();
    }
  }

  public dissolveEdges(edgeIndices?: number[]): void {
    const targets = edgeIndices ?? this.getSelectedEdgeIndices();
    const result = dissolveEdges(this.vertices, this.edges, this.faces, targets);
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
  }

  public deleteEdges(edgeIndices?: number[], deleteFacesOnly: boolean = false): void {
    const targets = edgeIndices ?? this.getSelectedEdgeIndices();
    const result = deleteEdges(this.vertices, this.edges, this.faces, targets, deleteFacesOnly);
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
  }

  public getEdgeLoop(startEdgeIndex: number): number[] {
    return getEdgeLoop(this.edges, this.faces, startEdgeIndex);
  }

  public getEdgeRing(startEdgeIndex: number): number[] {
    return getEdgeRing(this.edges, this.faces, startEdgeIndex);
  }

  public slideEdge(edgeIndices?: number[], factor: number = 0.5): void {
    const targets = edgeIndices ?? this.getSelectedEdgeIndices();
    slideEdge(this.vertices, this.edges, this.faces, targets, factor);
    this.computeFaceNormals();
    this.computeVertexNormals();
  }

  // Topology Tools
  public loopCut(
    startEdgeIndex: number,
    factor: number = 0.5,
    cuts: number = 1,
  ): { newFaceIndices: number[]; newVertexIndices: number[] } {
    const result = loopCut(this.vertices, this.edges, this.faces, startEdgeIndex, factor, cuts);
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
    return {
      newFaceIndices: result.newFaceIndices,
      newVertexIndices: result.newVertexIndices,
    };
  }

  public knifeSplitEdge(edgeIndex: number, factor: number = 0.5): number {
    const result = knifeSplitEdge(this.vertices, this.edges, this.faces, edgeIndex, factor);
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
    return result.newVertexIndices[0] ?? -1;
  }

  public knifeSplitFace(faceIndex: number, v1: number, v2: number): number[] {
    const result = knifeSplitFace(this.vertices, this.edges, this.faces, faceIndex, v1, v2);
    this.vertices = result.vertices;
    this.edges = result.edges;
    this.faces = result.faces;
    this.computeFaceNormals();
    this.computeVertexNormals();
    return result.newFaceIndices;
  }

  /**
   * Clones current topology deep copy
   */
  public clone(): MeshTopology {
    const verts: VertexData[] = this.vertices.map((v) => ({
      index: v.index,
      position: { ...v.position },
      normal: v.normal ? { ...v.normal } : undefined,
      uv: v.uv ? [v.uv[0], v.uv[1]] : undefined,
      selected: v.selected,
    }));

    const edges: EdgeData[] = this.edges.map((e) => ({
      index: e.index,
      v1: e.v1,
      v2: e.v2,
      selected: e.selected,
    }));

    const faces: FaceData[] = this.faces.map((f) => ({
      index: f.index,
      vertexIndices: [...f.vertexIndices],
      edgeIndices: f.edgeIndices ? [...f.edgeIndices] : undefined,
      normal: f.normal ? { ...f.normal } : undefined,
      selected: f.selected,
    }));

    return new MeshTopology(verts, edges, faces);
  }
}

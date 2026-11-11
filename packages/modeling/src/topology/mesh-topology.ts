import * as THREE from 'three';
import type {
  IMeshData,
  VertexData,
  EdgeData,
  FaceData,
  EditElementMode,
  Vector3,
} from '@blender-elt/contracts';

/**
 * Robust Mesh Topology data structure for editing and geometry queries
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

    const topology = new MeshTopology(vertices, Array.from(edgeMap.values()), faces);

    return topology;
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
   * Computes face normals from vertex positions
   */
  public computeFaceNormals(): void {
    this.faceNormals = new Array(this.faces.length);

    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const vC = new THREE.Vector3();
    const cb = new THREE.Vector3();
    const ab = new THREE.Vector3();

    for (let i = 0; i < this.faces.length; i++) {
      const face = this.faces[i];
      const vi = face.vertexIndices;
      if (vi.length >= 3) {
        const p0 = this.vertices[vi[0]]?.position;
        const p1 = this.vertices[vi[1]]?.position;
        const p2 = this.vertices[vi[2]]?.position;

        if (p0 && p1 && p2) {
          vA.set(p0.x, p0.y, p0.z);
          vB.set(p1.x, p1.y, p1.z);
          vC.set(p2.x, p2.y, p2.z);

          cb.subVectors(vC, vB);
          ab.subVectors(vA, vB);
          cb.cross(ab);

          if (cb.lengthSq() > 0) {
            cb.normalize();
          } else {
            cb.set(0, 1, 0);
          }

          const normal: Vector3 = { x: cb.x, y: cb.y, z: cb.z };
          face.normal = normal;
          this.faceNormals[i] = normal;
          continue;
        }
      }

      const defaultNorm: Vector3 = { x: 0, y: 1, z: 0 };
      face.normal = defaultNorm;
      this.faceNormals[i] = defaultNorm;
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

    for (const face of this.faces) {
      const vi = face.vertexIndices;
      const edgeIndices: number[] = [];
      const count = vi.length;
      for (let i = 0; i < count; i++) {
        const next = (i + 1) % count;
        edgeIndices.push(getOrAddEdge(vi[i], vi[next]));
      }
      face.edgeIndices = edgeIndices;
    }

    this.edges = Array.from(edgeMap.values());
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

  /**
   * Applies translation to specified vertices
   */
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

  /**
   * Scales specified vertices relative to an origin (default: center of selected vertices)
   */
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

  /**
   * Rotates specified vertices by Euler angles (in radians) about an origin
   */
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

  /**
   * General transform on vertex group
   */
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

  /**
   * Computes the geometric centroid of specified vertices
   */
  public getCentroid(vertexIndices: number[]): Vector3 {
    if (vertexIndices.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let count = 0;
    for (const idx of vertexIndices) {
      const v = this.vertices[idx];
      if (v) {
        sx += v.position.x;
        sy += v.position.y;
        sz += v.position.z;
        count++;
      }
    }
    if (count === 0) return { x: 0, y: 0, z: 0 };
    return { x: sx / count, y: sy / count, z: sz / count };
  }

  // --- Edit Mode Operations: Extrude & Subdivide ---

  /**
   * Extrudes a single face along its normal (or custom direction) by a given distance
   */
  public extrudeFace(
    faceIndex: number,
    distance: number,
    customDirection?: Vector3,
  ): { newFaceIndices: number[]; newVertexIndices: number[] } {
    const face = this.faces[faceIndex];
    if (!face) {
      return { newFaceIndices: [], newVertexIndices: [] };
    }

    const normal = customDirection ?? face.normal ?? { x: 0, y: 1, z: 0 };

    const offset: Vector3 = {
      x: normal.x * distance,
      y: normal.y * distance,
      z: normal.z * distance,
    };

    const origVertices = [...face.vertexIndices];
    const newVertexIndices: number[] = [];

    // Create duplicate extruded vertices
    for (const vi of origVertices) {
      const v = this.vertices[vi];
      const newIndex = this.vertices.length;
      this.vertices.push({
        index: newIndex,
        position: {
          x: v.position.x + offset.x,
          y: v.position.y + offset.y,
          z: v.position.z + offset.z,
        },
        normal: { ...normal },
        uv: v.uv ? [...v.uv] : undefined,
        selected: true,
      });
      newVertexIndices.push(newIndex);
    }

    // Replace original face's vertices with the top extruded vertices
    face.vertexIndices = [...newVertexIndices];
    face.selected = true;

    const newFaceIndices: number[] = [face.index];

    // For each perimeter edge of the face, build side quad (two triangles)
    const count = origVertices.length;
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      const v0 = origVertices[i];
      const v1 = origVertices[next];
      const nv0 = newVertexIndices[i];
      const nv1 = newVertexIndices[next];

      // Side quad consists of [v0, v1, nv1, nv0]
      // Triangulated into [v0, v1, nv1] and [v0, nv1, nv0]
      const sideFace1: FaceData = {
        index: this.faces.length,
        vertexIndices: [v0, v1, nv1],
        selected: false,
      };
      this.faces.push(sideFace1);
      newFaceIndices.push(sideFace1.index);

      const sideFace2: FaceData = {
        index: this.faces.length,
        vertexIndices: [v0, nv1, nv0],
        selected: false,
      };
      this.faces.push(sideFace2);
      newFaceIndices.push(sideFace2.index);
    }

    this.rebuildEdges();
    this.computeFaceNormals();
    this.computeVertexNormals();

    return {
      newFaceIndices,
      newVertexIndices,
    };
  }

  /**
   * Extrudes all currently selected faces
   */
  public extrudeSelectedFaces(distance: number): {
    newFaceIndices: number[];
    newVertexIndices: number[];
  } {
    const selectedFaceIndices = this.getSelectedFaceIndices();
    const resultNewFaces: number[] = [];
    const resultNewVerts: number[] = [];

    for (const fIdx of selectedFaceIndices) {
      const { newFaceIndices, newVertexIndices } = this.extrudeFace(fIdx, distance);
      resultNewFaces.push(...newFaceIndices);
      resultNewVerts.push(...newVertexIndices);
    }

    return {
      newFaceIndices: resultNewFaces,
      newVertexIndices: resultNewVerts,
    };
  }

  /**
   * Subdivides the mesh by splitting each triangle face into 4 smaller triangles
   */
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
          // Quad face: split into 4 quads or triangulate then split
          const v0 = vi[0];
          const v1 = vi[1];
          const v2 = vi[2];
          const v3 = vi[3];

          // Subdivide as two triangles
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
          // Pass-through if unsupported n-gon
          newFaces.push({ ...face, index: newFaces.length });
        }
      }

      this.faces = newFaces;
      this.rebuildEdges();
      this.computeFaceNormals();
      this.computeVertexNormals();
    }
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

import * as THREE from 'three';
import type { IMeshData } from '@blender-elt/contracts';

/**
 * Contiguous typed array buffer representation of a sculptable mesh.
 * Eliminates object allocation overhead during high-frequency sculpt strokes.
 */
export class SculptMeshBuffer {
  public positions: Float32Array;
  public normals: Float32Array;
  public masks: Float32Array;
  public indices: Uint32Array | null;
  public vertexCount: number;
  public triangleCount: number;

  // Dirty tracking for incremental GPU buffer uploads and sparse undo/redo
  private dirtyIndicesSet: Set<number> = new Set();
  public dirtyMinIndex: number = Infinity;
  public dirtyMaxIndex: number = -1;

  constructor(
    positions: Float32Array,
    normals?: Float32Array | null,
    masks?: Float32Array | null,
    indices?: Uint32Array | null,
  ) {
    this.positions = positions;
    this.vertexCount = Math.floor(positions.length / 3);

    if (normals && normals.length === positions.length) {
      this.normals = normals;
    } else {
      this.normals = new Float32Array(positions.length);
      // Default to +Y if uninitialized
      for (let i = 0; i < this.vertexCount; i++) {
        this.normals[i * 3 + 1] = 1.0;
      }
    }

    if (masks && masks.length === this.vertexCount) {
      this.masks = masks;
    } else {
      this.masks = new Float32Array(this.vertexCount);
    }

    this.indices = indices ?? null;
    this.triangleCount = this.indices
      ? Math.floor(this.indices.length / 3)
      : Math.floor(this.vertexCount / 3);
  }

  public static fromMeshData(meshData: IMeshData): SculptMeshBuffer {
    const positions =
      meshData.vertices instanceof Float32Array
        ? new Float32Array(meshData.vertices)
        : new Float32Array(meshData.vertices);

    let normals: Float32Array | null = null;
    if (meshData.normals && meshData.normals.length === positions.length) {
      normals =
        meshData.normals instanceof Float32Array
          ? new Float32Array(meshData.normals)
          : new Float32Array(meshData.normals);
    }

    let indices: Uint32Array | null = null;
    if (meshData.indices && meshData.indices.length > 0) {
      indices =
        meshData.indices instanceof Uint32Array
          ? new Uint32Array(meshData.indices)
          : new Uint32Array(meshData.indices);
    }

    const buffer = new SculptMeshBuffer(positions, normals, null, indices);
    if (!normals) {
      buffer.computeVertexNormals();
    }
    return buffer;
  }

  public static fromBufferGeometry(geometry: THREE.BufferGeometry): SculptMeshBuffer {
    const posAttr = geometry.getAttribute('position');
    if (!posAttr) {
      throw new Error('BufferGeometry must have a position attribute to create SculptMeshBuffer');
    }

    const positions = new Float32Array(posAttr.array);
    const normAttr = geometry.getAttribute('normal');
    const normals = normAttr ? new Float32Array(normAttr.array) : null;

    let indices: Uint32Array | null = null;
    if (geometry.index) {
      indices = new Uint32Array(geometry.index.array);
    }

    const buffer = new SculptMeshBuffer(positions, normals, null, indices);
    if (!normals) {
      buffer.computeVertexNormals();
    }
    return buffer;
  }

  public getVertex(index: number, out?: THREE.Vector3): THREE.Vector3 {
    const v = out || new THREE.Vector3();
    const idx = index * 3;
    return v.set(this.positions[idx], this.positions[idx + 1], this.positions[idx + 2]);
  }

  public setVertex(index: number, x: number, y: number, z: number): void {
    const idx = index * 3;
    this.positions[idx] = x;
    this.positions[idx + 1] = y;
    this.positions[idx + 2] = z;
    this.markDirty(index);
  }

  public getNormal(index: number, out?: THREE.Vector3): THREE.Vector3 {
    const v = out || new THREE.Vector3();
    const idx = index * 3;
    return v.set(this.normals[idx], this.normals[idx + 1], this.normals[idx + 2]);
  }

  public setNormal(index: number, nx: number, ny: number, nz: number): void {
    const idx = index * 3;
    this.normals[idx] = nx;
    this.normals[idx + 1] = ny;
    this.normals[idx + 2] = nz;
  }

  public getMask(index: number): number {
    return this.masks[index] ?? 0.0;
  }

  public setMask(index: number, weight: number): void {
    const clamped = Math.max(0.0, Math.min(1.0, weight));
    this.masks[index] = clamped;
    this.markDirty(index);
  }

  public markDirty(index: number): void {
    this.dirtyIndicesSet.add(index);
    if (index < this.dirtyMinIndex) this.dirtyMinIndex = index;
    if (index > this.dirtyMaxIndex) this.dirtyMaxIndex = index;
  }

  public getDirtyIndices(): number[] {
    return Array.from(this.dirtyIndicesSet);
  }

  public clearDirty(): void {
    this.dirtyIndicesSet.clear();
    this.dirtyMinIndex = Infinity;
    this.dirtyMaxIndex = -1;
  }

  public hasDirty(): boolean {
    return this.dirtyIndicesSet.size > 0;
  }

  public computeBoundingBox(targetBox?: THREE.Box3): THREE.Box3 {
    const box = targetBox || new THREE.Box3();
    box.makeEmpty();
    const v = new THREE.Vector3();
    for (let i = 0; i < this.vertexCount; i++) {
      this.getVertex(i, v);
      box.expandByPoint(v);
    }
    return box;
  }

  public computeVertexNormals(): void {
    // Clear normals
    this.normals.fill(0);
    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const vC = new THREE.Vector3();
    const cb = new THREE.Vector3();
    const ab = new THREE.Vector3();

    if (this.indices) {
      for (let i = 0; i < this.indices.length; i += 3) {
        const iA = this.indices[i];
        const iB = this.indices[i + 1];
        const iC = this.indices[i + 2];

        this.getVertex(iA, vA);
        this.getVertex(iB, vB);
        this.getVertex(iC, vC);

        cb.subVectors(vC, vB);
        ab.subVectors(vA, vB);
        cb.cross(ab); // normal = (vC - vB) x (vA - vB)

        this.normals[iA * 3] += cb.x;
        this.normals[iA * 3 + 1] += cb.y;
        this.normals[iA * 3 + 2] += cb.z;

        this.normals[iB * 3] += cb.x;
        this.normals[iB * 3 + 1] += cb.y;
        this.normals[iB * 3 + 2] += cb.z;

        this.normals[iC * 3] += cb.x;
        this.normals[iC * 3 + 1] += cb.y;
        this.normals[iC * 3 + 2] += cb.z;
      }
    } else {
      for (let i = 0; i < this.vertexCount; i += 3) {
        this.getVertex(i, vA);
        this.getVertex(i + 1, vB);
        this.getVertex(i + 2, vC);

        cb.subVectors(vC, vB);
        ab.subVectors(vA, vB);
        cb.cross(ab);

        for (let j = 0; j < 3; j++) {
          const idx = (i + j) * 3;
          this.normals[idx] = cb.x;
          this.normals[idx + 1] = cb.y;
          this.normals[idx + 2] = cb.z;
        }
      }
    }

    // Normalize
    const n = new THREE.Vector3();
    for (let i = 0; i < this.vertexCount; i++) {
      this.getNormal(i, n);
      if (n.lengthSq() > 1e-8) {
        n.normalize();
        this.setNormal(i, n.x, n.y, n.z);
      } else {
        this.setNormal(i, 0, 1, 0);
      }
    }
  }

  public toMeshData(): IMeshData {
    return {
      vertices: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      indices: this.indices ? new Uint32Array(this.indices) : undefined,
    };
  }

  public clone(): SculptMeshBuffer {
    const newPos = new Float32Array(this.positions);
    const newNorm = new Float32Array(this.normals);
    const newMask = new Float32Array(this.masks);
    const newIndices = this.indices ? new Uint32Array(this.indices) : null;
    return new SculptMeshBuffer(newPos, newNorm, newMask, newIndices);
  }
}

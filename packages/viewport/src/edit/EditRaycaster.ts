import * as THREE from 'three';
import type { MeshTopology } from '@blender-elt/modeling';
import type { EditElementMode, EditRaycastHit, Vector3 } from './types.js';

export interface PickOptions {
  vertexRadiusPixels?: number;
  edgeThresholdPixels?: number;
}

export interface BoxSelectResult {
  vertexIndices: number[];
  edgeIndices: number[];
  faceIndices: number[];
}

export interface DomRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * EditRaycaster
 * Provides accurate screen-space and 3D raycasting for sub-element picking
 * (vertices, edges, faces) and screen-space box marquee selection in Edit Mode.
 */
export class EditRaycaster {
  private readonly raycaster: THREE.Raycaster;
  private readonly ndcCoords: THREE.Vector2;
  private readonly tempVec3A: THREE.Vector3;
  private readonly tempProjA: THREE.Vector3;
  private readonly tempNormal: THREE.Vector3;
  private readonly normalMatrix: THREE.Matrix3;
  private readonly inverseMatrix: THREE.Matrix4;

  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true;
    this.ndcCoords = new THREE.Vector2();
    this.tempVec3A = new THREE.Vector3();
    this.tempProjA = new THREE.Vector3();
    this.tempNormal = new THREE.Vector3();
    this.normalMatrix = new THREE.Matrix3();
    this.inverseMatrix = new THREE.Matrix4();
  }

  /**
   * Converts client DOM coordinates to Normalized Device Coordinates (NDC) [-1, 1]
   */
  public clientToNDC(
    clientX: number,
    clientY: number,
    rect: DomRectLike,
  ): { x: number; y: number } {
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return { x, y };
  }

  /**
   * Projects a local vertex position into 2D element screen pixels and NDC z depth
   */
  public projectLocalPoint(
    localPos: Vector3,
    mesh: THREE.Mesh,
    camera: THREE.Camera,
    rect: DomRectLike,
  ): { screenX: number; screenY: number; depth: number; isBehind: boolean } {
    this.tempVec3A.set(localPos.x, localPos.y, localPos.z);
    this.tempVec3A.applyMatrix4(mesh.matrixWorld);
    this.tempProjA.copy(this.tempVec3A).project(camera);

    // Behind camera or clipped outside frustum near/far
    const isBehind = this.tempProjA.z > 1.0 || this.tempProjA.z < -1.0;

    const screenX = ((this.tempProjA.x + 1) / 2) * rect.width;
    const screenY = ((-this.tempProjA.y + 1) / 2) * rect.height;

    return {
      screenX,
      screenY,
      depth: this.tempProjA.z,
      isBehind,
    };
  }

  /**
   * Pick vertex under cursor within pixel radius tolerance
   */
  public pickVertex(
    mesh: THREE.Mesh,
    topology: MeshTopology,
    clientX: number,
    clientY: number,
    rect: DomRectLike,
    camera: THREE.Camera,
    radiusPixels = 12,
  ): EditRaycastHit | null {
    if (!mesh.visible || topology.vertices.length === 0) return null;

    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;

    let closestHit: EditRaycastHit | null = null;
    let closestDistSq = radiusPixels * radiusPixels;
    let closestDepth = Infinity;

    const radiusSq = radiusPixels * radiusPixels;

    for (let i = 0; i < topology.vertices.length; i++) {
      const v = topology.vertices[i];
      const proj = this.projectLocalPoint(v.position, mesh, camera, rect);
      if (proj.isBehind) continue;

      const dx = proj.screenX - pointerX;
      const dy = proj.screenY - pointerY;
      const distSq = dx * dx + dy * dy;

      if (distSq <= radiusSq) {
        // Prefer closer screen distance; tie-break with depth
        if (
          distSq < closestDistSq ||
          (Math.abs(distSq - closestDistSq) < 4 && proj.depth < closestDepth)
        ) {
          closestDistSq = distSq;
          closestDepth = proj.depth;

          this.tempVec3A
            .set(v.position.x, v.position.y, v.position.z)
            .applyMatrix4(mesh.matrixWorld);

          closestHit = {
            type: 'vertex',
            elementIndex: v.index,
            distance: Math.sqrt(distSq),
            worldPoint: { x: this.tempVec3A.x, y: this.tempVec3A.y, z: this.tempVec3A.z },
            localPoint: { x: v.position.x, y: v.position.y, z: v.position.z },
            normal: v.normal,
            mesh,
          };
        }
      }
    }

    return closestHit;
  }

  /**
   * Pick edge under cursor within pixel distance threshold
   */
  public pickEdge(
    mesh: THREE.Mesh,
    topology: MeshTopology,
    clientX: number,
    clientY: number,
    rect: DomRectLike,
    camera: THREE.Camera,
    thresholdPixels = 8,
  ): EditRaycastHit | null {
    if (!mesh.visible || topology.edges.length === 0) return null;

    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;

    let closestHit: EditRaycastHit | null = null;
    let closestDist = thresholdPixels;

    for (let i = 0; i < topology.edges.length; i++) {
      const edge = topology.edges[i];
      const v1 = topology.vertices[edge.v1];
      const v2 = topology.vertices[edge.v2];
      if (!v1 || !v2) continue;

      const p1 = this.projectLocalPoint(v1.position, mesh, camera, rect);
      const p2 = this.projectLocalPoint(v2.position, mesh, camera, rect);

      // If both endpoints are behind camera, skip
      if (p1.isBehind && p2.isBehind) continue;

      // Calculate distance from point (pointerX, pointerY) to segment (p1 -> p2)
      const dist = this.pointToSegmentDistance(
        pointerX,
        pointerY,
        p1.screenX,
        p1.screenY,
        p2.screenX,
        p2.screenY,
      );

      if (dist <= closestDist) {
        closestDist = dist;

        // Midpoint in local & world space
        const midLocal: Vector3 = {
          x: (v1.position.x + v2.position.x) * 0.5,
          y: (v1.position.y + v2.position.y) * 0.5,
          z: (v1.position.z + v2.position.z) * 0.5,
        };

        this.tempVec3A.set(midLocal.x, midLocal.y, midLocal.z).applyMatrix4(mesh.matrixWorld);

        closestHit = {
          type: 'edge',
          elementIndex: edge.index,
          distance: dist,
          worldPoint: { x: this.tempVec3A.x, y: this.tempVec3A.y, z: this.tempVec3A.z },
          localPoint: midLocal,
          mesh,
        };
      }
    }

    return closestHit;
  }

  /**
   * Pick face under cursor via 3D raycasting
   */
  public pickFace(
    mesh: THREE.Mesh,
    topology: MeshTopology,
    clientX: number,
    clientY: number,
    rect: DomRectLike,
    camera: THREE.Camera,
  ): EditRaycastHit | null {
    if (!mesh.visible || topology.faces.length === 0) return null;

    const ndc = this.clientToNDC(clientX, clientY, rect);
    this.ndcCoords.set(ndc.x, ndc.y);
    this.raycaster.setFromCamera(this.ndcCoords, camera);

    const intersects = this.raycaster.intersectObject(mesh, false);
    if (intersects.length === 0) return null;

    const hit = intersects[0];
    if (hit.faceIndex === undefined || hit.faceIndex === null) return null;

    // Map triangle hit.faceIndex to topology face
    const hitFaceIndex = hit.faceIndex;
    let faceIndex: number = hitFaceIndex;
    if (faceIndex >= topology.faces.length) {
      // Find face containing triangle vertices
      const geo = mesh.geometry;
      const indexAttr = geo.getIndex();
      if (indexAttr) {
        const i0 = indexAttr.getX(hitFaceIndex * 3);
        const i1 = indexAttr.getX(hitFaceIndex * 3 + 1);
        const i2 = indexAttr.getX(hitFaceIndex * 3 + 2);
        for (let f = 0; f < topology.faces.length; f++) {
          const vis = topology.faces[f].vertexIndices;
          if (vis.includes(i0) && vis.includes(i1) && vis.includes(i2)) {
            faceIndex = f;
            break;
          }
        }
      }
      if (faceIndex >= topology.faces.length) {
        faceIndex = topology.faces.length - 1;
      }
    }

    // World hit point
    const worldPoint: Vector3 = {
      x: hit.point.x,
      y: hit.point.y,
      z: hit.point.z,
    };

    // Local hit point
    this.inverseMatrix.copy(mesh.matrixWorld).invert();
    this.tempVec3A.copy(hit.point).applyMatrix4(this.inverseMatrix);
    const localPoint: Vector3 = {
      x: this.tempVec3A.x,
      y: this.tempVec3A.y,
      z: this.tempVec3A.z,
    };

    // Normal calculation
    let worldNormal: Vector3 | undefined = undefined;
    if (hit.face) {
      this.normalMatrix.getNormalMatrix(mesh.matrixWorld);
      this.tempNormal.copy(hit.face.normal).applyMatrix3(this.normalMatrix).normalize();
      worldNormal = {
        x: this.tempNormal.x,
        y: this.tempNormal.y,
        z: this.tempNormal.z,
      };
    }

    return {
      type: 'face',
      elementIndex: faceIndex,
      distance: hit.distance,
      worldPoint,
      localPoint,
      normal: worldNormal,
      mesh,
    };
  }

  /**
   * Unified picking respecting active element selection modes
   */
  public pickElement(
    mesh: THREE.Mesh,
    topology: MeshTopology,
    clientX: number,
    clientY: number,
    rect: DomRectLike,
    camera: THREE.Camera,
    activeModes: EditElementMode[],
    options?: PickOptions,
  ): EditRaycastHit | null {
    const vRadius = options?.vertexRadiusPixels ?? 12;
    const eThreshold = options?.edgeThresholdPixels ?? 8;

    // 1. Vertex mode priority if active
    if (activeModes.includes('vertex')) {
      const vHit = this.pickVertex(mesh, topology, clientX, clientY, rect, camera, vRadius);
      if (vHit) return vHit;
    }

    // 2. Edge mode priority if active
    if (activeModes.includes('edge')) {
      const eHit = this.pickEdge(mesh, topology, clientX, clientY, rect, camera, eThreshold);
      if (eHit) return eHit;
    }

    // 3. Face mode priority if active
    if (activeModes.includes('face')) {
      const fHit = this.pickFace(mesh, topology, clientX, clientY, rect, camera);
      if (fHit) return fHit;
    }

    return null;
  }

  /**
   * Screen-space 2D box marquee selection across active element modes
   */
  public boxSelectElements(
    mesh: THREE.Mesh,
    topology: MeshTopology,
    box: { x1: number; y1: number; x2: number; y2: number },
    rect: DomRectLike,
    camera: THREE.Camera,
    activeModes: EditElementMode[],
  ): BoxSelectResult {
    const minX = Math.min(box.x1, box.x2) - rect.left;
    const maxX = Math.max(box.x1, box.x2) - rect.left;
    const minY = Math.min(box.y1, box.y2) - rect.top;
    const maxY = Math.max(box.y1, box.y2) - rect.top;

    const result: BoxSelectResult = {
      vertexIndices: [],
      edgeIndices: [],
      faceIndices: [],
    };

    // Cache projected vertex positions in screen space
    const projectedVertices: Array<{ x: number; y: number; isInside: boolean; isBehind: boolean }> =
      new Array(topology.vertices.length);

    for (let i = 0; i < topology.vertices.length; i++) {
      const v = topology.vertices[i];
      const proj = this.projectLocalPoint(v.position, mesh, camera, rect);
      const isInside =
        !proj.isBehind &&
        proj.screenX >= minX &&
        proj.screenX <= maxX &&
        proj.screenY >= minY &&
        proj.screenY <= maxY;

      projectedVertices[i] = {
        x: proj.screenX,
        y: proj.screenY,
        isInside,
        isBehind: proj.isBehind,
      };

      if (activeModes.includes('vertex') && isInside) {
        result.vertexIndices.push(v.index);
      }
    }

    // Edge selection: included if either or both endpoints fall inside the box
    if (activeModes.includes('edge')) {
      for (let i = 0; i < topology.edges.length; i++) {
        const edge = topology.edges[i];
        const p1 = projectedVertices[edge.v1];
        const p2 = projectedVertices[edge.v2];
        if (!p1 || !p2) continue;

        // If both vertices are inside or midpoint is inside
        if (
          (p1.isInside && p2.isInside) ||
          (!p1.isBehind && !p2.isBehind && (p1.isInside || p2.isInside))
        ) {
          result.edgeIndices.push(edge.index);
        } else if (!p1.isBehind && !p2.isBehind) {
          // Midpoint check
          const midX = (p1.x + p2.x) * 0.5;
          const midY = (p1.y + p2.y) * 0.5;
          if (midX >= minX && midX <= maxX && midY >= minY && midY <= maxY) {
            result.edgeIndices.push(edge.index);
          }
        }
      }
    }

    // Face selection: included if centroid or all vertices fall inside the box
    if (activeModes.includes('face')) {
      for (let i = 0; i < topology.faces.length; i++) {
        const face = topology.faces[i];
        const vis = face.vertexIndices;
        if (vis.length === 0) continue;

        let allInside = true;
        let sumX = 0;
        let sumY = 0;
        let validCount = 0;

        for (const vIdx of vis) {
          const pv = projectedVertices[vIdx];
          if (!pv || pv.isBehind) {
            allInside = false;
            break;
          }
          if (!pv.isInside) {
            allInside = false;
          }
          sumX += pv.x;
          sumY += pv.y;
          validCount++;
        }

        if (allInside) {
          result.faceIndices.push(face.index);
        } else if (validCount === vis.length) {
          const centroidX = sumX / validCount;
          const centroidY = sumY / validCount;
          if (centroidX >= minX && centroidX <= maxX && centroidY >= minY && centroidY <= maxY) {
            result.faceIndices.push(face.index);
          }
        }
      }
    }

    return result;
  }

  /**
   * Distance from 2D point (px, py) to line segment (x1, y1) - (x2, y2)
   */
  private pointToSegmentDistance(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): number {
    const vx = x2 - x1;
    const vy = y2 - y1;
    const lenSq = vx * vx + vy * vy;

    if (lenSq < 1e-6) {
      const dx = px - x1;
      const dy = py - y1;
      return Math.sqrt(dx * dx + dy * dy);
    }

    const wx = px - x1;
    const wy = py - y1;
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq));

    const projX = x1 + t * vx;
    const projY = y1 + t * vy;

    const dx = px - projX;
    const dy = py - projY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

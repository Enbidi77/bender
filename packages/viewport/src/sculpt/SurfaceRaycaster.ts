import * as THREE from 'three';
import type { SculptHitTestResult, Vector3 } from '@blender-elt/contracts';

/**
 * Detailed hit test result including Three.js specific references and local space conversions
 */
export interface DetailedHitResult extends SculptHitTestResult {
  object: THREE.Mesh;
  localPoint: Vector3;
  localNormal: Vector3;
  uv?: { u: number; v: number };
}

/**
 * SurfaceRaycaster
 * Efficient mesh surface raycasting to determine hit point, surface normal, and target mesh.
 * Reuses internal Raycaster and Vector instances to prevent GC pressure during high-frequency pointermove events.
 */
export class SurfaceRaycaster {
  private readonly raycaster: THREE.Raycaster;
  private readonly ndcCoords: THREE.Vector2;
  private readonly tempWorldNormal: THREE.Vector3;
  private readonly tempLocalPoint: THREE.Vector3;
  private readonly tempLocalNormal: THREE.Vector3;
  private readonly inverseMatrix: THREE.Matrix4;
  private readonly normalMatrix: THREE.Matrix3;

  constructor() {
    this.raycaster = new THREE.Raycaster();
    // Optimize raycaster settings for sculpting
    this.raycaster.firstHitOnly = true;
    this.ndcCoords = new THREE.Vector2();
    this.tempWorldNormal = new THREE.Vector3();
    this.tempLocalPoint = new THREE.Vector3();
    this.tempLocalNormal = new THREE.Vector3();
    this.inverseMatrix = new THREE.Matrix4();
    this.normalMatrix = new THREE.Matrix3();
  }

  /**
   * Convert DOM client coordinates to Normalized Device Coordinates (NDC) [-1, 1]
   */
  public clientToNDC(
    clientX: number,
    clientY: number,
    rect: { left: number; top: number; width: number; height: number },
  ): { x: number; y: number } {
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return { x, y };
  }

  /**
   * Raycast against a single mesh from Normalized Device Coordinates
   */
  public raycastFromNDC(
    mesh: THREE.Mesh,
    ndcX: number,
    ndcY: number,
    camera: THREE.Camera,
  ): DetailedHitResult | null {
    this.ndcCoords.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndcCoords, camera);
    return this.intersectMesh(mesh);
  }

  /**
   * Raycast against a mesh from DOM pointer event coordinates
   */
  public raycastFromPointer(
    mesh: THREE.Mesh,
    clientX: number,
    clientY: number,
    domRect: DOMRect | { left: number; top: number; width: number; height: number },
    camera: THREE.Camera,
  ): DetailedHitResult | null {
    const ndc = this.clientToNDC(clientX, clientY, domRect);
    return this.raycastFromNDC(mesh, ndc.x, ndc.y, camera);
  }

  /**
   * Raycast against a mesh from an explicit world ray
   */
  public raycastFromRay(mesh: THREE.Mesh, ray: THREE.Ray): DetailedHitResult | null {
    this.raycaster.ray.copy(ray);
    return this.intersectMesh(mesh);
  }

  /**
   * Raycast against a list of candidate meshes to identify the foremost hit target
   */
  public findBestHit(
    meshes: THREE.Mesh[],
    ndcX: number,
    ndcY: number,
    camera: THREE.Camera,
  ): DetailedHitResult | null {
    this.ndcCoords.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndcCoords, camera);

    const intersects = this.raycaster.intersectObjects(meshes, false);
    if (intersects.length === 0) {
      return null;
    }

    const hit = intersects[0];
    const mesh = hit.object as THREE.Mesh;
    return this.formatIntersection(hit, mesh);
  }

  /**
   * Internal intersection logic with a specific mesh
   */
  private intersectMesh(mesh: THREE.Mesh): DetailedHitResult | null {
    if (!mesh.visible || !mesh.geometry) {
      return null;
    }

    const intersects = this.raycaster.intersectObject(mesh, false);
    if (intersects.length === 0) {
      return null;
    }

    return this.formatIntersection(intersects[0], mesh);
  }

  /**
   * Extract and compute world and local coordinates and normals from a Three.js intersection
   */
  private formatIntersection(hit: THREE.Intersection, mesh: THREE.Mesh): DetailedHitResult {
    // 1. World hit point
    const worldPoint: Vector3 = {
      x: hit.point.x,
      y: hit.point.y,
      z: hit.point.z,
    };

    // 2. World normal calculation
    // hit.face.normal is in object local space
    if (hit.face) {
      this.tempWorldNormal.copy(hit.face.normal);
      // Transform local face normal to world space using normal matrix
      this.normalMatrix.getNormalMatrix(mesh.matrixWorld);
      this.tempWorldNormal.applyMatrix3(this.normalMatrix).normalize();
    } else {
      this.tempWorldNormal.set(0, 1, 0);
    }

    const worldNormal: Vector3 = {
      x: this.tempWorldNormal.x,
      y: this.tempWorldNormal.y,
      z: this.tempWorldNormal.z,
    };

    // 3. Local space hit point and normal
    this.inverseMatrix.copy(mesh.matrixWorld).invert();

    this.tempLocalPoint.copy(hit.point).applyMatrix4(this.inverseMatrix);
    const localPoint: Vector3 = {
      x: this.tempLocalPoint.x,
      y: this.tempLocalPoint.y,
      z: this.tempLocalPoint.z,
    };

    if (hit.face) {
      this.tempLocalNormal.copy(hit.face.normal).normalize();
    } else {
      this.tempLocalNormal
        .copy(this.tempWorldNormal)
        .transformDirection(this.inverseMatrix)
        .normalize();
    }

    const localNormal: Vector3 = {
      x: this.tempLocalNormal.x,
      y: this.tempLocalNormal.y,
      z: this.tempLocalNormal.z,
    };

    return {
      hit: true,
      point: worldPoint,
      normal: worldNormal,
      localPoint,
      localNormal,
      faceIndex: hit.faceIndex != null ? hit.faceIndex : undefined,
      distance: hit.distance,
      object: mesh,
      uv: hit.uv ? { u: hit.uv.x, v: hit.uv.y } : undefined,
    };
  }
}

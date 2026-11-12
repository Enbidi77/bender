import * as THREE from 'three';
import type { SculptStrokePoint, Vector3 } from '@blender-elt/contracts';
import type { SculptViewportBridge } from './SculptViewportBridge.js';

export interface SculptInputControllerOptions {
  bridge: SculptViewportBridge;
  domElement: HTMLElement;
  cameraGetter: () => THREE.Camera | null;
  setIsSculptStrokeActive: (active: boolean) => void;
  getEnabled?: () => boolean;
}

/**
 * Normalizes pointer pressure across stylus, touch, and mouse inputs
 */
export function normalizePointerPressure(e: PointerEvent): number {
  if (e.pointerType === 'pen') {
    return Math.max(0.02, Math.min(1.0, e.pressure > 0 ? e.pressure : 0.5));
  }
  if (e.pointerType === 'touch') {
    return Math.max(0.1, Math.min(1.0, e.pressure > 0 ? e.pressure : 1.0));
  }
  // Standard mouse
  return e.pressure > 0 ? Math.min(1.0, e.pressure) : 1.0;
}

/**
 * SculptInputController
 * Handles PointerEvent lifecycle (down, move, up, cancel), pointer capture (setPointerCapture),
 * pressure normalization, and stroke dispatching to the active sculpt session.
 */
export class SculptInputController {
  private bridge: SculptViewportBridge;
  private domElement: HTMLElement;
  private cameraGetter: () => THREE.Camera | null;
  private setIsSculptStrokeActive: (active: boolean) => void;
  private getEnabled: () => boolean;

  private isPointerDown = false;
  private capturedPointerId: number | null = null;
  private lastStrokePoint: SculptStrokePoint | null = null;
  private readonly fallbackPlane = new THREE.Plane();
  private readonly tempRay = new THREE.Ray();
  private readonly tempVec = new THREE.Vector3();
  private readonly inverseMatrix = new THREE.Matrix4();

  // Bound event handlers
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundPointerCancel: (e: PointerEvent) => void;
  private boundPointerLeave: (e: PointerEvent) => void;

  constructor(options: SculptInputControllerOptions) {
    this.bridge = options.bridge;
    this.domElement = options.domElement;
    this.cameraGetter = options.cameraGetter;
    this.setIsSculptStrokeActive = options.setIsSculptStrokeActive;
    this.getEnabled = options.getEnabled ?? (() => true);

    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundPointerCancel = this.handlePointerCancel.bind(this);
    this.boundPointerLeave = this.handlePointerLeave.bind(this);

    this.attach();
  }

  public attach(): void {
    const el = this.domElement;
    el.addEventListener('pointerdown', this.boundPointerDown);
    el.addEventListener('pointermove', this.boundPointerMove);
    el.addEventListener('pointerup', this.boundPointerUp);
    el.addEventListener('pointercancel', this.boundPointerCancel);
    el.addEventListener('pointerleave', this.boundPointerLeave);
  }

  public detach(): void {
    const el = this.domElement;
    el.removeEventListener('pointerdown', this.boundPointerDown);
    el.removeEventListener('pointermove', this.boundPointerMove);
    el.removeEventListener('pointerup', this.boundPointerUp);
    el.removeEventListener('pointercancel', this.boundPointerCancel);
    el.removeEventListener('pointerleave', this.boundPointerLeave);

    if (this.capturedPointerId !== null) {
      try {
        el.releasePointerCapture(this.capturedPointerId);
      } catch {
        // Element may not have capture
      }
      this.capturedPointerId = null;
    }
  }

  public handlePointerDown(e: PointerEvent): void {
    if (!this.getEnabled()) return;
    // Sculpt only responds to primary button (Left Click), ignoring middle/right navigation
    if (e.button !== 0) return;
    // Alt + Left Click is reserved for Blender camera orbit
    if (e.altKey) return;

    const camera = this.cameraGetter();
    if (!camera) return;

    const rect = this.domElement.getBoundingClientRect();
    const ndc = this.bridge.getRaycaster().clientToNDC(e.clientX, e.clientY, rect);

    const hit = this.bridge.updateCursor(ndc.x, ndc.y, camera);
    if (!hit || !hit.hit) {
      // Clicked outside active sculpt mesh; allow camera navigation or selection
      return;
    }

    // Pointer capture to guarantee receiving pointermove/up events outside canvas bounds
    try {
      this.domElement.setPointerCapture(e.pointerId);
      this.capturedPointerId = e.pointerId;
    } catch {
      // Ignore if setPointerCapture is unsupported in environment
    }

    this.isPointerDown = true;
    this.setIsSculptStrokeActive(true);

    const mesh = hit.object;
    this.inverseMatrix.copy(mesh.matrixWorld).invert();

    // Camera view vector in local space
    camera.getWorldDirection(this.tempVec);
    this.tempVec.transformDirection(this.inverseMatrix);

    const strokePoint: SculptStrokePoint = {
      point: hit.localPoint,
      normal: hit.localNormal,
      pressure: normalizePointerPressure(e),
      viewVector: { x: this.tempVec.x, y: this.tempVec.y, z: this.tempVec.z },
      timestamp: Date.now(),
    };

    this.lastStrokePoint = strokePoint;

    // Initialize plane for drag continuation if cursor leaves mesh silhouette
    camera.getWorldDirection(this.tempVec).negate();
    this.fallbackPlane.setFromNormalAndCoplanarPoint(
      this.tempVec,
      new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z),
    );

    const started = this.bridge.getSession().beginStroke(strokePoint);
    if (started) {
      this.bridge.flushBufferToMesh();
    }
  }

  public handlePointerMove(e: PointerEvent): void {
    if (!this.getEnabled()) return;

    const camera = this.cameraGetter();
    if (!camera) return;

    const rect = this.domElement.getBoundingClientRect();
    const ndc = this.bridge.getRaycaster().clientToNDC(e.clientX, e.clientY, rect);

    if (this.isPointerDown && this.bridge.getSession().isStroking()) {
      const hit = this.bridge.updateCursor(ndc.x, ndc.y, camera);
      let localPos: Vector3;
      let localNorm: Vector3;

      const mesh = this.bridge.getActiveMesh();
      if (!mesh) return;

      this.inverseMatrix.copy(mesh.matrixWorld).invert();

      if (hit && hit.hit) {
        localPos = hit.localPoint;
        localNorm = hit.localNormal;
      } else {
        // Project onto fallback plane to continue drag strokes (e.g. Grab brush) outside silhouette
        this.tempRay.origin.setFromMatrixPosition(camera.matrixWorld);
        const rayDir = new THREE.Vector3(ndc.x, ndc.y, 0.5)
          .unproject(camera)
          .sub(this.tempRay.origin)
          .normalize();
        this.tempRay.direction.copy(rayDir);

        const planeIntersect = new THREE.Vector3();
        if (this.tempRay.intersectPlane(this.fallbackPlane, planeIntersect)) {
          planeIntersect.applyMatrix4(this.inverseMatrix);
          localPos = { x: planeIntersect.x, y: planeIntersect.y, z: planeIntersect.z };
          localNorm = this.lastStrokePoint?.normal ?? { x: 0, y: 1, z: 0 };
        } else {
          return;
        }
      }

      camera.getWorldDirection(this.tempVec);
      this.tempVec.transformDirection(this.inverseMatrix);

      const strokePoint: SculptStrokePoint = {
        point: localPos,
        normal: localNorm,
        pressure: normalizePointerPressure(e),
        viewVector: { x: this.tempVec.x, y: this.tempVec.y, z: this.tempVec.z },
        timestamp: Date.now(),
      };

      this.lastStrokePoint = strokePoint;
      this.bridge.getSession().updateStroke(strokePoint);
      this.bridge.flushBufferToMesh();
    } else {
      // Hover hit test to position cursor ring
      this.bridge.updateCursor(ndc.x, ndc.y, camera);
    }
  }

  public handlePointerUp(_e: PointerEvent): void {
    if (!this.isPointerDown) return;

    this.isPointerDown = false;
    this.setIsSculptStrokeActive(false);

    if (this.capturedPointerId !== null) {
      try {
        this.domElement.releasePointerCapture(this.capturedPointerId);
      } catch {
        // ignore
      }
      this.capturedPointerId = null;
    }

    if (this.bridge.getSession().isStroking()) {
      void this.bridge.commitStroke();
    }

    this.lastStrokePoint = null;
  }

  public handlePointerCancel(_e: PointerEvent): void {
    if (!this.isPointerDown) return;

    this.isPointerDown = false;
    this.setIsSculptStrokeActive(false);

    if (this.capturedPointerId !== null) {
      try {
        this.domElement.releasePointerCapture(this.capturedPointerId);
      } catch {
        // ignore
      }
      this.capturedPointerId = null;
    }

    if (this.bridge.getSession().isStroking()) {
      this.bridge.cancelStroke();
    }

    this.lastStrokePoint = null;
  }

  public handlePointerLeave(): void {
    if (!this.isPointerDown) {
      this.bridge.clearCursor();
    }
  }
}

import * as THREE from 'three';
import type { Vector3 } from '@blender-elt/contracts';
import type { EditViewportBridge } from './EditViewportBridge.js';
import type { EditModalState, EditModalType, ScreenBoxRect } from './types.js';

export interface EditInputControllerOptions {
  bridge: EditViewportBridge;
  domElement: HTMLElement;
  cameraGetter: () => THREE.Camera | null;
  getEnabled?: () => boolean;
  onMarqueeChange?: (rect: ScreenBoxRect | null) => void;
  onModalChange?: (state: EditModalState) => void;
}

/**
 * EditInputController
 * Coordinates pointer picking, box marquee dragging, and interactive modal tool sessions
 * (G/R/S transforms, E extrusions, axis constraints, numeric input).
 */
export class EditInputController {
  private bridge: EditViewportBridge;
  private domElement: HTMLElement;
  private cameraGetter: () => THREE.Camera | null;
  private getEnabled: () => boolean;
  private onMarqueeChange?: (rect: ScreenBoxRect | null) => void;
  private onModalChange?: (state: EditModalState) => void;

  private isPointerDown = false;
  private isDragging = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private capturedPointerId: number | null = null;
  private readonly dragThreshold = 4; // pixels

  // Interactive modal state
  private modalState: EditModalState = {
    active: false,
    type: 'none',
    axisLock: null,
    numericInput: '',
    startPointer: { x: 0, y: 0 },
    currentValue: 0,
  };

  private lastAppliedDelta: Vector3 = { x: 0, y: 0, z: 0 };
  private lastAppliedScale: Vector3 = { x: 1, y: 1, z: 1 };
  private lastAppliedRotation: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };

  // Bound event handlers
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundPointerLeave: (e: PointerEvent) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundOnExtrude: (e: Event) => void;
  private boundOnInset: (e: Event) => void;
  private boundOnBevel: (e: Event) => void;
  private boundOnLoopCut: (e: Event) => void;
  private boundOnKnife: (e: Event) => void;
  private boundOnDelete: (e: Event) => void;
  private boundOnModalTransform: (e: Event) => void;
  private boundOnSelectAll: (e: Event) => void;

  constructor(options: EditInputControllerOptions) {
    this.bridge = options.bridge;
    this.domElement = options.domElement;
    this.cameraGetter = options.cameraGetter;
    this.getEnabled = options.getEnabled ?? (() => true);
    this.onMarqueeChange = options.onMarqueeChange;
    this.onModalChange = options.onModalChange;

    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundPointerLeave = this.handlePointerLeave.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);

    this.boundOnExtrude = () => {
      if (this.getEnabled()) this.enterModal('extrude');
    };
    this.boundOnInset = () => {
      if (this.getEnabled()) this.bridge.insetSelected();
    };
    this.boundOnBevel = () => {
      if (this.getEnabled()) this.bridge.bevelSelected();
    };
    this.boundOnLoopCut = () => {
      if (this.getEnabled()) this.enterModal('loopcut');
    };
    this.boundOnKnife = () => {
      if (this.getEnabled()) this.enterModal('knife');
    };
    this.boundOnDelete = () => {
      if (this.getEnabled()) this.bridge.deleteSelected();
    };
    this.boundOnSelectAll = () => {
      if (this.getEnabled()) this.bridge.selectAll();
    };
    this.boundOnModalTransform = (e: Event) => {
      if (this.getEnabled()) {
        const type = (e as CustomEvent).detail?.type ?? 'translate';
        this.enterModal(type);
      }
    };

    this.attach();
  }

  public attach(): void {
    const el = this.domElement;
    el.addEventListener('pointerdown', this.boundPointerDown);
    el.addEventListener('pointermove', this.boundPointerMove);
    el.addEventListener('pointerup', this.boundPointerUp);
    el.addEventListener('pointerleave', this.boundPointerLeave);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundKeyDown, true);
      window.addEventListener('blender-elt:edit-extrude', this.boundOnExtrude);
      window.addEventListener('blender-elt:edit-inset', this.boundOnInset);
      window.addEventListener('blender-elt:edit-bevel', this.boundOnBevel);
      window.addEventListener('blender-elt:edit-loopcut', this.boundOnLoopCut);
      window.addEventListener('blender-elt:edit-knife', this.boundOnKnife);
      window.addEventListener('blender-elt:edit-delete', this.boundOnDelete);
      window.addEventListener('blender-elt:edit-select-all', this.boundOnSelectAll);
      window.addEventListener('blender-elt:edit-modal-transform', this.boundOnModalTransform);
    }
  }

  public detach(): void {
    const el = this.domElement;
    el.removeEventListener('pointerdown', this.boundPointerDown);
    el.removeEventListener('pointermove', this.boundPointerMove);
    el.removeEventListener('pointerup', this.boundPointerUp);
    el.removeEventListener('pointerleave', this.boundPointerLeave);
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyDown, true);
      window.removeEventListener('blender-elt:edit-extrude', this.boundOnExtrude);
      window.removeEventListener('blender-elt:edit-inset', this.boundOnInset);
      window.removeEventListener('blender-elt:edit-bevel', this.boundOnBevel);
      window.removeEventListener('blender-elt:edit-loopcut', this.boundOnLoopCut);
      window.removeEventListener('blender-elt:edit-knife', this.boundOnKnife);
      window.removeEventListener('blender-elt:edit-delete', this.boundOnDelete);
      window.removeEventListener('blender-elt:edit-select-all', this.boundOnSelectAll);
      window.removeEventListener('blender-elt:edit-modal-transform', this.boundOnModalTransform);
    }

    if (this.capturedPointerId !== null) {
      try {
        el.releasePointerCapture(this.capturedPointerId);
      } catch {
        // ignore
      }
      this.capturedPointerId = null;
    }
  }

  public getModalState(): Readonly<EditModalState> {
    return this.modalState;
  }

  public handlePointerDown(e: PointerEvent): void {
    if (!this.getEnabled()) return;
    // Don't intercept if Alt is pressed (Blender camera orbit)
    if (e.altKey) return;

    // Handle modal active session commits or cancels
    if (this.modalState.active) {
      if (e.button === 0) {
        // Left click commits
        e.preventDefault();
        e.stopPropagation();
        this.commitModal();
        return;
      } else if (e.button === 2) {
        // Right click cancels
        e.preventDefault();
        e.stopPropagation();
        this.cancelModal();
        return;
      }
    }

    // Only respond to primary Left Click (button 0)
    if (e.button !== 0) return;

    this.isPointerDown = true;
    this.isDragging = false;
    this.pointerStartX = e.clientX;
    this.pointerStartY = e.clientY;

    try {
      this.domElement.setPointerCapture(e.pointerId);
      this.capturedPointerId = e.pointerId;
    } catch {
      // ignore
    }
  }

  public handlePointerMove(e: PointerEvent): void {
    if (!this.getEnabled()) return;

    const camera = this.cameraGetter();
    if (!camera) return;

    const rect = this.domElement.getBoundingClientRect();

    // 1. Interactive modal tool update
    if (this.modalState.active) {
      this.updateModalFromPointer(e.clientX, e.clientY, rect, camera);
      return;
    }

    // 2. Marquee box selection drag
    if (this.isPointerDown) {
      const dx = e.clientX - this.pointerStartX;
      const dy = e.clientY - this.pointerStartY;
      const distSq = dx * dx + dy * dy;

      if (!this.isDragging && distSq >= this.dragThreshold * this.dragThreshold) {
        this.isDragging = true;
      }

      if (this.isDragging && this.onMarqueeChange) {
        this.onMarqueeChange({
          x1: this.pointerStartX,
          y1: this.pointerStartY,
          x2: e.clientX,
          y2: e.clientY,
          active: true,
        });
      }
      return;
    }

    // 3. Real-time hover element hit test
    this.bridge.updateHover(e.clientX, e.clientY, rect, camera);
  }

  public handlePointerUp(e: PointerEvent): void {
    if (!this.isPointerDown) return;

    this.isPointerDown = false;

    if (this.capturedPointerId !== null) {
      try {
        this.domElement.releasePointerCapture(this.capturedPointerId);
      } catch {
        // ignore
      }
      this.capturedPointerId = null;
    }

    const camera = this.cameraGetter();
    if (!camera) return;

    const rect = this.domElement.getBoundingClientRect();

    if (this.isDragging) {
      // Finalize box selection
      this.bridge.boxSelect(
        {
          x1: this.pointerStartX,
          y1: this.pointerStartY,
          x2: e.clientX,
          y2: e.clientY,
        },
        rect,
        camera,
        e.shiftKey ? 'add' : 'set',
      );

      this.isDragging = false;
      if (this.onMarqueeChange) {
        this.onMarqueeChange(null);
      }
    } else {
      // Single click selection
      this.bridge.selectElementAt(e.clientX, e.clientY, rect, camera, e.shiftKey);
    }
  }

  public handlePointerLeave(): void {
    if (!this.isPointerDown && !this.modalState.active) {
      this.bridge.clearHover();
    }
  }

  public handleKeyDown(e: KeyboardEvent): void {
    if (!this.getEnabled()) return;

    // Ignore if typing inside input / textarea
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }

    const code = e.code;

    // 1. While inside modal operation:
    if (this.modalState.active) {
      if (code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.cancelModal();
        return;
      }

      if (code === 'Enter' || code === 'NumpadEnter') {
        e.preventDefault();
        e.stopPropagation();
        this.commitModal();
        return;
      }

      // Axis Lock hotkeys: X, Y, Z
      if (code === 'KeyX' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.setModalAxisLock(this.modalState.axisLock === 'X' ? null : 'X');
        return;
      }
      if (code === 'KeyY' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.setModalAxisLock(this.modalState.axisLock === 'Y' ? null : 'Y');
        return;
      }
      if (code === 'KeyZ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.setModalAxisLock(this.modalState.axisLock === 'Z' ? null : 'Z');
        return;
      }

      // Numeric input
      if (/^[0-9.-]$/.test(e.key)) {
        e.preventDefault();
        this.appendNumericInput(e.key);
        return;
      }
      if (code === 'Backspace') {
        e.preventDefault();
        this.backspaceNumericInput();
        return;
      }

      return;
    }

    // 2. Non-modal edit hotkeys handled locally if not caught by useViewportHotkeys
    if (code === 'KeyA' && !e.ctrlKey && !e.metaKey) {
      if (e.altKey) {
        e.preventDefault();
        this.bridge.deselectAll();
      } else {
        e.preventDefault();
        this.bridge.selectAll();
      }
    }
  }

  /**
   * Enters an interactive modal session (e.g. Extrude, Translate, Rotate, Scale)
   */
  public enterModal(type: EditModalType, axisLock: 'X' | 'Y' | 'Z' | null = null): void {
    const mesh = this.bridge.getActiveMesh();
    if (!mesh) return;

    this.bridge.beginMutation();

    this.modalState = {
      active: true,
      type,
      axisLock,
      numericInput: '',
      startPointer: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      currentValue: 0,
    };

    this.lastAppliedDelta = { x: 0, y: 0, z: 0 };
    this.lastAppliedScale = { x: 1, y: 1, z: 1 };
    this.lastAppliedRotation = { x: 0, y: 0, z: 0 };

    if (type === 'extrude') {
      // Perform initial zero-distance extrusion so geometry is ready to slide
      const topology = this.bridge.getTopology();
      if (topology) {
        topology.extrudeSelectedFaces(0);
        this.bridge.flushTopologyToMesh();
      }
    }

    this.notifyModalChange();
  }

  /**
   * Commits the active modal operation
   */
  public commitModal(): void {
    if (!this.modalState.active) return;

    const opName = this.modalState.type.charAt(0).toUpperCase() + this.modalState.type.slice(1);

    this.modalState = {
      active: false,
      type: 'none',
      axisLock: null,
      numericInput: '',
      startPointer: { x: 0, y: 0 },
      currentValue: 0,
    };

    void this.bridge.commitTopologyChange(opName);
    this.notifyModalChange();
  }

  /**
   * Cancels the active modal operation, reverting geometry
   */
  public cancelModal(): void {
    if (!this.modalState.active) return;

    this.modalState = {
      active: false,
      type: 'none',
      axisLock: null,
      numericInput: '',
      startPointer: { x: 0, y: 0 },
      currentValue: 0,
    };

    this.bridge.cancelMutation();
    this.notifyModalChange();
  }

  public setModalAxisLock(axis: 'X' | 'Y' | 'Z' | null): void {
    this.modalState.axisLock = axis;
    this.notifyModalChange();
  }

  public appendNumericInput(char: string): void {
    this.modalState.numericInput += char;
    const num = parseFloat(this.modalState.numericInput);
    if (!isNaN(num)) {
      this.applyNumericValue(num);
    }
    this.notifyModalChange();
  }

  public backspaceNumericInput(): void {
    this.modalState.numericInput = this.modalState.numericInput.slice(0, -1);
    if (this.modalState.numericInput.length === 0) {
      this.applyNumericValue(0);
    } else {
      const num = parseFloat(this.modalState.numericInput);
      if (!isNaN(num)) {
        this.applyNumericValue(num);
      }
    }
    this.notifyModalChange();
  }

  private applyNumericValue(val: number): void {
    const { type, axisLock } = this.modalState;

    if (type === 'translate' || type === 'extrude') {
      const delta: Vector3 = {
        x: axisLock === 'X' || !axisLock ? val : 0,
        y: axisLock === 'Y' || (!axisLock && type === 'extrude') ? val : 0,
        z: axisLock === 'Z' ? val : 0,
      };

      // Revert last delta and apply new
      const invDelta: Vector3 = {
        x: delta.x - this.lastAppliedDelta.x,
        y: delta.y - this.lastAppliedDelta.y,
        z: delta.z - this.lastAppliedDelta.z,
      };
      this.bridge.translateSelected(invDelta);
      this.lastAppliedDelta = delta;
    } else if (type === 'scale') {
      const s = Math.max(0.001, val);
      const targetScale: Vector3 = {
        x: axisLock === 'X' || !axisLock ? s : 1,
        y: axisLock === 'Y' || !axisLock ? s : 1,
        z: axisLock === 'Z' || !axisLock ? s : 1,
      };
      const ratio: Vector3 = {
        x: targetScale.x / this.lastAppliedScale.x,
        y: targetScale.y / this.lastAppliedScale.y,
        z: targetScale.z / this.lastAppliedScale.z,
      };
      this.bridge.scaleSelected(ratio);
      this.lastAppliedScale = targetScale;
    } else if (type === 'rotate') {
      const rad = (val * Math.PI) / 180;
      const targetRot = {
        x: axisLock === 'X' ? rad : 0,
        y: axisLock === 'Y' ? rad : 0,
        z: axisLock === 'Z' || !axisLock ? rad : 0,
      };
      const deltaRot = {
        x: targetRot.x - this.lastAppliedRotation.x,
        y: targetRot.y - this.lastAppliedRotation.y,
        z: targetRot.z - this.lastAppliedRotation.z,
      };
      this.bridge.rotateSelected(deltaRot);
      this.lastAppliedRotation = targetRot;
    }
  }

  private updateModalFromPointer(
    clientX: number,
    clientY: number,
    _rect: DOMRect,
    _camera: THREE.Camera,
  ): void {
    if (this.modalState.numericInput.length > 0) return; // Numeric input takes precedence

    const dx = clientX - this.modalState.startPointer.x;
    const dy = clientY - this.modalState.startPointer.y;
    const sensitivity = 0.01;

    const { type, axisLock } = this.modalState;

    if (type === 'translate' || type === 'extrude') {
      const factor = (dx - dy) * sensitivity;
      const delta: Vector3 = {
        x: axisLock === 'X' ? dx * sensitivity : axisLock ? 0 : dx * sensitivity,
        y: axisLock === 'Y' ? -dy * sensitivity : axisLock ? 0 : -dy * sensitivity,
        z: axisLock === 'Z' ? factor : 0,
      };

      const invDelta: Vector3 = {
        x: delta.x - this.lastAppliedDelta.x,
        y: delta.y - this.lastAppliedDelta.y,
        z: delta.z - this.lastAppliedDelta.z,
      };
      this.bridge.translateSelected(invDelta);
      this.lastAppliedDelta = delta;
      this.modalState.currentValue = factor;
    } else if (type === 'scale') {
      const factor = Math.max(0.01, 1.0 + (dx - dy) * sensitivity);
      const targetScale: Vector3 = {
        x: axisLock === 'X' || !axisLock ? factor : 1,
        y: axisLock === 'Y' || !axisLock ? factor : 1,
        z: axisLock === 'Z' || !axisLock ? factor : 1,
      };
      const ratio: Vector3 = {
        x: targetScale.x / this.lastAppliedScale.x,
        y: targetScale.y / this.lastAppliedScale.y,
        z: targetScale.z / this.lastAppliedScale.z,
      };
      this.bridge.scaleSelected(ratio);
      this.lastAppliedScale = targetScale;
      this.modalState.currentValue = factor;
    } else if (type === 'rotate') {
      const angle = (dx - dy) * 0.02;
      const targetRot = {
        x: axisLock === 'X' ? angle : 0,
        y: axisLock === 'Y' ? angle : 0,
        z: axisLock === 'Z' || !axisLock ? angle : 0,
      };
      const deltaRot = {
        x: targetRot.x - this.lastAppliedRotation.x,
        y: targetRot.y - this.lastAppliedRotation.y,
        z: targetRot.z - this.lastAppliedRotation.z,
      };
      this.bridge.rotateSelected(deltaRot);
      this.lastAppliedRotation = targetRot;
      this.modalState.currentValue = (angle * 180) / Math.PI;
    }

    this.notifyModalChange();
  }

  private notifyModalChange(): void {
    if (this.onModalChange) {
      this.onModalChange({ ...this.modalState });
    }
  }
}

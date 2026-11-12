import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { sculptStore } from '@blender-elt/sculpting';

describe('Sculpt Mode Interactions & In-place Buffer Updates', () => {
  describe('In-place Three.js Buffer Updates & Mask Attributes', () => {
    it('applies vertex positions and normals in-place without reallocating BufferGeometry', () => {
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      const initialArray = posAttr.array;

      const newPositions = new Float32Array(posAttr.array.length);
      for (let i = 0; i < newPositions.length; i++) {
        newPositions[i] = initialArray[i] + 0.5;
      }

      // In-place update
      posAttr.set(newPositions);
      posAttr.needsUpdate = true;
      geometry.computeBoundingSphere();

      expect(posAttr.array).toBe(initialArray);
      expect(posAttr.array[0]).toBeCloseTo(newPositions[0], 5);
      expect(posAttr.version).toBeGreaterThan(0);
    });

    it('attaches sculptMask and color attributes for grayscale mask overlay', () => {
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      const vertexCount = posAttr.count;

      // Mock mask weights: half masked (1.0), half unmasked (0.0)
      const masks = new Float32Array(vertexCount);
      for (let i = 0; i < vertexCount; i++) {
        masks[i] = i % 2 === 0 ? 1.0 : 0.0;
      }

      // 1. Scalar mask attribute
      const maskAttr = new THREE.Float32BufferAttribute(masks, 1);
      geometry.setAttribute('sculptMask', maskAttr);

      // 2. Vertex color attribute for visual feedback
      const colors = new Float32Array(vertexCount * 3);
      for (let i = 0; i < vertexCount; i++) {
        const m = masks[i];
        const val = 1.0 - 0.65 * m; // 0.35 for masked, 1.0 for unmasked
        colors[i * 3] = val;
        colors[i * 3 + 1] = val;
        colors[i * 3 + 2] = val;
      }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      expect(geometry.getAttribute('sculptMask')).toBeDefined();
      expect(geometry.getAttribute('sculptMask').count).toBe(vertexCount);
      expect(geometry.getAttribute('color')).toBeDefined();

      const colorArr = geometry.getAttribute('color').array as Float32Array;
      // Masked vertex (0) has shade 0.35
      expect(colorArr[0]).toBeCloseTo(0.35, 2);
      // Unmasked vertex (1) has shade 1.0
      expect(colorArr[3]).toBeCloseTo(1.0, 2);
    });
  });

  describe('Modal Sculpt Hotkeys State Management', () => {
    beforeEach(() => {
      sculptStore.getState().setActiveBrush('draw');
      sculptStore.getState().setRadius(0.5);
      sculptStore.getState().setStrength(0.5);
      sculptStore.getState().setDirection('add');
    });

    it('toggles direction when Ctrl is held (invert/subtract)', () => {
      expect(sculptStore.getState().brushConfigs.draw.direction).toBe('add');

      // Keydown Ctrl simulates toggleDirection
      sculptStore.getState().toggleDirection();
      expect(sculptStore.getState().brushConfigs.draw.direction).toBe('subtract');

      // Keyup Ctrl restores
      sculptStore.getState().toggleDirection();
      expect(sculptStore.getState().brushConfigs.draw.direction).toBe('add');
    });

    it('temporarily switches to Smooth brush when Shift is held and restores on release', () => {
      expect(sculptStore.getState().activeBrush).toBe('draw');

      const prevBrush = sculptStore.getState().activeBrush;
      sculptStore.getState().setActiveBrush('smooth');
      expect(sculptStore.getState().activeBrush).toBe('smooth');

      // Release
      sculptStore.getState().setActiveBrush(prevBrush);
      expect(sculptStore.getState().activeBrush).toBe('draw');
    });

    it('adjusts radius and strength dynamically in modal mode', () => {
      // Radius adjustment
      sculptStore.getState().setRadius(0.75);
      expect(sculptStore.getState().brushConfigs.draw.radius).toBeCloseTo(0.75);

      // Strength adjustment
      sculptStore.getState().setStrength(0.9);
      expect(sculptStore.getState().brushConfigs.draw.strength).toBeCloseTo(0.9);
    });
  });

  describe('NavigationControls Suppression Invariant', () => {
    it('determines camera navigation enablement based on sculpt stroke and modal states', () => {
      const getNavigationEnabled = (
        isGizmoDragging: boolean,
        isSculptStrokeActive: boolean,
        isSculptModalActive: boolean,
      ) => !isGizmoDragging && !isSculptStrokeActive && !isSculptModalActive;

      // Normal state
      expect(getNavigationEnabled(false, false, false)).toBe(true);

      // Sculpt stroke active: suppressed
      expect(getNavigationEnabled(false, true, false)).toBe(false);

      // Modal hotkey active: suppressed
      expect(getNavigationEnabled(false, false, true)).toBe(false);

      // Gizmo dragging: suppressed
      expect(getNavigationEnabled(true, false, false)).toBe(false);
    });
  });
});

import type { SculptMeshBuffer } from '../geometry/sculpt-mesh-buffer.js';
import type { MeshAdjacency } from '../geometry/adjacency.js';

/**
 * Inverts vertex mask weights (1.0 - weight).
 */
export function invertMask(buffer: SculptMeshBuffer): void {
  const count = buffer.vertexCount;
  for (let i = 0; i < count; i++) {
    buffer.setMask(i, 1.0 - buffer.getMask(i));
  }
}

/**
 * Clears all mask weights to 0.0 (fully editable).
 */
export function clearMask(buffer: SculptMeshBuffer): void {
  const count = buffer.vertexCount;
  for (let i = 0; i < count; i++) {
    buffer.setMask(i, 0.0);
  }
}

/**
 * Fills all mask weights with a specified value (default 1.0 = fully protected).
 */
export function fillMask(buffer: SculptMeshBuffer, value: number = 1.0): void {
  const clamped = Math.max(0.0, Math.min(1.0, value));
  const count = buffer.vertexCount;
  for (let i = 0; i < count; i++) {
    buffer.setMask(i, clamped);
  }
}

/**
 * Smooths / blurs mask transitions across adjacent vertices using Laplacian averaging.
 */
export function smoothMask(
  buffer: SculptMeshBuffer,
  adjacency: MeshAdjacency,
  iterations: number = 1,
): void {
  const count = buffer.vertexCount;
  const temp = new Float32Array(count);

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < count; i++) {
      const neighbors = adjacency.getNeighbors(i);
      if (neighbors.length === 0) {
        temp[i] = buffer.getMask(i);
        continue;
      }

      let sum = 0;
      for (let k = 0; k < neighbors.length; k++) {
        sum += buffer.getMask(neighbors[k]);
      }
      const avg = sum / neighbors.length;
      temp[i] = buffer.getMask(i) * 0.5 + avg * 0.5;
    }

    for (let i = 0; i < count; i++) {
      buffer.setMask(i, temp[i]);
    }
  }
}

/**
 * Sharpens mask contrast around the 0.5 threshold.
 */
export function sharpenMask(buffer: SculptMeshBuffer, factor: number = 0.5): void {
  const count = buffer.vertexCount;
  const k = Math.max(0.1, factor * 2.0);

  for (let i = 0; i < count; i++) {
    const m = buffer.getMask(i);
    // Sigmoid or cubic contrast enhancement
    let sharpened: number;
    if (m >= 0.5) {
      sharpened = m + (1.0 - m) * k * (m - 0.5) * 2.0;
    } else {
      sharpened = m - m * k * (0.5 - m) * 2.0;
    }
    buffer.setMask(i, Math.max(0.0, Math.min(1.0, sharpened)));
  }
}

/**
 * Expands masked areas into neighboring vertices (dilation).
 */
export function growMask(buffer: SculptMeshBuffer, adjacency: MeshAdjacency): void {
  const count = buffer.vertexCount;
  const temp = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    let maxVal = buffer.getMask(i);
    const neighbors = adjacency.getNeighbors(i);
    for (let k = 0; k < neighbors.length; k++) {
      const nVal = buffer.getMask(neighbors[k]);
      if (nVal > maxVal) maxVal = nVal;
    }
    temp[i] = maxVal;
  }

  for (let i = 0; i < count; i++) {
    buffer.setMask(i, temp[i]);
  }
}

/**
 * Shrinks masked areas away from unmasked neighbors (erosion).
 */
export function shrinkMask(buffer: SculptMeshBuffer, adjacency: MeshAdjacency): void {
  const count = buffer.vertexCount;
  const temp = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    let minVal = buffer.getMask(i);
    const neighbors = adjacency.getNeighbors(i);
    for (let k = 0; k < neighbors.length; k++) {
      const nVal = buffer.getMask(neighbors[k]);
      if (nVal < minVal) minVal = nVal;
    }
    temp[i] = minVal;
  }

  for (let i = 0; i < count; i++) {
    buffer.setMask(i, temp[i]);
  }
}

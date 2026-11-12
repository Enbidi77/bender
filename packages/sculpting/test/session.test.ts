import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SculptSession } from '../src/core/sculpt-session.js';
import { sculptStore } from '../src/core/sculpt-store.js';

describe('SculptSession Lifecycle & Store Integration', () => {
  it('manages full stroke lifecycle: attach -> begin -> update -> end', () => {
    const session = new SculptSession();
    const sphere = new THREE.SphereGeometry(1, 16, 16);

    session.attachMesh('sphere-mesh-1', sphere);
    expect(session.getNodeId()).toBe('sphere-mesh-1');
    expect(sculptStore.getState().activeNodeId).toBe('sphere-mesh-1');
    expect(sculptStore.getState().vertexCount).toBe(session.getBuffer()?.vertexCount);

    // Set brush to Draw
    sculptStore.getState().setActiveBrush('draw');
    sculptStore.getState().setRadius(0.5);
    sculptStore.getState().setStrength(0.8);

    const hitPoint = {
      point: { x: 0, y: 1, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      pressure: 1.0,
      timestamp: Date.now(),
    };

    const strokeStarted = session.beginStroke(hitPoint);
    expect(strokeStarted).toBe(true);
    expect(session.isStroking()).toBe(true);
    expect(sculptStore.getState().isStroking).toBe(true);

    // Move stroke
    session.updateStroke({
      point: { x: 0.1, y: 1, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      pressure: 1.0,
      timestamp: Date.now() + 16,
    });

    const command = session.endStroke();
    expect(command).not.toBeNull();
    expect(session.isStroking()).toBe(false);
    expect(sculptStore.getState().isStroking).toBe(false);
    expect(command?.name).toContain('Sculpt draw');
    expect(command?.delta.indices.length).toBeGreaterThan(0);
  });

  it('cancelStroke discards modified positions and reverts buffer cleanly', () => {
    const session = new SculptSession();
    const sphere = new THREE.SphereGeometry(1, 8, 8);
    session.attachMesh('sphere-mesh-2', sphere);

    const initialTopVertex = session.getBuffer()?.getVertex(0).clone();

    session.beginStroke({
      point: { x: 0, y: 1, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      pressure: 1.0,
      timestamp: Date.now(),
    });

    // Cancel stroke
    session.cancelStroke();
    expect(session.isStroking()).toBe(false);

    const currentTopVertex = session.getBuffer()?.getVertex(0);
    expect(currentTopVertex?.y).toBeCloseTo(initialTopVertex!.y, 5);
  });
});

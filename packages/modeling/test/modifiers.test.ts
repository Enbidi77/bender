import { describe, it, expect } from 'vitest';
import type {
  ArrayModifier,
  MirrorModifier,
  SolidifyModifier,
  WireframeModifier,
  SubdivisionModifier,
  SmoothModifier,
  ModifierConfig,
} from '@blender-elt/contracts';
import {
  generateCube,
  generatePlane,
  MeshTopology,
  ModifierStackEvaluator,
  evaluateArrayModifier,
  evaluateMirrorModifier,
  evaluateSolidifyModifier,
  evaluateWireframeModifier,
  evaluateSubdivideModifier,
  evaluateSmoothModifier,
} from '../src/index.js';

describe('packages/modeling - Modifier Stack Engine', () => {
  const cubeData = generateCube(2, 2, 2);
  const planeData = generatePlane(2, 2);

  describe('Array Modifier', () => {
    it('duplicates geometry linearly by count', () => {
      const topology = MeshTopology.fromMeshData(cubeData);
      const initialVerts = topology.vertices.length;
      const initialFaces = topology.faces.length;

      const mod: ArrayModifier = {
        id: 'array-1',
        name: 'Array',
        type: 'array',
        enabled: true,
        showInViewport: true,
        showInRender: true,
        order: 0,
        count: 3,
        useRelativeOffset: true,
        relativeOffset: { x: 1.5, y: 0, z: 0 },
      };

      const result = evaluateArrayModifier(topology, mod);
      expect(result.vertices.length).toBe(initialVerts * 3);
      expect(result.faces.length).toBe(initialFaces * 3);
    });

    it('returns clone if count is <= 1', () => {
      const topology = MeshTopology.fromMeshData(cubeData);
      const mod: ArrayModifier = {
        id: 'array-single',
        name: 'Array',
        type: 'array',
        enabled: true,
        showInViewport: true,
        showInRender: true,
        order: 0,
        count: 1,
        useRelativeOffset: true,
        relativeOffset: { x: 1, y: 0, z: 0 },
      };

      const result = evaluateArrayModifier(topology, mod);
      expect(result.vertices.length).toBe(topology.vertices.length);
    });
  });

  describe('Mirror Modifier', () => {
    it('mirrors geometry across X axis and reverses face winding', () => {
      const topology = MeshTopology.fromMeshData(cubeData);
      // Offset cube so it does not center on X=0
      for (const v of topology.vertices) {
        v.position.x += 5;
      }
      const initialVerts = topology.vertices.length;
      const initialFaces = topology.faces.length;

      const mod: MirrorModifier = {
        id: 'mirror-1',
        name: 'Mirror',
        type: 'mirror',
        enabled: true,
        showInViewport: true,
        showInRender: true,
        order: 0,
        axis: { x: true, y: false, z: false },
        clip: false,
        merge: false,
        mergeThreshold: 0.001,
      };

      const result = evaluateMirrorModifier(topology, mod);
      expect(result.vertices.length).toBe(initialVerts * 2);
      expect(result.faces.length).toBe(initialFaces * 2);
    });

    it('merges vertices situated within merge threshold on the mirror plane', () => {
      const topology = MeshTopology.fromMeshData(planeData);
      // Plane has vertices along X=0 or symmetric
      const mod: MirrorModifier = {
        id: 'mirror-merge',
        name: 'Mirror',
        type: 'mirror',
        enabled: true,
        showInViewport: true,
        showInRender: true,
        order: 0,
        axis: { x: true, y: false, z: false },
        clip: true,
        merge: true,
        mergeThreshold: 0.1,
      };

      const result = evaluateMirrorModifier(topology, mod);
      expect(result.faces.length).toBeGreaterThan(topology.faces.length);
    });
  });

  describe('Solidify Modifier', () => {
    it('extrudes open surfaces with thickness and rim faces', () => {
      const topology = MeshTopology.fromMeshData(planeData);
      const initialVerts = topology.vertices.length;
      const initialFaces = topology.faces.length;

      const mod: SolidifyModifier = {
        id: 'solidify-1',
        name: 'Solidify',
        type: 'solidify',
        enabled: true,
        showInViewport: true,
        showInRender: true,
        order: 0,
        thickness: 0.5,
        offset: -1,
        rim: true,
      };

      const result = evaluateSolidifyModifier(topology, mod);
      // Vertices should double (outer + inner)
      expect(result.vertices.length).toBe(initialVerts * 2);
      // Faces should include outer, inner, and rim boundary quads (triangulated)
      expect(result.faces.length).toBeGreaterThan(initialFaces * 2);
    });
  });

  describe('Wireframe Modifier', () => {
    it('converts edges into 3D tubular struts', () => {
      const topology = MeshTopology.fromMeshData(cubeData);
      const mod: WireframeModifier = {
        id: 'wire-1',
        name: 'Wireframe',
        type: 'wireframe',
        enabled: true,
        showInViewport: true,
        showInRender: true,
        order: 0,
        thickness: 0.1,
        replaceOriginal: true,
      };

      const result = evaluateWireframeModifier(topology, mod);
      expect(result.faces.length).toBeGreaterThan(0);
      expect(result.vertices.length).toBeGreaterThan(topology.vertices.length);
    });
  });

  describe('Subdivision Modifier', () => {
    it('subdivides mesh faces into quads/triangles', () => {
      const topology = MeshTopology.fromMeshData(cubeData);
      const initialFaces = topology.faces.length;

      const mod: SubdivisionModifier = {
        id: 'subdiv-1',
        name: 'Subdivision',
        type: 'subdivision',
        enabled: true,
        showInViewport: true,
        showInRender: true,
        order: 0,
        levels: 1,
        renderLevels: 2,
        algorithm: 'catmull-clark',
      };

      const result = evaluateSubdivideModifier(topology, mod);
      expect(result.faces.length).toBe(initialFaces * 4);
    });
  });

  describe('Smooth Modifier', () => {
    it('applies Laplacian smoothing on vertex positions', () => {
      const topology = MeshTopology.fromMeshData(cubeData);
      // Displace one vertex violently
      topology.vertices[0].position.x += 10;
      const initialDist = topology.vertices[0].position.x;

      const mod: SmoothModifier = {
        id: 'smooth-1',
        name: 'Smooth',
        type: 'smooth',
        enabled: true,
        showInViewport: true,
        showInRender: true,
        order: 0,
        factor: 0.5,
        repeat: 3,
      };

      const result = evaluateSmoothModifier(topology, mod);
      // Vert 0 should be pulled inward towards neighbors
      expect(result.vertices[0].position.x).toBeLessThan(initialDist);
    });
  });

  describe('ModifierStackEvaluator Pipeline', () => {
    it('evaluates multiple modifiers sequentially in specified order', () => {
      const evaluator = new ModifierStackEvaluator();

      const modifiers: ModifierConfig[] = [
        {
          id: 'subdiv-step',
          name: 'Subdivision',
          type: 'subdivision',
          enabled: true,
          showInViewport: true,
          showInRender: true,
          order: 0,
          levels: 1,
          renderLevels: 1,
          algorithm: 'simple',
        },
        {
          id: 'array-step',
          name: 'Array',
          type: 'array',
          enabled: true,
          showInViewport: true,
          showInRender: true,
          order: 1,
          count: 2,
          useRelativeOffset: true,
          relativeOffset: { x: 2, y: 0, z: 0 },
        },
        {
          id: 'disabled-step',
          name: 'Disabled Mirror',
          type: 'mirror',
          enabled: false,
          showInViewport: true,
          showInRender: true,
          order: 2,
          axis: { x: true, y: false, z: false },
          clip: false,
          merge: false,
          mergeThreshold: 0.01,
        },
      ];

      const res = evaluator.evaluate(cubeData, modifiers);
      expect(res.appliedModifierIds).toEqual(['subdiv-step', 'array-step']);
      expect(res.durationMs).toBeGreaterThanOrEqual(0);
      expect(res.geometry.vertices.length).toBeGreaterThan(cubeData.vertices.length);
    });

    it('returns original geometry if no modifiers enabled', () => {
      const evaluator = new ModifierStackEvaluator();
      const res = evaluator.evaluate(cubeData, []);
      expect(res.appliedModifierIds).toEqual([]);
      expect(res.geometry).toBe(cubeData);
    });
  });
});

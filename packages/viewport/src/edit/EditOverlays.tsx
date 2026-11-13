import React, { useMemo, useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import type { EditViewportBridge } from './EditViewportBridge.js';
import { DEFAULT_EDIT_OVERLAY_COLORS, type EditOverlayColors } from './types.js';

export interface EditOverlaysProps {
  bridge: EditViewportBridge;
  showNormals?: boolean;
  colors?: Partial<EditOverlayColors>;
}

/**
 * Edit Mode Vertex Point Cloud Overlay
 */
export const VertexOverlay: React.FC<{
  bridge: EditViewportBridge;
  colors: EditOverlayColors;
}> = ({ bridge, colors }) => {
  const mesh = bridge.getActiveMesh();
  const topology = bridge.getTopology();
  const hoverState = bridge.getHoverState();
  const selectionStore = bridge.getSelectionStore();
  const selectedIndices = selectionStore.getState().editSelection.selectedVertexIndices;

  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, hasHovered, hoveredPos } = useMemo(() => {
    if (!topology || topology.vertices.length === 0) {
      return { geometry: null, hasHovered: false, hoveredPos: null };
    }

    const count = topology.vertices.length;
    const positions = new Float32Array(count * 3);
    const colorArray = new Float32Array(count * 3);

    const selSet = new Set(selectedIndices);
    const unselColor = new THREE.Color(colors.vertexUnselected);
    const selColor = new THREE.Color(colors.vertexSelected);
    const hovColor = new THREE.Color(colors.vertexHovered);

    const hoveredIdx = hoverState.hoveredVertexIndex;
    let hoveredPos: [number, number, number] | null = null;

    for (let i = 0; i < count; i++) {
      const v = topology.vertices[i];
      const i3 = i * 3;
      positions[i3] = v.position.x;
      positions[i3 + 1] = v.position.y;
      positions[i3 + 2] = v.position.z;

      if (i === hoveredIdx) {
        colorArray[i3] = hovColor.r;
        colorArray[i3 + 1] = hovColor.g;
        colorArray[i3 + 2] = hovColor.b;
        hoveredPos = [v.position.x, v.position.y, v.position.z];
      } else if (selSet.has(v.index)) {
        colorArray[i3] = selColor.r;
        colorArray[i3 + 1] = selColor.g;
        colorArray[i3 + 2] = selColor.b;
      } else {
        colorArray[i3] = unselColor.r;
        colorArray[i3 + 1] = unselColor.g;
        colorArray[i3 + 2] = unselColor.b;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

    return {
      geometry: geo,
      hasHovered: hoveredPos !== null,
      hoveredPos,
    };
  }, [topology, hoverState.hoveredVertexIndex, selectedIndices, colors]);

  useEffect(() => {
    return () => {
      if (geometry) geometry.dispose();
    };
  }, [geometry]);

  if (!mesh || !geometry) return null;

  return (
    <>
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial
          size={5}
          sizeAttenuation={false}
          vertexColors
          depthTest
          transparent={false}
        />
      </points>

      {/* Extra glow dot for hovered vertex */}
      {hasHovered && hoveredPos && (
        <points position={hoveredPos}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={1}
              array={new Float32Array([0, 0, 0])}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={9}
            sizeAttenuation={false}
            color={colors.vertexHovered}
            depthTest={false}
            transparent
            opacity={0.9}
          />
        </points>
      )}
    </>
  );
};

/**
 * Edit Mode Edge Wireframe Overlay
 */
export const EdgeOverlay: React.FC<{
  bridge: EditViewportBridge;
  colors: EditOverlayColors;
}> = ({ bridge, colors }) => {
  const mesh = bridge.getActiveMesh();
  const topology = bridge.getTopology();
  const hoverState = bridge.getHoverState();
  const selectionStore = bridge.getSelectionStore();
  const selectedIndices = selectionStore.getState().editSelection.selectedEdgeIndices;

  const geometry = useMemo(() => {
    if (!topology || topology.edges.length === 0) return null;

    const count = topology.edges.length;
    const positions = new Float32Array(count * 2 * 3);
    const colorArray = new Float32Array(count * 2 * 3);

    const selSet = new Set(selectedIndices);
    const unselColor = new THREE.Color(colors.edgeUnselected);
    const selColor = new THREE.Color(colors.edgeSelected);
    const hovColor = new THREE.Color(colors.edgeHovered);

    const hoveredIdx = hoverState.hoveredEdgeIndex;

    for (let i = 0; i < count; i++) {
      const edge = topology.edges[i];
      const v1 = topology.vertices[edge.v1];
      const v2 = topology.vertices[edge.v2];
      if (!v1 || !v2) continue;

      const idxBase = i * 6;

      positions[idxBase] = v1.position.x;
      positions[idxBase + 1] = v1.position.y;
      positions[idxBase + 2] = v1.position.z;

      positions[idxBase + 3] = v2.position.x;
      positions[idxBase + 4] = v2.position.y;
      positions[idxBase + 5] = v2.position.z;

      let c = unselColor;
      if (edge.index === hoveredIdx) {
        c = hovColor;
      } else if (selSet.has(edge.index)) {
        c = selColor;
      }

      colorArray[idxBase] = c.r;
      colorArray[idxBase + 1] = c.g;
      colorArray[idxBase + 2] = c.b;

      colorArray[idxBase + 3] = c.r;
      colorArray[idxBase + 4] = c.g;
      colorArray[idxBase + 5] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

    return geo;
  }, [topology, hoverState.hoveredEdgeIndex, selectedIndices, colors]);

  useEffect(() => {
    return () => {
      if (geometry) geometry.dispose();
    };
  }, [geometry]);

  if (!mesh || !geometry) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        vertexColors
        depthTest
        transparent
        opacity={0.85}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </lineSegments>
  );
};

/**
 * Edit Mode Selected Faces Highlight Overlay
 */
export const FaceOverlay: React.FC<{
  bridge: EditViewportBridge;
  colors: EditOverlayColors;
}> = ({ bridge, colors }) => {
  const mesh = bridge.getActiveMesh();
  const topology = bridge.getTopology();
  const selectionStore = bridge.getSelectionStore();
  const selectedFaceIndices = selectionStore.getState().editSelection.selectedFaceIndices;

  const geometry = useMemo(() => {
    if (!topology || topology.faces.length === 0 || selectedFaceIndices.length === 0) {
      return null;
    }

    const selSet = new Set(selectedFaceIndices);
    const triangleIndices: number[] = [];
    const positionsList: number[] = [];

    // Map vertex indices for triangulated faces
    let vertCounter = 0;

    for (let i = 0; i < topology.faces.length; i++) {
      const face = topology.faces[i];
      if (!selSet.has(face.index)) continue;

      const vis = face.vertexIndices;
      if (vis.length < 3) continue;

      const startIdx = vertCounter;
      for (const vIdx of vis) {
        const v = topology.vertices[vIdx];
        if (!v) continue;
        positionsList.push(v.position.x, v.position.y, v.position.z);
        vertCounter++;
      }

      // Fan triangulation
      for (let j = 1; j < vis.length - 1; j++) {
        triangleIndices.push(startIdx, startIdx + j, startIdx + j + 1);
      }
    }

    if (triangleIndices.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positionsList, 3));
    geo.setIndex(triangleIndices);
    geo.computeVertexNormals();

    return geo;
  }, [topology, selectedFaceIndices]);

  useEffect(() => {
    return () => {
      if (geometry) geometry.dispose();
    };
  }, [geometry]);

  if (!mesh || !geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color={colors.faceSelected}
        opacity={colors.faceOpacity}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
};

/**
 * Edit Mode Normals Overlay
 */
export const NormalsOverlay: React.FC<{
  bridge: EditViewportBridge;
  color: string;
}> = ({ bridge, color }) => {
  const mesh = bridge.getActiveMesh();
  const topology = bridge.getTopology();

  const geometry = useMemo(() => {
    if (!topology) return null;

    const normalLength = 0.25;
    const positions: number[] = [];

    // 1. Vertex Normals
    for (const v of topology.vertices) {
      if (v.normal) {
        positions.push(v.position.x, v.position.y, v.position.z);
        positions.push(
          v.position.x + v.normal.x * normalLength,
          v.position.y + v.normal.y * normalLength,
          v.position.z + v.normal.z * normalLength,
        );
      }
    }

    // 2. Face Normals from Centroids
    for (let i = 0; i < topology.faces.length; i++) {
      const face = topology.faces[i];
      const fn = topology.faceNormals[i] ?? face.normal;
      if (!fn) continue;

      let cx = 0;
      let cy = 0;
      let cz = 0;
      const count = face.vertexIndices.length;
      for (const vIdx of face.vertexIndices) {
        const v = topology.vertices[vIdx];
        if (v) {
          cx += v.position.x;
          cy += v.position.y;
          cz += v.position.z;
        }
      }
      cx /= count;
      cy /= count;
      cz /= count;

      positions.push(cx, cy, cz);
      positions.push(cx + fn.x * normalLength, cy + fn.y * normalLength, cz + fn.z * normalLength);
    }

    if (positions.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [topology]);

  useEffect(() => {
    return () => {
      if (geometry) geometry.dispose();
    };
  }, [geometry]);

  if (!mesh || !geometry) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} depthTest />
    </lineSegments>
  );
};

/**
 * EditOverlays Component
 * Master container rendering sub-element overlays aligned to the active mesh
 */
export const EditOverlays: React.FC<EditOverlaysProps> = ({
  bridge,
  showNormals = false,
  colors: customColors,
}) => {
  const [, setTick] = useState(0);

  // Subscribe to bridge updates (selection changes, hover changes, topology mutations)
  useEffect(() => {
    const unsub = bridge.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, [bridge]);

  const mesh = bridge.getActiveMesh();
  if (!mesh || !mesh.visible) return null;

  const mergedColors: EditOverlayColors = {
    ...DEFAULT_EDIT_OVERLAY_COLORS,
    ...customColors,
  };

  return (
    <group matrix={mesh.matrixWorld} matrixAutoUpdate={false}>
      {/* Selected faces translucent overlay */}
      <FaceOverlay bridge={bridge} colors={mergedColors} />

      {/* Wireframe edges overlay */}
      <EdgeOverlay bridge={bridge} colors={mergedColors} />

      {/* Vertices point cloud overlay */}
      <VertexOverlay bridge={bridge} colors={mergedColors} />

      {/* Normals overlay when enabled */}
      {showNormals && <NormalsOverlay bridge={bridge} color={mergedColors.normals} />}
    </group>
  );
};

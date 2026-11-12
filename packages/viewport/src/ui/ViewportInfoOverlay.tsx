import React, { useState, useEffect, useSyncExternalStore, useMemo } from 'react';
import * as THREE from 'three';
import { useViewportContext } from '../context/ViewportContext.js';
import { VIEWPOINT_CONFIGS } from '../constants.js';

export const ViewportInfoOverlay: React.FC = () => {
  const {
    config,
    cameraProjection,
    activeViewpoint,
    showOverlays,
    showStats,
    axisLock,
    sceneStore,
    selectionStore,
    sceneObjectsRef,
  } = useViewportContext();

  const activeNodeId = useSyncExternalStore(
    sceneStore.subscribe,
    () => sceneStore.getState().activeNodeId,
  );

  const selectedCount = useSyncExternalStore(
    sceneStore.subscribe,
    () => sceneStore.getState().selectedNodeIds.length,
  );

  const nodes = useSyncExternalStore(sceneStore.subscribe, () => sceneStore.getState().nodes);

  const cursor3D = useSyncExternalStore(
    selectionStore.subscribe,
    () => selectionStore.getState().cursor3D,
  );

  // Real-time FPS calculation loop
  const [fps, setFps] = useState<number>(60);
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const loop = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 500) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Compute scene-wide and active mesh statistics (Vertices, Triangles, Faces, Edges)
  const stats = useMemo(() => {
    let totalVerts = 0;
    let totalTris = 0;
    let totalMeshes = 0;

    const sceneObjects = sceneObjectsRef.current;
    if (sceneObjects) {
      for (const obj of sceneObjects.values()) {
        obj.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            totalMeshes++;
            const geo = (child as THREE.Mesh).geometry;
            if (geo) {
              const pos = geo.getAttribute('position');
              if (pos) {
                totalVerts += pos.count;
              }
              const idx = geo.getIndex();
              if (idx) {
                totalTris += Math.floor(idx.count / 3);
              } else if (pos) {
                totalTris += Math.floor(pos.count / 3);
              }
            }
          }
        });
      }
    }

    const totalFaces = totalTris;
    const totalEdges = Math.floor(totalTris * 1.5);

    return {
      totalMeshes,
      totalVerts,
      totalTris,
      totalFaces,
      totalEdges,
    };
  }, [nodes, sceneObjectsRef]);

  if (!showOverlays) {
    return null;
  }

  const activeNode = activeNodeId ? nodes[activeNodeId] : null;
  const viewpointTitle =
    cameraProjection === 'orthographic'
      ? `${VIEWPOINT_CONFIGS[activeViewpoint]?.name.replace('View', '').trim() || 'User'} Orthographic`
      : `${VIEWPOINT_CONFIGS[activeViewpoint]?.name || 'User Perspective'}`;

  const axisBadgeColor =
    axisLock === 'X'
      ? 'text-red-400 border-red-500/50 bg-red-950/40'
      : axisLock === 'Y'
        ? 'text-green-400 border-green-500/50 bg-green-950/40'
        : axisLock === 'Z'
          ? 'text-blue-400 border-blue-500/50 bg-blue-950/40'
          : '';

  return (
    <div className="absolute top-3 left-3 pointer-events-none flex flex-col gap-1.5 text-[11px] font-sans select-none z-10 text-gray-400">
      {/* Viewpoint and mode banner */}
      <div className="flex flex-col bg-[#1d1e22]/85 backdrop-blur-sm px-2.5 py-1.5 rounded border border-[#2e2f38] shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-gray-200">{viewpointTitle}</span>
          <span className="text-[10px] text-emerald-400 font-mono font-medium">{fps} FPS</span>
        </div>
        <span className="text-gray-400 text-[10px]">
          Mode: <span className="text-blue-400 capitalize">{config.mode}</span> | Shading:{' '}
          <span className="text-amber-400 capitalize">{config.shadingMode}</span>
        </span>
        {activeNode && (
          <span className="text-gray-300 mt-0.5 text-[10px]">
            Active: <span className="text-orange-400 font-medium">{activeNode.name}</span>{' '}
            <span className="text-gray-500">({activeNode.type})</span>
          </span>
        )}
      </div>

      {/* Axis Lock Constraint Banner */}
      {axisLock && (
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-mono font-semibold shadow-md ${axisBadgeColor}`}
        >
          <span>Axis Lock: {axisLock}</span>
          <span className="text-[9px] opacity-75 font-normal font-sans">
            (Press {axisLock} or Esc to release)
          </span>
        </div>
      )}

      {/* Real-time Viewport Statistics */}
      {showStats && (
        <div className="flex flex-col gap-0.5 bg-[#1d1e22]/85 backdrop-blur-sm px-2.5 py-1.5 rounded border border-[#2e2f38] text-[10px] font-mono text-gray-400 shadow-md">
          <div className="text-gray-300 font-semibold mb-0.5 text-[10px] font-sans border-b border-[#2e2f38] pb-0.5">
            Scene Statistics
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Objects:</span>
            <span className="text-gray-200 font-medium">
              {selectedCount} / {Object.keys(nodes).length}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Vertices:</span>
            <span className="text-gray-200 font-medium">{stats.totalVerts.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Edges:</span>
            <span className="text-gray-200 font-medium">{stats.totalEdges.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Faces:</span>
            <span className="text-gray-200 font-medium">{stats.totalFaces.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Triangles:</span>
            <span className="text-gray-200 font-medium">{stats.totalTris.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4 pt-0.5 mt-0.5 border-t border-[#2e2f38]/60 text-[9px] text-gray-500">
            <span>3D Cursor:</span>
            <span>
              {cursor3D.position.x.toFixed(1)}, {cursor3D.position.y.toFixed(1)},{' '}
              {cursor3D.position.z.toFixed(1)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

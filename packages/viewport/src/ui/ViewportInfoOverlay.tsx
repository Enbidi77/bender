import React, { useSyncExternalStore } from 'react';
import { useViewportContext } from '../context/ViewportContext.js';
import { VIEWPOINT_CONFIGS } from '../constants.js';

export const ViewportInfoOverlay: React.FC = () => {
  const { config, cameraProjection, activeViewpoint, showOverlays, showStats, sceneStore } =
    useViewportContext();

  const activeNodeId = useSyncExternalStore(
    sceneStore.subscribe,
    () => sceneStore.getState().activeNodeId,
  );

  const selectedCount = useSyncExternalStore(
    sceneStore.subscribe,
    () => sceneStore.getState().selectedNodeIds.length,
  );

  const nodes = useSyncExternalStore(sceneStore.subscribe, () => sceneStore.getState().nodes);

  if (!showOverlays) {
    return null;
  }

  const activeNode = activeNodeId ? nodes[activeNodeId] : null;
  const viewpointTitle =
    cameraProjection === 'orthographic'
      ? `${VIEWPOINT_CONFIGS[activeViewpoint]?.name.replace('View', '').trim() || 'User'} Orthographic`
      : `${VIEWPOINT_CONFIGS[activeViewpoint]?.name || 'User Perspective'}`;

  return (
    <div className="absolute top-3 left-3 pointer-events-none flex flex-col gap-1 text-[11px] font-sans select-none z-10 text-gray-400">
      {/* Viewpoint and mode banner */}
      <div className="flex flex-col bg-[#1d1e22]/80 backdrop-blur-sm px-2.5 py-1.5 rounded border border-[#2e2f38] shadow-md">
        <span className="font-semibold text-gray-200">{viewpointTitle}</span>
        <span className="text-gray-400">
          Mode: <span className="text-blue-400 capitalize">{config.mode}</span> | Shading:{' '}
          <span className="text-amber-400 capitalize">{config.shadingMode}</span>
        </span>
        {activeNode && (
          <span className="text-gray-300 mt-0.5">
            Active: <span className="text-orange-400 font-medium">{activeNode.name}</span>{' '}
            <span className="text-gray-500">({activeNode.type})</span>
          </span>
        )}
      </div>

      {/* Performance & object count stats */}
      {showStats && (
        <div className="bg-[#1d1e22]/80 backdrop-blur-sm px-2.5 py-1 rounded border border-[#2e2f38] text-[10px] text-gray-400">
          <div>Objects: {Object.keys(nodes).length}</div>
          <div>Selected: {selectedCount}</div>
        </div>
      )}
    </div>
  );
};

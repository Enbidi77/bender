import { useCallback, useSyncExternalStore } from 'react';
import { useViewportContext } from '../context/ViewportContext.js';

export function useSelection() {
  const { sceneStore, handleNodeSelect } = useViewportContext();

  const selectedNodeIds = useSyncExternalStore(
    sceneStore.subscribe,
    () => sceneStore.getState().selectedNodeIds,
  );

  const activeNodeId = useSyncExternalStore(
    sceneStore.subscribe,
    () => sceneStore.getState().activeNodeId,
  );

  const select = useCallback(
    (id: string, multi = false) => {
      handleNodeSelect(id, multi);
    },
    [handleNodeSelect],
  );

  const toggleSelect = useCallback(
    (id: string) => {
      sceneStore.getState().toggleSelect(id);
    },
    [sceneStore],
  );

  const deselectAll = useCallback(() => {
    handleNodeSelect(null);
  }, [handleNodeSelect]);

  return {
    selectedNodeIds,
    activeNodeId,
    select,
    toggleSelect,
    deselectAll,
  };
}

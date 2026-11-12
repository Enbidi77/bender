'use client';

import React, { useState, useEffect, useRef, useSyncExternalStore, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type {
  SceneNode,
  GizmoType,
  ShadingMode,
  ViewportMode,
  PrimitiveType,
  MaterialPreset,
  PBRMaterialConfig,
  Vector3,
  Euler,
  LightNode,
  CameraNode,
  ProjectDocument,
} from '@blender-elt/contracts';
import {
  createSceneStore,
  createMeshNode,
  createLightNode,
  createCameraNode,
} from '@blender-elt/scene-core';
import {
  CommandManager,
  CreateObjectCommand,
  DeleteObjectCommand,
  TransformObjectCommand,
  DuplicateObjectCommand,
  RenameObjectCommand,
  SetVisibilityCommand,
} from '@blender-elt/commands';
import { getMaterialPreset } from '@blender-elt/materials';
import {
  DockLayout,
  Header,
  OutlinerPanel,
  PropertiesPanel,
  TimelineBar,
  CommandPalette,
  AboutModal,
  ShortcutsModal,
  PreferencesModal,
  ThemeProvider,
  type CommandPaletteAction,
} from '@blender-elt/ui';
import { ViewportContainer } from '@blender-elt/viewport';
import {
  saveProjectDocumentWeb,
  openProjectDocumentWeb,
  exportSceneFileWeb,
  importSceneFileWeb,
  buildProjectDocument,
} from '../../../utils/webFileOperations';
import { webProjectStorage } from '../../../storage/webProjectStorage';
import { ArrowLeft, Save, Cloud, Check, Loader2 } from 'lucide-react';

interface EditorClientProps {
  projectId: string;
}

export const EditorStudio: React.FC<EditorClientProps> = ({ projectId }) => {
  const router = useRouter();

  // 1. Core Stores
  const sceneStoreRef = useRef(createSceneStore());
  const sceneStore = sceneStoreRef.current;
  const commandManagerRef = useRef(new CommandManager(100));
  const commandManager = commandManagerRef.current;

  // Scene Graph reactive state
  const sceneState = useSyncExternalStore(sceneStore.subscribe, sceneStore.getState);

  // Undo/Redo reactive state
  const [undoRedoState, setUndoRedoState] = useState(() => commandManager.getState());
  useEffect(() => {
    return commandManager.subscribe(setUndoRedoState);
  }, [commandManager]);

  // 2. Viewport & Tool States
  const [viewportMode, setViewportMode] = useState<ViewportMode>('object');
  const [gizmoType, setGizmoType] = useState<GizmoType>('translate');
  const [shadingMode, setShadingMode] = useState<ShadingMode>('solid');
  const [viewportFps] = useState<number>(60);

  // 3. Project File States
  const [projectName, setProjectName] = useState<string>('Untitled Scene');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // 4. Animation Timeline States
  const [currentFrame, setCurrentFrame] = useState<number>(1);
  const [startFrame, setStartFrame] = useState<number>(1);
  const [endFrame, setEndFrame] = useState<number>(250);
  const [fps, setFps] = useState<number>(24);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [loop, setLoop] = useState<boolean>(true);

  // 5. Modals States
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  // Load project on mount
  useEffect(() => {
    let active = true;

    async function loadInitialProject() {
      try {
        if (projectId && projectId !== 'new') {
          const doc = await webProjectStorage.getProject(projectId);
          if (doc && active) {
            sceneStore.getState().loadScene(doc.root, doc.nodes, doc.collections || {});
            setProjectName(doc.metadata?.name || 'Untitled Scene');
            commandManager.clear();
            setIsDirty(false);
            setSaveStatus('saved');
            setIsLoaded(true);
            return;
          }
        }

        // If new or not found, check URL search params for template
        if (active) {
          const params = new URLSearchParams(window.location.search);
          const tpl = (params.get('template') as any) || 'default';
          const defaultDoc = webProjectStorage.buildTemplateDocument('Untitled Scene', tpl);
          sceneStore
            .getState()
            .loadScene(defaultDoc.root, defaultDoc.nodes, defaultDoc.collections || {});
          setProjectName(defaultDoc.metadata?.name || 'Untitled Scene');
          commandManager.clear();
          setIsDirty(false);
          setSaveStatus('saved');
          setIsLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load project:', err);
        setIsLoaded(true);
      }
    }

    loadInitialProject();

    return () => {
      active = false;
    };
  }, [projectId]);

  // Autosave to IndexedDB with debounce
  useEffect(() => {
    if (!isDirty || !isLoaded) return;

    setSaveStatus('unsaved');
    const timer = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        const doc = buildProjectDocument(sceneStore.getState(), projectName);
        const actualId =
          projectId === 'new'
            ? `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
            : projectId;
        await webProjectStorage.saveProject(actualId, projectName, doc);
        setSaveStatus('saved');
        setIsDirty(false);
      } catch (err) {
        console.warn('Autosave error:', err);
        setSaveStatus('unsaved');
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [isDirty, isLoaded, projectName, projectId]);

  // Timeline playback loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = 1000 / fps;
    const timer = setInterval(() => {
      setCurrentFrame((prev) => {
        if (prev >= endFrame) {
          return loop ? startFrame : endFrame;
        }
        return prev + 1;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isPlaying, fps, startFrame, endFrame, loop]);

  // Command Execution
  const executeCmd = useCallback(
    (cmd: any) => {
      const ctx = { state: sceneStore.getState(), dispatch: () => {} };
      commandManager.execute(cmd, ctx);
      setIsDirty(true);
    },
    [commandManager, sceneStore],
  );

  // Undo / Redo helpers
  const handleUndo = useCallback(() => {
    const ctx = { state: sceneStore.getState(), dispatch: () => {} };
    commandManager.undo(ctx);
    setIsDirty(true);
  }, [commandManager, sceneStore]);

  const handleRedo = useCallback(() => {
    const ctx = { state: sceneStore.getState(), dispatch: () => {} };
    commandManager.redo(ctx);
    setIsDirty(true);
  }, [commandManager, sceneStore]);

  // Scene Operations with Command Pattern
  const handleAddPrimitive = useCallback(
    (type: PrimitiveType | 'light' | 'camera') => {
      let node: SceneNode;
      if (type === 'light') {
        node = createLightNode({ lightType: 'point' });
      } else if (type === 'camera') {
        node = createCameraNode({});
      } else {
        const prim = type as PrimitiveType;
        const name = prim.charAt(0).toUpperCase() + prim.slice(1);
        node = createMeshNode({
          name,
          primitiveType: prim,
        });
      }
      executeCmd(new CreateObjectCommand(node, 'root'));
    },
    [executeCmd],
  );

  const handleDeleteSelected = useCallback(() => {
    const activeId = sceneState.activeNodeId;
    if (!activeId) return;
    executeCmd(new DeleteObjectCommand(activeId));
  }, [executeCmd, sceneState.activeNodeId]);

  const handleDuplicateSelected = useCallback(() => {
    const activeId = sceneState.activeNodeId;
    if (!activeId) return;
    executeCmd(new DuplicateObjectCommand(activeId, { offset: { x: 2, y: 0, z: 0 } }));
  }, [executeCmd, sceneState.activeNodeId]);

  const handleRenameNode = useCallback(
    (nodeId: string, newName: string) => {
      executeCmd(new RenameObjectCommand(nodeId, newName));
    },
    [executeCmd],
  );

  const handleToggleVisibility = useCallback(
    (nodeId: string, currentVisible: boolean) => {
      executeCmd(new SetVisibilityCommand(nodeId, !currentVisible));
    },
    [executeCmd],
  );

  const handleUpdateTransform = useCallback(
    (nodeId: string, transform: { position?: Vector3; rotation?: Euler; scale?: Vector3 }) => {
      const target = sceneState.nodes[nodeId];
      if (!target) return;
      const oldTransform = { ...target.transform };
      const newTransform = {
        position: transform.position || target.transform.position,
        rotation: transform.rotation || target.transform.rotation,
        scale: transform.scale || target.transform.scale,
      };
      executeCmd(new TransformObjectCommand(nodeId, oldTransform, newTransform));
    },
    [executeCmd, sceneState.nodes],
  );

  const handleUpdateMaterial = useCallback(
    (nodeId: string, patch: Partial<PBRMaterialConfig>) => {
      const node = sceneState.nodes[nodeId];
      if (!node) return;
      const currentConfig = (node.metadata?.materialConfig as PBRMaterialConfig) || {
        color: '#cccccc',
        roughness: 0.5,
        metalness: 0.0,
        emission: '#000000',
        opacity: 1.0,
        transparent: false,
        wireframe: false,
      };
      const nextConfig = { ...currentConfig, ...patch };
      sceneStore.getState().updateNode(nodeId, {
        metadata: {
          ...node.metadata,
          materialConfig: nextConfig,
        },
      });
      setIsDirty(true);
    },
    [sceneState.nodes, sceneStore],
  );

  const handleApplyMaterialPreset = useCallback(
    (nodeId: string, preset: MaterialPreset) => {
      const presetConfig = getMaterialPreset(preset);
      handleUpdateMaterial(nodeId, presetConfig);
    },
    [handleUpdateMaterial],
  );

  const handleUpdateLight = useCallback(
    (nodeId: string, updates: Partial<LightNode>) => {
      sceneStore.getState().updateNode(nodeId, updates as Partial<SceneNode>);
      setIsDirty(true);
    },
    [sceneStore],
  );

  const handleUpdateCamera = useCallback(
    (nodeId: string, updates: Partial<CameraNode>) => {
      sceneStore.getState().updateNode(nodeId, updates as Partial<SceneNode>);
      setIsDirty(true);
    },
    [sceneStore],
  );

  // Project File actions
  const handleSaveProject = async (downloadFile: boolean = false) => {
    setSaveStatus('saving');
    const actualId =
      projectId === 'new'
        ? `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        : projectId;
    const res = await saveProjectDocumentWeb(sceneStore.getState(), actualId, projectName, {
      downloadFile,
    });
    if (res.success) {
      setIsDirty(false);
      setSaveStatus('saved');
      if (projectId === 'new') {
        router.replace(`/editor/${actualId}`);
      }
    } else {
      setSaveStatus('unsaved');
      alert(`Save failed: ${res.error}`);
    }
  };

  const handleOpenProject = async () => {
    const res = await openProjectDocumentWeb(sceneStore.getState());
    if (res.success && res.projectId) {
      router.push(`/editor/${res.projectId}`);
    }
  };

  const handleNewProject = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Discard and start new scene?')) {
      return;
    }
    router.push('/dashboard');
  };

  // Menu action dispatcher
  const handleMenuAction = async (actionId: string) => {
    switch (actionId) {
      case 'file:new':
        handleNewProject();
        break;
      case 'file:open':
        await handleOpenProject();
        break;
      case 'file:save':
        await handleSaveProject(false);
        break;
      case 'file:save-as':
        await handleSaveProject(true);
        break;
      case 'import:gltf':
        await importSceneFileWeb(sceneStore.getState(), 'gltf');
        break;
      case 'import:obj':
        await importSceneFileWeb(sceneStore.getState(), 'obj');
        break;
      case 'import:stl':
        await importSceneFileWeb(sceneStore.getState(), 'stl');
        break;
      case 'export:gltf':
        await exportSceneFileWeb(sceneStore.getState(), 'gltf', projectName);
        break;
      case 'export:glb':
        await exportSceneFileWeb(sceneStore.getState(), 'glb', projectName);
        break;
      case 'export:obj':
        await exportSceneFileWeb(sceneStore.getState(), 'obj', projectName);
        break;
      case 'export:stl':
        await exportSceneFileWeb(sceneStore.getState(), 'stl', projectName);
        break;
      case 'edit:undo':
        handleUndo();
        break;
      case 'edit:redo':
        handleRedo();
        break;
      case 'add:mesh:cube':
        handleAddPrimitive('cube');
        break;
      case 'add:mesh:sphere':
        handleAddPrimitive('sphere');
        break;
      case 'add:mesh:cylinder':
        handleAddPrimitive('cylinder');
        break;
      case 'add:mesh:cone':
        handleAddPrimitive('cone');
        break;
      case 'add:mesh:plane':
        handleAddPrimitive('plane');
        break;
      case 'add:mesh:torus':
        handleAddPrimitive('torus');
        break;
      case 'add:light:point':
      case 'add:light:directional':
      case 'add:light:spot':
        handleAddPrimitive('light');
        break;
      case 'add:camera':
        handleAddPrimitive('camera');
        break;
      case 'object:duplicate':
        handleDuplicateSelected();
        break;
      case 'object:delete':
        handleDeleteSelected();
        break;
      case 'app:preferences':
        setIsPreferencesOpen(true);
        break;
      case 'help:shortcuts':
        setIsShortcutsOpen(true);
        break;
      case 'help:about':
        setIsAboutOpen(true);
        break;
      case 'app:exit':
        router.push('/dashboard');
        break;
    }
  };

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      // Hotkey: G (translate)
      if (e.key === 'g' || e.key === 'G') {
        setGizmoType('translate');
      }
      // Hotkey: R (rotate)
      else if (e.key === 'r' || e.key === 'R') {
        setGizmoType('rotate');
      }
      // Hotkey: S (scale) - only if Ctrl is not pressed
      else if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) {
        setGizmoType('scale');
      }
      // Hotkey: W (box select)
      else if (e.key === 'w' || e.key === 'W') {
        setGizmoType('none');
      }
      // Hotkey: X or Delete (delete object)
      else if (e.key === 'x' || e.key === 'X' || e.key === 'Delete') {
        handleDeleteSelected();
      }
      // Hotkey: Shift+D (duplicate)
      else if ((e.key === 'd' || e.key === 'D') && e.shiftKey) {
        e.preventDefault();
        handleDuplicateSelected();
      }
      // Hotkey: Ctrl+Z (undo)
      else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Hotkey: Ctrl+Y or Ctrl+Shift+Z (redo)
      else if (
        ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey)) ||
        ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && e.shiftKey)
      ) {
        e.preventDefault();
        handleRedo();
      }
      // Hotkey: Ctrl+S (save)
      else if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSaveProject(e.shiftKey);
      }
      // Hotkey: Ctrl+O (open)
      else if ((e.key === 'o' || e.key === 'O') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleOpenProject();
      }
      // Hotkey: Space (play/pause timeline)
      else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
      // Hotkey: Left Arrow (prev frame)
      else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentFrame((f) => Math.max(startFrame, f - 1));
      }
      // Hotkey: Right Arrow (next frame)
      else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentFrame((f) => Math.min(endFrame, f + 1));
      }
      // Hotkey: Ctrl+K or F3 (command palette)
      else if (((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) || e.key === 'F3') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      // Hotkey: Ctrl+/ (shortcuts modal)
      else if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setIsShortcutsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    sceneState.activeNodeId,
    startFrame,
    endFrame,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleUndo,
    handleRedo,
  ]);

  // Command Palette Actions
  const commandPaletteActions: CommandPaletteAction[] = [
    {
      id: 'cp:add:cube',
      name: 'Add Cube',
      category: 'Add',
      onExecute: () => handleAddPrimitive('cube'),
    },
    {
      id: 'cp:add:sphere',
      name: 'Add Sphere',
      category: 'Add',
      onExecute: () => handleAddPrimitive('sphere'),
    },
    {
      id: 'cp:add:cylinder',
      name: 'Add Cylinder',
      category: 'Add',
      onExecute: () => handleAddPrimitive('cylinder'),
    },
    {
      id: 'cp:add:cone',
      name: 'Add Cone',
      category: 'Add',
      onExecute: () => handleAddPrimitive('cone'),
    },
    {
      id: 'cp:add:plane',
      name: 'Add Plane',
      category: 'Add',
      onExecute: () => handleAddPrimitive('plane'),
    },
    {
      id: 'cp:add:torus',
      name: 'Add Torus',
      category: 'Add',
      onExecute: () => handleAddPrimitive('torus'),
    },
    {
      id: 'cp:add:light',
      name: 'Add Light',
      category: 'Add',
      onExecute: () => handleAddPrimitive('light'),
    },
    {
      id: 'cp:add:camera',
      name: 'Add Camera',
      category: 'Add',
      onExecute: () => handleAddPrimitive('camera'),
    },
    {
      id: 'cp:tool:translate',
      name: 'Translate Tool',
      category: 'Edit',
      shortcut: 'G',
      onExecute: () => setGizmoType('translate'),
    },
    {
      id: 'cp:tool:rotate',
      name: 'Rotate Tool',
      category: 'Edit',
      shortcut: 'R',
      onExecute: () => setGizmoType('rotate'),
    },
    {
      id: 'cp:tool:scale',
      name: 'Scale Tool',
      category: 'Edit',
      shortcut: 'S',
      onExecute: () => setGizmoType('scale'),
    },
    {
      id: 'cp:tool:select',
      name: 'Select Box',
      category: 'Edit',
      shortcut: 'W',
      onExecute: () => setGizmoType('none'),
    },
    {
      id: 'cp:obj:duplicate',
      name: 'Duplicate Object',
      category: 'Object',
      shortcut: 'Shift+D',
      onExecute: handleDuplicateSelected,
    },
    {
      id: 'cp:obj:delete',
      name: 'Delete Object',
      category: 'Object',
      shortcut: 'X / Del',
      onExecute: handleDeleteSelected,
    },
    {
      id: 'cp:shade:wire',
      name: 'Shading: Wireframe',
      category: 'View',
      onExecute: () => setShadingMode('wireframe'),
    },
    {
      id: 'cp:shade:solid',
      name: 'Shading: Solid',
      category: 'View',
      onExecute: () => setShadingMode('solid'),
    },
    {
      id: 'cp:shade:mat',
      name: 'Shading: Material Preview',
      category: 'View',
      onExecute: () => setShadingMode('material'),
    },
    {
      id: 'cp:shade:render',
      name: 'Shading: Rendered',
      category: 'View',
      onExecute: () => setShadingMode('rendered'),
    },
    {
      id: 'cp:file:save',
      name: 'Save Project',
      category: 'File',
      shortcut: 'Ctrl+S',
      onExecute: () => handleSaveProject(false),
    },
    {
      id: 'cp:file:saveas',
      name: 'Download .belt File',
      category: 'File',
      shortcut: 'Ctrl+Shift+S',
      onExecute: () => handleSaveProject(true),
    },
    {
      id: 'cp:app:shortcuts',
      name: 'Keyboard Shortcuts Cheat Sheet',
      category: 'General',
      shortcut: 'Ctrl+/',
      onExecute: () => setIsShortcutsOpen(true),
    },
    {
      id: 'cp:app:prefs',
      name: 'Preferences',
      category: 'General',
      shortcut: 'Ctrl+,',
      onExecute: () => setIsPreferencesOpen(true),
    },
    {
      id: 'cp:app:about',
      name: 'About Blender-ELT',
      category: 'General',
      onExecute: () => setIsAboutOpen(true),
    },
  ];

  // Active node for properties inspector
  const activeNode = sceneState.activeNodeId
    ? sceneState.nodes[sceneState.activeNodeId] || null
    : null;
  const activeNodeMaterialConfig =
    (activeNode?.metadata?.materialConfig as PBRMaterialConfig) || undefined;

  // Scene polycounts
  const nodeCount = Object.keys(sceneState.nodes).length;
  let totalVerts = 0;
  let totalFaces = 0;
  Object.values(sceneState.nodes).forEach((n) => {
    if (n.type === 'mesh') {
      const prim = (n as any).primitiveType || 'cube';
      if (prim === 'sphere') {
        totalVerts += 482;
        totalFaces += 960;
      } else if (prim === 'cylinder') {
        totalVerts += 66;
        totalFaces += 64;
      } else if (prim === 'plane') {
        totalVerts += 4;
        totalFaces += 2;
      } else if (prim === 'torus') {
        totalVerts += 512;
        totalFaces += 1024;
      } else if (prim === 'cone') {
        totalVerts += 34;
        totalFaces += 33;
      } else {
        totalVerts += 8;
        totalFaces += 6;
      }
    }
  });

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-[#1d1e22] text-[#dedede] select-none">
      {/* Top Header Bar */}
      <DockLayout
        header={
          <div className="flex items-center w-full">
            {/* Back to dashboard button */}
            <button
              onClick={() => router.push('/dashboard')}
              title="Return to Projects Dashboard"
              className="flex items-center gap-1 px-2.5 h-full bg-[#202024] hover:bg-[#2b2d38] border-r border-[#181818] text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden sm:inline">Projects</span>
            </button>

            {/* Custom Header Component */}
            <div className="flex-1 flex items-center">
              <Header
                projectName={projectName}
                isDirty={isDirty}
                canUndo={undoRedoState.canUndo}
                canRedo={undoRedoState.canRedo}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onMenuAction={handleMenuAction}
                viewportMode={viewportMode}
                onViewportModeChange={setViewportMode}
                onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
                className="w-full"
              />
            </div>

            {/* Save Status & Quick Save */}
            <div className="flex items-center gap-2 pr-3 pl-2 bg-[#282828] h-full border-l border-[#181818]">
              <span
                className="text-[11px] flex items-center gap-1 font-mono"
                title={saveStatus === 'saved' ? 'Saved to IndexedDB' : 'Unsaved changes'}
              >
                {saveStatus === 'saving' ? (
                  <span className="text-amber-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                  </span>
                ) : saveStatus === 'unsaved' ? (
                  <span className="text-orange-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" /> Unsaved
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Saved
                  </span>
                )}
              </span>

              <button
                onClick={() => handleSaveProject(false)}
                className="px-2 py-1 rounded bg-[#35353d] hover:bg-[#4772b3] text-white text-[11px] font-medium flex items-center gap-1 transition-colors"
                title="Save (Ctrl+S)"
              >
                <Save className="w-3 h-3" />
                Save
              </button>
            </div>
          </div>
        }
        toolbar={<></>}
        viewport={
          <ViewportContainer
            sceneStore={sceneStore}
            commandManager={commandManager}
            config={{
              gizmoType,
              shadingMode,
              mode: viewportMode,
            }}
            showToolbar={true}
            showOverlays={true}
            showStats={true}
            onConfigChange={(cfg) => {
              if (cfg.gizmoType !== undefined) setGizmoType(cfg.gizmoType);
              if (cfg.shadingMode !== undefined) setShadingMode(cfg.shadingMode);
              if (cfg.mode !== undefined) setViewportMode(cfg.mode);
            }}
            className="w-full h-full"
          />
        }
        outliner={
          <OutlinerPanel
            nodes={sceneState.nodes}
            collections={sceneState.collections}
            selectedNodeIds={sceneState.selectedNodeIds}
            activeNodeId={sceneState.activeNodeId}
            onSelectNode={(id, multi) => sceneStore.getState().select(id, multi)}
            onToggleVisibility={handleToggleVisibility}
            onDeleteNode={(id) => executeCmd(new DeleteObjectCommand(id))}
            onRenameNode={handleRenameNode}
            onAddPrimitive={handleAddPrimitive}
          />
        }
        inspector={
          <PropertiesPanel
            node={activeNode}
            materialConfig={activeNodeMaterialConfig}
            onUpdateTransform={handleUpdateTransform}
            onUpdateName={handleRenameNode}
            onUpdateMaterial={handleUpdateMaterial}
            onApplyMaterialPreset={handleApplyMaterialPreset}
            onUpdateLight={handleUpdateLight}
            onUpdateCamera={handleUpdateCamera}
          />
        }
        timeline={
          <TimelineBar
            currentFrame={currentFrame}
            startFrame={startFrame}
            endFrame={endFrame}
            fps={fps}
            isPlaying={isPlaying}
            loop={loop}
            onSetFrame={setCurrentFrame}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            onStop={() => {
              setIsPlaying(false);
              setCurrentFrame(startFrame);
            }}
            onNextFrame={() => setCurrentFrame((f) => Math.min(endFrame, f + 1))}
            onPrevFrame={() => setCurrentFrame((f) => Math.max(startFrame, f - 1))}
            onJumpStart={() => setCurrentFrame(startFrame)}
            onJumpEnd={() => setCurrentFrame(endFrame)}
            onToggleLoop={() => setLoop((l) => !l)}
            onChangeStartFrame={setStartFrame}
            onChangeEndFrame={setEndFrame}
            onChangeFps={setFps}
            selectedObjectName={activeNode?.name}
            selectedObjectType={activeNode?.type}
            totalVertices={totalVerts}
            totalFaces={totalFaces}
            totalObjects={nodeCount}
            viewportFps={viewportFps}
          />
        }
      />

      {/* Modals & Overlays */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        actions={commandPaletteActions}
      />

      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />

      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        defaultShadingMode={shadingMode}
        onChangeDefaultShadingMode={setShadingMode}
        defaultFps={fps}
        onChangeDefaultFps={setFps}
      />
    </div>
  );
};

export default function EditorClient({ projectId }: EditorClientProps) {
  return (
    <ThemeProvider defaultTheme="dark">
      <EditorStudio projectId={projectId} />
    </ThemeProvider>
  );
}

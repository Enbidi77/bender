import React, {
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
  useCallback,
  useMemo,
} from 'react';
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
  SupportedFileFormat,
  IPlatformBridge,
  WorkspaceDefinition,
  EditorSessionState,
  SculptBrushType,
  SculptBrushConfig,
  SculptStrokeSettings,
  SymmetryConfig,
  SculptMaskOperation,
  VoxelRemeshConfig,
  EditModeTool,
  EditElementMode,
} from '@blender-elt/contracts';
import {
  createSceneStore,
  createMeshNode,
  createLightNode,
  createCameraNode,
  type SceneGraphState,
} from '@blender-elt/scene-core';

export type SceneStore = ReturnType<typeof createSceneStore>;
import {
  CommandManager,
  CommandRegistry,
  CreateObjectCommand,
  DeleteObjectCommand,
  TransformObjectCommand,
  DuplicateObjectCommand,
  RenameObjectCommand,
  SetVisibilityCommand,
} from '@blender-elt/commands';
import { getMaterialPreset } from '@blender-elt/materials';
import { exportScene } from '@blender-elt/file-formats';
import { ViewportContainer } from '@blender-elt/viewport';
import { Save, Check, Loader2 } from 'lucide-react';

import { DockLayout } from '../Layout/DockLayout.js';
import { Header } from '../Header/Header.js';
import { OutlinerPanel } from '../Outliner/OutlinerPanel.js';
import { PropertiesPanel } from '../Inspector/PropertiesPanel.js';
import { TimelineBar } from '../Timeline/TimelineBar.js';
import { CommandPalette, type CommandPaletteAction } from '../CommandPalette/CommandPalette.js';
import { AboutModal } from '../Modals/AboutModal.js';
import { ShortcutsModal } from '../Modals/ShortcutsModal.js';
import { PreferencesModal } from '../Modals/PreferencesModal.js';

import { DEFAULT_WORKSPACES } from './workspaces.js';
import { buildProjectDocument, calculateScenePolycounts } from './projectDocument.js';
import { SculptToolbar, SculptStatusBar, SCULPT_BRUSH_DEFINITIONS } from '../Sculpt/index.js';
import { ViewportToolbar } from '../Toolbar/ViewportToolbar.js';
import {
  EditModeToolbar,
  EditToolSettingsBar,
  EditContextMenu,
  DeleteDissolveMenu,
  EditModeStatusBar,
  DEFAULT_EDIT_MODE_SETTINGS,
  type EditModeSettings,
  type EditSelectionStats,
} from '../EditMode/index.js';

export interface EditorStudioProps {
  /**
   * Platform host bridge providing file system, window, and clipboard capabilities
   */
  platformBridge: IPlatformBridge;

  /**
   * Initial project document and metadata
   */
  initialProject?: {
    document?: ProjectDocument;
    name?: string;
    filePath?: string;
  };

  /**
   * Available workspaces (defaults to standard Blender Layout, Modeling, Sculpting, Shading, Animation)
   */
  workspaces?: WorkspaceDefinition[];

  /**
   * Initially active workspace ID (defaults to 'layout')
   */
  initialWorkspaceId?: string;

  /**
   * Optional pre-instantiated SceneStore
   */
  sceneStore?: SceneStore;

  /**
   * Optional pre-instantiated CommandManager
   */
  commandManager?: CommandManager;

  /**
   * Optional pre-instantiated CommandRegistry
   */
  commandRegistry?: CommandRegistry;

  /**
   * Optional custom prefix for header (e.g. web back button)
   */
  headerPrefix?: React.ReactNode;

  /**
   * Optional custom suffix for header (e.g. custom cloud status)
   */
  headerSuffix?: React.ReactNode;

  /**
   * Callback fired on session state changes
   */
  onSessionChange?: (session: EditorSessionState) => void;

  /**
   * Callback fired on save complete
   */
  onSave?: (result: { success: boolean; filePath?: string; error?: string }) => void;

  /**
   * Whether to enable autosave
   */
  autoSave?: boolean;

  /**
   * Autosave debounce interval in ms (defaults to 4000)
   */
  autoSaveIntervalMs?: number;

  /**
   * CSS class name
   */
  className?: string;
}

export const EditorStudio: React.FC<EditorStudioProps> = ({
  platformBridge,
  initialProject,
  workspaces = DEFAULT_WORKSPACES,
  initialWorkspaceId = 'layout',
  sceneStore: propSceneStore,
  commandManager: propCommandManager,
  commandRegistry: propCommandRegistry,
  headerPrefix,
  headerSuffix,
  onSessionChange,
  onSave,
  autoSave = true,
  autoSaveIntervalMs = 4000,
  className = '',
}) => {
  // 1. Core Stores & State Managers
  const sceneStoreRef = useRef<SceneStore>(propSceneStore || createSceneStore());
  const sceneStore = sceneStoreRef.current;

  const commandManagerRef = useRef<CommandManager>(propCommandManager || new CommandManager(100));
  const commandManager = commandManagerRef.current;

  const commandRegistryRef = useRef<CommandRegistry>(propCommandRegistry || new CommandRegistry());

  // Subscribe to scene graph state
  const sceneState: SceneGraphState = useSyncExternalStore(
    sceneStore.subscribe,
    sceneStore.getState,
  );

  // Subscribe to Undo/Redo state
  const [undoRedoState, setUndoRedoState] = useState(() => commandManager.getState());
  useEffect(() => {
    return commandManager.subscribe(setUndoRedoState);
  }, [commandManager]);

  // 2. Viewport & Tool States
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(initialWorkspaceId);
  const [viewportMode, setViewportMode] = useState<ViewportMode>('object');
  const [gizmoType, setGizmoType] = useState<GizmoType>('translate');
  const [shadingMode, setShadingMode] = useState<ShadingMode>('solid');
  const [viewportFps] = useState<number>(60);

  // Memoized Viewport configuration to avoid creating new object references every render
  const viewportConfig = useMemo(
    () => ({
      gizmoType,
      shadingMode,
      mode: viewportMode,
    }),
    [gizmoType, shadingMode, viewportMode],
  );

  const handleViewportConfigChange = useCallback(
    (cfg: { gizmoType?: GizmoType; shadingMode?: ShadingMode; mode?: ViewportMode }) => {
      if (cfg.gizmoType !== undefined) {
        setGizmoType((prev) => (prev !== cfg.gizmoType ? cfg.gizmoType! : prev));
      }
      if (cfg.shadingMode !== undefined) {
        setShadingMode((prev) => (prev !== cfg.shadingMode ? cfg.shadingMode! : prev));
      }
      if (cfg.mode !== undefined) {
        setViewportMode((prev) => (prev !== cfg.mode ? cfg.mode! : prev));
      }
    },
    [],
  );

  // Sculpt Mode States
  const isSculptMode = viewportMode === 'sculpt' || activeWorkspaceId === 'sculpting';
  const [activeSculptBrush, setActiveSculptBrush] = useState<SculptBrushType>('draw');
  const [brushConfigs, setBrushConfigs] = useState<Record<SculptBrushType, SculptBrushConfig>>(
    () => {
      const map: Partial<Record<SculptBrushType, SculptBrushConfig>> = {};
      for (const b of SCULPT_BRUSH_DEFINITIONS) {
        map[b.id] = {
          type: b.id,
          radius: b.defaultRadius,
          strength: b.defaultStrength,
          falloff: b.defaultFalloff,
          spacing: 10,
          direction: 'add',
          useStylusPressure: true,
          pressureAffectsSize: true,
          pressureAffectsStrength: true,
        };
      }
      return map as Record<SculptBrushType, SculptBrushConfig>;
    },
  );

  const [sculptStrokeSettings, setSculptStrokeSettings] = useState<SculptStrokeSettings>({
    spacing: 10,
    smoothStroke: false,
    smoothStrokeFactor: 0.5,
    useAccumulate: true,
    frontFacesOnly: false,
  });

  const [sculptSymmetry, setSculptSymmetry] = useState<SymmetryConfig>({
    x: true,
    y: false,
    z: false,
    radial: { axis: 'z', count: 1 },
  });

  const [maskEnabled, setMaskEnabled] = useState<boolean>(true);
  const [maskCoveragePercent, setMaskCoveragePercent] = useState<number>(0);
  const [remeshConfig, setRemeshConfig] = useState<VoxelRemeshConfig>({
    voxelSize: 0.05,
    adaptivity: 0,
    smoothNormals: true,
    preserveVolume: true,
  });
  const [isRemeshing, setIsRemeshing] = useState<boolean>(false);
  const [lastStrokeDurationMs] = useState<number>(0);

  const activeBrushConfig = brushConfigs[activeSculptBrush] || {
    type: activeSculptBrush,
    radius: 50,
    strength: 0.5,
    falloff: 'smooth',
    spacing: 10,
    direction: 'add',
  };

  const handleUpdateSculptBrushConfig = useCallback(
    (updates: Partial<SculptBrushConfig>) => {
      setBrushConfigs((prev) => ({
        ...prev,
        [activeSculptBrush]: {
          ...prev[activeSculptBrush],
          ...updates,
        },
      }));
    },
    [activeSculptBrush],
  );

  const handleUpdateSculptStrokeSettings = useCallback((updates: Partial<SculptStrokeSettings>) => {
    setSculptStrokeSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleUpdateSculptSymmetry = useCallback((updates: Partial<SymmetryConfig>) => {
    setSculptSymmetry((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleUpdateRemeshConfig = useCallback((updates: Partial<VoxelRemeshConfig>) => {
    setRemeshConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleMaskOperation = useCallback((operation: SculptMaskOperation) => {
    if (operation === 'clear') {
      setMaskCoveragePercent(0);
    } else if (operation === 'fill') {
      setMaskCoveragePercent(100);
    } else if (operation === 'invert') {
      setMaskCoveragePercent((prev) => Math.max(0, 100 - prev));
    }
    setIsDirty(true);
  }, []);

  const handleExecuteRemesh = useCallback(async (_cfg: VoxelRemeshConfig) => {
    setIsRemeshing(true);
    try {
      await new Promise((r) => setTimeout(r, 200));
      setIsDirty(true);
    } finally {
      setIsRemeshing(false);
    }
  }, []);

  // Edit Mode States
  const isEditMode = viewportMode === 'edit' || activeWorkspaceId === 'modeling';
  const [activeEditTool, setActiveEditTool] = useState<EditModeTool>('select');
  const [activeElementModes, setActiveElementModes] = useState<EditElementMode[]>(['vertex']);
  const [editModeSettings, setEditModeSettings] = useState<EditModeSettings>(
    DEFAULT_EDIT_MODE_SETTINGS,
  );
  const [isContextMenuOpen, setIsContextMenuOpen] = useState<boolean>(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isDeleteMenuOpen, setIsDeleteMenuOpen] = useState<boolean>(false);
  const [deleteMenuPosition, setDeleteMenuPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const handleSelectEditElementMode = useCallback(
    (mode: EditElementMode, isMultiSelect = false) => {
      setActiveElementModes((prev) => {
        if (isMultiSelect) {
          if (prev.includes(mode)) {
            return prev.length > 1 ? prev.filter((m) => m !== mode) : prev;
          } else {
            return [...prev, mode];
          }
        } else {
          return [mode];
        }
      });
    },
    [],
  );

  const handleUpdateEditModeSettings = useCallback((updates: Partial<EditModeSettings>) => {
    setEditModeSettings((prev) => ({ ...prev, ...updates }));
    setIsDirty(true);
  }, []);

  const handleExecuteEditOperation = useCallback(
    (opType: string, params?: Record<string, unknown>) => {
      if (typeof window !== 'undefined') {
        if (opType === 'extrude') {
          window.dispatchEvent(new CustomEvent('blender-elt:edit-extrude', { detail: params }));
        } else if (opType === 'inset') {
          window.dispatchEvent(new CustomEvent('blender-elt:edit-inset', { detail: params }));
        } else if (opType === 'bevel') {
          window.dispatchEvent(new CustomEvent('blender-elt:edit-bevel', { detail: params }));
        } else if (opType === 'loopcut') {
          window.dispatchEvent(new CustomEvent('blender-elt:edit-loopcut', { detail: params }));
        } else if (opType === 'knife') {
          window.dispatchEvent(new CustomEvent('blender-elt:edit-knife', { detail: params }));
        } else if (
          opType === 'delete' ||
          opType.startsWith('delete-') ||
          opType.startsWith('dissolve-')
        ) {
          window.dispatchEvent(new CustomEvent('blender-elt:edit-delete', { detail: params }));
        } else if (opType === 'select-all') {
          window.dispatchEvent(new CustomEvent('blender-elt:edit-select-all', { detail: params }));
        } else {
          window.dispatchEvent(new CustomEvent(`blender-elt:edit-${opType}`, { detail: params }));
        }
      }
      setIsDirty(true);
      setSaveStatus('unsaved');
    },
    [],
  );

  // 3. Project File States
  const [projectName, setProjectName] = useState<string>(initialProject?.name || 'Untitled.belt');
  const [currentFilePath, setCurrentFilePath] = useState<string | undefined>(
    initialProject?.filePath,
  );
  const [isDirty, setIsDirty] = useState<boolean>(false);
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

  // Load initial document if provided
  useEffect(() => {
    if (initialProject?.document) {
      sceneStore
        .getState()
        .loadScene(
          initialProject.document.root,
          initialProject.document.nodes,
          initialProject.document.collections || {},
        );
      commandManager.clear();
      setIsDirty(false);
      setSaveStatus('saved');
    }
  }, [initialProject?.document, sceneStore, commandManager]);

  // Notify parent of session state changes
  useEffect(() => {
    onSessionChange?.({
      projectName,
      filePath: currentFilePath,
      isDirty,
      activeWorkspaceId,
      activeModals: {
        about: isAboutOpen,
        shortcuts: isShortcutsOpen,
        preferences: isPreferencesOpen,
        commandPalette: isCommandPaletteOpen,
      },
    });
  }, [
    projectName,
    currentFilePath,
    isDirty,
    activeWorkspaceId,
    isAboutOpen,
    isShortcutsOpen,
    isPreferencesOpen,
    isCommandPaletteOpen,
    onSessionChange,
  ]);

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

  // Autosave handler (if enabled)
  useEffect(() => {
    if (!autoSave || !isDirty) return;

    setSaveStatus('unsaved');
    const timer = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        const doc = buildProjectDocument(sceneStore.getState(), projectName);
        const res = await platformBridge.fileSystem.saveProject(doc, currentFilePath);
        if (res.success) {
          setIsDirty(false);
          setSaveStatus('saved');
          if (res.filePath) setCurrentFilePath(res.filePath);
        } else {
          setSaveStatus('unsaved');
        }
      } catch (err) {
        console.warn('Autosave error:', err);
        setSaveStatus('unsaved');
      }
    }, autoSaveIntervalMs);

    return () => clearTimeout(timer);
  }, [
    isDirty,
    autoSave,
    projectName,
    currentFilePath,
    autoSaveIntervalMs,
    platformBridge,
    sceneStore,
  ]);

  // Execute a command helper
  const executeCmd = useCallback(
    (cmd: any) => {
      const ctx = { state: sceneStore.getState(), dispatch: () => {} };
      commandManager.execute(cmd, ctx);
      setIsDirty(true);
      setSaveStatus('unsaved');
    },
    [commandManager, sceneStore],
  );

  // Undo / Redo helpers
  const handleUndo = useCallback(() => {
    const ctx = { state: sceneStore.getState(), dispatch: () => {} };
    commandManager.undo(ctx);
    setIsDirty(true);
    setSaveStatus('unsaved');
  }, [commandManager, sceneStore]);

  const handleRedo = useCallback(() => {
    const ctx = { state: sceneStore.getState(), dispatch: () => {} };
    commandManager.redo(ctx);
    setIsDirty(true);
    setSaveStatus('unsaved');
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
      setSaveStatus('unsaved');
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
      setSaveStatus('unsaved');
    },
    [sceneStore],
  );

  const handleUpdateCamera = useCallback(
    (nodeId: string, updates: Partial<CameraNode>) => {
      sceneStore.getState().updateNode(nodeId, updates as Partial<SceneNode>);
      setIsDirty(true);
      setSaveStatus('unsaved');
    },
    [sceneStore],
  );

  // Workspace Switcher
  const handleSelectWorkspace = useCallback(
    (workspaceId: string) => {
      const targetWorkspace = workspaces.find((w) => w.id === workspaceId);
      if (!targetWorkspace) return;

      setActiveWorkspaceId(workspaceId);
      setViewportMode(targetWorkspace.defaultMode);

      if (targetWorkspace.viewportConfig) {
        if (targetWorkspace.viewportConfig.shadingMode) {
          setShadingMode(targetWorkspace.viewportConfig.shadingMode);
        }
        if (targetWorkspace.viewportConfig.gizmoType) {
          setGizmoType(targetWorkspace.viewportConfig.gizmoType);
        }
      }
    },
    [workspaces],
  );

  // File Operations via IPlatformBridge
  const handleNewProject = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Discard and create new project?');
      if (!confirmed) return;
    }
    sceneStore.getState().resetToDefaultScene();
    commandManager.clear();
    setProjectName('Untitled.belt');
    setCurrentFilePath(undefined);
    setIsDirty(false);
    setSaveStatus('saved');
    platformBridge.notifications?.notify('Created new project', 'info');
  }, [isDirty, sceneStore, commandManager, platformBridge]);

  const handleSaveProject = useCallback(
    async (saveAs = false) => {
      try {
        setSaveStatus('saving');
        const doc = buildProjectDocument(sceneStore.getState(), projectName);
        const targetPath = saveAs ? undefined : currentFilePath;
        const res = await platformBridge.fileSystem.saveProject(doc, targetPath);

        if (res.success) {
          setIsDirty(false);
          setSaveStatus('saved');
          if (res.filePath) {
            setCurrentFilePath(res.filePath);
            const filename = res.filePath.split(/[\\/]/).pop() || projectName;
            setProjectName(filename);
          }
          platformBridge.notifications?.notify('Project saved successfully', 'success');
          onSave?.(res);
        } else {
          setSaveStatus('unsaved');
          platformBridge.notifications?.notify(`Save failed: ${res.error}`, 'error');
          onSave?.(res);
        }
      } catch (err: unknown) {
        setSaveStatus('unsaved');
        const errMsg = err instanceof Error ? err.message : String(err);
        platformBridge.notifications?.notify(`Save error: ${errMsg}`, 'error');
      }
    },
    [projectName, currentFilePath, platformBridge, sceneStore, onSave],
  );

  const handleOpenProject = useCallback(async () => {
    try {
      const res = await platformBridge.fileSystem.openProject();
      if (res.success && res.document) {
        sceneStore
          .getState()
          .loadScene(res.document.root, res.document.nodes, res.document.collections || {});
        commandManager.clear();
        setIsDirty(false);
        setSaveStatus('saved');

        if (res.filePath) {
          setCurrentFilePath(res.filePath);
          const filename = res.filePath.split(/[\\/]/).pop() || res.document.metadata.name;
          setProjectName(filename);
        } else if (res.document.metadata.name) {
          setProjectName(res.document.metadata.name);
        }

        platformBridge.notifications?.notify('Project loaded successfully', 'success');
      } else if (res.error && res.error !== 'Cancelled') {
        platformBridge.notifications?.notify(`Open failed: ${res.error}`, 'error');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      platformBridge.notifications?.notify(`Open error: ${errMsg}`, 'error');
    }
  }, [platformBridge, sceneStore, commandManager]);

  const handleExportScene = useCallback(
    async (format: SupportedFileFormat) => {
      try {
        const doc = buildProjectDocument(sceneStore.getState(), projectName);
        const unifiedOutput = await exportScene(format, doc);
        const ext = format === 'glb' ? 'glb' : format === 'gltf' ? 'gltf' : format;
        const baseName = projectName.replace(/\.[^/.]+$/, '');
        const filename = `${baseName}.${ext}`;

        const res = await platformBridge.fileSystem.exportScene({
          filePath: filename,
          format,
          data: unifiedOutput.data,
        });

        if (res.success) {
          platformBridge.notifications?.notify(
            `Exported scene to ${format.toUpperCase()}`,
            'success',
          );
        } else if (res.error && res.error !== 'Cancelled') {
          platformBridge.notifications?.notify(`Export failed: ${res.error}`, 'error');
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        platformBridge.notifications?.notify(`Export error: ${errMsg}`, 'error');
      }
    },
    [projectName, platformBridge, sceneStore],
  );

  const handleImportScene = useCallback(
    async (format: SupportedFileFormat) => {
      try {
        const res = await platformBridge.fileSystem.importScene({ format });
        if (res.success && res.document) {
          sceneStore
            .getState()
            .loadScene(res.document.root, res.document.nodes, res.document.collections || {});
          setIsDirty(true);
          setSaveStatus('unsaved');
          platformBridge.notifications?.notify(
            `Imported ${format.toUpperCase()} into scene`,
            'success',
          );
        } else if (res.error && res.error !== 'Cancelled') {
          platformBridge.notifications?.notify(`Import failed: ${res.error}`, 'error');
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        platformBridge.notifications?.notify(`Import error: ${errMsg}`, 'error');
      }
    },
    [platformBridge, sceneStore],
  );

  // Menu action dispatcher
  const handleMenuAction = useCallback(
    async (actionId: string) => {
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
          await handleImportScene('gltf');
          break;
        case 'import:obj':
          await handleImportScene('obj');
          break;
        case 'import:stl':
          await handleImportScene('stl');
          break;
        case 'export:gltf':
          await handleExportScene('gltf');
          break;
        case 'export:glb':
          await handleExportScene('glb');
          break;
        case 'export:obj':
          await handleExportScene('obj');
          break;
        case 'export:stl':
          await handleExportScene('stl');
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
          platformBridge.window?.close?.();
          break;
      }
    },
    [
      handleNewProject,
      handleOpenProject,
      handleSaveProject,
      handleImportScene,
      handleExportScene,
      handleUndo,
      handleRedo,
      handleAddPrimitive,
      handleDuplicateSelected,
      handleDeleteSelected,
      platformBridge,
    ],
  );

  // Electron Native Menu Listener (if available)
  useEffect(() => {
    const bridge = (window as any).electronBridge || (window as any).electronAPI;
    if (bridge?.onMenuAction) {
      return bridge.onMenuAction((action: string) => {
        handleMenuAction(action);
      });
    }
    return undefined;
  }, [handleMenuAction]);

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept shortcuts when user is typing in form controls
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      // Sculpt Mode Specific Hotkeys
      if (isSculptMode) {
        if ((e.key === 'i' || e.key === 'I') && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleMaskOperation('invert');
          return;
        }
        if ((e.key === 'm' || e.key === 'M') && e.altKey) {
          e.preventDefault();
          handleMaskOperation('clear');
          return;
        }
        if ((e.key === 'r' || e.key === 'R') && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleExecuteRemesh(remeshConfig);
          return;
        }

        // Single key brush switches (when not holding modifier)
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          if (e.key === 'x' || e.key === 'X') {
            setActiveSculptBrush('draw');
            return;
          }
          if (e.key === 'c' || e.key === 'C') {
            setActiveSculptBrush('clay');
            return;
          }
          if (e.key === 'g' || e.key === 'G') {
            setActiveSculptBrush('grab');
            return;
          }
          if (e.key === 'i' || e.key === 'I') {
            setActiveSculptBrush('inflate');
            return;
          }
          if (e.key === 'b' || e.key === 'B') {
            setActiveSculptBrush('blob');
            return;
          }
          if (e.key === 'm' || e.key === 'M') {
            setActiveSculptBrush('mask');
            return;
          }
          if (e.key === 'p' || e.key === 'P') {
            setActiveSculptBrush('pinch');
            return;
          }
          if (e.key === 't' || e.key === 'T') {
            setActiveSculptBrush('flatten');
            return;
          }
          if (e.key === 's' || e.key === 'S') {
            setActiveSculptBrush('smooth');
            return;
          }
        }
      }

      // Tab key: Toggle between Object Mode and Edit Mode
      if (e.key === 'Tab') {
        e.preventDefault();
        setViewportMode((prev) => (prev === 'edit' ? 'object' : 'edit'));
        return;
      }

      // Edit Mode Specific Hotkeys
      if (isEditMode) {
        // Element selection modes: 1 (vertex), 2 (edge), 3 (face)
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          if (e.key === '1') {
            e.preventDefault();
            handleSelectEditElementMode('vertex', e.shiftKey);
            return;
          }
          if (e.key === '2') {
            e.preventDefault();
            handleSelectEditElementMode('edge', e.shiftKey);
            return;
          }
          if (e.key === '3') {
            e.preventDefault();
            handleSelectEditElementMode('face', e.shiftKey);
            return;
          }

          // Delete / Dissolve menu on X or Delete
          if (e.key === 'x' || e.key === 'X' || e.key === 'Delete') {
            e.preventDefault();
            setDeleteMenuPosition({
              x: typeof window !== 'undefined' ? window.innerWidth / 2 - 100 : 300,
              y: typeof window !== 'undefined' ? window.innerHeight / 2 - 120 : 250,
            });
            setIsDeleteMenuOpen(true);
            return;
          }

          // Edit Tool switches
          if (e.key === 'w' || e.key === 'W') {
            setActiveEditTool('select');
            return;
          }
          if (e.key === 'e' || e.key === 'E') {
            setActiveEditTool('extrude');
            return;
          }
          if (e.key === 'i' || e.key === 'I') {
            setActiveEditTool('inset');
            return;
          }
          if (e.key === 'k' || e.key === 'K') {
            setActiveEditTool('knife');
            return;
          }
        }

        // Ctrl+B: Bevel
        if ((e.key === 'b' || e.key === 'B') && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          setActiveEditTool('bevel');
          return;
        }

        // Ctrl+R: Loop Cut
        if ((e.key === 'r' || e.key === 'R') && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          setActiveEditTool('loopcut');
          return;
        }
      }

      // Hotkey: G (translate)
      if (e.key === 'g' || e.key === 'G') {
        setGizmoType('translate');
      }
      // Hotkey: R (rotate)
      else if (e.key === 'r' || e.key === 'R') {
        setGizmoType('rotate');
      }
      // Hotkey: S (scale) - only if Ctrl/Meta is not pressed
      else if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) {
        setGizmoType('scale');
      }
      // Hotkey: W (box select / none)
      else if (e.key === 'w' || e.key === 'W') {
        setGizmoType('none');
      }
      // Hotkey: X or Delete (delete object - in object mode only)
      else if (
        (!isSculptMode && !isEditMode && (e.key === 'x' || e.key === 'X')) ||
        (!isSculptMode && !isEditMode && e.key === 'Delete')
      ) {
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
      // Hotkey: Ctrl+S (save) / Ctrl+Shift+S (save as)
      else if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSaveProject(e.shiftKey);
      }
      // Hotkey: Ctrl+O (open)
      else if ((e.key === 'o' || e.key === 'O') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleOpenProject();
      }
      // Hotkey: Ctrl+N (new)
      else if ((e.key === 'n' || e.key === 'N') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleNewProject();
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
      // Hotkey: Ctrl+, (preferences modal)
      else if (e.key === ',' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setIsPreferencesOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    startFrame,
    endFrame,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleUndo,
    handleRedo,
    handleSaveProject,
    handleOpenProject,
    handleNewProject,
  ]);

  // Command Palette Actions
  const commandPaletteActions: CommandPaletteAction[] = [
    // Primitives
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
    // Tools
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
    // Object Ops
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
    // Shading
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
    // File
    {
      id: 'cp:file:new',
      name: 'New Project',
      category: 'File',
      shortcut: 'Ctrl+N',
      onExecute: handleNewProject,
    },
    {
      id: 'cp:file:open',
      name: 'Open Project',
      category: 'File',
      shortcut: 'Ctrl+O',
      onExecute: handleOpenProject,
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
      name: 'Save Project As...',
      category: 'File',
      shortcut: 'Ctrl+Shift+S',
      onExecute: () => handleSaveProject(true),
    },
    // General
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

  // Register built-in commands with CommandRegistry
  useEffect(() => {
    const reg = commandRegistryRef.current;
    reg.registerBatch([
      {
        id: 'cp:add:cube',
        name: 'Add Cube',
        category: 'mesh',
        execute: () => handleAddPrimitive('cube'),
      },
      {
        id: 'cp:add:sphere',
        name: 'Add Sphere',
        category: 'mesh',
        execute: () => handleAddPrimitive('sphere'),
      },
      {
        id: 'cp:tool:translate',
        name: 'Translate Tool',
        category: 'transform',
        execute: () => setGizmoType('translate'),
      },
      {
        id: 'cp:tool:rotate',
        name: 'Rotate Tool',
        category: 'transform',
        execute: () => setGizmoType('rotate'),
      },
      {
        id: 'cp:tool:scale',
        name: 'Scale Tool',
        category: 'transform',
        execute: () => setGizmoType('scale'),
      },
      {
        id: 'cp:obj:duplicate',
        name: 'Duplicate Object',
        category: 'object',
        execute: handleDuplicateSelected,
      },
      {
        id: 'cp:obj:delete',
        name: 'Delete Object',
        category: 'object',
        execute: handleDeleteSelected,
      },
      {
        id: 'cp:file:new',
        name: 'New Project',
        category: 'file',
        execute: handleNewProject,
      },
      {
        id: 'cp:file:open',
        name: 'Open Project',
        category: 'file',
        execute: handleOpenProject,
      },
      {
        id: 'cp:file:save',
        name: 'Save Project',
        category: 'file',
        execute: () => handleSaveProject(false),
      },
      {
        id: 'edit:undo',
        name: 'Undo',
        category: 'edit',
        execute: handleUndo,
      },
      {
        id: 'edit:redo',
        name: 'Redo',
        category: 'edit',
        execute: handleRedo,
      },
    ]);
  }, [
    handleAddPrimitive,
    handleDuplicateSelected,
    handleDeleteSelected,
    handleNewProject,
    handleOpenProject,
    handleSaveProject,
    handleUndo,
    handleRedo,
  ]);

  // Active node for properties inspector
  const activeNode = sceneState.activeNodeId
    ? sceneState.nodes[sceneState.activeNodeId] || null
    : null;
  const activeNodeMaterialConfig =
    (activeNode?.metadata?.materialConfig as PBRMaterialConfig) || undefined;

  // Scene polycounts statistics
  const { totalObjects, totalVertices, totalFaces } = calculateScenePolycounts(sceneState.nodes);

  // Polycounts & Selection Stats for Edit Mode
  const activeMeshNode = activeNode && activeNode.type === 'mesh' ? (activeNode as any) : null;
  const editSelectionStats: EditSelectionStats = useMemo(() => {
    const totalV = activeMeshNode?.geometry?.vertices?.length
      ? Math.floor(activeMeshNode.geometry.vertices.length / 3)
      : totalVertices || 8;
    const totalF = activeMeshNode?.geometry?.indices?.length
      ? Math.floor(activeMeshNode.geometry.indices.length / 3)
      : totalFaces || 6;
    const totalE = Math.round(totalV + totalF - 2);

    return {
      selectedVertices: isEditMode ? Math.min(4, totalV) : 0,
      totalVertices: totalV,
      selectedEdges: isEditMode ? Math.min(4, totalE) : 0,
      totalEdges: Math.max(0, totalE),
      selectedFaces: isEditMode ? Math.min(1, totalF) : 0,
      totalFaces: totalF,
    };
  }, [activeMeshNode, isEditMode, totalVertices, totalFaces]);

  // Status indicator content
  const renderSaveStatusIndicator = () => (
    <div className="flex items-center gap-2 pr-3 pl-2 bg-[#282828] h-full border-l border-[#181818]">
      <span
        className="text-[11px] flex items-center gap-1 font-mono"
        title={saveStatus === 'saved' ? 'Saved' : 'Unsaved changes'}
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
  );

  return (
    <div
      className={`w-screen h-screen overflow-hidden flex flex-col bg-[#1d1e22] text-[#dedede] select-none ${className}`}
    >
      <DockLayout
        header={
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
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSelectWorkspace={handleSelectWorkspace}
            headerPrefix={headerPrefix}
            headerSuffix={headerSuffix || renderSaveStatusIndicator()}
            editElementModes={activeElementModes}
            onSelectEditElementMode={handleSelectEditElementMode}
            activeSculptBrush={activeSculptBrush}
            sculptBrushConfig={activeBrushConfig}
            onUpdateSculptBrushConfig={handleUpdateSculptBrushConfig}
            onSelectSculptBrush={setActiveSculptBrush}
            sculptSymmetry={sculptSymmetry}
            onUpdateSculptSymmetry={handleUpdateSculptSymmetry}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onMinimize={platformBridge.window?.minimize}
            onMaximize={platformBridge.window?.maximize}
            onClose={platformBridge.window?.close}
            className="w-full"
          />
        }
        toolbar={
          isSculptMode ? (
            <SculptToolbar activeBrush={activeSculptBrush} onSelectBrush={setActiveSculptBrush} />
          ) : isEditMode ? (
            <EditModeToolbar activeTool={activeEditTool} onSelectTool={setActiveEditTool} />
          ) : (
            <ViewportToolbar
              activeGizmo={gizmoType}
              onChangeGizmo={setGizmoType}
              onAddPrimitive={handleAddPrimitive}
            />
          )
        }
        viewport={
          <div
            className="relative w-full h-full flex flex-col"
            onContextMenu={(e) => {
              if (isEditMode) {
                e.preventDefault();
                setContextMenuPosition({ x: e.clientX, y: e.clientY });
                setIsContextMenuOpen(true);
              }
            }}
          >
            {isEditMode && (
              <EditToolSettingsBar
                activeTool={activeEditTool}
                settings={editModeSettings}
                onUpdateSettings={handleUpdateEditModeSettings}
                onApplyOperation={handleExecuteEditOperation}
              />
            )}
            <div className="flex-1 relative overflow-hidden">
              <ViewportContainer
                sceneStore={sceneStore}
                commandManager={commandManager}
                config={viewportConfig}
                showToolbar={true}
                showOverlays={true}
                showStats={true}
                onConfigChange={handleViewportConfigChange}
                className="w-full h-full"
              />
            </div>
            {isSculptMode && (
              <SculptStatusBar
                activeBrush={activeSculptBrush}
                brushDirection={activeBrushConfig.direction}
                vertexCount={totalVertices}
                faceCount={totalFaces}
                lastStrokeDurationMs={lastStrokeDurationMs}
                symmetry={sculptSymmetry}
                maskEnabled={maskEnabled}
                maskCoveragePercent={maskCoveragePercent}
              />
            )}
            {isEditMode && (
              <EditModeStatusBar
                activeTool={activeEditTool}
                activeElementModes={activeElementModes}
                selectionStats={editSelectionStats}
              />
            )}
          </div>
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
            viewportMode={viewportMode}
            editModeTool={activeEditTool}
            onSelectEditModeTool={setActiveEditTool}
            editModeSettings={editModeSettings}
            onUpdateEditModeSettings={handleUpdateEditModeSettings}
            activeElementModes={activeElementModes}
            editSelectionStats={editSelectionStats}
            onExecuteEditOperation={handleExecuteEditOperation}
            activeSculptBrush={activeSculptBrush}
            sculptBrushConfig={activeBrushConfig}
            onUpdateSculptBrushConfig={handleUpdateSculptBrushConfig}
            sculptStrokeSettings={sculptStrokeSettings}
            onUpdateSculptStrokeSettings={handleUpdateSculptStrokeSettings}
            sculptSymmetry={sculptSymmetry}
            onUpdateSculptSymmetry={handleUpdateSculptSymmetry}
            onMaskOperation={handleMaskOperation}
            maskEnabled={maskEnabled}
            onToggleMaskEnabled={setMaskEnabled}
            maskCoveragePercent={maskCoveragePercent}
            remeshConfig={remeshConfig}
            onUpdateRemeshConfig={handleUpdateRemeshConfig}
            onExecuteRemesh={handleExecuteRemesh}
            isRemeshing={isRemeshing}
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
            totalVertices={totalVertices}
            totalFaces={totalFaces}
            totalObjects={totalObjects}
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

      {/* Edit Mode Context Menu */}
      <EditContextMenu
        isOpen={isContextMenuOpen}
        position={contextMenuPosition}
        elementMode={activeElementModes[0] || 'vertex'}
        onClose={() => setIsContextMenuOpen(false)}
        onSelectAction={handleExecuteEditOperation}
        hasSelection={true}
      />

      {/* Delete / Dissolve Popup Menu */}
      <DeleteDissolveMenu
        isOpen={isDeleteMenuOpen}
        position={deleteMenuPosition}
        onClose={() => setIsDeleteMenuOpen(false)}
        onSelectOption={handleExecuteEditOperation}
      />
    </div>
  );
};

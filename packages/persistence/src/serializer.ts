import type {
  ProjectDocument,
  ProjectMetadata,
  AnimationTimeline,
  IAnimationAction,
  IAnimationChannel,
} from '@blender-elt/contracts';
import { ProjectDocumentSchema } from './schema.js';
import type { IStorageAdapter } from './storage.js';

export const CURRENT_PROJECT_VERSION = '1.1.0';
export const LEGACY_PROJECT_VERSION = '1.0.0';
export const SUPPORTED_PROJECT_VERSIONS = ['1.0.0', '1.1.0'] as const;

/**
 * Creates default project metadata
 */
export function createProjectMetadata(name = 'Untitled Project', author = 'User'): ProjectMetadata {
  const now = new Date().toISOString();
  return {
    name,
    author,
    version: CURRENT_PROJECT_VERSION,
    createdAt: now,
    updatedAt: now,
    appVersion: '0.1.0',
    description: 'Blender-ELT 3D Project',
  };
}

/**
 * Creates a minimal default project document
 */
export function createDefaultProjectDocument(
  name = 'Untitled Project',
  author = 'User',
): ProjectDocument {
  return {
    version: CURRENT_PROJECT_VERSION,
    metadata: createProjectMetadata(name, author),
    root: {
      id: 'root',
      name: 'Scene Root',
      type: 'root',
      childrenIds: ['cube-default'],
      backgroundColor: '#1d1e22',
    },
    nodes: {
      'cube-default': {
        id: 'cube-default',
        name: 'Cube',
        type: 'mesh',
        geometryId: 'geo-cube-default',
        primitiveType: 'cube',
        materialId: 'mat-clay-default',
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, order: 'XYZ' },
          scale: { x: 1, y: 1, z: 1 },
        },
        visible: true,
        locked: false,
        parentId: 'root',
        childrenIds: [],
        castShadow: true,
        receiveShadow: true,
      },
    },
    geometries: {},
    materials: {},
    collections: {},
  };
}

/**
 * Migrates a legacy (v1.0.0) project document to modern v1.1.0 format.
 * Converts legacy animation tracks to modern animation channels under a default action ("Action").
 */
export function migrateProjectDocument(doc: ProjectDocument): ProjectDocument {
  const migrated: ProjectDocument = { ...doc };

  if (migrated.timeline) {
    const timeline: AnimationTimeline = {
      currentFrame: migrated.timeline.currentFrame ?? 1,
      startFrame: migrated.timeline.startFrame ?? 1,
      endFrame: migrated.timeline.endFrame ?? 250,
      fps: migrated.timeline.fps ?? 24,
      playbackState: migrated.timeline.playbackState ?? 'stopped',
      isPlaying: migrated.timeline.isPlaying ?? false,
      loop: migrated.timeline.loop ?? true,
      tracks: migrated.timeline.tracks ? [...migrated.timeline.tracks] : [],
      actions: migrated.timeline.actions ? { ...migrated.timeline.actions } : {},
      activeActionId: migrated.timeline.activeActionId,
      nlaTracks: migrated.timeline.nlaTracks ? [...migrated.timeline.nlaTracks] : [],
    };

    const tracks = timeline.tracks || [];
    const actions = timeline.actions || {};

    const hasActionsWithChannels = Object.values(actions).some(
      (act) => act && Array.isArray(act.channels) && act.channels.length > 0,
    );

    if (tracks.length > 0 && !hasActionsWithChannels) {
      const defaultActionId = 'action_default';
      const migratedChannels: IAnimationChannel[] = tracks.map((track, index) => {
        const legacyProp = (track as any).property;
        const propPath = track.propertyPath || legacyProp || 'position';
        return {
          id: track.id || `chan_${index}_${Date.now()}`,
          name: track.name || `Channel ${index + 1}`,
          targetNodeId: track.targetNodeId || '',
          propertyPath: propPath,
          keyframes: Array.isArray(track.keyframes)
            ? track.keyframes.map((kf, kfIndex) => ({
                id: kf.id || `kf_${kfIndex}_${kf.frame}`,
                frame: kf.frame,
                time: kf.time ?? (kf.frame - 1) / (timeline.fps || 24),
                value: kf.value,
                interpolation: kf.interpolation || track.interpolation || 'bezier',
                handleTypeLeft: kf.handleTypeLeft,
                handleTypeRight: kf.handleTypeRight,
                handleLeft: kf.handleLeft,
                handleRight: kf.handleRight,
                keyframeType: kf.keyframeType,
                selected: kf.selected,
                handleLeftSelected: kf.handleLeftSelected,
                handleRightSelected: kf.handleRightSelected,
                inTangent: kf.inTangent,
                outTangent: kf.outTangent,
              }))
            : [],
          interpolation: track.interpolation || 'bezier',
          extrapolation: track.extrapolation || 'constant',
          color: track.color || '#4772b3',
          muted: Boolean(track.muted),
          locked: Boolean(track.locked),
          modifiers: Array.isArray(track.modifiers) ? (track.modifiers as any) : [],
        };
      });

      const defaultAction: IAnimationAction = {
        id: defaultActionId,
        name: 'Action',
        groups: [],
        channels: migratedChannels,
        frameRange: [timeline.startFrame, timeline.endFrame],
        isLooping: timeline.loop,
      };

      if (!timeline.actions) {
        timeline.actions = {};
      }
      timeline.actions[defaultActionId] = defaultAction;
      if (!timeline.activeActionId) {
        timeline.activeActionId = defaultActionId;
      }
    }

    migrated.timeline = timeline;
  }

  migrated.version = CURRENT_PROJECT_VERSION;
  if (migrated.metadata) {
    migrated.metadata = {
      ...migrated.metadata,
      version: CURRENT_PROJECT_VERSION,
    };
  }

  return migrated;
}

/**
 * Validates arbitrary data against ProjectDocumentSchema and applies schema migrations
 */
export function validateProjectDocument(data: unknown): {
  success: boolean;
  data?: ProjectDocument;
  error?: string;
} {
  const result = ProjectDocumentSchema.safeParse(data);
  if (result.success) {
    const validatedData = result.data as unknown as ProjectDocument;
    const migrated = migrateProjectDocument(validatedData);
    return { success: true, data: migrated };
  }
  const issues = (result.error as any).issues || (result.error as any).errors || [];
  const errorMessage =
    issues.length > 0
      ? issues.map((e: any) => `${e.path?.join('.') || 'root'}: ${e.message}`).join('; ')
      : result.error.message;
  return { success: false, error: errorMessage };
}

/**
 * Serializes ProjectDocument to JSON string (.belt)
 */
export function serializeProject(doc: ProjectDocument, options?: { pretty?: boolean }): string {
  const migrated = migrateProjectDocument(doc);
  const updatedDoc: ProjectDocument = {
    ...migrated,
    version: CURRENT_PROJECT_VERSION,
    metadata: {
      ...migrated.metadata,
      version: CURRENT_PROJECT_VERSION,
      updatedAt: new Date().toISOString(),
    },
  };

  const validation = validateProjectDocument(updatedDoc);
  if (!validation.success || !validation.data) {
    throw new Error(`Cannot serialize invalid project document: ${validation.error}`);
  }

  const space = (options?.pretty ?? true) ? 2 : undefined;
  return JSON.stringify(validation.data, null, space);
}

/**
 * Deserializes JSON string into ProjectDocument with schema validation and automatic migration
 */
export function deserializeProject(jsonString: string): ProjectDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse JSON string: ${msg}`);
  }

  const validation = validateProjectDocument(parsed);
  if (!validation.success || !validation.data) {
    throw new Error(`Project schema validation failed: ${validation.error}`);
  }

  return validation.data;
}

/**
 * Helper to save a project document via a storage adapter
 */
export async function saveProject(
  adapter: IStorageAdapter,
  pathOrKey: string,
  doc: ProjectDocument,
  options?: { pretty?: boolean },
): Promise<void> {
  const serialized = serializeProject(doc, options);
  await adapter.write(pathOrKey, serialized);
}

/**
 * Helper to load a project document via a storage adapter
 */
export async function loadProject(
  adapter: IStorageAdapter,
  pathOrKey: string,
): Promise<ProjectDocument> {
  const content = await adapter.read(pathOrKey);
  return deserializeProject(content);
}

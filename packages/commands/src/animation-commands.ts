import type {
  CommandContext,
  Vector3,
  Euler,
  AnimationProperty,
  AnimationPropertyPath,
  IKeyframe,
  KeyframeInterpolation,
  KeyframeHandleType,
  BezierHandle,
} from '@blender-elt/contracts';
import { type TimelineState, timelineStore, createTrack } from '@blender-elt/animation';
import { BaseCommand } from './commands.js';

/**
 * Extracts TimelineState from CommandContext or falls back to global timelineStore
 */
export function getTimelineStore(ctx: CommandContext): TimelineState {
  // 1. ctx.metadata
  const meta = ctx.metadata;
  if (meta) {
    if (meta.timelineStore) {
      const s = meta.timelineStore as Record<string, unknown>;
      if (typeof s.getState === 'function') {
        return (s.getState as () => TimelineState)();
      }
      if (typeof s.insertKeyframe === 'function') {
        return s as unknown as TimelineState;
      }
    }
    if (meta.timeline) {
      const t = meta.timeline as Record<string, unknown>;
      if (typeof t.getState === 'function') {
        return (t.getState as () => TimelineState)();
      }
      if (typeof t.insertKeyframe === 'function') {
        return t as unknown as TimelineState;
      }
    }
  }

  // 2. ctx.state
  const st = ctx.state as Record<string, unknown> | null | undefined;
  if (st) {
    if (typeof st.insertKeyframe === 'function' && typeof st.getChannel === 'function') {
      return st as unknown as TimelineState;
    }
    if (st.timelineStore) {
      const s = st.timelineStore as Record<string, unknown>;
      if (typeof s.getState === 'function') {
        return (s.getState as () => TimelineState)();
      }
      if (typeof s.insertKeyframe === 'function') {
        return s as unknown as TimelineState;
      }
    }
    if (st.timeline) {
      const t = st.timeline as Record<string, unknown>;
      if (typeof t.getState === 'function') {
        return (t.getState as () => TimelineState)();
      }
      if (typeof t.insertKeyframe === 'function') {
        return t as unknown as TimelineState;
      }
    }
  }

  // 3. Direct ctx properties
  const direct = ctx as unknown as Record<string, unknown>;
  if (direct.timelineStore) {
    const s = direct.timelineStore as Record<string, unknown>;
    if (typeof s.getState === 'function') {
      return (s.getState as () => TimelineState)();
    }
    if (typeof s.insertKeyframe === 'function') {
      return s as unknown as TimelineState;
    }
  }
  if (direct.timeline) {
    const t = direct.timeline as Record<string, unknown>;
    if (typeof t.getState === 'function') {
      return (t.getState as () => TimelineState)();
    }
    if (typeof t.insertKeyframe === 'function') {
      return t as unknown as TimelineState;
    }
  }

  // 4. Fallback to singleton timelineStore from @blender-elt/animation
  return timelineStore.getState();
}

/**
 * Alias for getTimelineStore
 */
export const getTimelineState = getTimelineStore;

/**
 * Helper to assign standard Blender F-Curve axis colors
 */
export function getPropertyColor(propertyPath: string): string {
  if (propertyPath.endsWith('.x') || propertyPath.endsWith('.r')) return '#e53e3e'; // Red (X / R)
  if (propertyPath.endsWith('.y') || propertyPath.endsWith('.g')) return '#38a169'; // Green (Y / G)
  if (propertyPath.endsWith('.z') || propertyPath.endsWith('.b')) return '#3182ce'; // Blue (Z / B)
  return '#4772b3'; // Blender accent blue
}

/**
 * Helper to extract { x, y, z } from Vector3 / Euler objects or tuples
 */
function extractXYZ(val: unknown): { x?: number; y?: number; z?: number } | undefined {
  if (!val) return undefined;
  if (Array.isArray(val)) {
    return {
      x: typeof val[0] === 'number' ? val[0] : undefined,
      y: typeof val[1] === 'number' ? val[1] : undefined,
      z: typeof val[2] === 'number' ? val[2] : undefined,
    };
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    return {
      x: typeof obj.x === 'number' ? obj.x : undefined,
      y: typeof obj.y === 'number' ? obj.y : undefined,
      z: typeof obj.z === 'number' ? obj.z : undefined,
    };
  }
  return undefined;
}

/**
 * 1. InsertKeyframeCommand
 * Inserts or replaces a keyframe on a specific track/channel with undo/redo support.
 */
export class InsertKeyframeCommand extends BaseCommand {
  public readonly channelId: string;
  public readonly keyframe: Omit<IKeyframe, 'time'> & { time?: number };
  private previousKeyframe: IKeyframe | null = null;

  constructor(channelId: string, keyframe: Omit<IKeyframe, 'time'> & { time?: number }) {
    super(`Insert Keyframe (Frame ${keyframe.frame})`);
    this.channelId = channelId;
    this.keyframe = { ...keyframe };
  }

  public execute(ctx: CommandContext): void {
    const store = getTimelineStore(ctx);
    const existing = store.getKeyframe(this.channelId, this.keyframe.frame);
    this.previousKeyframe = existing ? { ...existing } : null;
    store.insertKeyframe(this.channelId, this.keyframe);
  }

  public undo(ctx: CommandContext): void {
    const store = getTimelineStore(ctx);
    if (this.previousKeyframe) {
      store.insertKeyframe(this.channelId, this.previousKeyframe);
    } else {
      store.removeKeyframe(this.channelId, this.keyframe.frame);
    }
  }

  public redo(ctx: CommandContext): void {
    const store = getTimelineStore(ctx);
    store.insertKeyframe(this.channelId, this.keyframe);
  }
}

/**
 * 2. DeleteKeyframeCommand
 * Deletes a keyframe at a specified frame and caches it for undo restoration.
 */
export class DeleteKeyframeCommand extends BaseCommand {
  public readonly channelId: string;
  public readonly frame: number;
  private deletedKeyframe: IKeyframe | null = null;

  constructor(channelId: string, frame: number) {
    super(`Delete Keyframe (Frame ${frame})`);
    this.channelId = channelId;
    this.frame = frame;
  }

  public execute(ctx: CommandContext): void {
    const store = getTimelineStore(ctx);
    const existing = store.getKeyframe(this.channelId, this.frame);
    if (!existing) return;

    this.deletedKeyframe = { ...existing };
    store.removeKeyframe(this.channelId, this.frame);
  }

  public undo(ctx: CommandContext): void {
    if (!this.deletedKeyframe) return;
    const store = getTimelineStore(ctx);
    store.insertKeyframe(this.channelId, this.deletedKeyframe);
  }

  public redo(ctx: CommandContext): void {
    const store = getTimelineStore(ctx);
    store.removeKeyframe(this.channelId, this.frame);
  }
}

/**
 * 3. MoveKeyframeCommand
 * Moves a keyframe from oldFrame to newFrame, caching any overwritten keyframe at newFrame.
 */
export class MoveKeyframeCommand extends BaseCommand {
  public readonly channelId: string;
  public readonly oldFrame: number;
  public readonly newFrame: number;
  private movedKeyframe: IKeyframe | null = null;
  private overwrittenKeyframe: IKeyframe | null = null;

  constructor(channelId: string, oldFrame: number, newFrame: number) {
    super(`Move Keyframe (${oldFrame} -> ${newFrame})`);
    this.channelId = channelId;
    this.oldFrame = oldFrame;
    this.newFrame = newFrame;
  }

  public execute(ctx: CommandContext): void {
    if (this.oldFrame === this.newFrame) return;

    const store = getTimelineStore(ctx);
    const original = store.getKeyframe(this.channelId, this.oldFrame);
    if (!original) return;

    this.movedKeyframe = { ...original };
    const target = store.getKeyframe(this.channelId, this.newFrame);
    this.overwrittenKeyframe = target ? { ...target } : null;

    store.removeKeyframe(this.channelId, this.oldFrame);
    store.insertKeyframe(this.channelId, {
      ...original,
      frame: this.newFrame,
    });
  }

  public undo(ctx: CommandContext): void {
    if (!this.movedKeyframe) return;

    const store = getTimelineStore(ctx);
    store.removeKeyframe(this.channelId, this.newFrame);
    store.insertKeyframe(this.channelId, this.movedKeyframe);

    if (this.overwrittenKeyframe) {
      store.insertKeyframe(this.channelId, this.overwrittenKeyframe);
    }
  }

  public redo(ctx: CommandContext): void {
    this.execute(ctx);
  }
}

/**
 * 4. SetInterpolationCommand
 * Updates the interpolation mode of a keyframe with undo/redo restoration.
 */
export class SetInterpolationCommand extends BaseCommand {
  public readonly channelId: string;
  public readonly frame: number;
  public readonly newInterpolation: KeyframeInterpolation;
  private oldInterpolation: KeyframeInterpolation | null = null;

  constructor(
    channelId: string,
    frame: number,
    newInterpolation: KeyframeInterpolation,
    oldInterpolation?: KeyframeInterpolation,
  ) {
    super(`Set Interpolation (${newInterpolation})`);
    this.channelId = channelId;
    this.frame = frame;
    this.newInterpolation = newInterpolation;
    if (oldInterpolation) {
      this.oldInterpolation = oldInterpolation;
    }
  }

  public execute(ctx: CommandContext): void {
    const store = getTimelineStore(ctx);
    const kf = store.getKeyframe(this.channelId, this.frame);
    if (!kf) return;

    if (!this.oldInterpolation) {
      this.oldInterpolation = kf.interpolation ?? 'linear';
    }

    store.insertKeyframe(this.channelId, {
      ...kf,
      interpolation: this.newInterpolation,
    });
  }

  public undo(ctx: CommandContext): void {
    if (!this.oldInterpolation) return;

    const store = getTimelineStore(ctx);
    const kf = store.getKeyframe(this.channelId, this.frame);
    if (!kf) return;

    store.insertKeyframe(this.channelId, {
      ...kf,
      interpolation: this.oldInterpolation,
    });
  }

  public redo(ctx: CommandContext): void {
    this.execute(ctx);
  }
}

/**
 * 5. SetKeyframeTangentsCommand
 * Updates Bezier control handles and handle types on a keyframe with undo/redo restoration.
 */
export class SetKeyframeTangentsCommand extends BaseCommand {
  public readonly channelId: string;
  public readonly frame: number;
  public readonly handles: {
    handleLeft?: BezierHandle;
    handleRight?: BezierHandle;
  };
  public readonly handleTypes?: {
    handleTypeLeft?: KeyframeHandleType;
    handleTypeRight?: KeyframeHandleType;
  };
  private oldHandles: {
    handleLeft?: BezierHandle;
    handleRight?: BezierHandle;
  } | null = null;
  private oldHandleTypes: {
    handleTypeLeft?: KeyframeHandleType;
    handleTypeRight?: KeyframeHandleType;
  } | null = null;

  constructor(
    channelId: string,
    frame: number,
    handles: {
      handleLeft?: BezierHandle;
      handleRight?: BezierHandle;
    },
    handleTypes?: {
      handleTypeLeft?: KeyframeHandleType;
      handleTypeRight?: KeyframeHandleType;
    },
  ) {
    super(`Set Keyframe Tangents (Frame ${frame})`);
    this.channelId = channelId;
    this.frame = frame;
    this.handles = {
      handleLeft: handles.handleLeft ? { ...handles.handleLeft } : undefined,
      handleRight: handles.handleRight ? { ...handles.handleRight } : undefined,
    };
    this.handleTypes = handleTypes ? { ...handleTypes } : undefined;
  }

  public execute(ctx: CommandContext): void {
    const store = getTimelineStore(ctx);
    const kf = store.getKeyframe(this.channelId, this.frame);
    if (!kf) return;

    this.oldHandles = {
      handleLeft: kf.handleLeft ? { ...kf.handleLeft } : undefined,
      handleRight: kf.handleRight ? { ...kf.handleRight } : undefined,
    };
    this.oldHandleTypes = {
      handleTypeLeft: kf.handleTypeLeft,
      handleTypeRight: kf.handleTypeRight,
    };

    const updated: IKeyframe = { ...kf };
    if (this.handles.handleLeft !== undefined) {
      updated.handleLeft = this.handles.handleLeft ? { ...this.handles.handleLeft } : undefined;
    }
    if (this.handles.handleRight !== undefined) {
      updated.handleRight = this.handles.handleRight ? { ...this.handles.handleRight } : undefined;
    }
    if (this.handleTypes?.handleTypeLeft !== undefined) {
      updated.handleTypeLeft = this.handleTypes.handleTypeLeft;
    }
    if (this.handleTypes?.handleTypeRight !== undefined) {
      updated.handleTypeRight = this.handleTypes.handleTypeRight;
    }

    store.insertKeyframe(this.channelId, updated);
  }

  public undo(ctx: CommandContext): void {
    if (!this.oldHandles) return;

    const store = getTimelineStore(ctx);
    const kf = store.getKeyframe(this.channelId, this.frame);
    if (!kf) return;

    const restored: IKeyframe = {
      ...kf,
      handleLeft: this.oldHandles.handleLeft ? { ...this.oldHandles.handleLeft } : undefined,
      handleRight: this.oldHandles.handleRight ? { ...this.oldHandles.handleRight } : undefined,
      handleTypeLeft: this.oldHandleTypes?.handleTypeLeft,
      handleTypeRight: this.oldHandleTypes?.handleTypeRight,
    };

    store.insertKeyframe(this.channelId, restored);
  }

  public redo(ctx: CommandContext): void {
    this.execute(ctx);
  }
}

/**
 * 6. SetTrackMutedCommand
 * Toggles or sets the muted flag of an animation track or action channel.
 */
export class SetTrackMutedCommand extends BaseCommand {
  public readonly trackOrChannelId: string;
  public readonly muted?: boolean;
  private previousMuted: boolean | null = null;
  private targetMuted: boolean = false;

  constructor(trackOrChannelId: string, muted?: boolean) {
    super(`Set Track Muted (${trackOrChannelId})`);
    this.trackOrChannelId = trackOrChannelId;
    this.muted = muted;
  }

  public execute(ctx: CommandContext): void {
    const store = getTimelineStore(ctx);
    const channel =
      store.getChannel(this.trackOrChannelId) ?? store.getTrack(this.trackOrChannelId);
    this.previousMuted = channel ? Boolean(channel.muted) : false;
    this.targetMuted = this.muted !== undefined ? this.muted : !this.previousMuted;
    store.muteTrack(this.trackOrChannelId, this.targetMuted);
  }

  public undo(ctx: CommandContext): void {
    if (this.previousMuted === null) return;
    const store = getTimelineStore(ctx);
    store.muteTrack(this.trackOrChannelId, this.previousMuted);
  }

  public redo(ctx: CommandContext): void {
    const store = getTimelineStore(ctx);
    store.muteTrack(this.trackOrChannelId, this.targetMuted);
  }
}

/**
 * 7. SetTrackLockedCommand
 * Toggles or sets the locked flag of an animation track or action channel.
 */
export class SetTrackLockedCommand extends BaseCommand {
  public readonly trackOrChannelId: string;
  public readonly locked?: boolean;
  private previousLocked: boolean | null = null;
  private targetLocked: boolean = false;

  constructor(trackOrChannelId: string, locked?: boolean) {
    super(`Set Track Locked (${trackOrChannelId})`);
    this.trackOrChannelId = trackOrChannelId;
    this.locked = locked;
  }

  public execute(ctx: CommandContext): void {
    const store = getTimelineStore(ctx);
    const channel =
      store.getChannel(this.trackOrChannelId) ?? store.getTrack(this.trackOrChannelId);
    this.previousLocked = channel ? Boolean(channel.locked) : false;
    this.targetLocked = this.locked !== undefined ? this.locked : !this.previousLocked;
    store.lockTrack(this.trackOrChannelId, this.targetLocked);
  }

  public undo(ctx: CommandContext): void {
    if (this.previousLocked === null) return;
    const store = getTimelineStore(ctx);
    store.lockTrack(this.trackOrChannelId, this.previousLocked);
  }

  public redo(ctx: CommandContext): void {
    const store = getTimelineStore(ctx);
    store.lockTrack(this.trackOrChannelId, this.targetLocked);
  }
}

/**
 * Parameters for InsertTransformKeyframeCommand
 */
export interface TransformKeyframeOptions {
  position?: Partial<Vector3> | [number, number, number];
  rotation?: Partial<Euler> | Partial<Vector3> | [number, number, number];
  scale?: Partial<Vector3> | [number, number, number];
  interpolation?: KeyframeInterpolation;
}

/**
 * 8. InsertTransformKeyframeCommand
 * Compound macro command: inserts keyframes across position.x/y/z, rotation.x/y/z, scale.x/y/z atomically.
 */
export class InsertTransformKeyframeCommand extends BaseCommand {
  public readonly targetNodeId: string;
  public readonly frame: number;
  public readonly position?: Partial<Vector3> | [number, number, number];
  public readonly rotation?: Partial<Euler> | Partial<Vector3> | [number, number, number];
  public readonly scale?: Partial<Vector3> | [number, number, number];
  public readonly interpolation?: KeyframeInterpolation;

  public commands: InsertKeyframeCommand[] = [];

  constructor(
    targetNodeId: string,
    frame: number,
    positionOrOptions?: Partial<Vector3> | [number, number, number] | TransformKeyframeOptions,
    rotation?: Partial<Euler> | Partial<Vector3> | [number, number, number],
    scale?: Partial<Vector3> | [number, number, number],
    interpolation?: KeyframeInterpolation,
  ) {
    super(`Insert Transform Keyframe (${targetNodeId} @ Frame ${frame})`);
    this.targetNodeId = targetNodeId;
    this.frame = frame;

    // Check if 3rd arg is an options object
    if (
      positionOrOptions &&
      typeof positionOrOptions === 'object' &&
      !Array.isArray(positionOrOptions) &&
      ('position' in positionOrOptions ||
        'rotation' in positionOrOptions ||
        'scale' in positionOrOptions ||
        'interpolation' in positionOrOptions)
    ) {
      const opts = positionOrOptions as TransformKeyframeOptions;
      this.position = opts.position;
      this.rotation = opts.rotation;
      this.scale = opts.scale;
      this.interpolation = opts.interpolation;
    } else {
      this.position = positionOrOptions as Partial<Vector3> | [number, number, number] | undefined;
      this.rotation = rotation;
      this.scale = scale;
      this.interpolation = interpolation;
    }
  }

  private findOrCreateChannel(
    store: TimelineState,
    targetNodeId: string,
    propertyPath: AnimationPropertyPath,
  ): string {
    // 1. Search in active action
    if (store.activeActionId && store.actions[store.activeActionId]) {
      const action = store.actions[store.activeActionId];
      const chan = action.channels.find(
        (c) => c.targetNodeId === targetNodeId && c.propertyPath === propertyPath,
      );
      if (chan) return chan.id;
    }

    // 2. Search across all actions
    for (const action of Object.values(store.actions)) {
      const chan = action.channels.find(
        (c) => c.targetNodeId === targetNodeId && c.propertyPath === propertyPath,
      );
      if (chan) return chan.id;
    }

    // 3. Search in tracks
    const track = store.tracks.find(
      (t) =>
        t.targetNodeId === targetNodeId &&
        (t.propertyPath === propertyPath || t.property === propertyPath),
    );
    if (track) return track.id;

    // 4. Create new channel in active action or first action if available
    if (store.activeActionId && store.actions[store.activeActionId]) {
      return store.addChannelToAction(store.activeActionId, {
        targetNodeId,
        propertyPath,
        name: `${propertyPath}`,
        keyframes: [],
        interpolation: this.interpolation ?? 'bezier',
        extrapolation: 'constant',
        color: getPropertyColor(propertyPath),
      });
    }

    if (Object.keys(store.actions).length > 0) {
      const firstActionId = Object.keys(store.actions)[0];
      return store.addChannelToAction(firstActionId, {
        targetNodeId,
        propertyPath,
        name: `${propertyPath}`,
        keyframes: [],
        interpolation: this.interpolation ?? 'bezier',
        extrapolation: 'constant',
        color: getPropertyColor(propertyPath),
      });
    }

    // 5. Otherwise create in legacy tracks
    return store.addTrack(
      createTrack(targetNodeId, propertyPath as AnimationProperty, `${propertyPath}`),
    );
  }

  public async execute(ctx: CommandContext): Promise<void> {
    const store = getTimelineStore(ctx);
    this.commands = [];

    const propsToInsert: Array<{ path: AnimationPropertyPath; value: number }> = [];

    const posX = extractXYZ(this.position);
    if (posX?.x !== undefined) propsToInsert.push({ path: 'position.x', value: posX.x });
    if (posX?.y !== undefined) propsToInsert.push({ path: 'position.y', value: posX.y });
    if (posX?.z !== undefined) propsToInsert.push({ path: 'position.z', value: posX.z });

    const rotX = extractXYZ(this.rotation);
    if (rotX?.x !== undefined) propsToInsert.push({ path: 'rotation.x', value: rotX.x });
    if (rotX?.y !== undefined) propsToInsert.push({ path: 'rotation.y', value: rotX.y });
    if (rotX?.z !== undefined) propsToInsert.push({ path: 'rotation.z', value: rotX.z });

    const scaX = extractXYZ(this.scale);
    if (scaX?.x !== undefined) propsToInsert.push({ path: 'scale.x', value: scaX.x });
    if (scaX?.y !== undefined) propsToInsert.push({ path: 'scale.y', value: scaX.y });
    if (scaX?.z !== undefined) propsToInsert.push({ path: 'scale.z', value: scaX.z });

    for (const item of propsToInsert) {
      const channelId = this.findOrCreateChannel(store, this.targetNodeId, item.path);
      const cmd = new InsertKeyframeCommand(channelId, {
        frame: this.frame,
        value: item.value,
        interpolation: this.interpolation ?? 'bezier',
      });
      await cmd.execute(ctx);
      this.commands.push(cmd);
    }
  }

  public async undo(ctx: CommandContext): Promise<void> {
    for (let i = this.commands.length - 1; i >= 0; i--) {
      await this.commands[i].undo(ctx);
    }
  }

  public async redo(ctx: CommandContext): Promise<void> {
    for (const cmd of this.commands) {
      if (cmd.redo) {
        await cmd.redo(ctx);
      } else {
        await cmd.execute(ctx);
      }
    }
  }
}

# AGENTS.md — Blender-ELT Development Guide

Welcome to the **Blender-ELT** project! This document establishes the architectural principles, standards, and conventions for AI agents and human contributors working within this codebase.

---

## 1. Project Mission & Overview

**Blender-ELT** is a lightweight, responsive, and extensible 3D desktop suite inspired by Blender. Built on modern web and desktop technologies (TypeScript, Three.js, React Three Fiber, and Electron), it provides an intuitive 3D modeling, material authoring, viewport rendering, and animation environment.

---

## 2. Monorepo Architecture

The repository is structured as a Turbo-orchestrated pnpm monorepo:

```
blender-elt/
├── apps/
│   └── desktop/            # Electron desktop application (Main, Preload, Renderer)
├── packages/
│   ├── contracts/          # Strict TypeScript interfaces, types & IPC schemas
│   ├── scene-core/         # Pure scene graph state machine, hierarchy & traversal
│   ├── commands/           # Command pattern manager with undo/redo stacks
│   ├── modeling/           # Procedural primitive generators & mesh topology (edit mode)
│   ├── materials/          # PBR shader configurations & material presets
│   ├── animation/          # Timeline store, track evaluation & keyframe interpolation
│   ├── file-formats/       # Import & export pipelines (GLTF, GLB, OBJ, STL)
│   ├── persistence/        # Project serializer/deserializer (.belt format)
│   ├── viewport/           # 3D canvas viewport, grid, camera & gizmos (Three.js/R3F)
│   └── ui/                 # Blender-themed UI design system (Header, Outliner, Panels)
├── package.json            # Root workspace config & Turbo scripts
├── pnpm-workspace.yaml     # Package workspace declarations
├── turbo.json              # Build, test, and typecheck dependency pipelines
└── tsconfig.base.json      # Shared strict TypeScript compiler configuration
```

---

## 3. Core Architectural Rules

### 3.1 Single Source of Truth (`@blender-elt/contracts`)

- All domain data types, node definitions, materials, primitives, commands, and IPC interfaces **must** be defined in `packages/contracts`.
- Other packages must import their types from `@blender-elt/contracts` rather than defining ad-hoc local duplicates.

### 3.2 3D Coordinate System & Math

- Standard coordinate system: **Right-handed, Y-Up** (Three.js and glTF standard).
  - $+X$: Right
  - $+Y$: Up
  - $+Z$: Forward / Out of the screen
- Angles are represented in radians internally, converted to degrees only in user-facing UI inputs.

### 3.3 State Management & React Decoupling

- Core state (scene graph, commands, animation tracks) is managed with vanilla **Zustand** stores in their respective packages (`scene-core`, `commands`, `animation`).
- This enables unit testing and headless execution without React or DOM dependencies.
- React components connect to store hooks or subscribers in renderer layers.

### 3.4 Command Pattern & Undo/Redo

- Any user action that mutates the 3D scene (moving objects, editing vertices, changing materials, adding primitives) **must** be encapsulated as an `ICommand`.
- Commands must implement both `execute()` and `undo()` methods.
- The `CommandManager` records the history stack and triggers reactive UI updates.

### 3.5 Desktop Electron Security & IPC

- `contextIsolation: true` and `sandbox: false` (or strict sandbox where applicable) with `nodeIntegration: false`.
- All IPC communication goes through the typed `DesktopBridgeAPI` exposed via `contextBridge` in `apps/desktop/src/preload`.
- Never expose raw Electron modules (`ipcRenderer`, `fs`, `child_process`) directly to the renderer.

### 3.6 Animation Subsystem Responsibilities & Conventions

- **Single Source of Truth (`@blender-elt/contracts`)**: All animation types (`IAnimationAction`, `IAnimationChannel`, `IKeyframe`, `BezierHandle`, `KeyframeHandleType`, `ExtrapolationMode`, `IFCurveModifier`, `ArmatureNode`, `BoneNode`, `AnimationTimeline`) must be defined in `packages/contracts/src/animation.ts` and `scene.ts`.
- **Headless Decoupling (`@blender-elt/animation`)**: Curve evaluation (Newton-Raphson cubic Bezier, Catmull-Rom auto-tangents, cyclical offsets, analytical 2-bone IK) and `TimelineStore` must remain 100% decoupled from React and DOM APIs.
- **Undo/Redo Command Mandate (`@blender-elt/commands`)**: Every keyframe insertion, deletion, retiming movement, or handle edit must be encapsulated in an `ICommand` (`InsertTransformKeyframeCommand`, `InsertKeyframeCommand`, `DeleteKeyframeCommand`, `MoveKeyframeCommand`, etc.). Direct mutations outside `CommandManager` are prohibited.
- **60fps Viewport Synchronization (`@blender-elt/viewport`)**: `AnimationViewportBridge` / `useAnimationSync` evaluates active channels when playhead frame ticks, immediately updating Three.js `Object3D` transforms and `sceneStore.updateNodeTransform`.
- **Studio UI & Hotkeys (`@blender-elt/ui`)**: Bottom drawer unifies Timeline, Dope Sheet, and Graph Editor. Hotkey `I` opens the Keyframe Menu modal (`Location`, `Rotation`, `Scale`, `LocRotScale`); `Alt+I` removes keyframes; gizmo release commits auto-keying when enabled.
- **Persistence Roundtrip (`@blender-elt/persistence`)**: Project documents must serialize the complete `AnimationTimeline` to ensure zero data loss across file save/load.

---

## 4. Coding Conventions

- **Strict TypeScript**: No `any` types. Use explicit types, generics, or `unknown` with type guards.
- **Pure Functions & Immutability**: Store state transitions should be immutable.
- **Component Styling**: Styled using Tailwind CSS with Blender's signature dark theme palette (`#1d1e22` background, `#282828` panels, `#303030` buttons, `#4772b3` active accents).
- **Naming**:
  - Files: `kebab-case.ts` / `PascalCase.tsx` for components.
  - Types/Interfaces: `PascalCase` (e.g., `SceneNode`, `PBRMaterialConfig`).
  - Functions/Variables: `camelCase`.

---

## 5. Development & Verification Workflows

Before committing any changes:

1. `pnpm typecheck` — Verify all workspace packages pass TypeScript checks.
2. `pnpm build` — Ensure all packages and applications bundle cleanly.
3. `pnpm test` — Run unit and integration tests.
4. `pnpm format:check` — Ensure Prettier formatting passes.

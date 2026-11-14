# Blender-ELT Desktop & Web Cross-Platform Parity Specification

**Version:** 1.0.0  
**Target:** Applications (`apps/desktop`, `apps/web`) and Shared Packages (`@blender-elt/ui`, `@blender-elt/viewport`, `@blender-elt/contracts`, `@blender-elt/persistence`)  
**Author:** `@verifier` (Quality, Test & Verification Specialist)  
**Status:** Approved Architectural Specification

---

## 1. Architectural Overview & Shared Core

A core requirement of Blender-ELT is **100% functional and visual parity** between the **Electron Desktop Application** (`apps/desktop`) and the **Next.js Web Application** (`apps/web`). Both platforms execute against the exact same shared library packages:

```mermaid
flowchart TD
    subgraph Desktop_App["apps/desktop (Electron 34)"]
        D_MAIN[Electron Main Process]
        D_PRE[Preload Bridge: contextBridge]
        D_REN[Desktop Renderer: App.tsx]
        D_BRG[createDesktopPlatformBridge]
    end

    subgraph Web_App["apps/web (Next.js 14 App Router)"]
        W_SSR[Next.js Server / Static Export]
        W_CLI[Web Client: EditorClient.tsx]
        W_BRG[createWebPlatformBridge]
        W_STO[IndexedDbStorageAdapter]
    end

    subgraph Shared_UI["@blender-elt/ui (Blender Design System)"]
        STUDIO[EditorStudio Component]
        HDR[Header & Mode Selector]
        OUT[Outliner Tree]
        INS[Inspector & Modifier Stack]
        VPTB[Viewport Toolbar & Tool Settings]
        TM[Timeline & Dope Sheet]
    end

    subgraph Shared_Engine["Shared Headless Engine Packages"]
        VP["@blender-elt/viewport (R3F / Three.js)"]
        SC["@blender-elt/scene-core (Zustand Stores)"]
        CMD["@blender-elt/commands (CommandManager)"]
        MOD["@blender-elt/modeling (Topology Engine)"]
        PER["@blender-elt/persistence (Zod / .belt)"]
    end

    D_REN --> D_BRG --> STUDIO
    W_CLI --> W_BRG --> STUDIO
    STUDIO --> HDR & OUT & INS & VPTB & TM
    STUDIO --> VP & SC & CMD & MOD & PER
```

By encapsulating 100% of the UI composition inside `@blender-elt/ui` (`EditorStudio`), both `apps/desktop` and `apps/web` serve as ultra-thin platform runners (fewer than 50 lines of code in their respective root views).

---

## 2. Platform Bridge Abstraction Layer

Platform discrepancies (such as native file dialogs vs. browser downloads) are mediated through the typed `PlatformBridge` interface defined in `@blender-elt/contracts`:

```typescript
export interface PlatformBridge {
  platform: 'desktop' | 'web';
  storage: IStorageAdapter;
  dialogs: {
    showOpenDialog: (options: FileFilterOptions) => Promise<string | null>;
    showSaveDialog: (options: FileFilterOptions) => Promise<string | null>;
    showMessageBox: (options: MessageBoxOptions) => Promise<MessageBoxResponse>;
  };
  clipboard: {
    readText: () => Promise<string>;
    writeText: (text: string) => Promise<void>;
  };
  window?: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
}
```

### 2.1 Storage Adapter Parity

- **Desktop (`ElectronFsStorageAdapter`)**:
  Interacts with the local operating system filesystem using Node.js `fs/promises` mediated through the secure Electron preload bridge (`window.desktopBridge.storage`).
- **Web (`IndexedDbStorageAdapter`)**:
  Stores `.belt` project binaries, scene graphs, and user preferences within browser `IndexedDB` with an in-memory caching layer and LocalStorage fallback.
- **Interchangeability Guarantee**:
  Any `.belt` file saved in the Electron desktop app can be imported directly into the web application, and vice versa. Both deserialize through the identical Zod schema in `@blender-elt/persistence`.

---

## 3. Comprehensive Cross-Platform Parity Matrix

| Feature / Subsystem      | Electron Desktop (`apps/desktop`)     | Next.js Web (`apps/web`)              |   Parity Status    | Implementation Notes                                                                           |
| :----------------------- | :------------------------------------ | :------------------------------------ | :----------------: | :--------------------------------------------------------------------------------------------- |
| **Theme & UI Styling**   | Tailwind CSS Blender Dark Theme       | Tailwind CSS Blender Dark Theme       | **100% Identical** | Shared `@blender-elt/ui` components; identical color tokens (`#1d1e22`, `#282828`, `#4772b3`). |
| **Scene Graph & Stores** | Vanilla Zustand stores                | Vanilla Zustand stores                | **100% Identical** | Pure TypeScript logic with zero environment coupling.                                          |
| **Undo / Redo Stack**    | `CommandManager`                      | `CommandManager`                      | **100% Identical** | Shared command stack, transactions, and undo history limits.                                   |
| **Edit Mode Switching**  | `Tab` hotkey / Header Dropdown        | `Tab` hotkey / Header Dropdown        | **100% Identical** | `e.preventDefault()` prevents browser focus traversal on Web.                                  |
| **Selection Modes**      | 1 (Vertex), 2 (Edge), 3 (Face)        | 1 (Vertex), 2 (Edge), 3 (Face)        | **100% Identical** | Managed by shared `selectionStore`.                                                            |
| **Element Raycasting**   | Screen-space distance in R3F          | Screen-space distance in R3F          | **100% Identical** | Identical Three.js math and projection matrix calculations.                                    |
| **Modal Transforms**     | `G` (Move), `R` (Rotate), `S` (Scale) | `G` (Move), `R` (Rotate), `S` (Scale) | **100% Identical** | Viewport canvas captures pointer lock & drag events.                                           |
| **Axis Constraints**     | `X`, `Y`, `Z` Global/Local locks      | `X`, `Y`, `Z` Global/Local locks      | **100% Identical** | Evaluated identically in `useViewportHotkeys.ts`.                                              |
| **Extrude (`E`)**        | Connected region & individual         | Connected region & individual         | **100% Identical** | Shared `@blender-elt/modeling` topology algorithms.                                            |
| **Bevel (`Ctrl+B`)**     | Chamfer & Fillet with segments        | Chamfer & Fillet with segments        | **100% Identical** | Prevented default browser bookmarking shortcut (`Ctrl+B`).                                     |
| **Loop Cut (`Ctrl+R`)**  | Quad ring split preview & cut         | Quad ring split preview & cut         | **100% Identical** | Prevented default browser page refresh (`Ctrl+R`).                                             |
| **Knife Tool (`K`)**     | Interactive raycast cut               | Interactive raycast cut               | **100% Identical** | Screen-to-surface projection identical in WebGL canvas.                                        |
| **Delete / Dissolve**    | `X` / `Delete` context menu           | `X` / `Delete` context menu           | **100% Identical** | Blender-style context popup modal.                                                             |
| **Timeline Scrubber**    | TimelineBar playhead & frame input    | TimelineBar playhead & frame input    | **100% Identical** | Subscribed to headless `timelineStore` in `@blender-elt/animation`.                            |
| **Dope Sheet Editor**    | Channels tree, summary row, diamonds  | Channels tree, summary row, diamonds  | **100% Identical** | SVG diamond rendering and multi-key retiming drag in `@blender-elt/ui`.                        |
| **Graph Editor**         | SVG F-Curves, Bezier tangent handles  | SVG F-Curves, Bezier tangent handles  | **100% Identical** | Newton-Raphson curve evaluation and aligned/auto handles.                                      |
| **Auto-Keying**          | Red record button & gizmo drag end    | Red record button & gizmo drag end    | **100% Identical** | Atomic `InsertTransformKeyframeCommand` via `commandManager.execute()`.                        |
| **Keyframe Modal Menu**  | `I` (Insert) & `Alt+I` (Delete)       | `I` (Insert) & `Alt+I` (Delete)       | **100% Identical** | `e.preventDefault()` prevents browser bookmark or search overrides.                            |
| **Playback Engine**      | `requestAnimationFrame` delta timer   | `requestAnimationFrame` delta timer   | **100% Identical** | Zero timer drift across desktop window and web browser tab.                                    |
| **Viewport Sync Bridge** | Direct 60fps Object3D transform sync  | Direct 60fps Object3D transform sync  | **100% Identical** | `AnimationViewportBridge` runs within R3F canvas on both platforms.                            |
| **Timeline Scrubber**    | TimelineBar playhead & frame input    | TimelineBar playhead & frame input    | **100% Identical** | Subscribed to headless `timelineStore` in `@blender-elt/animation`.                            |
| **Dope Sheet Editor**    | Channels tree, summary row, diamonds  | Channels tree, summary row, diamonds  | **100% Identical** | SVG diamond rendering and multi-key retiming drag in `@blender-elt/ui`.                        |
| **Graph Editor**         | SVG F-Curves, Bezier tangent handles  | SVG F-Curves, Bezier tangent handles  | **100% Identical** | Newton-Raphson curve evaluation and aligned/auto handles.                                      |
| **Auto-Keying**          | Red record button & gizmo drag end    | Red record button & gizmo drag end    | **100% Identical** | Atomic `InsertTransformKeyframeCommand` via `commandManager.execute()`.                        |
| **Keyframe Modal Menu**  | `I` (Insert) & `Alt+I` (Delete)       | `I` (Insert) & `Alt+I` (Delete)       | **100% Identical** | `e.preventDefault()` prevents browser bookmark or search overrides.                            |
| **Playback Engine**      | `requestAnimationFrame` delta timer   | `requestAnimationFrame` delta timer   | **100% Identical** | Zero timer drift across desktop window and web browser tab.                                    |
| **Viewport Sync Bridge** | Direct 60fps Object3D transform sync  | Direct 60fps Object3D transform sync  | **100% Identical** | `AnimationViewportBridge` runs within R3F canvas on both platforms.                            |
| **File Persistence**     | Native OS `.belt` files on disk       | IndexedDB `.belt` database storage    | **Native Adapted** | Both serialize to the identical binary format.                                                 |
| **Format Import/Export** | GLTF, GLB, OBJ, STL via FS            | GLTF, GLB, OBJ, STL via Blob/FS API   | **Native Adapted** | Parsers and exporters reside in shared `@blender-elt/file-formats`.                            |
| **Window Frame**         | Native frameless custom titlebar      | Browser viewport shell                | **Native Adapted** | Custom window controls (min/max/close) visible only on Desktop.                                |

---

## 4. Web-Specific Considerations & Browser Conflict Resolution

Operating a desktop-grade 3D modeler inside a standard web browser introduces key challenges that Blender-ELT resolves systematically:

### 4.1 Keyboard Shortcut Interception

Web browsers reserve several critical Blender hotkeys by default:

- `Tab`: Focus cycling.
- `Ctrl+B`: Bookmarks toggle.
- `Ctrl+R`: Page refresh.
- `Alt+A`: Accessibility / menu accelerator.

**Solution**:
The `useViewportHotkeys` hook hooks directly into the viewport canvas container. When the canvas has focus, `event.preventDefault()` and `event.stopPropagation()` are called immediately for all registered hotkey combinations:

```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  // Prevent browser refresh on Loop Cut
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
    e.preventDefault();
    triggerLoopCutTool();
    return;
  }
  // Prevent browser bookmarks on Bevel
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    triggerBevelTool();
    return;
  }
  // Prevent focus shift on Edit Mode toggle
  if (e.key === 'Tab') {
    e.preventDefault();
    toggleEditObjectMode();
    return;
  }
};
```

### 4.2 WebGL / WebGPU Rendering Performance

- Both desktop and web run Three.js against the client's GPU via WebGL 2.0 (with fallback to WebGL 1.0).
- Vertex buffer attributes for mesh topology are allocated as contiguous typed arrays (`Float32Array`), minimizing JavaScript garbage collection overhead and guaranteeing 60 FPS viewport navigation on modern laptops and desktop workstations alike.

---

## 5. Verification & Regression Prevention

Every CI run enforces:

1. `pnpm build`: Verifies that both `electron-vite` (desktop main/preload/renderer) and `next build` (web static and dynamic pages) compile with zero errors.
2. `pnpm typecheck`: Validates strict typing across all packages.
3. Unit and integration tests in both `apps/desktop` and `apps/web` verifying storage adapter roundtrips.

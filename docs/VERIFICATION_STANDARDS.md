# Blender-ELT Monorepo Verification & Quality Standards

**Version:** 1.0.0  
**Target Workspaces:** All 12 packages and apps in `blender-elt`  
**Author:** `@verifier` (Quality, Test & Build Verifier)  
**Status:** Approved Quality Gate Baseline

---

## 1. Baseline Verification & Health Check

| Quality Gate                 | Tooling / Command                        |        Current Health Status         | Scope / Coverage                                          |
| :--------------------------- | :--------------------------------------- | :----------------------------------: | :-------------------------------------------------------- |
| **Type Integrity**           | `pnpm typecheck` (`turbo run typecheck`) |     **100% Pass** (22/22 tasks)      | All 12 workspaces under strict TypeScript 5.6             |
| **Unit & Integration Tests** | `pnpm test` (`turbo run test`)           | **100% Pass** (20 suites, 171 tests) | 10 packages tested via Vitest; desktop shell consolidated |
| **Production Build**         | `pnpm build` (`turbo run build`)         |    **100% Pass** (12/12 packages)    | Electron SSR/renderer + Next.js 14 App Router             |
| **Code Formatting**          | `pnpm format:check`                      |            **100% Pass**             | Prettier across `**/*.{ts,tsx,js,jsx,json,md}`            |
| **Static Analysis**          | `pnpm lint`                              |            **100% Pass**             | Strict TypeScript and ESLint compliance                   |

---

## 2. Monorepo Test Coverage & Gap Analysis

### 2.1 Current Test Distribution Matrix

| Workspace                   |  Runner  | Test Files | Tests | Coverage Scope                                     | Status & Implementation Highlights                                                                        |
| :-------------------------- | :------: | :--------: | :---: | :------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| `@blender-elt/contracts`    |   None   |     0      |   0   | Pure types & interfaces                            | Verified via strict `tsc --noEmit`. Includes Modifiers, Selection, CommandRegistry, Workspace, and Shell. |
| `@blender-elt/scene-core`   |  Vitest  |     2      |  28   | Scene store, hierarchy, SelectionStore             | **High Coverage**. Added SelectionStore tests (selection modes, 3D cursor, pivot modes, element masks).   |
| `@blender-elt/commands`     |  Vitest  |     2      |  18   | CommandManager, CommandRegistry, CompoundCommand   | **High Coverage**. Added CommandRegistry tests (categories, availability, shortcuts, compound undo/redo). |
| `@blender-elt/modeling`     |  Vitest  |     3      |  24   | Primitives, topology ops, ModifierStackEvaluator   | **High Coverage**. Added procedural modifiers (Array, Mirror, Solidify, Wireframe, Subdivide, Smooth).    |
| `@blender-elt/materials`    |  Vitest  |     1      |   9   | PBR presets, material manager, Three.js factory    | **Good Coverage**. Parameter validation, Three.js physical material generation.                           |
| `@blender-elt/animation`    |  Vitest  |     2      |   9   | Timeline store, track evaluation, interpolation    | **Good Coverage**. Linear, step, cubic bezier, keyframe clamping.                                         |
| `@blender-elt/file-formats` |  Vitest  |     5      |  27   | GLTF, GLB, OBJ, STL parsers & bridge               | **High Coverage**. Added schema extension roundtripping tests.                                            |
| `@blender-elt/persistence`  |  Vitest  |     1      |  10   | Zod schemas, .belt serializer, storage adapters    | **High Coverage**. Decoupled Node.js fs/path, added DI storage adapter tests.                             |
| `@blender-elt/viewport`     |  Vitest  |     1      |  15   | Viewport configs, viewpoints, transforms, overlays | **High Coverage**. Added axis locking, 3D cursor overlay, and geometry statistics tests.                  |
| `@blender-elt/ui`           |  Vitest  |     1      |   5   | EditorStudio, Workspaces, Bridge                   | **Verified**. Consolidated EditorStudio, workspace presets, polycount calculations.                       |
| `@blender-elt/desktop`      | Electron |   Shell    | Shell | Electron main, preload bridge, renderer shell      | **Verified**. Consolidated App.tsx (~85% code reduction) delegating to shared EditorStudio.               |
| `@blender-elt/web`          |  Vitest  |     2      |  26   | Web persistence, storage fallback, templates       | **Good Coverage**. Consolidated EditorClient.tsx delegating to shared EditorStudio.                       |

---

## 3. Mandatory Verification Checklists for Upcoming Milestones

Every PR or milestone feature submission must satisfy the following verification invariants before merging into `main`.

### 3.1 Domain Invariants (Scene Graph & Math)

- [ ] **Tree Acyclicity Guarantee**: `reparentNode(childId, newParentId)` must throw or return `false` if `newParentId` is a descendant of `childId` or equals `childId`.
- [ ] **Referential Integrity**:
  - No orphan node IDs: Every ID in `root.childrenIds` or `node.childrenIds` must resolve in `state.nodes`.
  - Recursive cascading delete: Removing a node must recursively unregister all child nodes from `nodes`, `selectedNodeIds`, `activeNodeId`, and all `collections`.
- [ ] **Selection Sanity**:
  - `selectedNodeIds` must contain only valid IDs existing in `state.nodes`.
  - `activeNodeId` must be an element of `selectedNodeIds` (or `null` when selection is empty).
- [ ] **Hierarchical Transform Invariance**:
  - $M_{\text{world}} = M_{\text{parent}} \times M_{\text{local}}$. Root transform defines the world origin.
  - Quaternion representation must remain normalized ($\|q\| = 1$).
  - Rotation angles must strictly be in radians internally, converted to degrees only in presentation layers.
- [ ] **Schema & Serialization Roundtripping**:
  - $\text{deserializeProject}(\text{serializeProject}(\text{doc})) \equiv \text{doc}$.
  - Must pass Zod validation schema with zero unknown or untyped fields.

### 3.2 Command System & Undo/Redo Parity

- [ ] **Symmetric Reversibility**:
  - For every command $C$ operating on state $S$: $C.\text{undo}(C.\text{execute}(S)) \equiv S$.
  - State snapshot equality must hold for scene nodes, hierarchy links, and collection assignments.
- [ ] **History Stack Isolation**:
  - Executing a new command when `canRedo === true` must flush `redoStack`.
  - `undoStack` size must never exceed `maxHistory`. Oldest commands must discard cleanly without dangling references.
- [ ] **Gizmo Drag Isolation**:
  - Continuous mouse dragging during translation/rotation/scaling in the 3D viewport must update transient transform state without creating incremental undo steps.
  - Exactly **one** `TransformObjectCommand` must be committed to the `CommandManager` upon `pointerUp` / `dragEnd`.
- [ ] **Event Notification Accuracy**:
  - All command transitions (`execute`, `undo`, `redo`, `clear`) must notify external subscribers (`commandManager.subscribe`) with accurate `UndoRedoState`.

### 3.3 UI Synchronization & Reactive Parity

- [ ] **Outliner Reactive Consistency**:
  - Node additions, deletions, renames, and hierarchy changes in the Zustand store must re-render the tree nodes immediately without full unmount or scroll reset.
- [ ] **Bidirectional Properties Binding**:
  - Viewport Gizmo Move $\to$ Updates Store $\to$ Properties Panel numeric inputs reflect new values in real time.
  - Properties Panel numeric input edit $\to$ Dispatches Command $\to$ Viewport 3D object updates immediately.
- [ ] **Shading Mode Uniformity**:
  - Switching between `wireframe`, `solid`, `material`, and `rendered` must apply across all scene mesh instances consistently.
- [ ] **Theme & Palette Compliance**:
  - All UI elements must use Blender dark theme tokens (`#1d1e22` viewport, `#282828` panels, `#303030` buttons, `#4772b3` active accents).

### 3.4 Cross-Platform Parity (Desktop vs. Web)

- [ ] **Shared Studio Architecture**:
  - Eliminate duplicate logic between `App.tsx` and `EditorClient.tsx` by using the shared `@blender-elt/ui` editor container and unified hooks (`useEditorStudio`).
- [ ] **Storage Contract Parity**:
  - Both desktop and web must consume the identical `IStorageAdapter` contract:
    - Desktop: `ElectronFsStorageAdapter` via IPC.
    - Web: `IndexedDbStorageAdapter` / `WebStorageAdapter`.
  - Projects saved as `.belt` on desktop must load without error in web, and vice-versa.
- [ ] **File Format Bridge Parity**:
  - Exporting and importing GLTF, GLB, OBJ, and STL files must produce bit-compatible geometric primitives and material definitions on both platforms.
- [ ] **Keyboard Shortcut Consistency**:
  - Standard Blender keybindings (G, R, S, Delete, Numpad 1/3/7/5/0, Shift+A, Tab, Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z) must function identically across Electron and browser runtimes.

---

## 4. Monorepo Quality Gates & CI Pipeline

To ensure rigorous quality for all future milestones, the following sequential verification pipeline must be executed:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ pnpm typecheck  │ ──> │ pnpm format:chk │ ──> │    pnpm test    │ ──> │   pnpm build    │
│  (Strict TS)    │     │   (Prettier)    │     │  (Vitest 100%)  │     │ (Desktop & Web) │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. **`pnpm typecheck`**: No TypeScript errors permitted (`tsc --noEmit` across 12 workspaces).
2. **`pnpm format:check`**: Code must adhere strictly to Prettier formatting.
3. **`pnpm test`**: All Vitest test suites must pass. Zero regressions allowed. Minimum test coverage thresholds:
   - Core domain logic (`contracts`, `scene-core`, `commands`, `persistence`): **$\ge 90\%$**
   - Converters & Viewport (`file-formats`, `viewport`, `modeling`, `materials`): **$\ge 80\%$**
   - Application Shells (`apps/desktop`, `apps/web`): **$\ge 70\%$**
4. **`pnpm build`**: Monorepo production build must complete cleanly without Rollup or Next.js build errors.

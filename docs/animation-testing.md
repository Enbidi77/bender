# Blender-ELT Animation System: Testing Strategy & Verification Guide

**Document Version:** 1.0.0  
**Target:** Monorepo Workspaces (`@blender-elt/*`, `apps/*`)  
**Status:** Verification Baseline & Quality Gates

---

## 1. Testing Strategy Overview

The Blender-ELT testing philosophy enforces rigorous automated verification across five distinct layers:

1. **Mathematical Unit Tests:** Pure function verification of Bezier curve evaluation, Newton-Raphson precision, Catmull-Rom tangent slopes, and extrapolation offsets.
2. **State & Store Unit Tests:** Vanilla Zustand store mutations, track/channel CRUD, selection management, and playback ticks.
3. **Command Undo/Redo Symmetry Tests:** Execution followed by symmetric undo restoration verifying that state returns to the exact pre-execution state snapshot.
4. **Persistence & Serialization Roundtrips:** Schema validation, version migration ($1.0.0 \to 1.1.0$), and bit-exact `.belt` roundtrip guarantees.
5. **UI & Viewport Component Tests:** React component static markup rendering, diamond selection, box select, tangent handle drag simulations, and 3D Viewport bridge synchronization.

---

## 2. Test Suite Matrix across Packages

| Workspace Package              | Test File                            | Test Count | Key Test Coverage                                                               |
| :----------------------------- | :----------------------------------- | :--------: | :------------------------------------------------------------------------------ |
| **`@blender-elt/animation`**   | `test/bezier-evaluator.test.ts`      |     6      | Newton-Raphson convergence, smooth auto-tangents, Bernstein polynomials         |
| **`@blender-elt/animation`**   | `test/extrapolation.test.ts`         |     5      | Constant holding, linear tangent projection, cyclic loops, cyclic offsets       |
| **`@blender-elt/animation`**   | `test/modifiers.test.ts`             |     5      | Noise amplitude/scale, cycles repetition, stepped frame holds, limits           |
| **`@blender-elt/animation`**   | `test/playback-engine.test.ts`       |     4      | Delta-time accumulation, frame step ticks, playback start/stop/pause            |
| **`@blender-elt/animation`**   | `test/ik-solver.test.ts`             |     6      | Analytical 2-bone cosine solver, pole target bending, FABRIK iteration          |
| **`@blender-elt/animation`**   | `test/timeline.test.ts`              |     6      | Store range clamping, FPS setting, track addition/removal/muting                |
| **`@blender-elt/animation`**   | `test/interpolation.test.ts`         |     5      | Linear, step, ease-in, ease-out scalar and vector interpolation                 |
| **`@blender-elt/commands`**    | `test/animation-commands.test.ts`    |     13     | Undo/redo symmetry for Insert, Delete, Move, Tangents, and LocRotScale          |
| **`@blender-elt/persistence`** | `test/animation-persistence.test.ts` |     16     | Zod schema validation, $1.0.0 \to 1.1.0$ migration, roundtrip fidelity          |
| **`@blender-elt/viewport`**    | `test/animation-viewport.test.ts`    |     6      | Viewport bridge, 60fps Three.js object transform sync, octahedral bone geometry |
| **`@blender-elt/ui`**          | `test/animation-ui.test.ts`          |     28     | TimelineBar dots, Dope Sheet diamonds, Graph Editor curves, Keyframe modal `I`  |

**Total Animation System Tests:** **95+ automated tests** with 100% passing rate.

---

## 3. Exact Commands to Build, Test & Lint

All tasks are orchestrated through Turborepo with pnpm workspaces:

### 3.1 Typecheck All Packages

```bash
pnpm turbo run typecheck
```

_Ensures zero TypeScript errors and strict typing compliance across all packages._

### 3.2 Build All Packages

```bash
pnpm turbo run build
```

_Compiles all TypeScript source files into output declarations (`dist/`) according to package dependency order._

### 3.3 Run All Automated Tests

```bash
pnpm turbo run test
```

_Executes all Vitest test suites across `@blender-elt/animation`, `@blender-elt/commands`, `@blender-elt/persistence`, `@blender-elt/viewport`, `@blender-elt/ui`, etc._

### 3.4 Target Specific Package Tests

```bash
# Test Animation Engine
pnpm --filter @blender-elt/animation test

# Test Animation Commands
pnpm --filter @blender-elt/commands test

# Test Viewport Animation Bridge
pnpm --filter @blender-elt/viewport test

# Test Animation UI Components
pnpm --filter @blender-elt/ui test

# Test Animation Persistence
pnpm --filter @blender-elt/persistence test
```

### 3.5 Check Code Formatting (Prettier)

```bash
# Check formatting
pnpm format:check

# Auto-format all files
pnpm format
```

---

## 4. Continuous Integration & Quality Gates

Before merging any code change:

1. `pnpm turbo run typecheck` must report 0 errors.
2. `pnpm turbo run build` must cleanly generate all package bundles.
3. `pnpm turbo run test` must pass all test files without skipped failures.
4. `pnpm format:check` must pass without unformatted diffs.
5. Symmetrical undo/redo must be verified for any newly introduced command.

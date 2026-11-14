# Blender-ELT Animation System: Timeline, Dope Sheet & Graph Editor

**Document Version:** 1.0.0  
**Target Package:** `@blender-elt/ui`  
**Status:** User Interface & Interaction Specification

---

## 1. Unified Bottom Animation Drawer

The bottom workspace drawer in `EditorStudio` houses a unified, tabbed animation suite:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [▼ Timeline]  [Dope Sheet]  [Graph Editor] | ⏺ Auto-Key | ⏪ ◀ ▶ ⏩ ⏹ 🔁 | Frame: [  48 ] Range: 1..250   │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                        Active Animation Canvas                                         │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Tab switching between `[Timeline]`, `[Dope Sheet]`, and `[Graph Editor]` preserves playhead position, selection state, and viewport framing.

---

## 2. Editor Components & Capabilities

### 2.1 Timeline Bar (`TimelineBar.tsx`)

Designed for compact, continuous viewport transport:

- **Playhead Scrubber:** Interactive time scrubber with frame number ticks, second indicators, and current frame head.
- **Keyframe Markers:** Vertical tick marks showing keyframes present on active/selected scene objects.
- **Auto-Keying Indicator:** Red record button (`⏺`) toggling automatic keyframe generation upon transform gizmo release.
- **Transport Controls:**
  - Jump to Start (`Shift+Left`)
  - Step Backward 1 Frame (`Left`)
  - Play / Pause (`Space`)
  - Step Forward 1 Frame (`Right`)
  - Jump to End (`Shift+Right`)
  - Toggle Looping (`🔁`)
- **Range & FPS Configuration:** Numeric inputs for `StartFrame`, `EndFrame`, and playback `FPS` (24, 30, 60).

---

### 2.2 Dope Sheet View (`DopeSheetView.tsx`)

Provides macroscopic keyframe layout, multi-channel selection, and timing retiming:

- **Hierarchy Tree Sidebar (Left):**
  - Object rows with expand/collapse arrows (`▼`, `▶`).
  - Action container rows.
  - Individual channel rows (`Position X`, `Rotation Y`, etc.) with mute (`👁`) and lock (`🔒`) toggles.
- **Summary Row (Top):** Aggregated orange diamond markers indicating any frame where at least one channel contains a keyframe.
- **Channel Diamonds:**
  - High-performance SVG diamond markers (`◆`).
  - Standard keyframe: `#e6c547` (Yellow/Gold).
  - Selected keyframe: `#5588ee` (Blue highlight).
  - Hover glow: `#ffffff`.
- **Interactive Multi-Selection:**
  - Click single diamond to select.
  - `Shift`-Click for additive multi-key selection.
  - Box-Selection (`B` hotkey): Drag rubberband box across keys.
  - Select all / Deselect all (`A` / `Alt+A`).
- **Horizontal Retiming Drag:** Dragging selected diamonds shifts their time coordinate horizontally, executing `MoveKeyframeCommand` upon release.
- **Keyframe Deletion:** Pressing `X` or `Delete` deletes all selected keyframes via `DeleteKeyframeCommand`.

---

### 2.3 Graph Editor View (`GraphEditorView.tsx`)

Provides visual F-Curve manipulation, Bezier curvature editing, and tangent handle control:

- **Curve Canvas (Right):**
  - Smooth cubic Bezier spline rendering using SVG `<path>` elements.
  - Standard Blender axis color palette:
    - X Axis: Red (`#e53e3e`)
    - Y Axis: Green (`#38a169`)
    - Z Axis: Blue (`#3182ce`)
    - Custom Properties: Blue-Gray (`#4772b3`)
- **Interactive Bezier Tangent Handles:**
  - When a keyframe is selected, incoming ($\mathbf{P}_1$) and outgoing ($\mathbf{P}_2$) handle arms extend outwards.
  - Interactive circular knobs for handle rotation and stretching.
  - **Aligned Handles:** Modifying angle on one handle symmetrically mirrors the opposing handle's angle.
  - **Auto Handles:** Smooth clamped slopes recalculating automatically upon keyframe movement.
- **Handle Type Switcher Menu (`V` Hotkey):**
  - `Auto`: Automatic smooth tangent calculation.
  - `Aligned`: Tangents locked colinear ($180^\circ$).
  - `Vector`: Tangents point directly to adjacent keys.
  - `Free`: Fully independent handle manipulation.
- **Navigation Controls:**
  - Pan: Middle mouse drag / Shift+drag.
  - Zoom: Mouse wheel scroll.
  - Frame All (`Home` hotkey): Centers and fits all curves within viewport bounds.

---

## 3. Comprehensive Animation Hotkey Reference

| Hotkey                        | Context                   | Action                                                                         |
| :---------------------------- | :------------------------ | :----------------------------------------------------------------------------- |
| **`Space`**                   | Global                    | Play / Pause playback                                                          |
| **`Left Arrow`**              | Global                    | Step backward 1 frame                                                          |
| **`Right Arrow`**             | Global                    | Step forward 1 frame                                                           |
| **`Down Arrow`**              | Global                    | Jump to previous keyframe / start                                              |
| **`Up Arrow`**                | Global                    | Jump to next keyframe / end                                                    |
| **`Shift+Left`**              | Global                    | Jump to timeline start frame                                                   |
| **`Shift+Right`**             | Global                    | Jump to timeline end frame                                                     |
| **`I`**                       | Object Mode               | Open **Insert Keyframe Menu** (`Location`, `Rotation`, `Scale`, `LocRotScale`) |
| **`Alt+I`**                   | Object Mode               | **Delete Keyframes** at current frame for selected objects                     |
| **`Shift+Alt+K`**             | Global                    | Toggle **Auto-Keying** on/off                                                  |
| **`A`**                       | Dope Sheet / Graph Editor | Select All keyframes                                                           |
| **`Alt+A`**                   | Dope Sheet / Graph Editor | Deselect All keyframes                                                         |
| **`B`**                       | Dope Sheet / Graph Editor | Box-Select rubberband mode                                                     |
| **`V`**                       | Graph Editor              | Handle Type Menu (`Auto`, `Aligned`, `Vector`, `Free`)                         |
| **`X` / `Delete`**            | Dope Sheet / Graph Editor | Delete selected keyframes (`DeleteKeyframeCommand`)                            |
| **`Home`**                    | Graph Editor              | Frame All curves in view                                                       |
| **`Ctrl+Z`**                  | Global                    | Undo last animation action (`CommandManager.undo()`)                           |
| **`Ctrl+Y` / `Ctrl+Shift+Z`** | Global                    | Redo last animation action (`CommandManager.redo()`)                           |

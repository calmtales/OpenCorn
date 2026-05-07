# Enterprise Studio Refactor & Noustiny Polish Plan (v2)

Comprehensive plan to resolve UI overlaps, functional bugs, and aesthetic gaps to bring OpenCorn to true "Enterprise Studio" standards.

## 🎯 Goals
1.  **Dedicated Projects Engine:** Separate the workflow management from the "New Idea" creation.
2.  **Real-Time Pipeline Accuracy:** Eliminate progress caps and ensure 1:1 state mapping between MCP and UI.
3.  **"Tactical Narrative Command" Aesthetic:** Fully adopt the Noustiny visual language (Obsidian gradients, orthogonal paths, high-tech HUD).
4.  **Bulletproof Functional Stability:** Fix forking/branching buttons and the "black strip" glitch.
5.  **Audit Trail:** Professional, searchable, and structured logging in the MCP layer.

---

## 🛠️ Phase 1: Dedicated Projects View (Separation of Concerns)

Currently, the Projects Dashboard and the Seed Input (Idea) page are competing for space. We will split them into distinct app states.

- **`src/renderer/lib/store.ts`**: Update `ViewMode` to include `landing`, `projects`, and `canvas`.
- **`src/renderer/App.tsx`**: 
    - Implement a high-level router-like switch for the three modes.
    - Landing: Pure "New Idea" entry (like a cinematic splash).
    - Projects: Full-screen dashboard with search, sort, and project cards.
    - Canvas: The film editor.
- **`src/renderer/components/ProjectsDashboard.tsx`**: 
    - Standardize card sizes and typography.
    - Verify "Open" (load local JSON only) and "Resume" (re-attach to MCP pipeline) logic.
- **`src/renderer/components/Navigation.tsx`**: Create a new HUD-style top nav bar to switch between "New Studio" and "Archive."

---

## 🚀 Phase 2: Pipeline & Real-Time Sync Fix

The "22% stuck" bug suggests a mismatch between background process updates and frontend state.

- **`src/main/index.ts`**:
    - Refactor `McpClient` to use an event-driven emitter for status changes.
    - Ensure `pollStatus` and `runFullPipeline` push structured `onPipelineUpdate` messages immediately.
- **`src/renderer/hooks/useFilmPipeline.ts`**:
    - Remove all local "simulated" timers.
    - Use a strict event-source pattern: if the server says 35%, the UI shows 35%. 
- **`stoira-mcp/shared/checkpoint.py`**: Add more granular progress markers in the `videos_progress` checkpoint.

---

## 🎨 Phase 3: "Noustiny" Tactical UI Overhaul

The user wants "Tactical Narrative Command," not just a generic dark mode.

### 1. Canvas & Pathing
- **`src/renderer/components/StoryEdge.tsx`**:
    - **Orthogonal Routing:** Change from bracket curves to 90-degree "step" paths.
    - **Golden Path:** Implement a thick, glowing amber (`#e9c16b`) stroke for the canonical story path.
    - **Tactical Buttons:** Redesign Splice/Fork buttons to be "embedded" in the path, using small monospaced labels and geometric borders.
- **`src/renderer/components/Canvas.tsx`**:
    - Implement a subtle **Dot Grid** background.
    - Ensure the renderer is 100% transparent to the underlying obsidian gradient.

### 2. Node & State
- **`src/renderer/components/StoryNode.tsx`**:
    - **Weaving State:** Add a CRT-style flickering scanline overlay.
    - **Status HUD:** Add a small "system status" bar to each node showing its provenance (e.g., `AGENT: BRAINSTORMER`).

---

## ⚙️ Phase 4: MCP Enterprise Hardening

- **`stoira-mcp/stoira_mcp_server.py`**:
    - **JSONL Logging:** Switch to structured logging (Loguru or standard JSON format).
    - **Tracing:** Every tool call must log `[REQUEST_ID] TOOL_NAME | STATUS | ARGS`.
    - **Metrics:** Log the token usage (if available) and response duration.
- **`stoira-mcp/tools/`**: Audit all handlers for uniform error reporting.

---

## 🏁 Phase 5: The "Black Strip" & Layout Finality

- **`index.html`**: Complete audit of global CSS. Remove any `!important` backgrounds that might be creating opaque layers.
- **`src/renderer/App.tsx`**: Ensure `flex: 1` and `overflow: hidden` are used correctly on the canvas container to prevent the "strip" (which is likely a layout gap).

---

## 📝 Files to Change
- `src/renderer/App.tsx`
- `src/renderer/lib/store.ts`
- `src/renderer/components/Canvas.tsx`
- `src/renderer/components/StoryNode.tsx`
- `src/renderer/components/StoryEdge.tsx`
- `src/renderer/components/ProjectsDashboard.tsx`
- `src/renderer/hooks/useFilmPipeline.ts`
- `src/main/index.ts`
- `stoira-mcp/stoira_mcp_server.py`
- `stoira-mcp/shared/checkpoint.py`

## 🧪 Validation Plan
1.  **Visual:** Verify orthogonal paths and dot grid.
2.  **Functional:** Multi-branch a story and verify UI doesn't "cheapen" or break.
3.  **Data:** Edit 5 scenes in a project, close app, reopen, verify edits persist via MCP logs.
4.  **Logging:** Check `~/.stoira/logs/stoira.jsonl` for valid structured data.

**Plan File Saved to:** `.hermes/plans/2026-05-05_183000-enterprise-refactor-v2.md`

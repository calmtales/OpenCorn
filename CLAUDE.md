# OpenCorn Desktop App

Open-source AI film studio. Type an idea → get a film.

## Stack
- Electrobun (Bun + WebViews, NOT Electron)
- React 19 + Three.js for UI
- MCP client to connect to stoira-mcp server
- MIT license

## This repo: `/tmp/OpenCorn-new/`

## Architecture
- `src/main/` — Bun main process (MCP client, process management)
- `src/renderer/` — React UI (storyboard, timeline, preview)
- `src/shared/` — types shared between main and renderer

## Phase 1 (Current): Scaffold
- Electrobun project setup (package.json, config)
- React storyboard UI with:
  - IdeaInput — text area + style selector
  - StoryboardGrid — visual scene grid (drag-drop)
  - SceneCard — individual scene preview
  - TimelineBar — horizontal film timeline
  - PlayerPreview — video preview
  - McpStatus — connection status to MCP server
  - ExportPanel — download/share
- MCP client in main process (connects to stoira-mcp server)
- Idea → storyboard → render pipeline state machine

## Key Rules
- Electrobun, not Electron (16MB bundles, ZSTD compression, WGPU)
- Use typed RPC between main and renderer
- No external dependencies for UI (no Tailwind without Bun bundler check)
- Commit after each component

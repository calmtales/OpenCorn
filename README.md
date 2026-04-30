# OpenCorn

Open-source AI film studio. Type an idea, get a film.

## Stack

- **Runtime:** [Electrobun](https://electrobun.dev) (Bun + WebViews) — 16MB bundles, ZSTD compression, WGPU
- **UI:** React 19 with inline styles (no Tailwind, no CSS modules)
- **Backend:** MCP client connecting to stoira-mcp server via stdio (JSON-RPC 2.0)
- **License:** MIT

## Architecture

```
src/
  main/              # Bun main process
    index.ts         # MCP client (JSON-RPC), RPC handlers, window management
  renderer/          # React UI (runs in WebView)
    index.tsx        # Entry point, Electroview RPC setup
    App.tsx          # Main layout with dark film-production theme
    components/
      IdeaInput.tsx       # Text area + style selector
      StoryboardGrid.tsx  # Scene card grid
      SceneCard.tsx       # Individual scene preview
      TimelineBar.tsx     # Horizontal film timeline
      PlayerPreview.tsx   # Video preview player
      McpStatus.tsx       # MCP connection indicator
      ExportPanel.tsx     # Download/format selector
    hooks/
      useFilmPipeline.ts  # Pipeline state machine
  shared/
    types.ts         # Types shared between main and renderer
```

## How It Works

1. **Enter an idea** — describe your film concept in the sidebar
2. **Choose a style** — Anime, Film Noir, Cyberpunk, Watercolor, Realistic, or Stop Motion
3. **Generate** — the app calls `generate_screenplay` on the stoira-mcp server
4. **Pipeline runs** — screenplay → keyframes → video generation (via `run_full_pipeline`)
5. **Preview** — scenes appear in the storyboard grid, video plays in the preview panel
6. **Export** — download the final film in MP4, WebM, or MOV format

## MCP Integration

OpenCorn connects to the **stoira-mcp** server, which exposes these tools:

| Tool | Description |
|------|-------------|
| `generate_screenplay` | Generate a multi-scene screenplay from a text idea |
| `get_workflow_status` | Check pipeline progress for a workflow |
| `run_full_pipeline` | Execute the full end-to-end production pipeline |
| `list_workflows` | List all production workflows |

The MCP client performs a proper JSON-RPC 2.0 handshake (`initialize` → `notifications/initialized`) before calling tools.

## Pipeline Stages

```
idle → generating_screenplay → generating_keyframes → generating_video
     → processing_audio → stitching → complete
```

## RPC Contract

**Bun → Renderer (push):**
- `onPipelineUpdate` — stage/progress changes
- `onStoryboardReady` — storyboard generated
- `onVideoReady` — final video available

**Renderer → Bun (request/response):**
- `submitIdea({ idea, style })` → `{ workflowId }`
- `getStoryboard({ workflowId })` → `Storyboard`
- `pollStatus({ workflowId })` → `PipelineStatus`
- `getVideo({ workflowId })` → `{ videoUrl }`

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- Python 3.10+ with the stoira-mcp server installed at `/tmp/stoira-mcp/`

### Install

```bash
bun install
```

### Run

```bash
bun run dev
```

The app will automatically spawn the stoira-mcp server via:
```
python3 /tmp/stoira-mcp/stoira_mcp_server.py --transport stdio
```

### Build

```bash
bun run build
bun run package
```

## Style Mapping

The UI film styles map to stoira-mcp's `anime_style` enum:

| UI Style | MCP anime_style |
|----------|----------------|
| Anime | `ANIME` |
| Film Noir | `ANIME` |
| Cyberpunk | `THREE_D_ANIME` |
| Watercolor | `STUDIO_GHIBLI` |
| Realistic | `THREE_D_ANIME` |
| Stop Motion | `PIXEL_ART` |

## License

MIT

# OpenCorn

Open-source AI film studio. Type an idea, get a film.

## Stack

- **Runtime:** [Electrobun](https://electrobun.dev) (Bun + WebViews) — 16MB bundles, ZSTD compression, WGPU
- **UI:** React 19 with inline styles (no Tailwind, no CSS modules)
- **Backend:** MCP client connecting to stoira-mcp server via stdio or TCP (JSON-RPC 2.0)
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

OpenCorn delegates all AI generation to the **stoira-mcp** server, which orchestrates the full film production pipeline. The MCP client communicates over JSON-RPC 2.0 with a proper handshake (`initialize` → `notifications/initialized`).

### What the MCP Server Does

| Tool | Description |
|------|-------------|
| `generate_screenplay` | Generate a multi-scene screenplay from a text idea |
| `get_workflow_status` | Check pipeline progress for a workflow |
| `run_full_pipeline` | Execute the full end-to-end production pipeline |
| `list_workflows` | List all production workflows |

Internally, the server handles:
- **Screenplay generation** — turns your idea into a structured multi-scene script
- **Keyframe generation** — creates image keyframes for each scene
- **Video generation** — renders video clips from keyframes (uses providers like Sora 2, Seedance, Wan)
- **Pipeline orchestration** — sequences all stages, tracks progress, handles errors

### Connection Modes

OpenCorn supports two ways to connect to the MCP server:

#### Local Mode (default)

The `mcpServerUrl` setting defaults to `stdio://stoira_mcp_server.py`. In this mode, OpenCorn spawns the stoira-mcp server as a local subprocess:

```
python3 /tmp/stoira-mcp/stoira_mcp_server.py --transport stdio
```

This is the simplest setup — no network configuration needed. The server runs on your machine and the client communicates with it over stdin/stdout.

**Requirements for local mode:**
- Python 3.10+
- The stoira-mcp server scripts at `/tmp/stoira-mcp/`
- API keys for the AI services the server wraps (image/video generation providers)
- A GPU is recommended for local inference-heavy workloads; cloud API-backed workflows will work without one

#### Remote Mode (TCP)

Change `mcpServerUrl` to a `tcp://host:port` address (e.g. `tcp://192.168.1.50:8080`) to connect to a remotely hosted stoira-mcp server. This is useful when:
- The server runs on a dedicated GPU machine in your network
- You're sharing a server across a team
- You want to offload generation to a cloud instance

You can change the URL in the app's settings panel, or edit it directly in `src/shared/types.ts` in the `DEFAULT_SETTINGS` object.

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
- Python 3.10+ (for the MCP server in local mode)
- API keys for whichever AI providers you intend to use (image generation, video generation, etc.)

### 1. Install the App

```bash
bun install
```

### 2. Set Up the stoira-mcp Server

The stoira-mcp server must be present at `/tmp/stoira-mcp/` with the main entry point as `stoira_mcp_server.py`. The simplest way to get it:

```bash
# Clone the stoira-mcp repo
git clone https://github.com/nicepkg/stoira-mcp.git /tmp/stoira-mcp

# Install its Python dependencies
cd /tmp/stoira-mcp
pip install -r requirements.txt
```

> **Note:** The exact repository URL and installation steps may vary. Check the stoira-mcp project for the latest instructions. If you have a private fork or a pre-built distribution, place it at `/tmp/stoira-mcp/` instead.

**Verify it works** by running the server directly:
```bash
python3 /tmp/stoira-mcp/stoira_mcp_server.py --transport stdio
```
It should start and wait for JSON-RPC input on stdin. Press `Ctrl+C` to stop.

### 3. Configure Environment

The MCP server may need API keys for the AI services it calls (image/video generation providers). Set these as environment variables before launching OpenCorn — check the stoira-mcp documentation for the required variables.

### 4. Run

```bash
bun run dev
```

OpenCorn will automatically spawn the stoira-mcp server in **local mode** (stdio). If you want to use a **remote server** instead, change `mcpServerUrl` in the app settings to a `tcp://host:port` address. See [Connection Modes](#connection-modes) above.

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

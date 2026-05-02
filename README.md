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

# Create a virtual environment (required on macOS, recommended everywhere)
cd /tmp/stoira-mcp
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

> **Note:** The exact repository URL and installation steps may vary. Check the stoira-mcp project for the latest instructions. If you have a private fork or a pre-built distribution, place it at `/tmp/stoira-mcp/` instead.

> **macOS:** Apple's system `python3` (3.9) is too old for the MCP SDK (requires 3.10+). The virtual environment ensures the right Python and dependencies are used. If `python3 -m venv` fails, install Python 3.10+ via [Homebrew](https://brew.sh): `brew install python@3.14`

**Verify it works** by running the server directly:
```bash
# From /tmp/stoira-mcp:
.venv/bin/python3 stoira_mcp_server.py --transport stdio
```
It should start and wait for JSON-RPC input on stdin. Press `Ctrl+C` to stop.

OpenCorn automatically detects the `.venv` at `/tmp/stoira-mcp/.venv/bin/python3` and uses it. If no venv exists, it falls back to `python3` on your PATH.

### 3. Configure Environment

The MCP server needs API keys for the AI services it calls (image/video generation providers). Set these as environment variables **before** launching OpenCorn:

```bash
# Required for image/video generation (RunningHub)
export RUNNINGHUB_API_KEY="your-key-here"

# Required for screenplay generation (Google Gemini)
export GCP_PROJECT="your-gcp-project"

# Launch OpenCorn
bun run dev
```

The server starts in **degraded mode** when providers are unconfigured — it will respond to MCP handshakes and list tools, but generation requests will fail with clear error messages. This means OpenCorn will connect successfully even without API keys; you can configure them later.

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

## Troubleshooting

### MCP connect failed: MCP request timed out

**Cause:** The MCP server process crashed before it could respond to the `initialize` handshake. The most common reasons:

1. **Wrong Python** — `python3` points to Apple's Python 3.9 (macOS), which is too old for the `mcp` SDK.
   **Fix:** Create a venv at `/tmp/stoira-mcp/.venv` (see [Set Up the stoira-mcp Server](#2-set-up-the-stoira-mcp-server)).

2. **Missing dependencies** — The `mcp` package or other requirements aren't installed.
   **Fix:** `cd /tmp/stoira-mcp && .venv/bin/pip install -r requirements.txt`

3. **Server not cloned** — The `/tmp/stoira-mcp/` directory doesn't exist.
   **Fix:** Clone the repo (see setup instructions above).

OpenCorn now captures stderr from the server process and logs it to the console. Check the terminal output for the actual Python error.

### MCP server starts but tools fail

The server runs in degraded mode when providers are unconfigured. Set the required environment variables before launching OpenCorn (see [Configure Environment](#3-configure-environment)).

### Remote server (TCP) connection

To use a remote stoira-mcp server instead of a local subprocess, change `mcpServerUrl` in settings to `tcp://host:port` (e.g. `tcp://192.168.1.50:8080`). The remote server must be started with `--transport sse`.


## License

MIT

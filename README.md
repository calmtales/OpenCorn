# OpenCorn

Open-source AI film studio. Type an idea, get a film.

## Stack

- **Runtime:** Electrobun (Bun + WebViews) — 16MB bundles, ZSTD compression, WGPU
- **UI:** React 19
- **Backend:** MCP client connecting to stoira-mcp server via stdio

## Architecture

```
src/
├── main/           # Bun main process
│   └── index.ts    # MCP client, RPC handlers, window management
├── renderer/       # React UI (runs in WebView)
│   ├── index.tsx   # Entry point, Electroview RPC setup
│   ├── App.tsx     # Main layout
│   ├── components/
│   │   ├── IdeaInput.tsx       # Text area + style selector
│   │   ├── StoryboardGrid.tsx  # Scene card grid
│   │   ├── SceneCard.tsx       # Individual scene preview
│   │   ├── TimelineBar.tsx     # Horizontal film timeline
│   │   ├── PlayerPreview.tsx   # Video preview player
│   │   ├── McpStatus.tsx       # MCP connection indicator
│   │   └── ExportPanel.tsx     # Download/format selector
│   └── hooks/
│       └── useFilmPipeline.ts  # Pipeline state machine
└── shared/
    └── types.ts    # Types shared between main and renderer
```

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

```bash
bun install
bun run dev
```

Requires `stoira-mcp` server available on PATH.

## License

MIT

# OpenCorn v0.4 — End-to-End Test Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Bun** | >= 1.1 | `curl -fsSL https://bun.sh/install \| bash` |
| **Python 3** | >= 3.10 | System package manager |
| **FFmpeg** | >= 6.0 | `brew install ffmpeg` / `apt install ffmpeg` |
| **stoira-mcp** | Latest | Clone from repo (see below) |
| **Node.js** | >= 18 | For ComfyUI (optional) |

## Step-by-Step Setup

### 1. Clone and Install

```bash
# Clone OpenCorn
git clone https://github.com/opencorn/opencorn.git
cd opencorn

# Install dependencies
bun install

# Clone the MCP server
git clone https://github.com/stoira/stoira-mcp.git /tmp/stoira-mcp
cd /tmp/stoira-mcp
pip install -r requirements.txt
cd -
```

### 2. Start the MCP Server

```bash
# Verify the MCP server works
python3 /tmp/stoira-mcp/stoira_mcp_server.py --transport stdio --test

# If the above fails, install dependencies:
cd /tmp/stoira-mcp && pip install -e . && cd -
```

### 3. Start OpenCorn

```bash
bun run dev
```

The app window should open showing the OpenCorn interface with:
- Left sidebar: Idea input + style selector
- Center: Empty storyboard grid
- Right: Video preview panel
- Top: Header with navigation buttons
- Bottom: Status bar showing "Ready"

### 4. Create Your First Film

1. **Enter an idea** in the text area:
   ```
   A lone astronaut discovers an ancient AI artifact on a distant moon
   ```

2. **Select a style** — click one of the 6 style buttons (Anime, Noir, Cyberpunk, Watercolor, Realistic, Stop Motion)

3. **Generate** — click "Generate Film" or press `Cmd+Enter` (Ctrl+Enter on Linux/Windows)

4. **Watch progress** — the status bar will show pipeline stages:
   - "Writing screenplay..." (5-10s)
   - "Storyboard ready!" toast appears
   - "Rendering keyframes..." (20-60s)
   - "Generating video..." (1-5min)
   - "Stitching final render..." (10-30s)
   - "Film complete!" with green indicator

5. **Preview** — the video player on the right will load the generated film

6. **Export** — click the Export button in the top-right to download as MP4/WebM/MOV

### 5. Test Additional Features

#### Settings (`Cmd+,`)
- Change video provider (Sora 2, Seedance, WAN)
- Adjust scene count slider (1-30)
- Switch aspect ratio
- Click Save Settings

#### History (`Cmd+H`)
- View previous workflows
- Click a workflow to expand actions
- Resume, Download, or Delete workflows

#### PromptCraft (`Cmd+P`)
- Edit scene descriptions
- Change camera angles (Wide, Medium, Close-up, Tracking, Dolly)
- Adjust lighting mood (Natural, Dramatic, Warm, Cool, Noir, Golden, Neon)
- Upload character reference images via drag-and-drop

#### Presets (`Cmd+Shift+P`)
- Browse 8 built-in style presets (Arcane, Ghibli, Cyberpunk, etc.)
- Click a preset to see details and prompt template
- Click "Apply This Preset" to use it

#### Batch Mode (`Cmd+B`)
- Enter multiple ideas (one per line)
- Use "idea | style" format for per-idea styles
- Set concurrency (1-3 parallel)
- Click "Start Batch"
- Monitor progress with real-time updates

#### ComfyUI (`Cmd+K`)
- Enter ComfyUI URL (default: `http://127.0.0.1:8188`)
- Click Connect to scan installed models
- Import workflow JSON files via drag-and-drop
- Submit prompts to local ComfyUI instance

#### Local Models (`Cmd+L`)
- View VRAM usage (requires nvidia-smi)
- Browse installed models in `~/.stoira/models/`
- Download recommended models (SDXL, SD 1.5, FLUX.1, etc.)
- Run benchmarks on installed models

## Expected Output

### Successful Film Generation
- **Storyboard**: 4-8 scene cards with titles, descriptions, and keyframe previews
- **Timeline**: Horizontal bar showing scene durations proportionally
- **Video Player**: Full video with play/pause, scrubber, speed controls, loop, fullscreen
- **Export**: Downloadable MP4 file

### Screenshot Descriptions

1. **Main Interface** — Dark cinematic UI with orange accent. Left sidebar has text input and style grid. Center shows empty storyboard grid with "No storyboard yet" illustration. Right panel has video player placeholder.

2. **Generation in Progress** — Progress bar at top of main area. Status bar shows "Generating video..." with pulsing orange dot. Toast notification in bottom-right: "Writing your screenplay..."

3. **Completed Film** — Storyboard grid populated with 4 scene cards showing keyframe images. Video player showing the generated film with playback controls. Timeline bar showing colored scene segments. Export button now active.

4. **Batch Mode** — Input area with 3 ideas listed. Stats bar showing "2 done, 1 active, 0 failed, 3 total". Job cards with progress bars and status badges.

5. **ComfyUI Panel** — Green "Connected" status dot. List of installed models with type badges (checkpoint, lora, vae). Workflow import drop zone. Queue with running prompt and progress bar.

## Troubleshooting

### MCP Server Won't Start

```bash
# Check Python version
python3 --version  # Should be 3.10+

# Check stoira-mcp exists
ls /tmp/stoira-mcp/stoira_mcp_server.py

# Try running directly
python3 /tmp/stoira-mcp/stoira_mcp_server.py --transport stdio

# Common fix: install missing dependencies
cd /tmp/stoira-mcp && pip install -e .
```

### "Failed to connect to stoira-mcp server"

- Ensure `python3` is in your PATH
- Check the MCP server URL in Settings (`Cmd+,`)
- Default: `stdio://stoira_mcp_server.py`
- Try: `python3 /tmp/stoira-mcp/stoira_mcp_server.py --transport stdio` manually

### Video Generation Fails

- Check your API keys for the selected video provider
- Ensure FFmpeg is installed: `ffmpeg -version`
- Try a different video provider in Settings
- Check console for error details (View > Developer Tools)

### ComfyUI Connection Issues

- Ensure ComfyUI is running: `http://127.0.0.1:8188`
- Check ComfyUI has models installed in `models/checkpoints/`
- WebSocket connection requires ComfyUI >= 0.2.0
- Firewall may block the WebSocket connection

### UI Not Rendering

- Clear the app cache: delete `~/.opencorn/cache/`
- Check for JavaScript errors in Developer Tools
- Ensure React 19 is installed: `bun install`
- Try rebuilding: `bun run build`

### Batch Mode Stalls

- Check MCP server is still running
- Reduce concurrency to 1 (sequential)
- Check individual job errors in the batch panel
- Cancel and restart the batch

### Performance Issues

- Reduce scene count in Settings (lower = faster)
- Use 480p or 720p resolution for faster rendering
- Close other GPU-intensive applications
- For ComfyUI: use smaller models (SD 1.5 vs SDXL)

## Keyboard Shortcuts Reference

| Shortcut | Action |
|----------|--------|
| `Cmd+Enter` | Submit idea / Generate film |
| `Cmd+,` | Open Settings |
| `Cmd+H` | Open History |
| `Cmd+P` | Open PromptCraft |
| `Cmd+K` | Open ComfyUI |
| `Cmd+L` | Open Local Models |
| `Cmd+Shift+P` | Open Preset Gallery |
| `Cmd+B` | Open Batch Mode |
| `Cmd+/` | Keyboard shortcuts modal |
| `Cmd+F` | Toggle fullscreen player |
| `Space` | Play/Pause video |
| `Esc` | Close panel / modal |

## Running Integration Tests

```bash
bun test tests/integration.test.ts
```

Expected output:
```
✓ Full Pipeline Flow > submitIdea returns workflowId and builds storyboard
✓ Full Pipeline Flow > pollStatus returns complete after full pipeline
✓ Full Pipeline Flow > runFullPipeline returns merged video URL
✓ Full Pipeline Flow > full flow: submitIdea -> screenplay -> keyframes -> video -> export
✓ Settings Persistence > save then load settings survives restart simulation
✓ Settings Persistence > default settings used when no saved settings exist
✓ Settings Persistence > settings round-trip preserves all fields
✓ Batch Mode > batch processes 3 sample ideas sequentially
✓ Batch Mode > batch with per-idea styles
✓ ComfyUI Connection > connect returns models
✓ ComfyUI Connection > disconnect clears connection state
✓ ComfyUI Connection > submitPrompt requires connection
✓ Error Handling > MCP timeout returns error
✓ Error Handling > invalid MCP response throws error
✓ Error Handling > MCP disconnection is handled gracefully
✓ Error Handling > missing storyboard throws descriptive error
✓ Error Handling > missing video throws descriptive error
✓ Error Handling > malformed screenplay data is handled

18 tests passed
```

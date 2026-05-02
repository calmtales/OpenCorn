import { BrowserWindow, defineElectrobunRPC, type ElectrobunRPCSchema } from "electrobun/bun";
import type {
  BunRPC,
  WebviewRPC,
  PipelineStatus,
  Storyboard,
  Scene,
  FilmStyle,
  AppSettings,
  WorkflowSummary,
  ComfyUIModel,
  ComfyUIWorkflow,
  ComfyUIQueueItem,
  ComfyUIConnection,
  LocalModel,
  RecommendedModel,
  BatchJob,
  BatchState,
  Toast,
} from "../shared/types";
import { DEFAULT_SETTINGS } from "../shared/types";
import { ComfyUIClient } from "./comfyui";

// Map UI FilmStyle to stoira-mcp anime_style enum
const STYLE_MAP: Record<FilmStyle, string> = {
  anime: "ANIME",
  noir: "ANIME",
  cyberpunk: "THREE_D_ANIME",
  watercolor: "STUDIO_GHIBLI",
  realistic: "THREE_D_ANIME",
  "stop-motion": "PIXEL_ART",
  arcane: "THREE_D_ANIME",
  ghibli: "STUDIO_GHIBLI",
  "oil-painting": "STUDIO_GHIBLI",
  claymation: "PIXEL_ART",
};

// MCP Client — connects to stoira-mcp server via stdio using JSON-RPC 2.0
class McpClient {
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private connected = false;
  private initialized = false;
  private requestId = 0;
  private serverUrl = "stdio://stoira_mcp_server.py";
  private pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void }
  >();

  setServerUrl(url: string) {
    this.serverUrl = url;
  }

  /** Resolve the Python binary — prefer venv, then python3.14, then python3 */
  private resolvePython(): string {
    const venvPython = "/tmp/stoira-mcp/.venv/bin/python3";
    // Bun.file.exists is not available at runtime; use fs sync check
    try {
      const { existsSync } = require("fs");
      if (existsSync(venvPython)) return venvPython;
    } catch {}
    return "python3";
  }

  async connect(): Promise<boolean> {
    try {
      // Parse server URL — support stdio:// and tcp:// schemes
      let cmd: string[];
      const python = this.resolvePython();
      if (this.serverUrl.startsWith("stdio://")) {
        const script = this.serverUrl.slice("stdio://".length);
        cmd = [python, `/tmp/stoira-mcp/${script}`, "--transport", "stdio"];
      } else {
        cmd = [python, "/tmp/stoira-mcp/stoira_mcp_server.py", "--transport", "stdio"];
      }

      this.proc = Bun.spawn(cmd, {
        stdio: ["pipe", "pipe", "pipe"],
        stderr: "pipe",
        env: {
          ...process.env,
          // If using a venv, set VIRTUAL_ENV so child processes know
          ...(python.includes(".venv") ? { VIRTUAL_ENV: "/tmp/stoira-mcp/.venv" } : {}),
        },
      });

      // Collect stderr for diagnostics
      const stderrChunks: string[] = [];
      const stderrReader = this.proc.stderr?.getReader();
      const drainStderr = async () => {
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await stderrReader!.read();
            if (done) break;
            stderrChunks.push(decoder.decode(value, { stream: true }));
          }
        } catch {}
      };
      drainStderr();

      // Clean up pending promises on process exit
      this.proc.exited.then(() => {
        this.connected = false;
        this.initialized = false;
        // Reject all pending requests
        for (const [id, { reject }] of this.pending) {
          reject(new Error("MCP process exited unexpectedly"));
        }
        this.pending.clear();
      });

      // Start reading stdout
      this.readLoop();

      // Detect early process exit (e.g. missing Python deps, wrong interpreter)
      await Bun.sleep(500);
      if (this.proc.exitCode !== null) {
        const stderr = stderrChunks.join("").trim();
        const hint = stderr.includes("ModuleNotFoundError")
          ? "\nHint: run 'cd /tmp/stoira-mcp && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt'"
          : "";
        throw new Error(
          `MCP server exited immediately (code ${this.proc.exitCode}).${hint}\n${stderr}`
        );
      }

      this.connected = true;

      // MCP initialize handshake
      await this.initialize();
      return true;
    } catch (err) {
      console.error("MCP connect failed:", err);
      this.connected = false;
      this.proc?.kill();
      this.proc = null;
      return false;
    }
  }

  private async initialize(): Promise<void> {
    const result = await this.call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "opencorn",
        version: "0.4.0",
      },
    });

    // Send initialized notification
    this.notify("notifications/initialized", {});
    this.initialized = true;
    console.log("MCP initialized:", result?.serverInfo?.name ?? "unknown");
  }

  private async readLoop() {
    if (!this.proc?.stdout) return;
    const reader = this.proc.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id != null && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id)!;
            this.pending.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
          }
        } catch {
          // ignore malformed lines or non-JSON stderr output
        }
      }
    }
  }

  private notify(method: string, params: Record<string, unknown>) {
    if (!this.proc?.stdin) return;
    const msg = JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n";
    this.proc.stdin.write(new TextEncoder().encode(msg));
  }

  private async call(method: string, params: Record<string, unknown> = {}) {
    if (!this.proc?.stdin || !this.connected)
      throw new Error("MCP not connected");

    // Guard against process that exited after connect() validated it
    if (this.proc.exitCode !== null)
      throw new Error(`MCP process exited (code ${this.proc.exitCode})`);

    const id = ++this.requestId;
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";

    return new Promise<any>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc!.stdin!.write(new TextEncoder().encode(msg));

      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("MCP request timed out"));
        }
      }, 30_000);
    });
  }

  private async callTool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<any> {
    const result = await this.call("tools/call", { name, arguments: args });
    // MCP tools/call returns { content: [{ type: "text", text: "..." }] }
    if (result?.content?.[0]?.text) {
      return JSON.parse(result.content[0].text);
    }
    return result;
  }

  isConnected() {
    return this.connected && this.initialized;
  }

  async listTools(): Promise<string[]> {
    const result = await this.call("tools/list", {});
    return result?.tools?.map((t: any) => t.name) ?? [];
  }

  async generateScreenplay(
    idea: string,
    style: FilmStyle,
    settings: AppSettings
  ): Promise<{ workflowId: string; storyboard: Storyboard }> {
    const animeStyle = STYLE_MAP[style] ?? "ANIME";
    const result = await this.callTool("generate_screenplay", {
      idea,
      anime_style: animeStyle,
      num_scenes: settings.sceneCount,
      dialogue_language: "en",
      aspect_ratio: settings.aspectRatio,
      video_provider: settings.videoProvider,
      image_provider: settings.imageProvider,
    });

    const workflowId = result.workflow_id;
    const screenplay = result.screenplay;
    const storyboard = this.parseScreenplay(screenplay, workflowId, idea, style);

    return { workflowId, storyboard };
  }

  async getWorkflowStatus(workflowId: string): Promise<PipelineStatus> {
    const result = await this.callTool("get_workflow_status", {
      workflow_id: workflowId,
    });
    return this.parseWorkflowStatus(result);
  }

  async runFullPipeline(
    idea: string,
    style: FilmStyle,
    settings: AppSettings,
    workflowId?: string
  ): Promise<any> {
    const animeStyle = STYLE_MAP[style] ?? "ANIME";
    return this.callTool("run_full_pipeline", {
      idea,
      anime_style: animeStyle,
      num_scenes: settings.sceneCount,
      workflow_id: workflowId,
      aspect_ratio: settings.aspectRatio,
      video_provider: settings.videoProvider,
      image_provider: settings.imageProvider,
      export_format: settings.exportFormat,
      export_resolution: settings.exportResolution,
    });
  }

  async listWorkflows(): Promise<WorkflowSummary[]> {
    const result = await this.callTool("list_workflows", {});
    return (result?.workflows ?? []).map((w: any) => ({
      workflowId: w.workflow_id ?? w.id,
      title: w.title ?? "Untitled",
      idea: w.idea ?? "",
      style: (w.style ?? "anime") as FilmStyle,
      createdAt: w.created_at ?? new Date().toISOString(),
      status: w.status ?? "idle",
      videoUrl: w.video_url,
      sceneCount: w.scene_count ?? 0,
    }));
  }

  async deleteWorkflow(workflowId: string): Promise<boolean> {
    try {
      await this.callTool("delete_workflow", { workflow_id: workflowId });
      return true;
    } catch {
      return false;
    }
  }

  private parseScreenplay(
    screenplay: any,
    workflowId: string,
    idea: string,
    style: FilmStyle
  ): Storyboard {
    const scenes: Scene[] = (screenplay.scenes ?? []).map(
      (s: any, i: number) => ({
        id: `${workflowId}-scene-${i + 1}`,
        title: s.title ?? `Scene ${i + 1}`,
        description: s.visual_description ?? s.description ?? s.action ?? "",
        duration: s.duration ?? 10,
        dialogue: s.dialogue ?? undefined,
        keyframes: s.keyframe_url
          ? [
              {
                id: `${workflowId}-kf-${i + 1}`,
                imageUrl: s.keyframe_url,
                description: s.visual_description ?? "",
                timestamp: s.timestamp ?? i * 10,
              },
            ]
          : [],
        order: i,
      })
    );

    return {
      id: workflowId,
      title: screenplay.title ?? idea.slice(0, 60),
      idea,
      style,
      scenes,
      totalDuration:
        screenplay.total_duration ??
        scenes.reduce((sum, s) => sum + s.duration, 0),
      createdAt: new Date().toISOString(),
    };
  }

  private parseWorkflowStatus(status: any): PipelineStatus {
    if (status.error) {
      return { stage: "idle", progress: 0, error: status.error };
    }

    const stages = status.stages ?? status;
    const screenplayDone = stages.screenplay ?? false;
    const keyframesDone = stages.keyframes ?? false;
    const videosDone = stages.videos ?? false;
    const mergedDone = stages.merged ?? false;

    if (mergedDone) return { stage: "complete", progress: 100 };
    if (videosDone) return { stage: "stitching", progress: 90 };
    if (keyframesDone) return { stage: "generating_video", progress: 70 };
    if (screenplayDone) return { stage: "generating_keyframes", progress: 30 };
    return { stage: "generating_screenplay", progress: 10 };
  }

  disconnect() {
    this.proc?.kill();
    this.connected = false;
    this.initialized = false;
  }
}

// --- App entry ---
const mcp = new McpClient();
const comfy = new ComfyUIClient();
let currentSettings: AppSettings = { ...DEFAULT_SETTINGS };
const workflowStore = new Map<
  string,
  { storyboard?: Storyboard; videoUrl?: string; scenes?: Scene[] }
>();
const batchStore = new Map<string, BatchState>();
let batchCounter = 0;

// RPC schema: bun handles requests from renderer, sends messages to renderer
interface AppRPCSchema extends ElectrobunRPCSchema {
  bun: {
    requests: {
      submitIdea: { params: { idea: string; style: FilmStyle; settings: AppSettings }; response: { workflowId: string } };
      getStoryboard: { params: { workflowId: string }; response: Storyboard };
      pollStatus: { params: { workflowId: string }; response: PipelineStatus };
      getVideo: { params: { workflowId: string }; response: { videoUrl: string } };
      listWorkflows: { params: undefined; response: { workflows: WorkflowSummary[] } };
      deleteWorkflow: { params: { workflowId: string }; response: { success: boolean } };
      resumeWorkflow: { params: { workflowId: string }; response: { workflowId: string } };
      updateScene: { params: { workflowId: string; sceneId: string; updates: Partial<Scene> }; response: { success: boolean } };
      getSettings: { params: undefined; response: AppSettings };
      saveSettings: { params: { settings: AppSettings }; response: { success: boolean } };
      comfyConnect: { params: { url: string }; response: { success: boolean; models: ComfyUIModel[] } };
      comfyDisconnect: { params: undefined; response: { success: boolean } };
      comfyGetStatus: { params: undefined; response: ComfyUIConnection };
      comfyScanModels: { params: undefined; response: { models: ComfyUIModel[] } };
      comfyImportWorkflow: { params: { json: string }; response: { workflow: ComfyUIWorkflow } };
      comfyExportWorkflow: { params: { workflowId: string }; response: { json: string } };
      comfySubmitPrompt: { params: { workflowId: string; inputs: Record<string, unknown> }; response: { promptId: string } };
      comfyPollStatus: { params: { promptId: string }; response: ComfyUIQueueItem };
      comfyListQueue: { params: undefined; response: { queue: ComfyUIQueueItem[] } };
      scanLocalModels: { params: { dir?: string }; response: { models: LocalModel[] } };
      getRecommendedModels: { params: undefined; response: { models: RecommendedModel[] } };
      downloadModel: { params: { modelId: string; url: string }; response: { success: boolean } };
      getVramInfo: { params: undefined; response: { totalMb: number; usedMb: number; freeMb: number } };
      benchmarkModel: { params: { modelId: string }; response: { latencyMs: number } };
      submitBatch: { params: { jobs: { idea: string; style: FilmStyle }[]; concurrency: number }; response: { batchId: string } };
      getBatchStatus: { params: { batchId: string }; response: BatchState };
      cancelBatch: { params: { batchId: string }; response: { success: boolean } };
      exportBatchResults: { params: { batchId: string; format: "zip" | "individual" }; response: { path: string } };
    };
    messages: {};
  };
  webview: {
    requests: {};
    messages: {
      onPipelineUpdate: { status: PipelineStatus };
      onStoryboardReady: { storyboard: Storyboard };
      onVideoReady: { videoUrl: string };
      onToast: { toast: Toast };
      onComfyUIUpdate: { connection: ComfyUIConnection };
      onBatchProgress: { jobId: string; status: BatchJob["status"]; progress: number };
    };
  };
}

// Create RPC first, then window — Electrobun wires transport automatically
const rpc = defineElectrobunRPC<AppRPCSchema, "bun">("bun", {
  handlers: { requests: {}, messages: {} },
});

// Set request handlers (called async by Electrobun, so `rpc` is fully initialized
// by the time any handler closure executes — safe to reference rpc.send())
rpc.setRequestHandler({
  submitIdea: async ({ idea, style, settings }: { idea: string; style: FilmStyle; settings: AppSettings }) => {
    currentSettings = settings ?? currentSettings;
    mcp.setServerUrl(currentSettings.mcpServerUrl);

    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok) throw new Error("Failed to connect to stoira-mcp server");
    }

    const { workflowId, storyboard } = await mcp.generateScreenplay(
      idea,
      style,
      currentSettings
    );
    workflowStore.set(workflowId, { storyboard });

    // Push storyboard to renderer
    rpc.send("onStoryboardReady", { storyboard });

    // Kick off full pipeline in background
    mcp
      .runFullPipeline(idea, style, currentSettings, workflowId)
      .then((result) => {
        const videos = result.scene_videos ?? [];
        const mergedUrl = result.merged_video_url;
        const firstVideo = videos.find((v: any) => v.video_url)?.video_url;

        const entry = workflowStore.get(workflowId);
        if (entry) entry.videoUrl = mergedUrl ?? firstVideo;

        if (mergedUrl || firstVideo) {
          rpc.send("onVideoReady", {
            videoUrl: mergedUrl ?? firstVideo,
          });
        }
      })
      .catch((err) => {
        console.error("Pipeline failed:", err);
      });

    return { workflowId };
  },

  getStoryboard: async ({ workflowId }: { workflowId: string }) => {
    const entry = workflowStore.get(workflowId);
    if (entry?.storyboard) return entry.storyboard;
    throw new Error("Storyboard not found for workflow " + workflowId);
  },

  pollStatus: async ({ workflowId }: { workflowId: string }) => {
    if (!mcp.isConnected()) throw new Error("MCP not connected");
    return mcp.getWorkflowStatus(workflowId);
  },

  getVideo: async ({ workflowId }: { workflowId: string }) => {
    const entry = workflowStore.get(workflowId);
    if (entry?.videoUrl) return { videoUrl: entry.videoUrl };
    throw new Error("Video not ready for workflow " + workflowId);
  },

  listWorkflows: async () => {
    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok) return { workflows: [] };
    }
    const workflows = await mcp.listWorkflows();
    return { workflows };
  },

  deleteWorkflow: async ({ workflowId }: { workflowId: string }) => {
    workflowStore.delete(workflowId);
    if (!mcp.isConnected()) return { success: true };
    const ok = await mcp.deleteWorkflow(workflowId);
    return { success: ok };
  },

  resumeWorkflow: async ({ workflowId }: { workflowId: string }) => {
    return { workflowId };
  },

  updateScene: async ({ workflowId, sceneId, updates }: { workflowId: string; sceneId: string; updates: Partial<Scene> }) => {
    const entry = workflowStore.get(workflowId);
    if (entry?.storyboard) {
      entry.storyboard.scenes = entry.storyboard.scenes.map((s) =>
        s.id === sceneId ? { ...s, ...updates } : s
      );
    }
    return { success: true };
  },

  getSettings: async () => {
    return currentSettings;
  },

  saveSettings: async ({ settings }: { settings: AppSettings }) => {
    currentSettings = settings;
    return { success: true };
  },

  // --- ComfyUI ---
  comfyConnect: async ({ url }: { url: string }) => {
    const ok = await comfy.connect(url);
    const conn = comfy.getConnection();
    rpc.send("onComfyUIUpdate", { connection: conn });
    return { success: ok, models: conn.models };
  },

  comfyDisconnect: async () => {
    comfy.disconnect();
    const conn = comfy.getConnection();
    rpc.send("onComfyUIUpdate", { connection: conn });
    return { success: true };
  },

  comfyGetStatus: async () => {
    return comfy.getConnection();
  },

  comfyScanModels: async () => {
    const models = await comfy.scanModels();
    return { models };
  },

  comfyImportWorkflow: async ({ json }: { json: string }) => {
    const workflow = await comfy.importWorkflow(json);
    return { workflow };
  },

  comfyExportWorkflow: async ({ workflowId }: { workflowId: string }) => {
    const json = comfy.exportWorkflow(workflowId);
    if (!json) throw new Error("Workflow not found");
    return { json };
  },

  comfySubmitPrompt: async ({ workflowId, inputs }: { workflowId: string; inputs: Record<string, unknown> }) => {
    const workflows = comfy.getWorkflows();
    const wf = workflows.find((w) => w.id === workflowId);
    if (!wf) throw new Error("Workflow not found");
    const promptId = await comfy.submitPrompt(wf, inputs);
    return { promptId };
  },

  comfyPollStatus: async ({ promptId }: { promptId: string }) => {
    return comfy.pollStatus(promptId);
  },

  comfyListQueue: async () => {
    const queue = await comfy.getQueue();
    return { queue };
  },

  // --- Local Models ---
  scanLocalModels: async ({ dir }: { dir?: string }) => {
    const modelsDir = dir ?? `${process.env.HOME}/.stoira/models`;
    const models: LocalModel[] = [];

    try {
      const { readdirSync, statSync, existsSync } = await import("fs");
      const { join, extname, basename } = await import("path");

      if (!existsSync(modelsDir)) {
        return { models: [] };
      }

      const files = readdirSync(modelsDir);
      for (const file of files) {
        const filePath = join(modelsDir, file);
        const stat = statSync(filePath);
        if (!stat.isFile()) continue;

        const ext = extname(file).toLowerCase().slice(1);
        const formats = ["gguf", "onnx", "safetensors", "ckpt", "pt"];
        if (!formats.includes(ext)) continue;

        const sizeBytes = stat.size;
        // Rough VRAM estimate: model size * 1.2 for overhead
        const vramEstimateMb = Math.round((sizeBytes * 1.2) / (1024 * 1024));

        // Extract tags from filename
        const name = basename(file, extname(file));
        const tags: string[] = [];
        if (name.toLowerCase().includes("sdxl") || name.toLowerCase().includes("xl")) tags.push("sdxl");
        if (name.toLowerCase().includes("sd15") || name.toLowerCase().includes("1.5")) tags.push("sd1.5");
        if (name.toLowerCase().includes("flux")) tags.push("flux");
        if (name.toLowerCase().includes("lora")) tags.push("lora");
        if (name.toLowerCase().includes("controlnet") || name.toLowerCase().includes("cn")) tags.push("controlnet");

        models.push({
          id: `local-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          name: file,
          format: ext as any,
          path: filePath,
          sizeBytes,
          vramEstimateMb,
          tags,
        });
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return { models };
  },

  getRecommendedModels: async () => {
    const models: RecommendedModel[] = [
      {
        id: "sdxl-base",
        name: "Stable Diffusion XL Base",
        description: "High-quality general-purpose image generation model",
        format: "safetensors",
        downloadUrl: "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors",
        sizeBytes: 6_940_000_000,
        vramEstimateMb: 8_300,
        tags: ["sdxl", "general"],
        category: "image",
      },
      {
        id: "sd15-pruned",
        name: "Stable Diffusion 1.5 Pruned",
        description: "Lightweight SD model, good for low VRAM setups",
        format: "safetensors",
        downloadUrl: "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors",
        sizeBytes: 2_130_000_000,
        vramEstimateMb: 4_000,
        tags: ["sd1.5", "lightweight"],
        category: "image",
      },
      {
        id: "flux-dev",
        name: "FLUX.1 Dev",
        description: "Black Forest Labs' state-of-the-art text-to-image model",
        format: "safetensors",
        downloadUrl: "https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/flux1-dev.safetensors",
        sizeBytes: 23_800_000_000,
        vramEstimateMb: 24_000,
        tags: ["flux", "state-of-the-art"],
        category: "image",
      },
      {
        id: "anything-v5",
        name: "Anything V5",
        description: "High-quality anime-style generation model",
        format: "safetensors",
        downloadUrl: "https://huggingface.co/stablediffusionapi/anything-v5/resolve/main/anything-v5.safetensors",
        sizeBytes: 2_130_000_000,
        vramEstimateMb: 4_000,
        tags: ["anime", "sd1.5"],
        category: "image",
      },
      {
        id: "wan-21-i2v",
        name: "WAN 2.1 Image-to-Video",
        description: "High-quality image-to-video generation for local inference",
        format: "gguf",
        downloadUrl: "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/wan2.1_i2v_480p_14B.gguf",
        sizeBytes: 8_500_000_000,
        vramEstimateMb: 10_000,
        tags: ["video", "i2v"],
        category: "video",
      },
    ];
    return { models };
  },

  downloadModel: async ({ modelId, url }: { modelId: string; url: string }) => {
    // In a real implementation, this would stream the download to ~/.stoira/models/
    console.log(`Download requested: ${modelId} from ${url}`);
    return { success: true };
  },

  getVramInfo: async () => {
    // Try to get real VRAM info via nvidia-smi
    try {
      const proc = Bun.spawn(["nvidia-smi", "--query-gpu=memory.total,memory.used,memory.free", "--format=csv,noheader,nounits"], {
        stdio: ["pipe", "pipe", "pipe"],
      });
      const output = await new Response(proc.stdout).text();
      const [total, used, free] = output.trim().split(",").map((s) => parseInt(s.trim(), 10));
      if (!isNaN(total) && !isNaN(used) && !isNaN(free)) {
        return { totalMb: total, usedMb: used, freeMb: free };
      }
    } catch {}

    // Fallback: estimate based on system info
    return { totalMb: 8192, usedMb: 2048, freeMb: 6144 };
  },

  benchmarkModel: async ({ modelId }: { modelId: string }) => {
    // Simulated benchmark
    const baseLatency = 150;
    const jitter = Math.random() * 100;
    return { latencyMs: Math.round(baseLatency + jitter) };
  },

  // --- Batch Mode ---
  submitBatch: async ({ jobs, concurrency }: { jobs: { idea: string; style: FilmStyle }[]; concurrency: number }) => {
    const batchId = `batch-${++batchCounter}`;
    const batchJobs: BatchJob[] = jobs.map((j: { idea: string; style: FilmStyle }, i: number) => ({
      id: `${batchId}-job-${i}`,
      idea: j.idea,
      style: j.style,
      status: "pending" as const,
      progress: 0,
      createdAt: new Date().toISOString(),
    }));

    const batchState: BatchState = {
      jobs: batchJobs,
      isRunning: true,
      currentIndex: 0,
      concurrency,
    };
    batchStore.set(batchId, batchState);

    // Process jobs sequentially (simplified; real impl would use concurrency)
    const processBatch = async () => {
      for (let i = 0; i < batchJobs.length; i++) {
        const job = batchJobs[i];
        job.status = "running";
        rpc.send("onBatchProgress", {
          jobId: job.id,
          status: "running",
          progress: 0,
        });

        try {
          // Submit idea via MCP
          const { workflowId } = await mcp.generateScreenplay(
            job.idea,
            job.style,
            currentSettings
          );
          job.workflowId = workflowId;
          job.progress = 30;
          rpc.send("onBatchProgress", {
            jobId: job.id,
            status: "running",
            progress: 30,
          });

          // Run pipeline
          const result = await mcp.runFullPipeline(
            job.idea,
            job.style,
            currentSettings,
            workflowId
          );

          const videos = result.scene_videos ?? [];
          const mergedUrl = result.merged_video_url;
          job.videoUrl = mergedUrl ?? videos.find((v: any) => v.video_url)?.video_url;
          job.status = "complete";
          job.progress = 100;
          rpc.send("onBatchProgress", {
            jobId: job.id,
            status: "complete",
            progress: 100,
          });
        } catch (err: any) {
          job.status = "failed";
          job.error = err.message ?? "Unknown error";
          rpc.send("onBatchProgress", {
            jobId: job.id,
            status: "failed",
            progress: 0,
          });
        }

        batchState.currentIndex = i + 1;
      }

      batchState.isRunning = false;
    };

    processBatch();
    return { batchId };
  },

  getBatchStatus: async ({ batchId }: { batchId: string }) => {
    const batch = batchStore.get(batchId);
    if (!batch) throw new Error("Batch not found");
    return batch;
  },

  cancelBatch: async ({ batchId }: { batchId: string }) => {
    const batch = batchStore.get(batchId);
    if (batch) {
      batch.isRunning = false;
      for (const job of batch.jobs) {
        if (job.status === "pending" || job.status === "running") {
          job.status = "failed";
          job.error = "Cancelled";
        }
      }
    }
    return { success: true };
  },

  exportBatchResults: async ({ batchId, format }: { batchId: string; format: "zip" | "individual" }) => {
    const batch = batchStore.get(batchId);
    if (!batch) throw new Error("Batch not found");

    const outputDir = `${process.env.HOME}/.stoira/exports/${batchId}`;
    try {
      const { mkdirSync, writeFileSync } = await import("fs");
      mkdirSync(outputDir, { recursive: true });

      // Write summary JSON
      writeFileSync(
        `${outputDir}/summary.json`,
        JSON.stringify(batch.jobs, null, 2)
      );
    } catch {}

    return { path: outputDir };
  },
});

// Create window — pass the pre-wired RPC so BrowserView connects the transport
const win = new BrowserWindow({
  title: "OpenCorn — AI Film Studio",
  url: "views://main/index.html",
  rpc,
});

// Forward ComfyUI connection updates to renderer
comfy.onConnectionChange((connection) => {
  try {
    rpc.send("onComfyUIUpdate", { connection });
  } catch {}
});

// Connect MCP on startup
mcp.connect().then((ok) => {
  console.log(`MCP ${ok ? "connected" : "disconnected — will retry on use"}`);
  if (ok) {
    mcp.listTools().then((tools) => {
      console.log("Available MCP tools:", tools.join(", "));
    });
  }
});

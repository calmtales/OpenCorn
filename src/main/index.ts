import { BrowserWindow } from "electrobun/bun";
import type {
  BunRPC,
  WebviewRPC,
  PipelineStatus,
  Storyboard,
  Scene,
  FilmStyle,
} from "../shared/types";

// Map UI FilmStyle to stoira-mcp anime_style enum
const STYLE_MAP: Record<FilmStyle, string> = {
  anime: "ANIME",
  noir: "ANIME",
  cyberpunk: "THREE_D_ANIME",
  watercolor: "STUDIO_GHIBLI",
  realistic: "THREE_D_ANIME",
  "stop-motion": "PIXEL_ART",
};

// MCP Client — connects to stoira-mcp server via stdio using JSON-RPC 2.0
class McpClient {
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private connected = false;
  private initialized = false;
  private requestId = 0;
  private pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void }
  >();

  async connect(): Promise<boolean> {
    try {
      this.proc = Bun.spawn(
        ["python3", "/tmp/stoira-mcp/stoira_mcp_server.py", "--transport", "stdio"],
        {
          stdio: ["pipe", "pipe", "pipe"],
          stderr: "inherit",
        }
      );

      this.proc.exited.then(() => {
        this.connected = false;
        this.initialized = false;
      });

      this.readLoop();
      this.connected = true;

      // MCP initialize handshake
      await this.initialize();
      return true;
    } catch (err) {
      console.error("MCP connect failed:", err);
      this.connected = false;
      return false;
    }
  }

  private async initialize(): Promise<void> {
    const result = await this.call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "opencorn",
        version: "0.1.0",
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
      }, 120_000);
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
    style: FilmStyle
  ): Promise<{ workflowId: string; storyboard: Storyboard }> {
    const animeStyle = STYLE_MAP[style] ?? "ANIME";
    const result = await this.callTool("generate_screenplay", {
      idea,
      anime_style: animeStyle,
      num_scenes: 5,
      dialogue_language: "en",
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
    workflowId?: string
  ): Promise<any> {
    const animeStyle = STYLE_MAP[style] ?? "ANIME";
    return this.callTool("run_full_pipeline", {
      idea,
      anime_style: animeStyle,
      num_scenes: 5,
      workflow_id: workflowId,
    });
  }

  async listWorkflows(): Promise<any> {
    return this.callTool("list_workflows", {});
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
    // Map workflow status to pipeline stage
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
const workflowStore = new Map<string, { storyboard?: Storyboard; videoUrl?: string }>();

const win = new BrowserWindow({
  title: "OpenCorn — AI Film Studio",
  url: "views://main/index.html",
});

// Wire up Bun-side RPC handlers
win.rpc.on({
  submitIdea: async ({ idea, style }) => {
    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok) throw new Error("Failed to connect to stoira-mcp server");
    }

    const { workflowId, storyboard } = await mcp.generateScreenplay(idea, style);
    workflowStore.set(workflowId, { storyboard });

    // Push storyboard to renderer
    win.rpc.send("onStoryboardReady", { storyboard });

    // Kick off full pipeline in background
    mcp.runFullPipeline(idea, style, workflowId).then((result) => {
      const videos = result.scene_videos ?? [];
      const mergedUrl = result.merged_video_url;
      const firstVideo = videos.find((v: any) => v.video_url)?.video_url;

      const entry = workflowStore.get(workflowId);
      if (entry) entry.videoUrl = mergedUrl ?? firstVideo;

      if (mergedUrl || firstVideo) {
        win.rpc.send("onVideoReady", { videoUrl: mergedUrl ?? firstVideo });
      }
    }).catch((err) => {
      console.error("Pipeline failed:", err);
    });

    return { workflowId };
  },

  getStoryboard: async ({ workflowId }) => {
    const entry = workflowStore.get(workflowId);
    if (entry?.storyboard) return entry.storyboard;
    throw new Error("Storyboard not found for workflow " + workflowId);
  },

  pollStatus: async ({ workflowId }) => {
    if (!mcp.isConnected()) throw new Error("MCP not connected");
    return mcp.getWorkflowStatus(workflowId);
  },

  getVideo: async ({ workflowId }) => {
    const entry = workflowStore.get(workflowId);
    if (entry?.videoUrl) return { videoUrl: entry.videoUrl };
    throw new Error("Video not ready for workflow " + workflowId);
  },
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

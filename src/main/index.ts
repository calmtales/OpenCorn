import { BrowserWindow } from "electrobun/bun";
import type { BunRPC, WebviewRPC, PipelineStatus, Storyboard, FilmStyle } from "../shared/types";

// MCP Client — connects to stoira-mcp server via stdio
class McpClient {
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private connected = false;
  private requestId = 0;
  private pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void }
  >();

  async connect(): Promise<boolean> {
    try {
      this.proc = Bun.spawn(["stoira-mcp"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.proc.exited.then(() => {
        this.connected = false;
      });

      this.readLoop();
      this.connected = true;
      return true;
    } catch {
      this.connected = false;
      return false;
    }
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
          // ignore malformed lines
        }
      }
    }
  }

  private async call(method: string, params: Record<string, unknown> = {}) {
    if (!this.proc?.stdin || !this.connected)
      throw new Error("MCP not connected");

    const id = ++this.requestId;
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";

    return new Promise<any>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc!.stdin!.write(new TextEncoder().encode(msg));

      // timeout after 60s
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("MCP request timed out"));
        }
      }, 60_000);
    });
  }

  isConnected() {
    return this.connected;
  }

  async submitIdea(
    idea: string,
    style: FilmStyle
  ): Promise<{ workflowId: string }> {
    return this.call("tools/call", {
      name: "generate_storyboard",
      arguments: { idea, style },
    });
  }

  async getStoryboard(workflowId: string): Promise<Storyboard> {
    return this.call("tools/call", {
      name: "get_storyboard",
      arguments: { workflowId },
    });
  }

  async pollStatus(workflowId: string): Promise<PipelineStatus> {
    return this.call("tools/call", {
      name: "poll_status",
      arguments: { workflowId },
    });
  }

  async getVideo(workflowId: string): Promise<{ videoUrl: string }> {
    return this.call("tools/call", {
      name: "get_video",
      arguments: { workflowId },
    });
  }

  disconnect() {
    this.proc?.kill();
    this.connected = false;
  }
}

// --- App entry ---
const mcp = new McpClient();

const win = new BrowserWindow({
  title: "OpenCorn — AI Film Studio",
  url: "views://main/index.html",
});

// Wire up Bun-side RPC handlers
win.rpc.on({
  submitIdea: async ({ idea, style }) => {
    if (!mcp.isConnected()) await mcp.connect();
    return mcp.submitIdea(idea, style);
  },
  getStoryboard: async ({ workflowId }) => {
    return mcp.getStoryboard(workflowId);
  },
  pollStatus: async ({ workflowId }) => {
    return mcp.pollStatus(workflowId);
  },
  getVideo: async ({ workflowId }) => {
    return mcp.getVideo(workflowId);
  },
});

// Connect MCP on startup
mcp.connect().then((ok) => {
  console.log(`MCP ${ok ? "connected" : "disconnected — will retry on use"}`);
});

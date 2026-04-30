import type {
  ComfyUIConnection,
  ComfyUIModel,
  ComfyUIQueueItem,
  ComfyUIWorkflow,
  ComfyUINode,
  ComfyUIStatus,
} from "../shared/types";

const DEFAULT_URL = "http://127.0.0.1:8188";

export class ComfyUIClient {
  private url = DEFAULT_URL;
  private ws: WebSocket | null = null;
  private status: ComfyUIStatus = "disconnected";
  private models: ComfyUIModel[] = [];
  private queue: ComfyUIQueueItem[] = [];
  private workflows: ComfyUIWorkflow[] = [];
  private clientId = crypto.randomUUID();
  private listeners: ((conn: ComfyUIConnection) => void)[] = [];

  onConnectionChange(listener: (conn: ComfyUIConnection) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit() {
    const conn = this.getConnection();
    for (const l of this.listeners) l(conn);
  }

  async connect(url: string = DEFAULT_URL): Promise<boolean> {
    this.url = url;
    this.status = "connecting";
    this.emit();

    try {
      // Test HTTP connection
      const resp = await fetch(`${this.url}/system_stats`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      await resp.json();

      // Connect WebSocket for real-time updates
      this.connectWebSocket();

      // Scan models
      await this.scanModels();

      this.status = "connected";
      this.emit();
      return true;
    } catch (err) {
      this.status = "error";
      this.emit();
      console.error("ComfyUI connect failed:", err);
      return false;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.status = "disconnected";
    this.models = [];
    this.queue = [];
    this.emit();
  }

  private connectWebSocket() {
    try {
      const wsUrl = this.url.replace(/^http/, "ws");
      this.ws = new WebSocket(`${wsUrl}/ws?clientId=${this.clientId}`);

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(typeof event.data === "string" ? event.data : "");
          this.handleWsMessage(data);
        } catch {
          // binary or non-JSON
        }
      };

      this.ws.onclose = () => {
        // Auto-reconnect after 3s
        setTimeout(() => {
          if (this.status === "connected") this.connectWebSocket();
        }, 3000);
      };

      this.ws.onerror = () => {};
    } catch {
      // WebSocket not available — fall back to polling
    }
  }

  private handleWsMessage(data: any) {
    if (data.type === "progress") {
      const item = this.queue.find((q) => q.promptId === data.data.prompt_id);
      if (item) {
        item.progress = Math.round(
          (data.data.value / data.data.max) * 100
        );
        this.emit();
      }
    }

    if (data.type === "executing") {
      const item = this.queue.find((q) => q.promptId === data.data.prompt_id);
      if (item && data.data.node === null) {
        // Execution complete
        item.status = "completed";
        item.completedAt = new Date().toISOString();
        item.progress = 100;
        this.emit();
      }
    }

    if (data.type === "execution_error") {
      const item = this.queue.find((q) => q.promptId === data.data.prompt_id);
      if (item) {
        item.status = "failed";
        item.error = data.data.exception_message ?? "Unknown error";
        this.emit();
      }
    }
  }

  async scanModels(): Promise<ComfyUIModel[]> {
    try {
      const resp = await fetch(`${this.url}/object_info`);
      if (!resp.ok) return this.models;
      const info = await resp.json();

      const models: ComfyUIModel[] = [];

      // Extract checkpoint models
      if (info.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]) {
        for (const name of info.CheckpointLoaderSimple.input.required.ckpt_name[0]) {
          models.push({
            name,
            type: "checkpoint",
            path: `checkpoints/${name}`,
          });
        }
      }

      // Extract LoRA models
      if (info.LoraLoader?.input?.required?.lora_name?.[0]) {
        for (const name of info.LoraLoader.input.required.lora_name[0]) {
          models.push({
            name,
            type: "lora",
            path: `loras/${name}`,
          });
        }
      }

      // Extract VAE models
      if (info.VAELoader?.input?.required?.vae_name?.[0]) {
        for (const name of info.VAELoader.input.required.vae_name[0]) {
          models.push({
            name,
            type: "vae",
            path: `vae/${name}`,
          });
        }
      }

      this.models = models.length > 0 ? models : this.models;
      this.emit();
      return this.models;
    } catch {
      return this.models;
    }
  }

  async importWorkflow(jsonStr: string): Promise<ComfyUIWorkflow> {
    const raw = JSON.parse(jsonStr);
    const nodes: ComfyUINode[] = [];

    // Handle both API format (numbered keys) and UI format
    const nodeKeys = Object.keys(raw).filter((k) => !["last_node_id", "last_link_id", "links", "groups", "config", "extra", "version"].includes(k));

    for (const key of nodeKeys) {
      const node = raw[key];
      if (node && node.class_type) {
        nodes.push({
          id: key,
          type: node.class_type,
          title: node._meta?.title,
          inputs: node.inputs ?? {},
          outputs: node.outputs ?? {},
        });
      }
    }

    const workflow: ComfyUIWorkflow = {
      id: crypto.randomUUID(),
      name: raw._meta?.title ?? `Workflow ${this.workflows.length + 1}`,
      nodes,
      raw,
      source: "imported",
    };

    this.workflows.push(workflow);
    this.emit();
    return workflow;
  }

  exportWorkflow(workflowId: string): string | null {
    const wf = this.workflows.find((w) => w.id === workflowId);
    if (!wf) return null;
    return JSON.stringify(wf.raw, null, 2);
  }

  async submitPrompt(
    workflow: ComfyUIWorkflow,
    inputs: Record<string, unknown> = {}
  ): Promise<string> {
    // Merge inputs into workflow nodes
    const prompt = JSON.parse(JSON.stringify(workflow.raw));

    for (const [nodeId, nodeInputs] of Object.entries(inputs)) {
      if (prompt[nodeId]) {
        prompt[nodeId].inputs = {
          ...prompt[nodeId].inputs,
          ...(nodeInputs as Record<string, unknown>),
        };
      }
    }

    const resp = await fetch(`${this.url}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        client_id: this.clientId,
      }),
    });

    if (!resp.ok) throw new Error(`ComfyUI prompt failed: ${resp.status}`);
    const result = await resp.json();
    const promptId = result.prompt_id;

    this.queue.push({
      promptId,
      workflowName: workflow.name,
      status: "running",
      progress: 0,
      startedAt: new Date().toISOString(),
    });
    this.emit();

    return promptId;
  }

  async pollStatus(promptId: string): Promise<ComfyUIQueueItem> {
    const item = this.queue.find((q) => q.promptId === promptId);
    if (!item) throw new Error("Prompt not found in queue");

    try {
      const resp = await fetch(`${this.url}/history/${promptId}`);
      if (resp.ok) {
        const history = await resp.json();
        if (history[promptId]) {
          const entry = history[promptId];
          if (entry.status?.completed) {
            item.status = "completed";
            item.progress = 100;
            item.completedAt = new Date().toISOString();

            // Get output image
            const outputs = entry.outputs ?? {};
            for (const nodeOut of Object.values(outputs)) {
              const images = (nodeOut as any).images ?? [];
              if (images.length > 0) {
                const img = images[0];
                item.outputUrl = `${this.url}/view?filename=${img.filename}&subfolder=${img.subfolder ?? ""}&type=${img.type ?? "output"}`;
                break;
              }
            }
          }
          if (entry.status?.status_str === "error") {
            item.status = "failed";
            item.error = "Generation failed";
          }
        }
      }
    } catch {
      // fall back to local state
    }

    return { ...item };
  }

  async getQueue(): Promise<ComfyUIQueueItem[]> {
    try {
      const resp = await fetch(`${this.url}/queue`);
      if (resp.ok) {
        const data = await resp.json();
        // Update running/queued from server
        const running = (data.queue_running ?? []).map((q: any) => q[1]?.prompt_id).filter(Boolean);
        const pending = (data.queue_pending ?? []).map((q: any) => q[1]?.prompt_id).filter(Boolean);

        for (const item of this.queue) {
          if (running.includes(item.promptId) && item.status !== "completed" && item.status !== "failed") {
            item.status = "running";
          } else if (pending.includes(item.promptId)) {
            item.status = "queued";
          }
        }
      }
    } catch {}

    return [...this.queue];
  }

  getConnection(): ComfyUIConnection {
    return {
      status: this.status,
      url: this.url,
      models: [...this.models],
      workflows: [...this.workflows],
      queue: [...this.queue],
    };
  }

  getModels(): ComfyUIModel[] {
    return [...this.models];
  }

  getWorkflows(): ComfyUIWorkflow[] {
    return [...this.workflows];
  }

  isConnected(): boolean {
    return this.status === "connected";
  }
}

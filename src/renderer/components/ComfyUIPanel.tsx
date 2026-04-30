import { useState, useEffect, useCallback } from "react";
import type {
  ComfyUIConnection,
  ComfyUIModel,
  ComfyUIQueueItem,
  ComfyUIWorkflow,
  ComfyUIStatus,
} from "../../shared/types";

const STATUS_LABELS: Record<ComfyUIStatus, { label: string; color: string }> = {
  disconnected: { label: "Disconnected", color: "var(--text-muted)" },
  connecting: { label: "Connecting...", color: "var(--warning)" },
  connected: { label: "Connected", color: "var(--success)" },
  error: { label: "Error", color: "var(--error)" },
};

const MODEL_TYPE_COLORS: Record<string, string> = {
  checkpoint: "var(--accent)",
  lora: "#a78bfa",
  vae: "#34d399",
  controlnet: "#f472b6",
  upscale: "#60a5fa",
  clip: "#fbbf24",
  unet: "#f87171",
};

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid var(--border-subtle)",
    flexShrink: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: 4,
    display: "flex",
  },
  body: {
    flex: 1,
    overflow: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    background: "var(--bg-tertiary)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
  },
  statusDot: (color: string) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: color,
    boxShadow: `0 0 6px ${color}40`,
  }),
  statusText: {
    fontSize: 12,
    fontWeight: 500,
  },
  statusUrl: {
    fontSize: 10,
    color: "var(--text-muted)",
    marginLeft: "auto",
    fontFamily: "var(--font-mono)",
  },
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
  },
  inputRow: {
    display: "flex",
    gap: 8,
  },
  input: {
    flex: 1,
    padding: "8px 10px",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    fontSize: 12,
    outline: "none",
    fontFamily: "var(--font-mono)",
  },
  btn: (variant: "primary" | "secondary" | "danger" = "secondary") => ({
    padding: "8px 14px",
    background: variant === "primary" ? "var(--accent)" : variant === "danger" ? "var(--error-muted)" : "var(--bg-tertiary)",
    border: `1px solid ${variant === "primary" ? "var(--accent)" : variant === "danger" ? "rgba(234,74,74,0.2)" : "var(--border)"}`,
    borderRadius: "var(--radius-sm)",
    color: variant === "primary" ? "#fff" : variant === "danger" ? "var(--error)" : "var(--text-secondary)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  }),
  modelList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  modelItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 8px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    fontSize: 11,
  },
  modelTypeBadge: (color: string) => ({
    padding: "1px 6px",
    borderRadius: 10,
    fontSize: 9,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    background: `${color}18`,
    color: color,
    border: `1px solid ${color}30`,
  }),
  modelName: {
    flex: 1,
    color: "var(--text-primary)",
    fontWeight: 500,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  dropZone: (dragOver: boolean) => ({
    padding: "24px",
    border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
    borderRadius: "var(--radius-md)",
    background: dragOver ? "var(--accent-muted)" : "var(--bg-tertiary)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    transition: "all var(--duration-fast) var(--ease-out)",
    textAlign: "center" as const,
  }),
  workflowItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
  },
  workflowName: {
    flex: 1,
    fontSize: 12,
    fontWeight: 500,
  },
  workflowNodes: {
    fontSize: 10,
    color: "var(--text-muted)",
  },
  queueItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
  },
  queueProgress: (pct: number) => ({
    width: 40,
    height: 4,
    borderRadius: 2,
    background: "var(--bg-tertiary)",
    position: "relative" as const,
    overflow: "hidden",
  }),
  queueProgressFill: (pct: number) => ({
    position: "absolute" as const,
    top: 0,
    left: 0,
    height: "100%",
    width: `${pct}%`,
    background: "var(--accent)",
    borderRadius: 2,
    transition: "width 0.3s ease",
  }),
  compareArea: {
    display: "flex",
    gap: 8,
    padding: 12,
    background: "var(--bg-tertiary)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
  },
  compareSlot: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 6,
    padding: 12,
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    minHeight: 120,
    justifyContent: "center",
  },
  compareLabel: {
    fontSize: 9,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "var(--text-muted)",
  },
  compareImg: {
    maxWidth: "100%",
    maxHeight: 160,
    borderRadius: "var(--radius-sm)",
    objectFit: "contain" as const,
  },
  empty: {
    fontSize: 11,
    color: "var(--text-muted)",
    textAlign: "center" as const,
    padding: 8,
  },
};

interface Props {
  onClose: () => void;
}

export function ComfyUIPanel({ onClose }: Props) {
  const [connection, setConnection] = useState<ComfyUIConnection>({
    status: "disconnected",
    url: "http://127.0.0.1:8188",
    models: [],
    workflows: [],
    queue: [],
  });
  const [urlInput, setUrlInput] = useState("http://127.0.0.1:8188");
  const [dragOver, setDragOver] = useState(false);
  const [compareImages, setCompareImages] = useState<{
    comfy: string | null;
    mcp: string | null;
  }>({ comfy: null, mcp: null });

  const getRpc = () => (window as any).__electrobun_rpc;

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getRpc()?.request?.comfyGetStatus?.();
      if (status) setConnection(status);
    } catch {}
  }, []);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  // Listen for ComfyUI updates
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setConnection(e.detail.connection);
    };
    window.addEventListener("comfyui-update", handler as EventListener);
    return () => window.removeEventListener("comfyui-update", handler as EventListener);
  }, []);

  const handleConnect = async () => {
    try {
      const result = await getRpc()?.request?.comfyConnect?.({ url: urlInput });
      if (result?.success) {
        window.dispatchEvent(
          new CustomEvent("toast", {
            detail: { id: "", type: "success", message: "Connected to ComfyUI" },
          })
        );
        refreshStatus();
      } else {
        window.dispatchEvent(
          new CustomEvent("toast", {
            detail: { id: "", type: "error", message: "Failed to connect to ComfyUI" },
          })
        );
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent("toast", {
          detail: { id: "", type: "error", message: "ComfyUI connection error" },
        })
      );
    }
  };

  const handleDisconnect = async () => {
    await getRpc()?.request?.comfyDisconnect?.();
    refreshStatus();
  };

  const handleImportWorkflow = async (jsonStr: string) => {
    try {
      await getRpc()?.request?.comfyImportWorkflow?.({ json: jsonStr });
      window.dispatchEvent(
        new CustomEvent("toast", {
          detail: { id: "", type: "success", message: "Workflow imported" },
        })
      );
      refreshStatus();
    } catch {
      window.dispatchEvent(
        new CustomEvent("toast", {
          detail: { id: "", type: "error", message: "Invalid workflow JSON" },
        })
      );
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = () => handleImportWorkflow(reader.result as string);
      reader.readAsText(file);
    }
  };

  const handleSubmitWorkflow = async (workflowId: string) => {
    try {
      const result = await getRpc()?.request?.comfySubmitPrompt?.({
        workflowId,
        inputs: {},
      });
      if (result?.promptId) {
        window.dispatchEvent(
          new CustomEvent("toast", {
            detail: { id: "", type: "info", message: `Queued: ${result.promptId.slice(0, 8)}` },
          })
        );
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent("toast", {
          detail: { id: "", type: "error", message: "Failed to submit to ComfyUI" },
        })
      );
    }
  };

  const connected = connection.status === "connected";

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.title}>ComfyUI</span>
        <button style={s.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div style={s.body}>
        {/* Connection Status */}
        <div style={s.statusRow}>
          <div style={s.statusDot(STATUS_LABELS[connection.status].color)} />
          <span style={s.statusText}>{STATUS_LABELS[connection.status].label}</span>
          <span style={s.statusUrl}>{connection.url}</span>
        </div>

        {/* Connect/Disconnect */}
        <div style={s.inputRow}>
          <input
            style={s.input}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="http://127.0.0.1:8188"
            disabled={connected}
          />
          {connected ? (
            <button style={s.btn("danger")} onClick={handleDisconnect}>
              Disconnect
            </button>
          ) : (
            <button style={s.btn("primary")} onClick={handleConnect}>
              Connect
            </button>
          )}
        </div>

        {/* Models */}
        {connected && (
          <div style={s.section}>
            <div style={s.sectionTitle}>
              Installed Models ({connection.models.length})
            </div>
            <div style={s.modelList}>
              {connection.models.length === 0 ? (
                <div style={s.empty}>No models found. Install models in ComfyUI.</div>
              ) : (
                connection.models.slice(0, 20).map((model, i) => (
                  <div key={`${model.name}-${i}`} style={s.modelItem}>
                    <span style={s.modelTypeBadge(MODEL_TYPE_COLORS[model.type] ?? "var(--text-muted)")}>
                      {model.type}
                    </span>
                    <span style={s.modelName}>{model.name}</span>
                  </div>
                ))
              )}
              {connection.models.length > 20 && (
                <div style={s.empty}>+{connection.models.length - 20} more</div>
              )}
            </div>
          </div>
        )}

        {/* Import Workflow */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Workflows</div>
          <div
            style={s.dropZone(dragOver)}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => handleImportWorkflow(reader.result as string);
                  reader.readAsText(file);
                }
              };
              input.click();
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 16V4M12 4L8 8M12 4l4 4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Drop ComfyUI workflow JSON or click to import
            </span>
          </div>

          {connection.workflows.map((wf) => (
            <div key={wf.id} style={s.workflowItem}>
              <span style={s.workflowName}>{wf.name}</span>
              <span style={s.workflowNodes}>{wf.nodes.length} nodes</span>
              <button
                style={s.btn("primary")}
                onClick={() => handleSubmitWorkflow(wf.id)}
              >
                Run
              </button>
            </div>
          ))}
        </div>

        {/* Queue */}
        {connection.queue.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Queue</div>
            <div style={s.modelList}>
              {connection.queue.map((item) => (
                <div key={item.promptId} style={s.queueItem}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {item.promptId.slice(0, 8)}
                  </span>
                  <span style={{ fontSize: 11, flex: 1 }}>{item.workflowName}</span>
                  <div style={s.queueProgress(item.progress ?? 0)}>
                    <div style={s.queueProgressFill(item.progress ?? 0)} />
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: item.status === "completed" ? "var(--success)" :
                           item.status === "failed" ? "var(--error)" :
                           item.status === "running" ? "var(--accent)" : "var(--text-muted)",
                  }}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Side-by-side comparison */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Compare Output</div>
          <div style={s.compareArea}>
            <div style={s.compareSlot}>
              <span style={s.compareLabel}>ComfyUI (Local)</span>
              {compareImages.comfy ? (
                <img src={compareImages.comfy} alt="ComfyUI output" style={s.compareImg} />
              ) : (
                <span style={s.empty}>Generate with ComfyUI first</span>
              )}
            </div>
            <div style={s.compareSlot}>
              <span style={s.compareLabel}>MCP Cloud</span>
              {compareImages.mcp ? (
                <img src={compareImages.mcp} alt="MCP output" style={s.compareImg} />
              ) : (
                <span style={s.empty}>Generate with MCP first</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import type { LocalModel, RecommendedModel, LocalModelsState } from "../../shared/types";

const FORMAT_COLORS: Record<string, string> = {
  gguf: "#f59e0b",
  onnx: "#3b82f6",
  safetensors: "#8b5cf6",
  ckpt: "#ef4444",
  pt: "#10b981",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

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
  vramBar: {
    padding: "12px",
    background: "var(--bg-tertiary)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
  },
  vramLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
    marginBottom: 8,
  },
  vramTrack: {
    height: 8,
    borderRadius: 4,
    background: "var(--bg-elevated)",
    overflow: "hidden",
    marginBottom: 6,
  },
  vramFill: (pct: number) => ({
    height: "100%",
    width: `${pct}%`,
    borderRadius: 4,
    background: pct > 90 ? "var(--error)" : pct > 70 ? "var(--warning)" : "var(--accent)",
    transition: "width 0.5s ease",
  }),
  vramStats: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    color: "var(--text-muted)",
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
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  btn: (variant: "primary" | "secondary" | "ghost" = "secondary") => ({
    padding: "6px 12px",
    background: variant === "primary" ? "var(--accent)" : variant === "ghost" ? "transparent" : "var(--bg-tertiary)",
    border: `1px solid ${variant === "primary" ? "var(--accent)" : "var(--border)"}`,
    borderRadius: "var(--radius-sm)",
    color: variant === "primary" ? "#fff" : "var(--text-secondary)",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  }),
  modelCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    padding: "10px 12px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
  },
  modelHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  formatBadge: (color: string) => ({
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
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-primary)",
    flex: 1,
  },
  modelMeta: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 10,
    color: "var(--text-muted)",
  },
  modelTags: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 4,
  },
  tag: {
    padding: "1px 6px",
    background: "var(--bg-elevated)",
    borderRadius: 10,
    fontSize: 9,
    color: "var(--text-secondary)",
  },
  modelActions: {
    display: "flex",
    gap: 6,
  },
  recCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    padding: "10px 12px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
  },
  recHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  recName: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-primary)",
    flex: 1,
  },
  recDesc: {
    fontSize: 11,
    color: "var(--text-secondary)",
    lineHeight: 1.4,
  },
  recMeta: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 10,
    color: "var(--text-muted)",
  },
  downloadProgress: {
    height: 3,
    borderRadius: 2,
    background: "var(--bg-elevated)",
    overflow: "hidden",
  },
  downloadFill: (pct: number) => ({
    height: "100%",
    width: `${pct}%`,
    background: "var(--accent)",
    borderRadius: 2,
    transition: "width 0.3s ease",
  }),
  empty: {
    fontSize: 11,
    color: "var(--text-muted)",
    textAlign: "center" as const,
    padding: 16,
  },
  benchmarkResult: {
    fontSize: 11,
    color: "var(--accent)",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
};

interface Props {
  onClose: () => void;
}

export function LocalModels({ onClose }: Props) {
  const [models, setModels] = useState<LocalModel[]>([]);
  const [recommended, setRecommended] = useState<RecommendedModel[]>([]);
  const [scanning, setScanning] = useState(false);
  const [downloads, setDownloads] = useState<Record<string, number>>({});
  const [vram, setVram] = useState({ totalMb: 0, usedMb: 0, freeMb: 0 });
  const [benchmarks, setBenchmarks] = useState<Record<string, number>>({});

  const getRpc = () => (window as any).__electrobun_rpc;

  const scanModels = useCallback(async () => {
    setScanning(true);
    try {
      const result = await getRpc()?.request?.scanLocalModels?.({});
      if (result?.models) setModels(result.models);
    } catch {}
    setScanning(false);
  }, []);

  const fetchRecommended = useCallback(async () => {
    try {
      const result = await getRpc()?.request?.getRecommendedModels?.();
      if (result?.models) setRecommended(result.models);
    } catch {}
  }, []);

  const fetchVram = useCallback(async () => {
    try {
      const result = await getRpc()?.request?.getVramInfo?.();
      if (result) setVram(result);
    } catch {}
  }, []);

  useEffect(() => {
    scanModels();
    fetchRecommended();
    fetchVram();
  }, [scanModels, fetchRecommended, fetchVram]);

  const handleDownload = async (model: RecommendedModel) => {
    setDownloads((prev) => ({ ...prev, [model.id]: 0 }));

    // Simulate progress (real implementation would stream from Bun side)
    const interval = setInterval(() => {
      setDownloads((prev) => {
        const current = prev[model.id] ?? 0;
        if (current >= 100) {
          clearInterval(interval);
          return prev;
        }
        return { ...prev, [model.id]: Math.min(current + Math.random() * 15, 100) };
      });
    }, 500);

    try {
      await getRpc()?.request?.downloadModel?.({
        modelId: model.id,
        url: model.downloadUrl,
      });
      setDownloads((prev) => ({ ...prev, [model.id]: 100 }));
      scanModels();
    } catch {
      setDownloads((prev) => {
        const next = { ...prev };
        delete next[model.id];
        return next;
      });
      window.dispatchEvent(
        new CustomEvent("toast", {
          detail: { id: "", type: "error", message: `Failed to download ${model.name}` },
        })
      );
    }
  };

  const handleBenchmark = async (modelId: string) => {
    window.dispatchEvent(
      new CustomEvent("toast", {
        detail: { id: "", type: "info", message: "Running benchmark..." },
      })
    );
    try {
      const result = await getRpc()?.request?.benchmarkModel?.({ modelId });
      if (result?.latencyMs) {
        setBenchmarks((prev) => ({ ...prev, [modelId]: result.latencyMs }));
      }
    } catch {}
  };

  const vramPct = vram.totalMb > 0 ? (vram.usedMb / vram.totalMb) * 100 : 0;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.title}>Local Models</span>
        <button style={s.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div style={s.body}>
        {/* VRAM Monitor */}
        <div style={s.vramBar}>
          <div style={s.vramLabel}>VRAM Usage</div>
          <div style={s.vramTrack}>
            <div style={s.vramFill(vramPct)} />
          </div>
          <div style={s.vramStats}>
            <span>{formatBytes(vram.usedMb * 1024 * 1024)} / {formatBytes(vram.totalMb * 1024 * 1024)}</span>
            <span>{vramPct.toFixed(0)}% used</span>
          </div>
        </div>

        {/* Installed Models */}
        <div style={s.section}>
          <div style={s.sectionTitle}>
            <span>Installed ({models.length})</span>
            <button style={s.btn("ghost")} onClick={scanModels} disabled={scanning}>
              {scanning ? "Scanning..." : "Rescan"}
            </button>
          </div>

          {models.length === 0 ? (
            <div style={s.empty}>
              No models found in ~/.stoira/models/<br />
              Download models or place them manually
            </div>
          ) : (
            models.map((model) => (
              <div key={model.id} style={s.modelCard}>
                <div style={s.modelHeader}>
                  <span style={s.formatBadge(FORMAT_COLORS[model.format] ?? "var(--text-muted)")}>
                    {model.format}
                  </span>
                  <span style={s.modelName}>{model.name}</span>
                </div>
                <div style={s.modelMeta}>
                  <span>{formatBytes(model.sizeBytes)}</span>
                  {model.vramEstimateMb && (
                    <span>~{model.vramEstimateMb} MB VRAM</span>
                  )}
                  {model.lastUsed && (
                    <span>Used {new Date(model.lastUsed).toLocaleDateString()}</span>
                  )}
                </div>
                {model.tags.length > 0 && (
                  <div style={s.modelTags}>
                    {model.tags.map((tag) => (
                      <span key={tag} style={s.tag}>{tag}</span>
                    ))}
                  </div>
                )}
                <div style={s.modelActions}>
                  <button style={s.btn()} onClick={() => handleBenchmark(model.id)}>
                    Benchmark
                  </button>
                  {benchmarks[model.id] && (
                    <span style={s.benchmarkResult}>{benchmarks[model.id]}ms</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Recommended Downloads */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Recommended Downloads</div>

          {recommended.map((model) => {
            const dlProgress = downloads[model.id];
            const isDownloading = dlProgress !== undefined && dlProgress < 100;
            const isInstalled = models.some((m) => m.name === model.name);

            return (
              <div key={model.id} style={s.recCard}>
                <div style={s.recHeader}>
                  <span style={s.formatBadge(FORMAT_COLORS[model.format] ?? "var(--text-muted)")}>
                    {model.format}
                  </span>
                  <span style={s.recName}>{model.name}</span>
                  <span style={s.tag}>{model.category}</span>
                </div>
                <span style={s.recDesc}>{model.description}</span>
                <div style={s.recMeta}>
                  <span>{formatBytes(model.sizeBytes)}</span>
                  <span>~{model.vramEstimateMb} MB VRAM</span>
                  {model.tags.map((tag) => (
                    <span key={tag} style={s.tag}>{tag}</span>
                  ))}
                </div>
                {isDownloading && (
                  <div style={s.downloadProgress}>
                    <div style={s.downloadFill(dlProgress)} />
                  </div>
                )}
                <div style={s.modelActions}>
                  {isInstalled ? (
                    <span style={{ fontSize: 10, color: "var(--success)", fontWeight: 600 }}>Installed</span>
                  ) : (
                    <button
                      style={s.btn("primary")}
                      onClick={() => handleDownload(model)}
                      disabled={isDownloading}
                    >
                      {isDownloading ? `${dlProgress.toFixed(0)}%` : "Download"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

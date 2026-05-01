import { useState, useCallback, useRef, useEffect } from "react";
import type { BatchJob, BatchState, FilmStyle } from "../../shared/types";

const FILM_STYLES: { value: FilmStyle; label: string }[] = [
  { value: "anime", label: "Anime" },
  { value: "noir", label: "Noir" },
  { value: "cyberpunk", label: "Cyberpunk" },
  { value: "watercolor", label: "Watercolor" },
  { value: "realistic", label: "Realistic" },
  { value: "stop-motion", label: "Stop Motion" },
  { value: "arcane", label: "Arcane" },
  { value: "ghibli", label: "Ghibli" },
  { value: "oil-painting", label: "Oil Painting" },
  { value: "claymation", label: "Claymation" },
];

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  pending: { color: "var(--text-muted)", bg: "var(--bg-elevated)" },
  running: { color: "var(--accent)", bg: "var(--accent-muted)" },
  complete: { color: "var(--success)", bg: "var(--success-muted)" },
  failed: { color: "var(--error)", bg: "var(--error-muted)" },
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
  inputArea: {
    width: "100%",
    minHeight: 100,
    padding: "10px 12px",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    fontSize: 12,
    lineHeight: 1.5,
    resize: "vertical" as const,
    outline: "none",
    fontFamily: "var(--font-mono)",
  },
  inputHint: {
    fontSize: 10,
    color: "var(--text-muted)",
    lineHeight: 1.4,
  },
  row: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  select: {
    padding: "8px 10px",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    fontSize: 12,
    outline: "none",
    appearance: "none" as const,
    cursor: "pointer",
  },
  btn: (variant: "primary" | "secondary" | "danger" | "ghost" = "secondary") => ({
    padding: "8px 16px",
    background: variant === "primary" ? "var(--accent)" : variant === "danger" ? "var(--error-muted)" : variant === "ghost" ? "transparent" : "var(--bg-tertiary)",
    border: `1px solid ${variant === "primary" ? "var(--accent)" : variant === "danger" ? "rgba(234,74,74,0.2)" : "var(--border)"}`,
    borderRadius: "var(--radius-sm)",
    color: variant === "primary" ? "#fff" : variant === "danger" ? "var(--error)" : "var(--text-secondary)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  }),
  queueHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  queueStats: {
    display: "flex",
    gap: 12,
    fontSize: 10,
    color: "var(--text-muted)",
    fontVariantNumeric: "tabular-nums" as const,
  },
  statDot: (color: string) => ({
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: color,
    display: "inline-block",
    marginRight: 4,
  }),
  jobCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    padding: "10px 12px",
    background: "var(--bg-card)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
  },
  jobHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  jobIndex: {
    fontSize: 9,
    fontWeight: 700,
    color: "var(--text-muted)",
    minWidth: 20,
    textAlign: "center" as const,
  },
  jobIdea: {
    fontSize: 12,
    color: "var(--text-primary)",
    flex: 1,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  jobStyle: {
    fontSize: 9,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    color: "var(--text-muted)",
    padding: "1px 6px",
    background: "var(--bg-elevated)",
    borderRadius: 10,
  },
  jobStatus: (status: string) => ({
    fontSize: 10,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 10,
    color: STATUS_STYLES[status]?.color ?? "var(--text-muted)",
    background: STATUS_STYLES[status]?.bg ?? "var(--bg-elevated)",
  }),
  progressBar: {
    height: 3,
    borderRadius: 2,
    background: "var(--bg-elevated)",
    overflow: "hidden",
  },
  progressFill: (pct: number, status: string) => ({
    height: "100%",
    width: `${pct}%`,
    borderRadius: 2,
    background: status === "failed" ? "var(--error)" : "var(--accent)",
    transition: "width 0.5s ease",
  }),
  jobFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 10,
    color: "var(--text-muted)",
  },
  empty: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 40,
    color: "var(--text-muted)",
    textAlign: "center" as const,
  },
  emptyIcon: {
    opacity: 0.15,
  },
  dropZone: (dragOver: boolean) => ({
    padding: "16px",
    border: `1px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
    borderRadius: "var(--radius-sm)",
    background: dragOver ? "var(--accent-muted)" : "var(--bg-tertiary)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    transition: "all var(--duration-fast) var(--ease-out)",
  }),
};

interface Props {
  onClose: () => void;
}

export function BatchPanel({ onClose }: Props) {
  const [inputText, setInputText] = useState("");
  const [defaultStyle, setDefaultStyle] = useState<FilmStyle>("anime");
  const [concurrency, setConcurrency] = useState(1);
  const [batch, setBatch] = useState<BatchState | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getRpc = () => (window as any).__electrobun_rpc;

  // Listen for batch progress events
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { jobId, status, progress } = e.detail;
      setBatch((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          jobs: prev.jobs.map((j) =>
            j.id === jobId ? { ...j, status, progress } : j
          ),
        };
      });
    };
    window.addEventListener("batch-progress", handler as EventListener);
    return () => window.removeEventListener("batch-progress", handler as EventListener);
  }, []);

  // Cleanup polling
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const parseIdeas = useCallback((text: string): { idea: string; style?: FilmStyle }[] => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    return lines.map((line) => {
      // Support "idea | style" format
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length >= 2) {
        const style = FILM_STYLES.find((s) => s.label.toLowerCase() === parts[1].toLowerCase() || s.value === parts[1].toLowerCase());
        return { idea: parts[0], style: style?.value };
      }
      return { idea: line };
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const ideas = parseIdeas(inputText);
    if (ideas.length === 0) {
      window.dispatchEvent(
        new CustomEvent("toast", {
          detail: { id: "", type: "warning", message: "Enter at least one idea" },
        })
      );
      return;
    }

    try {
      const result = await getRpc()?.request?.submitBatch?.({
        jobs: ideas.map((i) => ({
          idea: i.idea,
          style: i.style ?? defaultStyle,
        })),
        concurrency,
      });

      if (result?.batchId) {
        // Start polling batch status
        const batchId = result.batchId;
        pollRef.current = setInterval(async () => {
          try {
            const status = await getRpc()?.request?.getBatchStatus?.({ batchId });
            if (status) setBatch(status);

            const allDone = status.jobs.every(
              (j: BatchJob) => j.status === "complete" || j.status === "failed"
            );
            if (allDone && pollRef.current) {
              clearInterval(pollRef.current);
              window.dispatchEvent(
                new CustomEvent("toast", {
                  detail: { id: "", type: "success", message: "Batch complete!" },
                })
              );
            }
          } catch {}
        }, 3000);

        window.dispatchEvent(
          new CustomEvent("toast", {
            detail: { id: "", type: "info", message: `Batch started: ${ideas.length} jobs` },
          })
        );
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent("toast", {
          detail: { id: "", type: "error", message: "Failed to start batch" },
        })
      );
    }
  }, [inputText, defaultStyle, concurrency, parseIdeas]);

  const handleCancel = useCallback(async () => {
    if (!batch) return;
    try {
      await getRpc()?.request?.cancelBatch?.({ batchId: "current" });
      if (pollRef.current) clearInterval(pollRef.current);
      window.dispatchEvent(
        new CustomEvent("toast", {
          detail: { id: "", type: "info", message: "Batch cancelled" },
        })
      );
    } catch {}
  }, [batch]);

  const handleExport = useCallback(async () => {
    if (!batch) return;
    try {
      const result = await getRpc()?.request?.exportBatchResults?.({
        batchId: "current",
        format: "zip",
      });
      if (result?.path) {
        window.dispatchEvent(
          new CustomEvent("toast", {
            detail: { id: "", type: "success", message: `Exported to ${result.path}` },
          })
        );
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent("toast", {
          detail: { id: "", type: "error", message: "Export failed" },
        })
      );
    }
  }, [batch]);

  const handleFileImport = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      try {
        // Try JSON first
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          const lines = json.map((item: any) => {
            if (typeof item === "string") return item;
            if (item.idea) return item.style ? `${item.idea} | ${item.style}` : item.idea;
            return JSON.stringify(item);
          });
          setInputText(lines.join("\n"));
        }
      } catch {
        // CSV or plain text
        setInputText(text);
      }
    };
    reader.readAsText(file);
  };

  const completedCount = batch?.jobs.filter((j) => j.status === "complete").length ?? 0;
  const failedCount = batch?.jobs.filter((j) => j.status === "failed").length ?? 0;
  const totalCount = batch?.jobs.length ?? 0;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.title}>Batch Mode</span>
        <button style={s.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div style={s.body}>
        {/* Input area */}
        {!batch && (
          <>
            <div style={s.section}>
              <div style={s.sectionTitle}>Ideas (one per line)</div>
              <textarea
                style={s.inputArea}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={"A cat exploring a cyberpunk city\nA dragon in a watercolor forest\nA detective solving a noir mystery"}
              />
              <div style={s.inputHint}>
                Use "idea | style" format to set per-idea styles. Drag & drop CSV/JSON files.
              </div>
            </div>

            <div
              style={s.dropZone(dragOver)}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileImport}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 16V4M12 4L8 8M12 4l4 4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                Drop CSV or JSON file
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,.txt"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) readFile(file);
                }}
              />
            </div>

            <div style={s.row}>
              <div style={s.section}>
                <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>Default Style</label>
                <select
                  style={s.select}
                  value={defaultStyle}
                  onChange={(e) => setDefaultStyle(e.target.value as FilmStyle)}
                >
                  {FILM_STYLES.map((st) => (
                    <option key={st.value} value={st.value}>{st.label}</option>
                  ))}
                </select>
              </div>
              <div style={s.section}>
                <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>Concurrency</label>
                <select
                  style={s.select}
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                >
                  <option value={1}>1 (sequential)</option>
                  <option value={2}>2 parallel</option>
                  <option value={3}>3 parallel</option>
                </select>
              </div>
            </div>

            <button
              style={s.btn("primary")}
              onClick={handleSubmit}
              disabled={!inputText.trim()}
            >
              Start Batch ({parseIdeas(inputText).length} jobs)
            </button>
          </>
        )}

        {/* Queue view */}
        {batch && (
          <>
            <div style={s.queueHeader}>
              <div style={s.queueStats}>
                <span><span style={s.statDot("var(--success)")}>{completedCount}</span> done</span>
                <span><span style={s.statDot("var(--accent)")}>{totalCount - completedCount - failedCount}</span> active</span>
                <span><span style={s.statDot("var(--error)")}>{failedCount}</span> failed</span>
                <span>{totalCount} total</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {batch.isRunning && (
                  <button style={s.btn("danger")} onClick={handleCancel}>
                    Cancel
                  </button>
                )}
                {completedCount > 0 && (
                  <button style={s.btn()} onClick={handleExport}>
                    Export All
                  </button>
                )}
                {!batch.isRunning && (
                  <button style={s.btn("ghost")} onClick={() => setBatch(null)}>
                    New Batch
                  </button>
                )}
              </div>
            </div>

            {batch.jobs.map((job, i) => (
              <div key={job.id} style={s.jobCard}>
                <div style={s.jobHeader}>
                  <span style={s.jobIndex}>{i + 1}</span>
                  <span style={s.jobIdea}>{job.idea}</span>
                  <span style={s.jobStyle}>{job.style}</span>
                  <span style={s.jobStatus(job.status)}>{job.status}</span>
                </div>
                {(job.status === "running" || job.status === "complete") && (
                  <div style={s.progressBar}>
                    <div style={s.progressFill(job.progress, job.status)} />
                  </div>
                )}
                <div style={s.jobFooter}>
                  <span>{job.progress}%</span>
                  {job.error && <span style={{ color: "var(--error)" }}>{job.error}</span>}
                  {job.videoUrl && (
                    <a
                      href={job.videoUrl}
                      target="_blank"
                      rel="noopener"
                      style={{ color: "var(--accent)", textDecoration: "none" }}
                    >
                      View result
                    </a>
                  )}
                </div>
              </div>
            ))}

            {totalCount === 0 && (
              <div style={s.empty}>
                <div style={s.emptyIcon}>
                  <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                    <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M16 20h16M16 28h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ fontSize: 12 }}>Queue is empty</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

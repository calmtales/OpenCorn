import { useState, useEffect, useCallback } from "react";
import type { WorkflowSummary, FilmStyle } from "../../shared/types";
import { HistoryListSkeleton } from "./LoadingSkeleton";

const STYLE_ICONS: Record<FilmStyle, string> = {
  anime: "🎌",
  noir: "🎬",
  cyberpunk: "🌆",
  watercolor: "🎨",
  realistic: "📷",
  "stop-motion": "🧸",
  arcane: "💎",
  ghibli: "🌿",
  "oil-painting": "🖼️",
  claymation: "🧱",
};

const STATUS_COLORS: Record<string, string> = {
  complete: "var(--success)",
  generating_screenplay: "var(--accent)",
  generating_keyframes: "var(--accent)",
  generating_video: "var(--accent)",
  stitching: "var(--warning)",
  idle: "var(--text-muted)",
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
  },
  item: (hover: boolean) => ({
    padding: "12px 16px",
    borderBottom: "1px solid var(--border-subtle)",
    cursor: "pointer",
    background: hover ? "var(--bg-tertiary)" : "transparent",
    transition: "background var(--duration-fast) var(--ease-out)",
  }),
  itemHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-primary)",
    flex: 1,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  itemMeta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 10,
    color: "var(--text-muted)",
  },
  statusDot: (color: string) => ({
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
  }),
  itemIdea: {
    fontSize: 11,
    color: "var(--text-secondary)",
    lineHeight: 1.4,
    display: "-webkit-box" as const,
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
    marginTop: 2,
  },
  actions: {
    display: "flex",
    gap: 4,
    marginTop: 8,
  },
  actionBtn: (variant: "primary" | "danger" | "ghost") => ({
    padding: "4px 10px",
    background:
      variant === "primary"
        ? "var(--accent-muted)"
        : variant === "danger"
          ? "var(--error-muted)"
          : "var(--bg-tertiary)",
    border: `1px solid ${
      variant === "primary"
        ? "rgba(232, 93, 38, 0.2)"
        : variant === "danger"
          ? "rgba(234, 74, 74, 0.2)"
          : "var(--border)"
    }`,
    borderRadius: "var(--radius-sm)",
    color:
      variant === "primary"
        ? "var(--accent)"
        : variant === "danger"
          ? "var(--error)"
          : "var(--text-secondary)",
    fontSize: 10,
    fontWeight: 600,
    cursor: "pointer",
  }),
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
};

interface Props {
  onClose: () => void;
  onResume?: (workflowId: string) => void;
}

export function HistoryPanel({ onClose, onResume }: Props) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const rpc = (window as any).__electrobun_rpc;
      const result = await rpc?.request?.listWorkflows?.();
      setWorkflows(result?.workflows ?? []);
    } catch {
      setWorkflows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleResume = (workflowId: string) => {
    onResume?.(workflowId);
    onClose();
  };

  const handleDownload = (workflowId: string) => {
    const rpc = (window as any).__electrobun_rpc;
    rpc?.request?.getVideo?.({ workflowId }).then(({ videoUrl }: { videoUrl: string }) => {
      if (videoUrl) {
        const a = document.createElement("a");
        a.href = videoUrl;
        a.download = `opencorn-${workflowId}.mp4`;
        a.click();
      }
    }).catch(() => {
      window.dispatchEvent(new CustomEvent("toast", { detail: { id: "", type: "error", message: "No video available for download" } }));
    });
  };

  const handleDelete = async (workflowId: string) => {
    try {
      const rpc = (window as any).__electrobun_rpc;
      await rpc?.request?.deleteWorkflow?.({ workflowId });
      setWorkflows((prev) => prev.filter((w) => w.workflowId !== workflowId));
      window.dispatchEvent(new CustomEvent("toast", { detail: { id: "", type: "success", message: "Workflow deleted" } }));
    } catch {
      window.dispatchEvent(new CustomEvent("toast", { detail: { id: "", type: "error", message: "Failed to delete workflow" } }));
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " +
        d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.title}>History</span>
        <button style={s.closeBtn} onClick={onClose} aria-label="Close history">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div style={s.body}>
        {loading ? (
          <HistoryListSkeleton />
        ) : workflows.length === 0 ? (
          <div style={s.empty}>
            <div style={s.emptyIcon}>
              <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1.5" />
                <path d="M24 14V24L30 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ fontSize: 12 }}>No workflows yet</div>
            <div style={{ fontSize: 11 }}>Your generated films will appear here</div>
          </div>
        ) : (
          workflows.map((wf) => (
            <div
              key={wf.workflowId}
              style={s.item(hoverId === wf.workflowId)}
              onMouseEnter={() => setHoverId(wf.workflowId)}
              onMouseLeave={() => setHoverId(null)}
              onClick={() => setExpandedId(expandedId === wf.workflowId ? null : wf.workflowId)}
            >
              <div style={s.itemHeader}>
                <span style={s.statusDot(STATUS_COLORS[wf.status] ?? "var(--text-muted)")} />
                <span style={s.itemTitle}>{wf.title}</span>
                <span style={{ fontSize: 14 }}>{STYLE_ICONS[wf.style] ?? "🎬"}</span>
              </div>
              <div style={s.itemMeta}>
                <span>{wf.sceneCount} scenes</span>
                <span>&middot;</span>
                <span>{formatDate(wf.createdAt)}</span>
              </div>
              {wf.idea && <div style={s.itemIdea}>{wf.idea}</div>}

              {expandedId === wf.workflowId && (
                <div style={s.actions} onClick={(e) => e.stopPropagation()}>
                  <button
                    style={s.actionBtn("primary")}
                    onClick={() => handleResume(wf.workflowId)}
                  >
                    Resume
                  </button>
                  {wf.status === "complete" && (
                    <button
                      style={s.actionBtn("ghost")}
                      onClick={() => handleDownload(wf.workflowId)}
                    >
                      Download
                    </button>
                  )}
                  <button
                    style={s.actionBtn("danger")}
                    onClick={() => handleDelete(wf.workflowId)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

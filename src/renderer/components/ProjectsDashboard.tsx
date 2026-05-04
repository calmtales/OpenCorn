import { useEffect, useState } from "react";
import type { WorkflowSummary } from "../../shared/types";
import { HistoryListSkeleton } from "./LoadingSkeleton";

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
    gap: 14,
    minWidth: 0,
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  titleBlock: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  kicker: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    textTransform: "uppercase" as const,
    letterSpacing: "0.28em",
    color: "rgba(170,185,205,0.55)",
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "-0.03em",
  },
  meta: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    textTransform: "uppercase" as const,
    letterSpacing: "0.18em",
    color: "rgba(170,185,205,0.62)",
  },
  list: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 12,
  },
  card: {
    position: "relative" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    padding: 14,
    background: "linear-gradient(180deg, rgba(12,15,21,0.94), rgba(10,13,18,0.86))",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
    minHeight: 150,
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  dot: (color: string) => ({
    width: 8,
    height: 8,
    borderRadius: 999,
    background: color,
    flexShrink: 0,
    boxShadow: `0 0 10px ${color}55`,
  }),
  cardTitle: {
    fontSize: 13,
    fontWeight: 700,
    flex: 1,
    minWidth: 0,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  cardBody: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "var(--text-secondary)",
    display: "-webkit-box" as const,
    WebkitBoxOrient: "vertical" as const,
    WebkitLineClamp: 3,
    overflow: "hidden",
  },
  cardMeta: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    marginTop: "auto",
    fontFamily: "var(--font-mono)",
    fontSize: 9.5,
    textTransform: "uppercase" as const,
    letterSpacing: "0.18em",
    color: "rgba(170,185,205,0.55)",
  },
  cardActions: {
    display: "flex",
    gap: 8,
    marginTop: 4,
  },
  btn: (variant: "primary" | "ghost" | "danger") => ({
    padding: "7px 10px",
    borderRadius: 10,
    border: `1px solid ${variant === "primary" ? "rgba(79,195,247,0.35)" : variant === "danger" ? "rgba(234,74,74,0.2)" : "rgba(255,255,255,0.08)"}`,
    background:
      variant === "primary"
        ? "linear-gradient(180deg, rgba(79,195,247,0.18), rgba(79,195,247,0.08))"
        : variant === "danger"
          ? "rgba(234,74,74,0.08)"
          : "rgba(255,255,255,0.03)",
    color:
      variant === "primary"
        ? "#4fc3f7"
        : variant === "danger"
          ? "#ea4a4a"
          : "var(--text-secondary)",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
    textTransform: "uppercase" as const,
    letterSpacing: "0.16em",
  }),
  empty: {
    padding: 20,
    borderRadius: 14,
    border: "1px dashed rgba(255,255,255,0.08)",
    color: "var(--text-muted)",
    background: "rgba(10,13,18,0.58)",
    lineHeight: 1.55,
  },
};

interface Props {
  onResume: (workflowId: string) => void;
  onDelete: (workflowId: string) => Promise<void>;
}

export function ProjectsDashboard({ onResume, onDelete }: Props) {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<WorkflowSummary[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const rpc = (window as any).__electrobun_rpc;
      const result = await rpc?.request?.listWorkflows?.();
      const items = (result?.workflows ?? []) as WorkflowSummary[];
      items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      setProjects(items);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  const handleResume = (workflowId: string) => {
    onResume(workflowId);
  };

  const handleDelete = async (workflowId: string) => {
    setBusyId(workflowId);
    try {
      await onDelete(workflowId);
      await loadProjects();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section style={s.container} aria-label="Projects dashboard">
      <div style={s.header}>
        <div style={s.titleBlock}>
          <div style={s.kicker}>projects</div>
          <div style={s.title}>All workflows in one place</div>
          <div style={s.meta}>{projects.length} saved project{projects.length === 1 ? "" : "s"}</div>
        </div>
        <button
          type="button"
          style={s.btn("ghost")}
          onClick={() => void loadProjects()}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <HistoryListSkeleton />
      ) : projects.length === 0 ? (
        <div style={s.empty}>
          No projects yet. Start a new one below, then it will appear here for quick resume.
        </div>
      ) : (
        <div style={s.list}>
          {projects.map((project) => (
            <article key={project.workflowId} style={s.card}>
              <div style={s.cardTop}>
                <span style={s.dot(STATUS_COLORS[project.status] ?? "var(--text-muted)")} />
                <div style={s.cardTitle}>{project.title}</div>
              </div>
              <div style={s.cardBody}>{project.idea || "No idea text saved for this project."}</div>
              <div style={s.cardMeta}>
                <span>{project.sceneCount} scenes</span>
                <span>·</span>
                <span>{project.status.replace(/_/g, " ")}</span>
                <span>·</span>
                <span>{new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
              <div style={s.cardActions}>
                <button type="button" style={s.btn("primary")} onClick={() => handleResume(project.workflowId)}>
                  Open
                </button>
                <button
                  type="button"
                  style={s.btn("ghost")}
                  onClick={() => handleResume(project.workflowId)}
                >
                  Resume
                </button>
                <button
                  type="button"
                  style={s.btn("danger")}
                  onClick={() => void handleDelete(project.workflowId)}
                  disabled={busyId === project.workflowId}
                >
                  {busyId === project.workflowId ? "Deleting…" : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

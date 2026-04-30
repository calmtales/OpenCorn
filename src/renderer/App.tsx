import { useState } from "react";
import type { FilmStyle, Storyboard } from "../shared/types";
import { IdeaInput } from "./components/IdeaInput";
import { StoryboardGrid } from "./components/StoryboardGrid";
import { TimelineBar } from "./components/TimelineBar";
import { PlayerPreview } from "./components/PlayerPreview";
import { McpStatus } from "./components/McpStatus";
import { ExportPanel } from "./components/ExportPanel";
import { useFilmPipeline } from "./hooks/useFilmPipeline";

const styles = {
  app: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    overflow: "hidden",
    background: "var(--bg-primary)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 20px",
    background: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border-subtle)",
    flexShrink: 0,
    zIndex: 10,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logoText: {
    fontSize: 17,
    fontWeight: 700,
    letterSpacing: "-0.03em",
  },
  logoAccent: {
    color: "var(--accent)",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  main: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  sidebar: {
    width: 300,
    flexShrink: 0,
    background: "var(--bg-secondary)",
    borderRight: "1px solid var(--border-subtle)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    background: "var(--bg-primary)",
  },
  viewport: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
  },
  storyboardArea: {
    flex: 1,
    overflow: "auto",
    padding: 20,
  },
  previewPanel: {
    width: 340,
    flexShrink: 0,
    background: "var(--bg-secondary)",
    borderLeft: "1px solid var(--border-subtle)",
    display: "flex",
    flexDirection: "column" as const,
  },
  timelineArea: {
    flexShrink: 0,
    borderTop: "1px solid var(--border)",
    background: "var(--bg-secondary)",
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "5px 16px",
    background: "var(--bg-tertiary)",
    borderTop: "1px solid var(--border-subtle)",
    fontSize: 11,
    color: "var(--text-muted)",
    flexShrink: 0,
  },
  stageLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  progressDot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    flexShrink: 0,
  },
  progressBar: {
    height: 2,
    background: "var(--bg-tertiary)",
    position: "relative" as const,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "var(--accent)",
    transition: "width 0.5s var(--ease-out)",
  },
};

export default function App() {
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const pipeline = useFilmPipeline();

  const activeStoryboard = pipeline.storyboard ?? storyboard;

  const handleSubmit = async (idea: string, style: FilmStyle) => {
    try {
      await pipeline.submitIdea(idea, style);
    } catch (err) {
      console.error("Submit failed:", err);
    }
  };

  const stageLabels: Record<string, string> = {
    idle: "Ready",
    generating_screenplay: "Writing screenplay...",
    generating_keyframes: "Rendering keyframes...",
    generating_video: "Generating video...",
    processing_audio: "Processing audio...",
    stitching: "Stitching final render...",
    complete: "Complete",
  };

  const isActive = pipeline.stage !== "idle";

  return (
    <div style={styles.app}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="var(--accent)" />
            <path d="M8 8L16 12L8 16V8Z" fill="var(--bg-primary)" />
          </svg>
          <span style={styles.logoText}>
            <span style={styles.logoAccent}>Open</span>Corn
          </span>
        </div>
        <div style={styles.headerRight}>
          <McpStatus connected={!!pipeline.workflowId} />
          <ExportPanel
            videoUrl={pipeline.videoUrl}
            disabled={pipeline.stage !== "complete"}
          />
        </div>
      </div>

      {/* Progress bar */}
      {isActive && (
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${pipeline.progress}%` }} />
        </div>
      )}

      {/* Main area */}
      <div style={styles.main}>
        <div style={styles.sidebar}>
          <IdeaInput
            onSubmit={handleSubmit}
            disabled={pipeline.stage !== "idle" && pipeline.stage !== "complete"}
          />
        </div>

        <div style={styles.content}>
          <div style={styles.viewport}>
            <div style={styles.storyboardArea}>
              <StoryboardGrid storyboard={activeStoryboard} />
            </div>
            <div style={styles.previewPanel}>
              <PlayerPreview videoUrl={pipeline.videoUrl} />
            </div>
          </div>
          <div style={styles.timelineArea}>
            <TimelineBar storyboard={activeStoryboard} />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div style={styles.statusBar}>
        <div style={styles.stageLabel}>
          <div
            style={{
              ...styles.progressDot,
              background:
                pipeline.stage === "complete"
                  ? "var(--success)"
                  : pipeline.stage === "idle"
                    ? "var(--text-muted)"
                    : "var(--accent)",
              boxShadow:
                pipeline.stage !== "idle" && pipeline.stage !== "complete"
                  ? "0 0 6px var(--accent-glow)"
                  : pipeline.stage === "complete"
                    ? "0 0 6px var(--success-muted)"
                    : "none",
            }}
          />
          <span>{stageLabels[pipeline.stage] ?? pipeline.stage}</span>
          {pipeline.error && (
            <span style={{ color: "var(--error)", marginLeft: 8 }}>
              {pipeline.error}
            </span>
          )}
        </div>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {isActive ? `${pipeline.progress}%` : ""}
        </span>
      </div>
    </div>
  );
}

import { useState } from "react";
import type { FilmStyle, PipelineStatus, Storyboard } from "../shared/types";
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
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    background: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  logoAccent: {
    color: "var(--accent)",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  main: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  sidebar: {
    width: 320,
    flexShrink: 0,
    background: "var(--bg-secondary)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  viewport: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
  },
  storyboardArea: {
    flex: 1,
    overflow: "auto",
    padding: 16,
  },
  previewPanel: {
    width: 360,
    flexShrink: 0,
    background: "var(--bg-secondary)",
    borderLeft: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column" as const,
  },
  timelineArea: {
    flexShrink: 0,
    borderTop: "1px solid var(--border)",
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 16px",
    background: "var(--bg-tertiary)",
    borderTop: "1px solid var(--border)",
    fontSize: 12,
    color: "var(--text-secondary)",
    flexShrink: 0,
  },
  stageLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--success)",
  },
};

export default function App() {
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const pipeline = useFilmPipeline();

  const handleSubmit = async (idea: string, style: FilmStyle) => {
    try {
      const result = await pipeline.submitIdea(idea, style);
      // Pipeline hook handles polling and state transitions
    } catch (err) {
      console.error("Submit failed:", err);
    }
  };

  const stageLabels: Record<string, string> = {
    idle: "Ready",
    generating_screenplay: "Generating screenplay...",
    generating_keyframes: "Rendering keyframes...",
    generating_video: "Generating video...",
    processing_audio: "Processing audio...",
    stitching: "Stitching final render...",
    complete: "Complete",
  };

  return (
    <div style={styles.app}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect
              x="2"
              y="2"
              width="20"
              height="20"
              rx="4"
              fill="var(--accent)"
            />
            <path d="M8 8L16 12L8 16V8Z" fill="var(--bg-primary)" />
          </svg>
          <span style={styles.logoText}>
            <span style={styles.logoAccent}>Open</span>Corn
          </span>
        </div>
        <div style={styles.headerRight}>
          <McpStatus />
          <ExportPanel
            videoUrl={videoUrl}
            disabled={pipeline.stage !== "complete"}
          />
        </div>
      </div>

      {/* Main area */}
      <div style={styles.main}>
        {/* Left sidebar: idea input */}
        <div style={styles.sidebar}>
          <IdeaInput
            onSubmit={handleSubmit}
            disabled={pipeline.stage !== "idle" && pipeline.stage !== "complete"}
          />
        </div>

        {/* Center: storyboard + timeline */}
        <div style={styles.content}>
          <div style={styles.viewport}>
            <div style={styles.storyboardArea}>
              <StoryboardGrid storyboard={storyboard} />
            </div>
            <div style={styles.previewPanel}>
              <PlayerPreview videoUrl={videoUrl} />
            </div>
          </div>
          <div style={styles.timelineArea}>
            <TimelineBar storyboard={storyboard} />
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
            }}
          />
          <span>{stageLabels[pipeline.stage] ?? pipeline.stage}</span>
        </div>
        <span>
          {pipeline.stage !== "idle" && `${pipeline.progress}%`}
        </span>
      </div>
    </div>
  );
}

import type { Storyboard } from "../../shared/types";
import { SceneCard } from "./SceneCard";

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    gap: 16,
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
  sceneCount: {
    fontSize: 11,
    color: "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 12,
    flex: 1,
    alignContent: "start",
  },
  empty: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 16,
    color: "var(--text-muted)",
    textAlign: "center" as const,
    padding: 40,
  },
  emptyIcon: {
    opacity: 0.15,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text-secondary)",
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "var(--text-muted)",
    maxWidth: 260,
  },
};

interface Props {
  storyboard: Storyboard | null;
}

export function StoryboardGrid({ storyboard }: Props) {
  if (!storyboard || storyboard.scenes.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>
          <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
            <rect
              x="4"
              y="8"
              width="24"
              height="18"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect
              x="36"
              y="8"
              width="24"
              height="18"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect
              x="4"
              y="34"
              width="24"
              height="18"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect
              x="36"
              y="34"
              width="24"
              height="18"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </div>
        <div style={styles.emptyTitle}>No storyboard yet</div>
        <div style={styles.emptyText}>
          Enter an idea and choose a visual style to generate your film storyboard
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>{storyboard.title}</span>
        <span style={styles.sceneCount}>
          {storyboard.scenes.length} scene
          {storyboard.scenes.length !== 1 ? "s" : ""} &middot;{" "}
          {Math.floor(storyboard.totalDuration / 60)}:
          {String(storyboard.totalDuration % 60).padStart(2, "0")}
        </span>
      </div>
      <div style={styles.grid}>
        {storyboard.scenes
          .sort((a, b) => a.order - b.order)
          .map((scene) => (
            <SceneCard key={scene.id} scene={scene} />
          ))}
      </div>
    </div>
  );
}

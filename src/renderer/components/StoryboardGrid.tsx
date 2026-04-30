import type { Storyboard } from "../../shared/types";
import { SceneCard } from "./SceneCard";

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    gap: 12,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
  },
  sceneCount: {
    fontSize: 12,
    color: "var(--text-secondary)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
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
    gap: 12,
    color: "var(--text-muted)",
    textAlign: "center" as const,
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    opacity: 0.3,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 1.5,
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
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect
              x="4"
              y="8"
              width="24"
              height="18"
              rx="3"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect
              x="36"
              y="8"
              width="24"
              height="18"
              rx="3"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect
              x="4"
              y="34"
              width="24"
              height="18"
              rx="3"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect
              x="36"
              y="34"
              width="24"
              height="18"
              rx="3"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </div>
        <div style={styles.emptyText}>
          Enter an idea and choose a style to generate your storyboard
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

import type { Storyboard } from "../../shared/types";

const SCENE_COLORS = [
  "rgba(232, 93, 38, 0.25)",
  "rgba(139, 92, 246, 0.25)",
  "rgba(59, 130, 246, 0.25)",
  "rgba(16, 185, 129, 0.25)",
  "rgba(245, 158, 11, 0.25)",
  "rgba(236, 72, 153, 0.25)",
  "rgba(99, 102, 241, 0.25)",
  "rgba(20, 184, 166, 0.25)",
];

const styles = {
  container: {
    padding: "10px 16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  labelRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
  },
  time: {
    fontSize: 10,
    color: "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
  },
  track: {
    display: "flex",
    height: 28,
    gap: 2,
    background: "var(--bg-tertiary)",
    borderRadius: "var(--radius-sm)",
    overflow: "hidden",
    border: "1px solid var(--border)",
  },
  segment: (widthPercent: number, colorIndex: number) => ({
    width: `${widthPercent}%`,
    background: SCENE_COLORS[colorIndex % SCENE_COLORS.length],
    borderRight: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 500,
    color: "var(--text-secondary)",
    cursor: "pointer",
    overflow: "hidden",
    whiteSpace: "nowrap" as const,
    textOverflow: "ellipsis",
    padding: "0 6px",
    minWidth: 0,
  }),
  empty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 28,
    background: "var(--bg-tertiary)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    color: "var(--text-muted)",
    fontSize: 11,
  },
};

interface Props {
  storyboard: Storyboard | null;
}

export function TimelineBar({ storyboard }: Props) {
  if (!storyboard || storyboard.scenes.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>No scenes yet</div>
      </div>
    );
  }

  const total = storyboard.totalDuration;
  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, "0")}`;

  return (
    <div style={styles.container}>
      <div style={styles.labelRow}>
        <span style={styles.label}>Timeline</span>
        <span style={styles.time}>
          {formatTime(0)} / {formatTime(total)}
        </span>
      </div>
      <div style={styles.track}>
        {storyboard.scenes
          .sort((a, b) => a.order - b.order)
          .map((scene, i) => {
            const pct = (scene.duration / total) * 100;
            return (
              <div
                key={scene.id}
                style={styles.segment(pct, i)}
                title={`${scene.title} (${formatTime(scene.duration)})`}
              >
                {pct > 8 ? `SC ${scene.order + 1}` : ""}
              </div>
            );
          })}
      </div>
    </div>
  );
}

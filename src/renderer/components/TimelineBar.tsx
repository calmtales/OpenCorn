import type { Storyboard, Scene } from "../../shared/types";

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
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    color: "var(--text-secondary)",
  },
  time: {
    fontSize: 11,
    color: "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
  },
  track: {
    display: "flex",
    height: 32,
    gap: 2,
    background: "var(--bg-tertiary)",
    borderRadius: 6,
    overflow: "hidden",
    border: "1px solid var(--border)",
  },
  segment: (widthPercent: number, isHover: boolean) => ({
    width: `${widthPercent}%`,
    background: isHover ? "var(--accent)" : "var(--bg-card)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 500,
    color: isHover ? "#fff" : "var(--text-secondary)",
    cursor: "pointer",
    transition: "background 0.15s ease",
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
    height: 32,
    background: "var(--bg-tertiary)",
    borderRadius: 6,
    border: "1px solid var(--border)",
    color: "var(--text-muted)",
    fontSize: 12,
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
          .map((scene) => {
            const pct = (scene.duration / total) * 100;
            return (
              <div
                key={scene.id}
                style={styles.segment(pct, false)}
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

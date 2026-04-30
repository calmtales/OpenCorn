const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
  },
  header: {
    padding: "12px 16px",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border)",
  },
  viewport: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#000",
    position: "relative" as const,
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "contain" as const,
  },
  empty: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    color: "var(--text-muted)",
    padding: 24,
    textAlign: "center" as const,
  },
  emptyIcon: {
    opacity: 0.3,
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "var(--bg-secondary)",
    borderTop: "1px solid var(--border)",
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "var(--accent)",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    flexShrink: 0,
  },
  scrubber: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    background: "var(--bg-tertiary)",
    position: "relative" as const,
    cursor: "pointer",
  },
  scrubberFill: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    height: "100%",
    borderRadius: 2,
    background: "var(--accent)",
  },
  time: {
    fontSize: 11,
    color: "var(--text-secondary)",
    fontVariantNumeric: "tabular-nums",
    minWidth: 40,
    textAlign: "right" as const,
  },
};

interface Props {
  videoUrl: string | null;
}

export function PlayerPreview({ videoUrl }: Props) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>Preview</div>
      <div style={styles.viewport}>
        {videoUrl ? (
          <video src={videoUrl} style={styles.video} controls autoPlay />
        ) : (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect
                  x="4"
                  y="8"
                  width="40"
                  height="32"
                  rx="4"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M20 16L32 24L20 32V16Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div style={{ fontSize: 13 }}>Video preview will appear here</div>
            <div style={{ fontSize: 11 }}>
              Generate a film to see the result
            </div>
          </div>
        )}
      </div>
      {videoUrl && (
        <div style={styles.controls}>
          <button style={styles.playBtn}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 1L12 7L3 13V1Z" fill="currentColor" />
            </svg>
          </button>
          <div style={styles.scrubber}>
            <div style={{ ...styles.scrubberFill, width: "0%" }} />
          </div>
          <span style={styles.time}>0:00</span>
        </div>
      )}
    </div>
  );
}

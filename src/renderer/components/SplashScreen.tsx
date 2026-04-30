import { useState, useEffect } from "react";

interface Props {
  onComplete: () => void;
  duration?: number;
}

export function SplashScreen({ onComplete, duration = 1800 }: Props) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setFadeOut(true);
          setTimeout(onComplete, 300);
          return 100;
        }
        return p + Math.random() * 15 + 5;
      });
    }, duration / 8);

    return () => clearInterval(interval);
  }, [duration, onComplete]);

  return (
    <div style={{ ...styles.container, opacity: fadeOut ? 0 : 1 }}>
      <div style={styles.content}>
        {/* App icon */}
        <div style={styles.icon}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect x="4" y="4" width="56" height="56" rx="12" fill="var(--accent)" />
            <path d="M22 18L44 32L22 46V18Z" fill="var(--bg-primary)" />
          </svg>
        </div>

        {/* App name */}
        <div style={styles.name}>
          <span style={styles.nameAccent}>Open</span>Corn
        </div>
        <div style={styles.tagline}>AI Film Studio</div>

        {/* Progress bar */}
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${Math.min(progress, 100)}%`,
            }}
          />
        </div>

        {/* Version */}
        <div style={styles.version}>v0.4.0</div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-primary)",
    zIndex: 10000,
    transition: "opacity 0.3s ease",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
  },
  icon: {
    animation: "pulse 2s ease-in-out infinite",
  },
  name: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: "-0.04em",
    color: "var(--text-primary)",
  },
  nameAccent: {
    color: "var(--accent)",
  },
  tagline: {
    fontSize: 13,
    color: "var(--text-muted)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  progressTrack: {
    width: 200,
    height: 3,
    borderRadius: 2,
    background: "var(--bg-tertiary)",
    overflow: "hidden",
    marginTop: 24,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    background: "var(--accent)",
    transition: "width 0.15s ease",
  },
  version: {
    fontSize: 10,
    color: "var(--text-muted)",
    marginTop: 8,
    fontFamily: "var(--font-mono)",
  },
};

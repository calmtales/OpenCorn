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
        {/* App icon — animated glow ring */}
        <div style={styles.iconWrap}>
          <div style={styles.iconRing} />
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            style={{ animation: "splashIconPulse 1.8s ease-in-out infinite" }}
          >
            <rect x="4" y="4" width="56" height="56" rx="12" fill="var(--accent)" />
            <path d="M22 18L44 32L22 46V18Z" fill="var(--bg-primary)" />
          </svg>
        </div>

        {/* App name — staggered reveal */}
        <div style={styles.name}>
          <span style={{ ...styles.nameAccent, animation: "splashAccentIn 0.6s ease-out 0.3s both" }}>Open</span>
          <span style={{ animation: "splashAccentIn 0.6s ease-out 0.5s both" }}>Corn</span>
        </div>
        <div style={styles.tagline}>
          <span style={{ animation: "fadeInUp 0.5s ease-out 0.7s both" }}>AI Film Studio</span>
        </div>

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
  iconWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 96,
    height: 96,
  },
  iconRing: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    border: "1.5px solid var(--accent)",
    opacity: 0.35,
    animation: "splashRingPulse 2.2s ease-in-out infinite",
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

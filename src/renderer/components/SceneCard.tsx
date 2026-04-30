import { useState } from "react";
import type { Scene } from "../../shared/types";

const styles = {
  card: (hover: boolean) => ({
    background: "var(--bg-card)",
    border: `1px solid ${hover ? "var(--accent)" : "var(--border)"}`,
    borderRadius: 8,
    overflow: "hidden",
    cursor: "pointer",
    transition: "border-color 0.15s ease, transform 0.15s ease",
    transform: hover ? "translateY(-2px)" : "none",
  }),
  preview: {
    width: "100%",
    aspectRatio: "16/9",
    background: "var(--bg-tertiary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative" as const,
    overflow: "hidden",
  },
  previewImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
  },
  previewPlaceholder: {
    color: "var(--text-muted)",
    fontSize: 24,
  },
  sceneNumber: {
    position: "absolute" as const,
    top: 8,
    left: 8,
    background: "rgba(0,0,0,0.7)",
    borderRadius: 4,
    padding: "2px 6px",
    fontSize: 10,
    fontWeight: 700,
    color: "var(--accent)",
  },
  duration: {
    position: "absolute" as const,
    bottom: 8,
    right: 8,
    background: "rgba(0,0,0,0.7)",
    borderRadius: 4,
    padding: "2px 6px",
    fontSize: 10,
    color: "var(--text-secondary)",
  },
  body: {
    padding: 10,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.3,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  description: {
    fontSize: 11,
    color: "var(--text-secondary)",
    lineHeight: 1.4,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
  },
  dialogue: {
    fontSize: 11,
    color: "var(--text-muted)",
    fontStyle: "italic",
    lineHeight: 1.3,
    marginTop: 4,
    display: "-webkit-box",
    WebkitLineClamp: 1,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
  },
};

interface Props {
  scene: Scene;
}

export function SceneCard({ scene }: Props) {
  const [hover, setHover] = useState(false);
  const keyframe = scene.keyframes[0];

  return (
    <div
      style={styles.card(hover)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={styles.preview}>
        {keyframe?.imageUrl ? (
          <img
            src={keyframe.imageUrl}
            alt={keyframe.description}
            style={styles.previewImg}
          />
        ) : (
          <div style={styles.previewPlaceholder}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path
                d="M12 10L24 16L12 22V10Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
        <div style={styles.sceneNumber}>SC {scene.order + 1}</div>
        <div style={styles.duration}>
          {Math.floor(scene.duration / 60)}:
          {String(scene.duration % 60).padStart(2, "0")}
        </div>
      </div>
      <div style={styles.body}>
        <div style={styles.title}>{scene.title}</div>
        <div style={styles.description}>{scene.description}</div>
        {scene.dialogue && (
          <div style={styles.dialogue}>"{scene.dialogue}"</div>
        )}
      </div>
    </div>
  );
}

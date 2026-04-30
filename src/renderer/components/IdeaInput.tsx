import { useState } from "react";
import type { FilmStyle } from "../../shared/types";

const FILM_STYLES: { value: FilmStyle; label: string; icon: string }[] = [
  { value: "anime", label: "Anime", icon: "🎌" },
  { value: "noir", label: "Film Noir", icon: "🎬" },
  { value: "cyberpunk", label: "Cyberpunk", icon: "🌆" },
  { value: "watercolor", label: "Watercolor", icon: "🎨" },
  { value: "realistic", label: "Realistic", icon: "📷" },
  { value: "stop-motion", label: "Stop Motion", icon: "🧸" },
];

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    padding: 16,
    gap: 16,
  },
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    color: "var(--text-secondary)",
  },
  textarea: {
    width: "100%",
    minHeight: 160,
    padding: 12,
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text-primary)",
    fontSize: 14,
    lineHeight: 1.5,
    resize: "vertical" as const,
    outline: "none",
    fontFamily: "inherit",
  },
  styleGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 6,
  },
  styleBtn: (selected: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 10px",
    background: selected ? "var(--accent)" : "var(--bg-tertiary)",
    border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
    borderRadius: 6,
    color: selected ? "#fff" : "var(--text-secondary)",
    fontSize: 12,
    fontWeight: selected ? 600 : 400,
    cursor: "pointer",
    transition: "all 0.15s ease",
  }),
  submitBtn: (disabled: boolean) => ({
    width: "100%",
    padding: "12px 0",
    background: disabled ? "var(--bg-tertiary)" : "var(--accent)",
    border: "none",
    borderRadius: 8,
    color: disabled ? "var(--text-muted)" : "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 0.15s ease",
  }),
  hint: {
    fontSize: 11,
    color: "var(--text-muted)",
    lineHeight: 1.4,
  },
};

interface Props {
  onSubmit: (idea: string, style: FilmStyle) => void;
  disabled: boolean;
}

export function IdeaInput({ onSubmit, disabled }: Props) {
  const [idea, setIdea] = useState("");
  const [style, setStyle] = useState<FilmStyle>("anime");

  const handleSubmit = () => {
    if (!idea.trim() || disabled) return;
    onSubmit(idea.trim(), style);
  };

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <label style={styles.label}>Your idea</label>
        <textarea
          style={styles.textarea}
          placeholder="A lone astronaut discovers an ancient AI artifact on a distant moon..."
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          disabled={disabled}
        />
        <span style={styles.hint}>
          Describe the film concept. Be as brief or detailed as you like.
        </span>
      </div>

      <div style={styles.section}>
        <label style={styles.label}>Visual style</label>
        <div style={styles.styleGrid}>
          {FILM_STYLES.map((s) => (
            <button
              key={s.value}
              style={styles.styleBtn(style === s.value)}
              onClick={() => setStyle(s.value)}
              disabled={disabled}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <button
        style={styles.submitBtn(disabled || !idea.trim())}
        onClick={handleSubmit}
        disabled={disabled || !idea.trim()}
      >
        Generate Film
      </button>
    </div>
  );
}

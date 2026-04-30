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
    gap: 20,
  },
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
  },
  textarea: {
    width: "100%",
    minHeight: 140,
    padding: "10px 12px",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-primary)",
    fontSize: 13,
    lineHeight: 1.6,
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
    padding: "7px 10px",
    background: selected ? "var(--accent-muted)" : "var(--bg-tertiary)",
    border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
    borderRadius: "var(--radius-sm)",
    color: selected ? "var(--accent)" : "var(--text-secondary)",
    fontSize: 12,
    fontWeight: selected ? 600 : 400,
    cursor: "pointer",
  }),
  submitBtn: (disabled: boolean) => ({
    width: "100%",
    padding: "11px 0",
    background: disabled ? "var(--bg-tertiary)" : "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-md)",
    color: disabled ? "var(--text-muted)" : "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    letterSpacing: "0.01em",
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
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
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <span style={styles.hint}>
          Describe your film concept. Press Cmd+Enter to generate.
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

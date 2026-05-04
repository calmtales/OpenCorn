/*  ──────────────────────────────────────────────────────────────────────
 *  ModeSelector — compact industry mode dropdown for the canvas header
 *  Lets the user switch mode mid-session without resetting the tree.
 *  Noustiny-style, inline CSS (no Tailwind)
 *  ────────────────────────────────────────────────────────────────────── */

import { useState, useRef, useEffect } from "react";
import { useStory, modeLabels } from "../lib/store";
import type { IndustryMode } from "../lib/types";

const MODES: { value: IndustryMode; label: string; icon: string }[] = [
  { value: "filmmaking", label: "Film", icon: "🎬" },
  { value: "design", label: "Design", icon: "🎨" },
  { value: "architecture", label: "Architecture", icon: "🏛" },
  { value: "advertising", label: "Advertising", icon: "📢" },
];

const styles = {
  wrapper: {
    position: "relative" as const,
  },
  trigger: (active: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    background: active ? "var(--accent-muted)" : "transparent",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    borderRadius: "var(--radius-sm)",
    color: active ? "var(--accent)" : "var(--text-secondary)",
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
    fontFamily: "var(--font-display)",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap" as const,
  }),
  dropdown: {
    position: "absolute" as const,
    top: "100%",
    right: 0,
    marginTop: 4,
    minWidth: 180,
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    boxShadow: "var(--shadow-lg)",
    zIndex: 100,
    overflow: "hidden",
  },
  option: (active: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "8px 12px",
    background: active ? "var(--accent-muted)" : "transparent",
    border: "none",
    borderBottom: "1px solid var(--border-subtle)",
    color: active ? "var(--accent)" : "var(--text-primary)",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "background 0.12s ease",
    fontFamily: "var(--font-display)",
  }),
  optionIcon: {
    fontSize: 14,
    width: 20,
    textAlign: "center" as const,
  },
  optionMeta: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 1,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: 500,
  },
  optionDesc: {
    fontSize: 9,
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.2em",
    color: "var(--text-muted)",
  },
};

export function ModeSelector() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const industryMode = useStory((s) => s.industryMode);
  const setIndustryMode = useStory((s) => s.setIndustryMode);

  const current = MODES.find((m) => m.value === industryMode) ?? MODES[0];
  const labels = modeLabels(industryMode);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={styles.wrapper}>
      <button
        type="button"
        style={styles.trigger(open)}
        onClick={() => setOpen((v) => !v)}
        title={`Industry mode: ${current.label} (${labels.story})`}
        aria-label={`Switch industry mode, currently ${current.label}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{current.icon}</span>
        <span>{current.label}</span>
        <span style={{ fontSize: 8, opacity: 0.5, marginLeft: 2 }}>▾</span>
      </button>

      {open && (
        <div style={styles.dropdown} role="listbox" aria-label="Industry modes">
          {MODES.map((m) => {
            const mLabels = modeLabels(m.value);
            return (
              <button
                key={m.value}
                type="button"
                role="option"
                aria-selected={m.value === industryMode}
                style={styles.option(m.value === industryMode)}
                onClick={() => {
                  setIndustryMode(m.value);
                  setOpen(false);
                }}
                onMouseEnter={(e) => {
                  if (m.value !== industryMode) {
                    e.currentTarget.style.background = "var(--bg-elevated)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (m.value !== industryMode) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <span style={styles.optionIcon}>{m.icon}</span>
                <div style={styles.optionMeta}>
                  <span style={styles.optionLabel}>{m.label}</span>
                  <span style={styles.optionDesc}>{mLabels.story} · {mLabels.beat}s</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
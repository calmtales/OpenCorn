/*  ──────────────────────────────────────────────────────────────────────
 *  SeedInput — landing page with seed prompt + industry mode
 *  Noustiny-style, ported for OpenCorn (inline CSS, no Tailwind)
 *  ────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { useStory, DEMO_SEED } from "../lib/store";
import type { IndustryMode } from "../lib/types";

const FILM_EXAMPLES = [
  {
    label: "Endgame — the gauntlet moment",
    text: DEMO_SEED,
  },
  {
    label: "Avatar — Aang wakes in the iceberg",
    text:
      "At the South Pole, Aang lies frozen inside a massive iceberg — unconscious, eyes closed, asleep for a hundred years. Katara and Sokka of the Southern Water Tribe discover him and call out through the ice.",
  },
  {
    label: "Breaking Bad — the last phone call",
    text:
      "Walt stands at the payphone outside a New Hampshire diner. Every option he weighs in his head will end something. Which one does he choose to end?",
  },
  {
    label: "Istanbul — the nameless hacker awakens",
    text:
      "A hacker wakes at the foot of the Galata Tower; a cybernetic implant sits beneath the skin of his arm, and he has no memory of the last three years. The time is 03:17.",
  },
];

const DESIGN_EXAMPLES = [
  {
    label: "Minimalist living room",
    text: "A minimalist living room with floor-to-ceiling windows overlooking a city skyline at dusk. The client wants warmth without clutter — every object must justify its presence.",
  },
  {
    label: "Co-working space for night owls",
    text: "A co-working space designed for night owls: low ambient light, acoustically isolated pods, and a central espresso bar that doubles as a social anchor.",
  },
];

const ARCH_EXAMPLES = [
  {
    label: "Community library on a hillside",
    text: "A community library on a hillside, half-buried into the slope, with skylights that track the sun and a reading terrace overlooking a valley. Budget is tight; material honesty is non-negotiable.",
  },
  {
    label: "Floating pavilion on the Bosphorus",
    text: "A floating pavilion on the Bosphorus — part ferry terminal, part public garden. The structure must resist currents and still feel weightless from the shore.",
  },
];

const ADS_EXAMPLES = [
  {
    label: "Launch campaign for a plant-based burger",
    text: "Launch campaign for a plant-based burger that doesn't apologize for being plant-based. Target: flexitarians aged 25-40 who grill on weekends. Tone: confident, not preachy.",
  },
  {
    label: "Rebrand for a 100-year-old watchmaker",
    text: "Rebrand for a 100-year-old Swiss watchmaker entering the smartwatch market. The tension: heritage vs. innovation. Every asset must feel like both at once.",
  },
];

const MODE_EXAMPLES: Record<IndustryMode, typeof FILM_EXAMPLES> = {
  filmmaking: FILM_EXAMPLES,
  design: DESIGN_EXAMPLES,
  architecture: ARCH_EXAMPLES,
  advertising: ADS_EXAMPLES,
};

const INDUSTRY_OPTIONS: { value: IndustryMode; label: string; icon: string }[] = [
  { value: "filmmaking", label: "Film", icon: "🎬" },
  { value: "design", label: "Design", icon: "🎨" },
  { value: "architecture", label: "Architecture", icon: "🏛" },
  { value: "advertising", label: "Advertising", icon: "📢" },
];

const styles = {
  container: {
    position: "fixed" as const,
    inset: 0,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  backdrop: {
    position: "absolute" as const,
    inset: 0,
    background:
      "radial-gradient(ellipse at 25% 30%, rgba(79,195,247,0.08), transparent 55%), radial-gradient(ellipse at 75% 70%, rgba(233,193,107,0.06), transparent 55%)",
  },
  topBar: {
    position: "relative" as const,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 32px",
  },
  logo: {
    fontFamily: "var(--font-display)",
    fontSize: 26,
    fontWeight: 300,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5em",
    color: "rgba(138,150,170,0.6)",
  },
  topRight: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    textTransform: "uppercase" as const,
    letterSpacing: "0.28em",
    color: "rgba(170,185,205,0.35)",
  },
  hero: {
    position: "relative" as const,
    zIndex: 10,
    display: "flex",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  heroInner: {
    width: "100%",
    maxWidth: 760,
  },
  subtitle: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontFamily: "var(--font-display)",
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.36em",
    color: "#4fc3f7",
  },
  subtitleLine: {
    height: 1,
    width: 32,
    background: "#4fc3f7",
    opacity: 0.5,
  },
  h1: {
    marginTop: 20,
    fontFamily: "var(--font-display)",
    fontSize: 56,
    fontWeight: 300,
    lineHeight: 1.02,
    letterSpacing: "-0.01em",
    color: "rgba(230,236,244,0.9)",
  },
  h1Accent: {
    color: "#4fc3f7",
  },
  description: {
    marginTop: 16,
    maxWidth: 560,
    fontSize: 14,
    lineHeight: 1.7,
    color: "rgba(138,150,170,0.8)",
  },
  textCard: {
    marginTop: 20,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,19,27,0.6)",
    backdropFilter: "blur(4px)",
  },
  textCardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  textCardLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    textTransform: "uppercase" as const,
    letterSpacing: "0.28em",
    color: "rgba(170,185,205,0.35)",
  },
  textarea: {
    width: "100%",
    minHeight: 120,
    padding: "16px",
    background: "transparent",
    border: "none",
    color: "rgba(230,236,244,0.9)",
    fontSize: 16,
    lineHeight: 1.55,
    fontFamily: "var(--font-display)",
    resize: "vertical" as const,
    outline: "none",
  },
  exampleBtn: (active: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    border: `1px solid ${active ? "#4fc3f7" : "rgba(255,255,255,0.08)"}`,
    background: active ? "rgba(79,195,247,0.08)" : "rgba(10,13,18,0.4)",
    color: active ? "#4fc3f7" : "rgba(138,150,170,0.7)",
    fontFamily: "var(--font-display)",
    fontSize: 10,
    textTransform: "uppercase" as const,
    letterSpacing: "0.26em",
    cursor: "pointer",
    boxShadow: active ? "0 0 14px rgba(79,195,247,0.28)" : "none",
    transition: "all 0.15s ease",
  }),
  industryRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  industryBtn: (active: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    background: active ? "rgba(79,195,247,0.08)" : "transparent",
    border: `1px solid ${active ? "#4fc3f7" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 4,
    color: active ? "#4fc3f7" : "rgba(138,150,170,0.6)",
    fontFamily: "var(--font-display)",
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    transition: "all 0.15s ease",
  }),
  enterBtn: (disabled: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 28px",
    border: disabled ? "1px solid rgba(255,255,255,0.06)" : "1px solid #e9c16b",
    background: disabled ? "rgba(10,13,18,0.3)" : "rgba(233,193,107,0.08)",
    color: disabled ? "rgba(138,150,170,0.4)" : "#e9c16b",
    fontFamily: "var(--font-display)",
    fontSize: 13,
    textTransform: "uppercase" as const,
    letterSpacing: "0.36em",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled
      ? "none"
      : "0 0 28px rgba(233,193,107,0.32), inset 0 0 0 1px rgba(233,193,107,0.18)",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  }),
  bottomBar: {
    position: "relative" as const,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 32px",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    textTransform: "uppercase" as const,
    letterSpacing: "0.28em",
    color: "rgba(170,185,205,0.35)",
  },
};

const MODE_PLACEHOLDERS: Record<IndustryMode, string> = {
  filmmaking: "A scene, a decision, a character at a crossroads…",
  design: "A space, a material, a client's impossible brief…",
  architecture: "A site, a constraint, a building that doesn't exist yet…",
  advertising: "A brand, a tension, a campaign that has to land…",
};

export function SeedInput() {
  const [text, setText] = useState(DEMO_SEED);
  const [industry, setIndustry] = useState<IndustryMode>("filmmaking");
  const enterCanvas = useStory((s) => s.enterCanvas);

  const examples = MODE_EXAMPLES[industry];

  return (
    <div style={styles.container}>
      <div aria-hidden style={styles.backdrop} />

      {/* Top chrome */}
      <div style={styles.topBar}>
        <div style={styles.logo}>OpenCorn</div>
        <div style={styles.topRight}>tactical narrative command</div>
      </div>

      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.heroInner}>
          <div style={styles.subtitle}>
            <span style={styles.subtitleLine} />
            ✦ Branching narrative engine
          </div>
          <h1 style={styles.h1}>
            Every choice is a universe.<br />
            <span style={styles.h1Accent}>What if…</span>
          </h1>
          <p style={styles.description}>
            Drop a scene, a memory, or a decision you can't stop rehearsing.
            A council of Hermes agents will branch it into the lives it could
            have been — and let you walk into any of them.
          </p>

          {/* Seed textarea */}
          <div style={styles.textCard}>
            <div style={styles.textCardHeader}>
              <span style={styles.textCardLabel}>✎ seed</span>
              <span style={styles.textCardLabel}>{text.length}/600</span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 600))}
              rows={4}
              placeholder={MODE_PLACEHOLDERS[industry]}
              style={styles.textarea}
            />
          </div>

          {/* Example buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20 }}>
            {examples.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => setText(ex.text)}
                style={styles.exampleBtn(text.trim() === ex.text.trim())}
              >
                ✦ {ex.label}
              </button>
            ))}
          </div>

          {/* Industry mode */}
          <div style={styles.industryRow}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                textTransform: "uppercase" as const,
                letterSpacing: "0.24em",
                color: "rgba(170,185,205,0.4)",
                marginRight: 4,
              }}
            >
              mode:
            </span>
            {INDUSTRY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setIndustry(opt.value)}
                style={styles.industryBtn(industry === opt.value)}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Enter button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 32 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                textTransform: "uppercase" as const,
                letterSpacing: "0.28em",
              }}
            >
              {[
                { label: "seed", color: "rgba(230,236,244,0.78)" },
                { label: "hermes", color: "#e9c16b" },
                { label: "canvas", color: "#4fc3f7" },
              ].map((s, i, arr) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 8px",
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(15,19,27,0.45)",
                      color: s.color,
                    }}
                  >
                    {s.label}
                  </span>
                  {i < arr.length - 1 && (
                    <span style={{ color: "rgba(170,185,205,0.3)" }}>→</span>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={!text.trim()}
              onClick={() => {
                const seed = text.trim() || DEMO_SEED;
                enterCanvas(seed, industry);
              }}
              style={styles.enterBtn(!text.trim())}
              onMouseEnter={(e) => {
                if (!text.trim()) return;
                e.currentTarget.style.background = "rgba(233,193,107,0.16)";
                e.currentTarget.style.boxShadow =
                  "0 0 36px rgba(233,193,107,0.48), inset 0 0 0 1px rgba(233,193,107,0.28)";
              }}
              onMouseLeave={(e) => {
                if (!text.trim()) return;
                e.currentTarget.style.background = "rgba(233,193,107,0.08)";
                e.currentTarget.style.boxShadow =
                  "0 0 28px rgba(233,193,107,0.32), inset 0 0 0 1px rgba(233,193,107,0.18)";
              }}
            >
              Enter the divergence
              <span style={{ fontSize: 15 }}>→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom chrome */}
      <div style={styles.bottomBar}>
        <span>no login · all in your browser</span>
        <span>open source · hermes ai</span>
      </div>
    </div>
  );
}

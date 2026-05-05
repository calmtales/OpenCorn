/*  ──────────────────────────────────────────────────────────────────────
 *  AgentTicker — live agent activity panel
 *  Noustiny-style, ported for OpenCorn (inline CSS, no Tailwind)
 *  ────────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useState } from "react";
import { Cpu, Zap } from "lucide-react";
import { useStory } from "../lib/store";
import type { AgentId, AgentEvent } from "../lib/types";

const AGENT_LABEL: Record<string, { name: string; accent: string }> = {
  brainstorm:        { name: "Brainstorm",      accent: "#4fc3f7" },
  character:         { name: "Character",       accent: "#e9c16b" },
  critic:            { name: "Critic",          accent: "#8a96aa" },
  writer:            { name: "Writer",          accent: "#f7d27c" },
  director:          { name: "Director",        accent: "#a78bfa" },
  "writer-assist":   { name: "Writer-Assist",   accent: "#4fc3f7" },
  "character-sheet": { name: "Cast Sheet",      accent: "#f472b6" },
  judge:             { name: "Judge",           accent: "#ffd47a" },
  "registry-lookup": { name: "Registry",        accent: "#5eead4" },
  "copyright-detector": { name: "Copyright",    accent: "#5eead4" },
};

const NARRATIVE_AGENTS: Set<AgentId> = new Set<AgentId>([
  "brainstorm", "writer", "writer-assist", "critic", "judge",
  "director", "character-sheet", "character",
]);

const FADE_MS = 6000;
const MAX_VISIBLE = 3;

const styles = {
  container: {
    pointerEvents: "none" as const,
    position: "absolute" as const,
    left: 20,
    top: 20,
    zIndex: 20,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    width: 380,
  },
  header: {
    pointerEvents: "auto" as const,
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--font-display)",
    fontSize: 10,
    textTransform: "uppercase" as const,
    letterSpacing: "0.32em",
    color: "rgba(198,210,226,0.72)",
  },
  toggleBtn: (active: boolean) => ({
    marginLeft: "auto",
    padding: "3px 8px",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.22em",
    border: `1px solid ${active ? "rgba(79,195,247,0.4)" : "rgba(255,255,255,0.08)"}`,
    color: active ? "#4fc3f7" : "rgba(170,185,205,0.55)",
    background: active ? "rgba(79,195,247,0.1)" : "transparent",
    cursor: "pointer",
    transition: "all 0.15s ease",
  }),
  panel: {
    pointerEvents: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(10,13,18,0.92)",
    backdropFilter: "blur(8px)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
  },
  card: (accent: string, active: boolean) => ({
    pointerEvents: "auto" as const,
    position: "relative" as const,
    padding: "8px 12px",
    background: "rgba(15,19,27,0.6)",
    boxShadow: active
      ? `inset 3px 0 0 ${accent}, 0 0 18px ${accent}22`
      : `inset 3px 0 0 ${accent}`,
  }),
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--font-mono)",
    fontSize: 9.5,
    textTransform: "uppercase" as const,
    letterSpacing: "0.28em",
  },
  progressBar: (accent: string) => ({
    marginTop: 6,
    height: 1,
    width: "100%",
    overflow: "hidden",
    background: `${accent}22`,
  }),
  progressFill: (accent: string) => ({
    height: "100%",
    width: "30%",
    background: accent,
    boxShadow: `0 0 8px ${accent}`,
    animation: "tickerSweep 1.4s linear infinite",
  }),
  text: {
    marginTop: 6,
    fontFamily: "var(--font-mono)",
    fontSize: 10.5,
    lineHeight: 1.5,
    color: "rgba(234,240,248,0.95)",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-all" as const,
    maxHeight: 240,
    overflow: "hidden",
  },
  moreBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderTop: "1px solid rgba(255,255,255,0.07)",
    padding: "8px",
    fontFamily: "var(--font-mono)",
    fontSize: 9.5,
    textTransform: "uppercase" as const,
    letterSpacing: "0.28em",
    color: "#e9c16b",
    background: "rgba(233,193,107,0.05)",
    cursor: "pointer",
    transition: "background 0.15s ease",
  },
};

export function AgentTicker() {
  const agents = useStory((s) => s.agents);
  const [now, setNow] = useState(() => Date.now());

  // Ticking re-render for fade
  useEffect(() => {
    const hasFading = agents.some(
      (a) => a.status === "done" && Date.now() - a.startedAt < FADE_MS + 400,
    );
    if (!hasFading) return;
    const t = setInterval(() => setNow(Date.now()), 600);
    return () => clearInterval(t);
  }, [agents]);

  const visible = useMemo(
    () =>
      agents
        .filter((a) => NARRATIVE_AGENTS.has(a.agent))
        .filter((a) => {
          if (a.status === "streaming" || a.status === "thinking" || a.status === "error") return true;
          return now - a.startedAt < FADE_MS;
        })
        .slice(-MAX_VISIBLE),
    [agents, now],
  );

  if (visible.length === 0) return null;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <Cpu size={11} strokeWidth={1.6} />
        agents · live
      </div>

      {/* Cards */}
      <div style={styles.panel}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 6 }}>
          {visible.slice().reverse().map((a) => (
            <AgentEventCard key={a.id} event={a} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentEventCard({ event: a }: { event: AgentEvent }) {
  const meta = AGENT_LABEL[a.agent] ?? { name: a.agent, accent: "#4fc3f7" };
  const isActive = a.status === "thinking" || a.status === "streaming";
  const [expanded, setExpanded] = useState(false);

  const showFull = isActive || expanded;
  const preview = showFull ? a.text : truncate(a.text, 280);

  return (
    <div style={styles.card(meta.accent, isActive)}>
      {/* Header */}
      <div style={styles.cardHeader}>
        <span style={{ color: meta.accent, fontWeight: 600 }}>{meta.name}</span>
        <span style={{ color: "rgba(170,185,205,0.55)" }}>· {a.model}</span>
        {isActive && (
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, color: meta.accent }}>
            <Zap size={9} strokeWidth={2} /> {a.status}
          </span>
        )}
        {a.status === "done" && (
          <span style={{ marginLeft: "auto", color: "rgba(170,185,205,0.55)" }}>done</span>
        )}
        {a.status === "error" && (
          <span style={{ marginLeft: "auto", color: "#e74c3c" }}>error</span>
        )}
      </div>

      {/* Label */}
      {a.label && a.label !== meta.name && (
        <div
          style={{
            marginTop: 4,
            fontFamily: "var(--font-display)",
            fontSize: 11.5,
            textTransform: "uppercase" as const,
            letterSpacing: "0.16em",
            color: "rgba(234,240,248,0.95)",
          }}
        >
          {a.label}
        </div>
      )}

      {/* Progress bar */}
      {isActive && (
        <div style={styles.progressBar(meta.accent)}>
          <div style={styles.progressFill(meta.accent)} />
        </div>
      )}

      {/* Text */}
      {a.text ? (
        <div style={styles.text}>
          {a.status === "streaming" ? (
            <>
              {a.text}
              <span style={{ animation: "blink 1s step-end infinite", color: meta.accent }}>▌</span>
            </>
          ) : (
            <>
              {preview}
              {!showFull && a.text.length > 140 && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  style={{
                    marginLeft: 4,
                    fontFamily: "var(--font-mono)",
                    fontSize: 9.5,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.24em",
                    color: "#4fc3f7",
                    textDecoration: "underline",
                    cursor: "pointer",
                    background: "none",
                    border: "none",
                  }}
                >
                  more
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div
          style={{
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "uppercase" as const,
            letterSpacing: "0.24em",
            color: "rgba(170,185,205,0.55)",
          }}
        >
          <LoadingDots accent={meta.accent} />
          <span>reading context</span>
        </div>
      )}
    </div>
  );
}

function truncate(text: string, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

function LoadingDots({ accent }: { accent: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            width: 4,
            height: 4,
            background: accent,
            borderRadius: 1,
            animation: `dotPulse 1.1s ease-in-out infinite ${i * 0.18}s`,
          }}
        />
      ))}
    </span>
  );
}

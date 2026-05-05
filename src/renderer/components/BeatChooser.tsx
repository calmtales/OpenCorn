/*  ──────────────────────────────────────────────────────────────────────
 *  BeatChooser — next critical beats suggestion panel
 *  Shows brainstorm branch options below the current node,
 *  lets the user pick the next canon beat or spawn a what-if.
 *  Noustiny-inspired, OpenCorn (inline CSS, no Tailwind)
 *  ────────────────────────────────────────────────────────────────────── */

import { useState, useCallback } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { useStory, modeLabels } from "../lib/store";
import type { StoryNode as TStoryNode, NodeMood } from "../lib/types";

const MOOD_TINT: Record<NodeMood, string> = {
  neutral: "#8a96aa",
  hopeful: "#e9c16b",
  tense: "#e9c16b",
  danger: "#e74c3c",
  climax: "#e9c16b",
  quiet: "#8a96aa",
  discovery: "#4fc3f7",
};

const s = {
  container: {
    pointerEvents: "auto" as const,
    position: "absolute" as const,
    left: 20,
    bottom: 20,
    zIndex: 25,
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    width: 420,
    animation: "fadeInUp 0.3s ease-out",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--font-display)",
    fontSize: 10,
    textTransform: "uppercase" as const,
    letterSpacing: "0.32em",
    color: "rgba(198,210,226,0.72)",
  },
  grid: {
    display: "flex",
    gap: 8,
  },
  card: (accent: string, isHovered: boolean) => ({
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    padding: "10px 12px",
    border: `1px solid ${isHovered ? accent : "rgba(255,255,255,0.08)"}`,
    background: isHovered ? `${accent}11` : "rgba(10,13,18,0.88)",
    backdropFilter: "blur(8px)",
    cursor: "pointer",
    transition: "all 0.15s ease",
    boxShadow: isHovered
      ? `0 0 16px ${accent}33, inset 0 0 0 1px ${accent}44`
      : "0 4px 16px rgba(0,0,0,0.4)",
  }),
  cardTitle: {
    fontFamily: "var(--font-display)",
    fontSize: 11.5,
    fontWeight: 600,
    letterSpacing: "0.04em",
    lineHeight: 1.35,
    color: "rgba(230,236,244,0.92)",
    display: "-webkit-box" as const,
    WebkitBoxOrient: "vertical" as const,
    WebkitLineClamp: 2,
    overflow: "hidden",
  },
  cardSummary: {
    fontFamily: "var(--font-mono)",
    fontSize: 9.5,
    lineHeight: 1.5,
    color: "rgba(170,185,205,0.6)",
    display: "-webkit-box" as const,
    WebkitBoxOrient: "vertical" as const,
    WebkitLineClamp: 2,
    overflow: "hidden",
  },
  cardAction: (accent: string) => ({
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginTop: "auto",
    paddingTop: 6,
    borderTop: "1px solid rgba(255,255,255,0.06)",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    textTransform: "uppercase" as const,
    letterSpacing: "0.28em",
    color: accent,
  }),
  emptyState: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(10,13,18,0.85)",
    backdropFilter: "blur(6px)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
    color: "rgba(170,185,205,0.45)",
  },
  hint: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.24em",
    textTransform: "uppercase" as const,
    color: "rgba(170,185,205,0.35)",
    marginLeft: "auto",
  },
};

interface BeatSuggestion {
  id: string;
  title: string;
  summary: string;
  mood: NodeMood;
  nodeId: string;
  childIdx: number;
}

/**
 * Collects child suggestions from the current node's children.
 * If no children exist, returns an empty array (user can click a node
 * to trigger brainstorm via the edge buttons).
 */
function collectSuggestions(currentNode: TStoryNode | undefined, nodes: Map<string, TStoryNode>): BeatSuggestion[] {
  if (!currentNode || currentNode.childrenIds.length === 0) return [];
  return currentNode.childrenIds
    .map((childId, idx) => {
      const child = nodes.get(childId);
      if (!child) return null;
      return {
        id: child.id,
        title: child.title,
        summary: child.summary || child.body || "",
        mood: child.mood,
        nodeId: child.id,
        childIdx: idx,
      };
    })
    .filter(Boolean) as BeatSuggestion[];
}

export function BeatChooser() {
  const currentNodeId = useStory((s) => s.currentId);
  const nodes = useStory((s) => s.nodes);
  const industryMode = useStory((s) => s.industryMode);
  const setCurrent = useStory((s) => s.setCurrent);
  const currentNode = nodes.get(currentNodeId);
  const labels = modeLabels(industryMode);

  const suggestions = collectSuggestions(currentNode, nodes);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handlePick = useCallback(
    (nodeId: string) => {
      setCurrent(nodeId, "human");
    },
    [setCurrent],
  );

  // Don't show if there's nothing to choose
  if (suggestions.length === 0) return null;

  const accent = "#4fc3f7";

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <Sparkles size={11} strokeWidth={1.6} />
        <span>next critical {labels.beat.toLowerCase()}s</span>
        <span style={s.hint}>click to continue</span>
      </div>

      {/* Beat cards */}
      <div style={s.grid}>
        {suggestions.map((beat) => {
          const isHovered = hoveredId === beat.id;
          const tint = MOOD_TINT[beat.mood] ?? accent;
          return (
            <div
              key={beat.id}
              style={s.card(tint, isHovered)}
              onMouseEnter={() => setHoveredId(beat.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handlePick(beat.nodeId)}
            >
              <div style={s.cardTitle}>{beat.title}</div>
              <div style={s.cardSummary}>{beat.summary}</div>
              <div style={s.cardAction(tint)}>
                <ArrowRight size={9} strokeWidth={2.4} />
                enter
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

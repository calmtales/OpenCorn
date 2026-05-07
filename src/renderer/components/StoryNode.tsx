/*  ──────────────────────────────────────────────────────────────────────
 *  StoryNode — checkpoint + compact bar variants
 *  Noustiny-style branching canvas, ported for OpenCorn
 *  Inline CSS only — no Tailwind, no framer-motion
 *  ────────────────────────────────────────────────────────────────────── */

import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  AlertTriangle, Skull, Heart, Sparkles, Eye,
  Lock, Check, ChevronRight, ArrowRight, X, Bot, User,
} from "lucide-react";
import type { ComponentType, CSSProperties, SVGProps } from "react";
import { useState, useEffect } from "react";
import type { NodeMood, NodeTone, StoryNode as TStoryNode } from "../lib/types";
import { useStory, modeLabels, modeStylePrefix } from "../lib/store";
import { variantOf, COMPACT_RIBBON_Y, CHECKPOINT_HEIGHT, COMPACT_HEIGHT } from "../lib/layout";

// Inject keyframe animations for weaving/generating states + CRT scanlines
if (typeof document !== "undefined" && !document.getElementById("storynode-animations")) {
  const style = document.createElement("style");
  style.id = "storynode-animations";
  style.textContent = `
    @keyframes scanSweep {
      0% { background-position: 0% -100%; }
      100% { background-position: 0% 200%; }
    }
    @keyframes weavingPulse {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
    @keyframes generatingGlow {
      0%, 100% { box-shadow: 0 0 12px rgba(79,195,247,0.3); }
      50% { box-shadow: 0 0 24px rgba(79,195,247,0.6); }
    }
    @keyframes crtFlicker {
      0%, 100% { opacity: 0.12; }
      20% { opacity: 0.18; }
      40% { opacity: 0.08; }
      60% { opacity: 0.15; }
      80% { opacity: 0.1; }
    }
    @keyframes crtScroll {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100%); }
    }
  `;
  document.head.appendChild(style);
}

type Props = NodeProps & { data: { node: TStoryNode } };

type LucideLike = ComponentType<
  SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number; style?: CSSProperties }
>;

const MOOD_ICON: Record<NodeMood, LucideLike> = {
  neutral: ArrowRight,
  hopeful: Sparkles,
  tense: AlertTriangle,
  danger: Skull,
  climax: Sparkles,
  quiet: Heart,
  discovery: Eye,
};

const MOOD_TINT: Record<NodeMood, string> = {
  neutral: "#8a96aa",
  hopeful: "#e9c16b",
  tense: "#e9c16b",
  danger: "#e74c3c",
  climax: "#e9c16b",
  quiet: "#8a96aa",
  discovery: "#4fc3f7",
};

// ---- Inline style objects ---------------------------------------------------

const sCompact = {
  thumb: {
    position: "relative" as const,
    width: "100%",
    height: 80,
    marginBottom: 4,
    background: "#05070b",
    clipPath: "polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)",
    overflow: "hidden",
    cursor: "zoom-in",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
  },
  shimmer: {
    position: "absolute" as const,
    inset: 0,
    background: "linear-gradient(110deg, #0f131b, #151a24, #0f131b)",
    animation: "pulse 2s ease-in-out infinite",
  },
  ribbon: {
    position: "relative" as const,
    display: "flex",
    alignItems: "center",
    height: 38,
  },
  ribbonInner: {
    position: "relative" as const,
    display: "flex",
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 10,
    padding: "0 16px",
    clipPath: "polygon(8px 0, 100% 0, 100% 100%, 0 100%)",
  },
  ribbonTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: "var(--font-display)",
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.14em",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  handle: {
    width: 2,
    height: 10,
    minWidth: 2,
    minHeight: 10,
    background: "rgba(255,255,255,0.4)",
    border: "none",
    opacity: 0,
    pointerEvents: "none" as const,
    borderRadius: 1,
  },
  removeBtn: {
    position: "absolute" as const,
    top: -8,
    right: -8,
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    height: 20,
    borderRadius: "50%",
    border: "1px solid #e74c3c",
    background: "rgba(10,13,18,0.96)",
    color: "#e74c3c",
    cursor: "pointer",
    opacity: 0,
    transition: "opacity 0.15s ease",
  },
} as const;

const sCheckpoint = {
  container: {
    position: "relative" as const,
    width: 480,
    userSelect: "none" as const,
    fontSize: 12,
  },
  imageWrap: {
    position: "relative" as const,
    overflow: "hidden",
    clipPath: "polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)",
  },
  imageInner: {
    position: "relative" as const,
    width: "100%",
    height: 240,
    overflow: "hidden",
    background: "#05070b",
    cursor: "zoom-in",
  },
  imageTag: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    zIndex: 15,
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 20px",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.28em",
    clipPath: "polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 10px 100%)",
    cursor: "pointer",
    opacity: 0.9,
    transition: "opacity 0.15s ease",
  },
  ribbon: {
    position: "relative" as const,
    marginTop: -24,
    zIndex: 2,
    cursor: "pointer",
  },
  ribbonInner: {
    position: "relative" as const,
    display: "flex",
    flex: 1,
    flexDirection: "column" as const,
    justifyContent: "center",
    padding: "12px 18px",
    clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)",
  },
  ribbonTitle: {
    fontFamily: "var(--font-display)",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: "0.06em",
    lineHeight: 1.4,
    display: "-webkit-box",
    WebkitBoxOrient: "vertical" as const,
    WebkitLineClamp: 3,
    overflow: "hidden",
    color: "#fff",
    textShadow: "0 2px 4px rgba(0,0,0,0.5)",
  },
  ribbonSub: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.32em",
  },
  provenance: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    padding: "0 4px",
    fontFamily: "var(--font-mono)",
    fontSize: 11.5,
    textTransform: "uppercase" as const,
    letterSpacing: "0.24em",
    color: "rgba(170,185,205,0.55)",
  },
  quickActions: {
    position: "absolute" as const,
    right: 10,
    top: 10,
    zIndex: 24,
    display: "flex",
    gap: 8,
    opacity: 0,
    transform: "translateY(-3px)",
    transition: "opacity 0.14s ease, transform 0.14s ease",
    pointerEvents: "none" as const,
  },
  quickButton: (variant: "canon" | "what-if") => ({
    pointerEvents: "auto" as const,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 38,
    height: 38,
    padding: "0 12px",
    border: `1.5px solid ${variant === "canon" ? "rgba(79,195,247,0.4)" : "rgba(233,193,107,0.4)"}`,
    background: variant === "canon"
      ? "rgba(79,195,247,0.15)"
      : "rgba(233,193,107,0.15)",
    color: variant === "canon" ? "#4fc3f7" : "#e9c16b",
    borderRadius: variant === "canon" ? 999 : 8,
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: "0.2em",
    boxShadow: "0 10px 24px rgba(0,0,0,0.45)",
    transition: "all 0.18s ease",
    backdropFilter: "blur(8px)",
  }),
  cornerBracket: {
    position: "absolute" as const,
    width: 18,
    height: 18,
    opacity: 0.9,
  },
  weavingOverlay: {
    position: "absolute" as const,
    inset: 0,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    textTransform: "uppercase" as const,
    letterSpacing: "0.3em",
  },
  weavingText: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.36em",
    textShadow: "0 0 12px currentColor",
    animation: "weavingPulse 2.5s ease-in-out infinite",
  },
  scanLine: {
    position: "absolute" as const,
    inset: 0,
    pointerEvents: "none" as const,
    opacity: 0.15,
    backgroundImage:
      "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.04) 2px, rgba(255,255,255,0.04) 4px)",
  },
  scanSweep: {
    position: "absolute" as const,
    inset: 0,
    pointerEvents: "none" as const,
    background: "linear-gradient(180deg, transparent 0%, rgba(79,195,247,0.06) 50%, transparent 100%)",
    backgroundSize: "100% 200%",
    animation: "scanSweep 3s linear infinite",
  },
  /** CRT scanline overlay — horizontal lines + rolling bar for generating/weaving state */
  crtScanlines: {
    position: "absolute" as const,
    inset: 0,
    pointerEvents: "none" as const,
    zIndex: 10,
    overflow: "hidden" as const,
  },
  crtLines: {
    position: "absolute" as const,
    inset: 0,
    pointerEvents: "none" as const,
    backgroundImage:
      "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.03) 1px, rgba(255,255,255,0.03) 2px)",
    animation: "crtFlicker 4s ease-in-out infinite",
  },
  crtBar: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    height: "40%",
    pointerEvents: "none" as const,
    background: "linear-gradient(180deg, transparent 0%, rgba(79,195,247,0.04) 40%, rgba(79,195,247,0.06) 50%, rgba(79,195,247,0.04) 60%, transparent 100%)",
    animation: "crtScroll 5s linear infinite",
  },
} as const;

// ---- helpers ----------------------------------------------------------------

function staleBorder(node: TStoryNode): string | null {
  if (node.staleState === "stale") return "#e9c16b";
  if (node.staleState === "unresolved") return "#e74c3c";
  if (node.staleState === "rewritten") return "rgba(79,195,247,0.75)";
  return null;
}

function quickBranchFor(
  node: TStoryNode,
  variant: "canon" | "what-if",
  labels: ReturnType<typeof modeLabels>,
) {
  const base = node.title?.trim() || node.summary?.trim() || labels.beat;
  const prefix = variant === "canon" ? `Next ${labels.beat.toLowerCase()}` : `What if`;
  const title = variant === "canon"
    ? `${prefix}: ${base}`
    : `${prefix} ${base.toLowerCase()}?`;
  const summary = variant === "canon"
    ? `${base} continues as the canonical ${labels.beat.toLowerCase()} path.`
    : `An alternate ${labels.beat.toLowerCase()} that bends the story into a different direction.`;
  const body = `${summary}\n\nGenerated locally so the team can keep moving even while the brainstorm service is catching up.`;
  const imagePrompt = `${summary} ${modeStylePrefix(useStory.getState().industryMode)}`;
  return {
    title,
    summary,
    body,
    imagePrompt,
    imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=480&height=300&seed=${Date.now()}&model=flux&nologo=true`,
    mood: (variant === "canon" ? "neutral" : "discovery") as NodeMood,
    tone: (variant === "canon" ? "canon" : "what-if") as NodeTone,
    label: variant === "canon" ? "canon" : "alternate",
  };
}

// ---- CompactBar -------------------------------------------------------------

function CompactBar({ node, hovered }: { node: TStoryNode; hovered: boolean }) {
  const setCurrent = useStory((s) => s.setCurrent);
  const removeInserted = useStory((s) => s.removeInserted);
  const isHover = hovered;
  const MoodIcon = MOOD_ICON[node.mood];
  const staleTint = staleBorder(node);
  const isShell = node.status === "generating" && !!node.inserted && !node.title;
  const onCanon = node.status === "canon" || node.status === "current";
  const isVisited = node.status === "visited";

  let barBg: string;
  let titleColor: string;
  let iconColor: string;

  if (isShell) {
    barBg = "linear-gradient(90deg, rgba(20,26,36,0.88) 0%, rgba(15,19,27,0.88) 100%)";
    titleColor = "rgba(233,193,107,0.92)";
    iconColor = "rgba(233,193,107,0.8)";
  } else if (onCanon) {
    barBg = "linear-gradient(90deg, #1aa1e0 0%, #4fc3f7 100%)";
    titleColor = "#0a0d12";
    iconColor = "#0a0d12";
  } else {
    barBg = "rgba(20,26,36,0.88)";
    titleColor = "rgba(230,236,244,0.9)";
    iconColor = MOOD_TINT[node.mood];
  }

  const outline = isShell
    ? "inset 0 0 0 1px rgba(233,193,107,0.55)"
    : staleTint
      ? `inset 0 0 0 1.5px ${staleTint}, 0 0 10px ${staleTint}40`
      : isHover
        ? "inset 0 0 0 1px #4fc3f7"
        : "inset 0 0 0 1px rgba(255,255,255,0.08)";

  const displayLabel = isShell
    ? "new moment"
    : node.status === "generating" && !node.title
      ? "Agent weaving…"
      : node.label || node.title;

  return (
    <div
      style={{
        position: "relative",
        width: 272,
        userSelect: "none",
        cursor: "pointer",
        transition: "opacity 0.3s ease, transform 0.3s ease",
        transform: isHover ? "scale(1.01)" : "scale(1)",
      }}
      onClick={(e) => { e.stopPropagation(); setCurrent(node.id); }}
    >
      {/* × removal button */}
      {node.inserted && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); removeInserted(node.id); }}
          style={sCompact.removeBtn}
          title="Remove this inserted beat"
        >
          <X size={10} strokeWidth={2.2} />
        </button>
      )}

      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          ...sCompact.handle,
          left: 4,
          top: COMPACT_RIBBON_Y,
          transform: "translate(0, -50%)",
        }}
      />
      {/* Source handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          ...sCompact.handle,
          right: -2,
          top: COMPACT_RIBBON_Y,
          transform: "translate(0, -50%)",
        }}
      />

      {/* Thumbnail */}
      <div style={sCompact.thumb}>
        {node.imageUrl && (
          <img
            src={node.imageUrl}
            alt=""
            draggable={false}
            style={{
              ...sCompact.thumbImg,
              filter: node.status === "visited" ? "grayscale(0.3) brightness(0.82)" : undefined,
            }}
          />
        )}
        {!node.imageUrl && (
          <div style={{
            ...sCompact.shimmer,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 10px",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            textTransform: "uppercase" as const,
            letterSpacing: "0.18em",
            color: "rgba(170,185,205,0.5)",
            textAlign: "center" as const,
            lineHeight: 1.4,
          }}>
            {(node.body || node.summary || node.title || "").slice(0, 80) || "No keyframe"}
          </div>
        )}
        {/* Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none" as const,
            background:
              "linear-gradient(180deg, rgba(10,13,18,0.12) 0%, transparent 45%, rgba(10,13,18,0.6) 100%)",
          }}
        />
        {/* Weaving overlay — immersive generating state with CRT scanlines */}
        {node.status === "generating" && (
          <div
            style={{
              ...sCheckpoint.weavingOverlay,
              background: isShell ? "rgba(5,7,11,0.88)" : "rgba(5,7,11,0.78)",
              color: isShell ? "#e9c16b" : "#4fc3f7",
            }}
          >
            <div style={sCheckpoint.scanSweep} />
            {/* CRT scanline overlay */}
            <div style={sCheckpoint.crtScanlines}>
              <div style={sCheckpoint.crtLines} />
              <div style={sCheckpoint.crtBar} />
            </div>
            <Lock size={12} style={{ opacity: 0.6 }} />
            <span style={sCheckpoint.weavingText}>
              {isShell ? "weaving…" : "imagining…"}
            </span>
          </div>
        )}
      </div>

      {/* Ribbon */}
      <div style={sCompact.ribbon}>
        <div
          style={{
            ...sCompact.ribbonInner,
            background: barBg,
            boxShadow: outline,
            transition: "box-shadow 0.14s ease, background 0.14s ease",
          }}
        >
          <MoodIcon size={11} strokeWidth={2.2} style={{ color: iconColor, flexShrink: 0 }} />
          <span
            style={{ ...sCompact.ribbonTitle, color: titleColor }}
            title={node.label ? node.title : undefined}
          >
            {displayLabel}
          </span>
          {node.staleState === "stale" && (
            <span
              style={{
                flexShrink: 0,
                border: "1px solid #e9c16b",
                color: "#e9c16b",
                padding: "1px 4px",
                fontFamily: "var(--font-mono)",
                fontSize: 8,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
              }}
            >
              stale
            </span>
          )}
          {isVisited && (
            <Check size={11} strokeWidth={2.2} style={{ color: iconColor, marginLeft: "auto", flexShrink: 0 }} />
          )}
          {node.status === "generating" && (
            <Lock size={11} style={{ color: isShell ? "#e9c16b" : "#4fc3f7", marginLeft: "auto", flexShrink: 0 }} />
          )}
          {!isVisited && node.status !== "generating" && (
            <ChevronRight
              size={11}
              strokeWidth={2.2}
              style={{ color: iconColor, opacity: 0.75, marginLeft: "auto", flexShrink: 0 }}
            />
          )}
        </div>
      </div>

      {/* Provenance HUD strip */}
      {(node.decidedBy === "agent" || node.inserted) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 6,
            padding: "2px 6px",
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            textTransform: "uppercase" as const,
            letterSpacing: "0.24em",
            color: "rgba(170,185,205,0.45)",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          {node.decidedBy === "agent" ? (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "rgba(79,195,247,0.5)", letterSpacing: "0.3em", fontSize: 8.5 }}>AGENT</span>
              <Bot size={10} strokeWidth={2} style={{ color: "#4fc3f7" }} />
              <span style={{ color: "rgba(79,195,247,0.75)" }}>
                {(node.decidedByAgent?.replace("hermes-", "") ?? "brainstorm").toUpperCase()}
              </span>
            </span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "rgba(233,193,107,0.5)", letterSpacing: "0.3em", fontSize: 8.5 }}>USER</span>
              <User size={10} strokeWidth={2} style={{ color: "#e9c16b" }} />
              <span style={{ color: "rgba(233,193,107,0.75)" }}>YOU</span>
            </span>
          )}
          {node.inserted && (
            <span style={{ border: "1px solid rgba(255,255,255,0.06)", padding: "1px 5px", fontSize: 8, marginLeft: "auto" }}>
              INS
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---- CheckpointCard ---------------------------------------------------------

function CheckpointCard({ node, hovered }: { node: TStoryNode; hovered: boolean }) {
  const setCurrent = useStory((s) => s.setCurrent);
  const removeInserted = useStory((s) => s.removeInserted);
  const addBranches = useStory((s) => s.addBranches);
  const industryMode = useStory((s) => s.industryMode);
  const labels = modeLabels(industryMode);
  const [loaded, setLoaded] = useState(false);
  const isCurrent = node.status === "current";
  const isShell = node.status === "generating" && !!node.inserted && !node.title;
  const isHover = hovered;
  const staleTint = staleBorder(node);

  const ribbonBg = isShell
    ? "linear-gradient(90deg, rgba(20,26,36,0.7) 0%, rgba(20,26,36,0.4) 100%)"
    : isCurrent
      ? "linear-gradient(90deg, #b88a2c 0%, #e9c16b 100%)"
      : "linear-gradient(90deg, #1aa1e0 0%, #4fc3f7 100%)";
  const ribbonInk = isShell ? "rgba(233,193,107,0.9)" : "#0a0d12";

  const handleQuickAdd = (variant: "canon" | "what-if") => {
    const branch = quickBranchFor(node, variant, labels);
    const [newId] = addBranches(node.id, [branch], "human", "you");
    if (newId) setCurrent(newId, "human");
  };

  return (
    <div
      style={{
        ...sCheckpoint.container,
        opacity: isShell ? 0.82 : 1,
      }}
      onClick={(e) => { e.stopPropagation(); setCurrent(node.id); }}
    >
      {/* × removal button */}
      {node.inserted && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); removeInserted(node.id); }}
          style={{ ...sCompact.removeBtn, width: 24, height: 24, top: -8, right: -8 }}
          title="Remove this inserted beat"
        >
          <X size={12} strokeWidth={2.2} />
        </button>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ ...sCompact.handle, left: 6, top: 120, transform: "translate(0, -50%)" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ ...sCompact.handle, right: -2, top: 120, transform: "translate(0, -50%)" }}
      />

      {/* Image tile */}
      <div
        style={{
          ...sCheckpoint.imageWrap,
          boxShadow: node.status === "generating"
            ? "0 0 22px rgba(79,195,247,0.35), 0 0 44px rgba(79,195,247,0.15)"
            : isShell
              ? "0 0 18px rgba(233,193,107,0.28)"
              : staleTint
                ? `inset 0 0 0 1.5px ${staleTint}, 0 0 20px ${staleTint}40`
                : isHover
                  ? "inset 0 0 0 1px #4fc3f7, 0 0 18px rgba(79,195,247,0.2)"
                  : "inset 0 0 0 1px rgba(255,255,255,0.08)",
          transition: "box-shadow 0.18s ease",
          animation: node.status === "generating" ? "generatingGlow 2.5s ease-in-out infinite" : undefined,
        }}
      >
        <div style={sCheckpoint.imageInner}>
          {!loaded && !node.imageUrl && (
            <div style={{
              ...sCompact.shimmer,
              display: "flex",
              flexDirection: "column" as const,
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 20,
            }}>
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                textTransform: "uppercase" as const,
                letterSpacing: "0.28em",
                color: "rgba(170,185,205,0.35)",
              }}>
                no keyframe
              </span>
              <span style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: "rgba(170,185,205,0.55)",
                textAlign: "center" as const,
                maxWidth: "90%",
                display: "-webkit-box" as const,
                WebkitBoxOrient: "vertical" as const,
                WebkitLineClamp: 5,
                overflow: "hidden",
              }}>
                {node.body || node.summary || node.title || ""}
              </span>
            </div>
          )}
          {!loaded && !!node.imageUrl && <div style={sCompact.shimmer} />}
          {node.imageUrl && (
            <img
              src={node.imageUrl}
              alt={node.title}
              onLoad={() => setLoaded(true)}
              onError={(e) => {
                // When image fails to load, show description text instead
                (e.target as HTMLImageElement).style.display = "none";
              }}
              draggable={false}
              style={{
                ...sCheckpoint.imageInner,
                objectFit: "cover",
                opacity: loaded ? 1 : 0,
                filter: node.status === "visited" ? "grayscale(0.3) brightness(0.82)" : undefined,
                transition: "opacity 0.3s ease",
              }}
            />
          )}
          {/* Vignette */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none" as const,
              background:
                "linear-gradient(180deg, rgba(10,13,18,0.2) 0%, transparent 40%, transparent 70%, rgba(10,13,18,0.7) 100%)",
            }}
          />
          {isCurrent && <div style={sCheckpoint.scanLine} />}

          {/* Weaving overlay — immersive generating state with CRT scanlines */}
          {node.status === "generating" && (
            <div
              style={{
                ...sCheckpoint.weavingOverlay,
                background: isShell
                  ? "rgba(5,7,11,0.92)"
                  : loaded
                    ? "rgba(5,7,11,0.72)"
                    : "rgba(5,7,11,0.92)",
                color: isShell ? "#e9c16b" : "#4fc3f7",
              }}
            >
              <div style={sCheckpoint.scanSweep} />
              {/* CRT scanline overlay */}
              <div style={sCheckpoint.crtScanlines}>
                <div style={sCheckpoint.crtLines} />
                <div style={sCheckpoint.crtBar} />
              </div>
              <Lock size={14} style={{ opacity: 0.6 }} />
              <span style={sCheckpoint.weavingText}>
                {isShell ? "weaving new beat…" : "agent imagining…"}
              </span>
            </div>
          )}

          {/* Storybook button */}
          {!isShell && node.status !== "generating" && node.parentId && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); }}
              title="Generate storybook video ending at this beat"
              style={{
                ...sCheckpoint.imageTag,
                border: "1px solid #4fc3f7",
                background: "rgba(10,13,18,0.92)",
                color: "#4fc3f7",
                boxShadow: "0 4px 14px rgba(79,195,247,0.22)",
              }}
            >
              <span style={{ fontSize: 12 }}>📽</span>
              storybook
            </button>
          )}
        </div>
      </div>

      {/* Active-beat indicator brackets */}
      {isCurrent && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" as const, zIndex: 20 }} aria-hidden>
          <span
            style={{
              ...sCheckpoint.cornerBracket,
              top: -11, left: -5,
              borderTop: "1.7px solid #4fc3f7",
              borderLeft: "1.7px solid #4fc3f7",
            }}
          />
          <span
            style={{
              ...sCheckpoint.cornerBracket,
              top: -11, right: -5,
              borderTop: "1.7px solid #4fc3f7",
              borderRight: "1.7px solid #4fc3f7",
            }}
          />
          <span
            style={{
              ...sCheckpoint.cornerBracket,
              bottom: -5, left: -5,
              borderBottom: "1.7px solid #4fc3f7",
              borderLeft: "1.7px solid #4fc3f7",
            }}
          />
          <span
            style={{
              ...sCheckpoint.cornerBracket,
              bottom: -5, right: -5,
              borderBottom: "1.7px solid #4fc3f7",
              borderRight: "1.7px solid #4fc3f7",
            }}
          />
        </div>
      )}

      {/* Title ribbon */}
      <div style={sCheckpoint.ribbon}>
        <div
          style={{
            ...sCheckpoint.ribbonInner,
            background: ribbonBg,
            color: ribbonInk,
            boxShadow: isShell
              ? "0 0 0 1px rgba(233,193,107,0.35), 0 6px 16px rgba(0,0,0,0.35)"
              : `0 8px 20px ${isCurrent ? "rgba(233,193,107,0.25)" : "rgba(79,195,247,0.2)"}`,
          }}
        >
          <div style={sCheckpoint.ribbonTitle}>
            {isShell ? "New moment" : node.title}
          </div>
          <div
            style={{
              ...sCheckpoint.ribbonSub,
              color: isShell ? "rgba(233,193,107,0.55)" : "rgba(10,13,18,0.7)",
            }}
          >
            {isShell ? "placeholder · weaving" : "Checkpoint"}
          </div>
        </div>
      </div>

      {/* Quick add controls */}
      {isCurrent && !isShell && (
        <div
          style={{
            ...sCheckpoint.quickActions,
            opacity: isHover ? 1 : 0.82,
            transform: isHover ? "translateY(0)" : "translateY(-1px)",
          }}
          aria-label="Add node options"
        >
          <button
            type="button"
            style={sCheckpoint.quickButton("canon")}
            onClick={(e) => { e.stopPropagation(); handleQuickAdd("canon"); }}
            title={`Add canon ${labels.beat.toLowerCase()}`}
          >
            + ○
          </button>
          <button
            type="button"
            style={sCheckpoint.quickButton("what-if")}
            onClick={(e) => { e.stopPropagation(); handleQuickAdd("what-if"); }}
            title={`Add alternate ${labels.beat.toLowerCase()}`}
          >
            + □
          </button>
        </div>
      )}

      {/* Provenance HUD */}
      <div style={{
        ...sCheckpoint.provenance,
        borderTop: "1px solid rgba(255,255,255,0.04)",
        paddingTop: 8,
        marginTop: 10,
      }}>
        {node.decidedBy === "agent" ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "rgba(79,195,247,0.5)", letterSpacing: "0.3em", fontSize: 9.5 }}>AGENT</span>
            <Bot size={11} strokeWidth={2} style={{ color: "#4fc3f7" }} />
            <span style={{ color: "rgba(79,195,247,0.75)" }}>
              {(node.decidedByAgent?.replace("hermes-", "") ?? "brainstorm").toUpperCase()}
            </span>
          </span>
        ) : (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "rgba(233,193,107,0.5)", letterSpacing: "0.3em", fontSize: 9.5 }}>USER</span>
            <User size={11} strokeWidth={2} style={{ color: "#e9c16b" }} />
            <span style={{ color: "rgba(233,193,107,0.75)" }}>YOU</span>
          </span>
        )}
        {node.inserted && (
          <span style={{ border: "1px solid rgba(255,255,255,0.06)", padding: "1px 5px", fontSize: 8, marginLeft: "auto" }}>
            INS
          </span>
        )}
      </div>
    </div>
  );
}

// ---- StoryNodeCard (main export) -------------------------------------------

function PreviewOverlay({ node, yShift, hovered }: { node: TStoryNode; yShift: number; hovered: boolean }) {
  const setCurrent = useStory((s) => s.setCurrent);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: -yShift,
        zIndex: 20,
      }}
      onClick={(e) => { e.stopPropagation(); setCurrent(node.id); }}
    >
      <CheckpointCard node={node} hovered={hovered} />
    </div>
  );
}

export function StoryNodeCard({ data }: Props) {
  const { node } = data;
  const [isHovered, setIsHovered] = useState(false);
  const variant = variantOf(node);

  if (variant === "checkpoint") return <CheckpointCard node={node} hovered={isHovered} />;

  const showPreview = isHovered;
  const yShift = (CHECKPOINT_HEIGHT - COMPACT_HEIGHT) / 2;

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ visibility: showPreview ? "hidden" : "visible" }}>
        <CompactBar node={node} hovered={isHovered} />
      </div>
      {showPreview && (
        <PreviewOverlay node={node} yShift={yShift} hovered={isHovered} />
      )}
    </div>
  );
}

export const nodeTypes = { story: StoryNodeCard };

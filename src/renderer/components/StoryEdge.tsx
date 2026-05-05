/*  ──────────────────────────────────────────────────────────────────────
 *  StoryEdge — Orthogonal 90° tactical connector
 *  Noustiny-style branching canvas: Golden Path, geometric buttons
 *  Inline CSS only — no Tailwind, no framer-motion
 *  ────────────────────────────────────────────────────────────────────── */

import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { useStory } from "../lib/store";

const SPINE_OFFSET = 95;
const RADIUS = 8;

function computeSpine(sx: number, tx: number): number {
  const mid = (sx + tx) / 2;
  return Math.min(sx + SPINE_OFFSET, mid);
}

/** Orthogonal 90° step path — pure horizontal → vertical → horizontal. */
function orthogonalPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): string {
  const spine = computeSpine(sx, tx);
  if (Math.abs(ty - sy) < 1) return `M ${sx},${sy} L ${tx},${ty}`;
  return [
    `M ${sx},${sy}`,
    `L ${spine},${sy}`,  // horizontal out from source
    `L ${spine},${ty}`,  // vertical step
    `L ${tx},${ty}`,     // horizontal into target
  ].join(" ");
}

// Inline style objects — tactical geometric buttons
const styles = {
  spliceBtn: (canon: boolean) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minWidth: 36,
    height: 28,
    padding: "0 8px",
    cursor: "pointer",
    border: `1.5px solid ${canon ? "rgba(233,193,107,0.7)" : "rgba(79,195,247,0.45)"}`,
    background: canon
      ? "linear-gradient(180deg, rgba(233,193,107,0.18), rgba(233,193,107,0.06))"
      : "linear-gradient(180deg, rgba(79,195,247,0.12), rgba(79,195,247,0.04))",
    color: canon ? "#e9c16b" : "#4fc3f7",
    boxShadow: canon
      ? "0 0 14px rgba(233,193,107,0.3), inset 0 1px 0 rgba(233,193,107,0.15)"
      : "0 0 10px rgba(79,195,247,0.2), inset 0 1px 0 rgba(79,195,247,0.1)",
    // Geometric tactical clip-path (arrow-right)
    clipPath: "polygon(6px 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 6px 100%, 0 50%)",
    transition: "all 0.18s ease",
    outline: "none",
    fontFamily: "var(--font-mono)",
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    backdropFilter: "blur(4px)",
  }),
  forkBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 40,
    height: 26,
    padding: "0 10px",
    cursor: "pointer",
    background: "linear-gradient(180deg, rgba(15,19,27,0.94), rgba(10,13,18,0.9))",
    border: "1px solid rgba(233,193,107,0.4)",
    color: "rgba(233,193,107,0.7)",
    backdropFilter: "blur(4px)",
    // Geometric tactical clip-path (diamond)
    clipPath: "polygon(0 0, 100% 0, calc(100% - 5px) 50%, 100% 100%, 0 100%, 5px 50%)",
    transition: "all 0.18s ease",
    outline: "none",
    fontFamily: "var(--font-mono)",
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
  },
  labelTag: {
    fontFamily: "var(--font-mono)",
    fontSize: 7.5,
    textTransform: "uppercase" as const,
    letterSpacing: "0.32em",
    opacity: 0.7,
  },
};

export function StoryEdge({
  source, target,
  sourceX, sourceY, targetX, targetY,
  data, markerEnd,
}: EdgeProps) {
  const meta = (data ?? {}) as { canon?: boolean; explored?: boolean };
  const path = orthogonalPath(sourceX, sourceY, targetX, targetY);
  const openInsertModal = useStory((s) => s.openInsertModal);

  // Highlight ancestor chain of hovered node
  const isHighlighted = useStory((s) => {
    const anchor = s.selectedId;
    if (!anchor) return false;
    let cursor: string | null = anchor;
    while (cursor) {
      if (cursor === target) return true;
      cursor = s.nodes.get(cursor)?.parentId ?? null;
    }
    return false;
  });

  // Golden Path: canon edges get amber glow, highlighted edges get bright amber
  const stroke = isHighlighted
    ? "#e9c16b"
    : meta.canon
      ? "#e9c16b"  // Golden Path — amber for canon
      : meta.explored
        ? "#64748b"
        : "rgba(100,116,139,0.35)";
  const width = isHighlighted ? 2.8 : meta.canon ? 2.2 : meta.explored ? 1.3 : 1;
  const dash = isHighlighted || meta.canon || meta.explored ? undefined : "4 4";
  const filter = isHighlighted
    ? "drop-shadow(0 0 8px rgba(233,193,107,0.7)) drop-shadow(0 0 16px rgba(233,193,107,0.3))"
    : meta.canon
      ? "drop-shadow(0 0 6px rgba(233,193,107,0.5)) drop-shadow(0 0 12px rgba(233,193,107,0.2))"
      : undefined;

  // Button positions
  const spine = computeSpine(sourceX, targetX);
  const mx = (spine + RADIUS + targetX) / 2;
  const my = targetY;
  const tx = (sourceX + (spine - RADIUS)) / 2;
  const ty = sourceY;

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeWidth: width,
          strokeDasharray: dash,
          fill: "none",
          filter,
          transition: "stroke 0.16s ease, stroke-width 0.16s ease, filter 0.16s ease",
        }}
      />

      <EdgeLabelRenderer>
        {/* SPLICE — tactical bracket button between parent/child */}
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${mx}px, ${my}px)`,
            zIndex: 50,
            pointerEvents: "auto" as const,
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openInsertModal(source, target, "canon");
            }}
            style={styles.spliceBtn(!!meta.canon)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.08)";
              e.currentTarget.style.boxShadow = meta.canon
                ? "0 0 20px rgba(233,193,107,0.4), inset 0 1px 0 rgba(233,193,107,0.2)"
                : "0 0 18px rgba(79,195,247,0.4), inset 0 1px 0 rgba(79,195,247,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = meta.canon
                ? "0 0 14px rgba(233,193,107,0.25), inset 0 1px 0 rgba(233,193,107,0.15)"
                : "0 0 12px rgba(79,195,247,0.25), inset 0 1px 0 rgba(79,195,247,0.15)";
            }}
            title="Splice a moment between these two beats"
          >
            <Plus size={12} strokeWidth={2.8} />
            <span style={styles.labelTag}>splice</span>
          </button>
        </div>

        {/* FORK — tactical what-if sibling button */}
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px)`,
            zIndex: 49,
            pointerEvents: "auto" as const,
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openInsertModal(source, target, "what-if");
            }}
            style={styles.forkBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(233,193,107,0.8)";
              e.currentTarget.style.color = "#e9c16b";
              e.currentTarget.style.boxShadow = "0 0 18px rgba(233,193,107,0.35)";
              e.currentTarget.style.transform = "scale(1.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(233,193,107,0.4)";
              e.currentTarget.style.color = "rgba(233,193,107,0.7)";
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "scale(1)";
            }}
            title="Spawn a what-if fork on this branch"
          >
            <Plus size={11} strokeWidth={2.6} />
            <span style={styles.labelTag}>fork</span>
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const edgeTypes = { story: StoryEdge };

/*  ──────────────────────────────────────────────────────────────────────
 *  StoryEdge — bracket connector with arm/trunk + buttons
 *  Noustiny-style branching canvas, ported for OpenCorn
 *  Inline CSS only — no Tailwind, no framer-motion
 *  ────────────────────────────────────────────────────────────────────── */

import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { useStory } from "../lib/store";

const RADIUS = 9;
const SPINE_OFFSET = 95;

function computeSpine(sx: number, tx: number): number {
  const mid = (sx + tx) / 2;
  return Math.min(sx + SPINE_OFFSET, mid);
}

function bracketPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): string {
  const spine = computeSpine(sx, tx);
  const dy = ty - sy;
  if (Math.abs(dy) < 1) return `M ${sx},${sy} L ${tx},${ty}`;
  const sign = dy > 0 ? 1 : -1;
  const halfH = (tx - sx) / 2;
  const r = Math.max(1, Math.min(RADIUS, Math.abs(dy) / 2, halfH - 1));
  return [
    `M ${sx},${sy}`,
    `L ${spine - r},${sy}`,
    `Q ${spine},${sy} ${spine},${sy + sign * r}`,
    `L ${spine},${ty - sign * r}`,
    `Q ${spine},${ty} ${spine + r},${ty}`,
    `L ${tx},${ty}`,
  ].join(" ");
}

// Inline style objects
const styles = {
  plusBtn: (canon: boolean) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    cursor: "pointer",
    border: `1.5px solid ${canon ? "#e9c16b" : "#4fc3f7"}`,
    background: canon ? "rgba(10,13,18,0.95)" : "rgba(15,19,27,0.88)",
    color: canon ? "#e9c16b" : "#4fc3f7",
    boxShadow: canon
      ? "0 0 12px rgba(233,193,107,0.35)"
      : "0 0 10px rgba(79,195,247,0.35)",
    clipPath: "polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    outline: "none",
  }),
  trunkBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: "50%",
    cursor: "pointer",
    background: "rgba(15,19,27,0.88)",
    border: "1.2px dashed rgba(170,185,205,0.3)",
    color: "rgba(138,150,170,0.6)",
    backdropFilter: "blur(2px)",
    transition: "transform 0.18s ease, border 0.18s ease, color 0.18s ease, box-shadow 0.18s ease",
    outline: "none",
  },
  ghostLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: 8.5,
    textTransform: "uppercase" as const,
    letterSpacing: "0.32em",
  },
};

export function StoryEdge({
  source, target,
  sourceX, sourceY, targetX, targetY,
  data, markerEnd,
}: EdgeProps) {
  const meta = (data ?? {}) as { canon?: boolean; explored?: boolean };
  const path = bracketPath(sourceX, sourceY, targetX, targetY);
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

  const stroke = isHighlighted
    ? "#e9c16b"
    : meta.canon
      ? "#4fc3f7"
      : meta.explored
        ? "#64748b"
        : "rgba(100,116,139,0.4)";
  const width = isHighlighted ? 2.4 : meta.canon ? 1.9 : meta.explored ? 1.3 : 1;
  const dash = isHighlighted || meta.canon || meta.explored ? undefined : "4 4";
  const filter = isHighlighted
    ? "drop-shadow(0 0 7px rgba(233,193,107,0.6))"
    : meta.canon
      ? "drop-shadow(0 0 5px rgba(79,195,247,0.4))"
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
        {/* ARM + — canon splice between parent/child */}
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
            style={styles.plusBtn(!!meta.canon)}
            title="Splice a moment between these two beats"
          >
            <Plus size={15} strokeWidth={2.6} />
          </button>
        </div>

        {/* TRUNK + — what-if sibling on parent stub */}
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
            style={styles.trunkBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.border = "1.2px solid #e9c16b";
              e.currentTarget.style.color = "#e9c16b";
              e.currentTarget.style.boxShadow = "0 0 14px rgba(233,193,107,0.45)";
              e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.border = "1.2px dashed rgba(170,185,205,0.3)";
              e.currentTarget.style.color = "rgba(138,150,170,0.6)";
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "scale(1)";
            }}
            title="Spawn a what-if sibling on this branch"
          >
            <Plus size={13} strokeWidth={2.4} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const edgeTypes = { story: StoryEdge };

/*  ──────────────────────────────────────────────────────────────────────
 *  StoryEdge — Orthogonal 90° tactical connector
 *  Branching canvas edge: Golden Path, geometric buttons
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
    `L ${spine},${sy}`, // horizontal out from source
    `L ${spine},${ty}`, // vertical step
    `L ${tx},${ty}`, // horizontal into target
  ].join(" ");
}

// Inline style objects — tactical geometric buttons
const styles = {
  spliceBtn: (canon: boolean) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 42,
    height: 32,
    padding: "0 10px",
    cursor: "pointer",
    border: `2px solid ${canon ? "rgba(233,193,107,0.7)" : "rgba(79,195,247,0.45)"}`,
    background: canon
      ? "linear-gradient(180deg, rgba(233,193,107,0.22), rgba(233,193,107,0.08))"
      : "linear-gradient(180deg, rgba(79,195,247,0.15), rgba(79,195,247,0.06))",
    color: canon ? "#e9c16b" : "#4fc3f7",
    boxShadow: canon
      ? "0 0 16px rgba(233,193,107,0.35), inset 0 1px 0 rgba(233,193,107,0.2)"
      : "0 0 12px rgba(79,195,247,0.25), inset 0 1px 0 rgba(79,195,247,0.12)",
    // Geometric tactical clip-path (arrow-right)
    clipPath:
      "polygon(6px 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 6px 100%, 0 50%)",
    transition: "all 0.18s ease",
    outline: "none",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    backdropFilter: "blur(6px)",
  }),
  forkBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 46,
    height: 30,
    padding: "0 12px",
    cursor: "pointer",
    background:
      "linear-gradient(180deg, rgba(15,19,27,0.96), rgba(10,13,18,0.92))",
    border: "1.5px solid rgba(233,193,107,0.45)",
    color: "rgba(233,193,107,0.85)",
    backdropFilter: "blur(6px)",
    // Geometric tactical clip-path (diamond)
    clipPath:
      "polygon(0 0, 100% 0, calc(100% - 5px) 50%, 100% 100%, 0 100%, 5px 50%)",
    transition: "all 0.18s ease",
    outline: "none",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.24em",
    textTransform: "uppercase" as const,
  },
  labelTag: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.32em",
    opacity: 0.8,
  },
};

export function StoryEdge({
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerEnd,
}: EdgeProps) {
  const meta = (data ?? {}) as {
    canon?: boolean;
    explored?: boolean;
    active?: boolean;
  };
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

  const appearance = isHighlighted
    ? {
        rail: "rgba(8,11,16,0.96)",
        stroke: "#f1ca72",
        width: 4,
        dash: undefined,
        filter:
          "drop-shadow(0 0 8px rgba(233,193,107,0.7)) drop-shadow(0 0 16px rgba(233,193,107,0.3))",
      }
    : meta.canon
      ? {
          rail: "rgba(8,11,16,0.92)",
          stroke: "#e9c16b",
          width: 3.4,
          dash: undefined,
          filter:
            "drop-shadow(0 0 6px rgba(233,193,107,0.5)) drop-shadow(0 0 12px rgba(233,193,107,0.2))",
        }
      : meta.active
        ? {
            rail: "rgba(8,11,16,0.9)",
            stroke: "rgba(109,205,244,0.96)",
            width: 3.1,
            dash: undefined,
            filter: "drop-shadow(0 0 10px rgba(79,195,247,0.22))",
          }
        : meta.explored
          ? {
              rail: "rgba(8,11,16,0.88)",
              stroke: "rgba(138,160,187,0.92)",
              width: 2.6,
              dash: undefined,
              filter: undefined,
            }
          : {
              rail: "rgba(8,11,16,0.84)",
              stroke: "rgba(111,190,238,0.88)",
              width: 2.4,
              dash: "6 4",
              filter: undefined,
            };

  // Button positions
  const spine = computeSpine(sourceX, targetX);
  const mx = (spine + RADIUS + targetX) / 2;
  const my = targetY;

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: appearance.rail,
          strokeWidth: appearance.width + 2.4,
          strokeDasharray: appearance.dash,
          vectorEffect: "non-scaling-stroke",
          fill: "none",
          opacity: 0.95,
          transition:
            "stroke 0.16s ease, stroke-width 0.16s ease, opacity 0.16s ease",
        }}
      />

      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: appearance.stroke,
          strokeWidth: appearance.width,
          strokeDasharray: appearance.dash,
          vectorEffect: "non-scaling-stroke",
          fill: "none",
          filter: appearance.filter,
          transition:
            "stroke 0.16s ease, stroke-width 0.16s ease, filter 0.16s ease",
        }}
      />

      <EdgeLabelRenderer>
        {/* Insert — tactical bracket button between parent/child */}
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
            title="Insert a beat between these two nodes"
          >
            <Plus size={12} strokeWidth={2.8} />
            <span style={styles.labelTag}>insert</span>
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const edgeTypes = { story: StoryEdge };

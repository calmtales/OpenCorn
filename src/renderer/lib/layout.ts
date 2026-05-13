/*  ──────────────────────────────────────────────────────────────────────
 *  Horizontal tree layout for the branching canvas
 *  Ported for OpenCorn (inline CSS, no Tailwind)
 *  ────────────────────────────────────────────────────────────────────── */

import type { NodeVariant, StoryNode } from "./types";

/** Horizontal distance between columns. */
export const COL_WIDTH = 680;
export const V_GAP = 34;

export const STAGE_HEIGHT = 228;
export const CHECKPOINT_HEIGHT = 320;
export const COMPACT_HEIGHT = 132;
/** Ribbon midline offset from compact card top. */
export const COMPACT_RIBBON_Y = 80 + 4 + 19;
export const STAGE_WIDTH = 560;
export const CHECKPOINT_WIDTH = 480;
export const COMPACT_WIDTH = 272;

export function variantOf(
  n: Pick<StoryNode, "status" | "parentId" | "inserted" | "kind">,
): NodeVariant {
  if (n.kind === "writers-room-stage") return "stage";
  if (n.parentId === null) return "checkpoint";
  if (n.status === "generating" && n.inserted) return "compact";
  if (n.status === "current" || n.status === "generating") return "checkpoint";
  return "compact";
}

export function nodeHeight(n: StoryNode): number {
  const variant = variantOf(n);
  if (variant === "stage") return STAGE_HEIGHT;
  return variant === "checkpoint" ? CHECKPOINT_HEIGHT : COMPACT_HEIGHT;
}

export function nodeWidth(n: StoryNode): number {
  const variant = variantOf(n);
  if (variant === "stage") return STAGE_WIDTH;
  return variant === "checkpoint" ? CHECKPOINT_WIDTH : COMPACT_WIDTH;
}

/** Reserve full checkpoint height so promoting any node never collides. */
function reservedHeight(n: StoryNode): number {
  return variantOf(n) === "stage" ? STAGE_HEIGHT : CHECKPOINT_HEIGHT;
}

function subtreeHeight(id: string, nodes: Map<string, StoryNode>): number {
  const n = nodes.get(id);
  if (!n) return 0;
  const ownH = reservedHeight(n);
  if (n.childrenIds.length === 0) return ownH;
  const childrenTotal = n.childrenIds.reduce((sum, cid, i) => {
    return sum + subtreeHeight(cid, nodes) + (i > 0 ? V_GAP : 0);
  }, 0);
  return Math.max(ownH, childrenTotal);
}

function placeSubtree(
  id: string,
  nodes: Map<string, StoryNode>,
  yTop: number,
): void {
  const n = nodes.get(id);
  if (!n) return;
  const myH = subtreeHeight(id, nodes);

  if (n.childrenIds.length === 0) {
    n.y = yTop + myH / 2;
    return;
  }

  const childrenHeight = n.childrenIds.reduce((sum, cid, i) => {
    return sum + subtreeHeight(cid, nodes) + (i > 0 ? V_GAP : 0);
  }, 0);
  let cursor = yTop + (myH - childrenHeight) / 2;

  for (const cid of n.childrenIds) {
    const ch = subtreeHeight(cid, nodes);
    placeSubtree(cid, nodes, cursor);
    cursor += ch + V_GAP;
  }

  n.y = yTop + myH / 2;
}

export function layoutTree(
  nodes: Map<string, StoryNode>,
  rootId: string,
): void {
  const root = nodes.get(rootId);
  if (!root) return;
  placeSubtree(rootId, nodes, 0);
  nodes.forEach((n) => {
    n.x = n.depth * COL_WIDTH;
  });
}

export function canonPath(
  nodes: Map<string, StoryNode>,
  rootId: string,
  currentId?: string,
): string[] {
  let startId: string | null = null;
  if (currentId && nodes.has(currentId)) {
    startId = currentId;
  } else {
    const viaStatus = Array.from(nodes.values()).find(
      (n) => n.status === "current" || n.status === "generating",
    );
    startId = viaStatus?.id ?? rootId;
  }
  const path: string[] = [];
  let cursor: string | null = startId;
  while (cursor) {
    path.unshift(cursor);
    const n = nodes.get(cursor);
    cursor = n?.parentId ?? null;
  }
  return path;
}

/*  ──────────────────────────────────────────────────────────────────────
 *  Zustand store — Noustiny-style branching canvas state
 *  Simplified for OpenCorn (stripped save/load, scenes, media library)
 *  ────────────────────────────────────────────────────────────────────── */

import { create } from "zustand";
import type {
  AgentEvent,
  BranchSuggestion,
  Decider,
  IndustryMode,
  NodeStatus,
  RenderJob,
  StoryNode,
} from "./types";
import { canonPath, layoutTree } from "./layout";
import { imageUrl, seedFromString } from "./image";

type ViewMode = "landing" | "canvas";

// ---- helpers ----------------------------------------------------------------

const nextId = (() => {
  let n = 0;
  return (prefix = "n") =>
    `${prefix}-${Date.now().toString(36)}-${(n += 1).toString(36)}`;
})();

function buildRootTree(seed: string): Map<string, StoryNode> {
  const trimmed = (seed ?? "").trim() || DEMO_SEED;
  const firstSentence = trimmed.split(/(?<=[.!?])\s+/)[0]?.trim() ?? trimmed;
  const title =
    firstSentence.length <= 100
      ? firstSentence || "Opening beat"
      : firstSentence.slice(0, 100).replace(/\s+\S*$/, "") + "…";
  const imagePrompt = trimmed.slice(0, 300);

  const map = new Map<string, StoryNode>();
  map.set("root", {
    id: "root",
    parentId: null,
    childrenIds: [],
    depth: 0,
    title,
    summary: trimmed.slice(0, 180),
    body: trimmed,
    imagePrompt,
    imageUrl: imageUrl({
      prompt: imagePrompt,
      seed: seedFromString("root" + title),
    }),
    mood: "neutral",
    tone: "canon",
    status: "current",
    decidedBy: "human",
    staleState: "fresh",
    x: 0,
    y: 0,
  });
  return map;
}

export const DEMO_SEED =
  "Tony Stark stands on the Avengers compound battlefield, the Infinity Gauntlet in his hand — every possible ending hinges on what he chooses to do next.";

function relayoutAndRecompute(
  nodes: Map<string, StoryNode>,
  rootId: string,
  currentId: string,
): void {
  const canonSet = new Set<string>();
  let cursor: string | null = currentId;
  while (cursor) {
    canonSet.add(cursor);
    const n = nodes.get(cursor);
    cursor = n?.parentId ?? null;
  }
  nodes.forEach((n) => {
    if (n.id === currentId) {
      n.status = "current";
    } else if (canonSet.has(n.id)) {
      n.status = "canon";
    } else if (n.status === "current" || n.status === "canon") {
      n.status = "visited";
    }
  });
  layoutTree(nodes, rootId);
}

function collectDescendants(
  start: string,
  nodes: Map<string, StoryNode>,
): string[] {
  const out: string[] = [];
  const stack = [...(nodes.get(start)?.childrenIds ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    const n = nodes.get(id);
    if (n) stack.push(...n.childrenIds);
  }
  return out;
}

// ---- store types ------------------------------------------------------------

interface InsertEdgeContext {
  parentId: string;
  childId: string;
  mode?: "canon" | "what-if";
}

interface StoreState {
  mode: ViewMode;
  seed: string;
  rootId: string;
  nodes: Map<string, StoryNode>;
  currentId: string;
  selectedId: string | null;
  storybookEndpointId: string | null;
  renderJobs: RenderJob[];
  agents: AgentEvent[];
  industryMode: IndustryMode;
  characters: Record<string, string>;
  characterRefs: Record<string, string>;
  mergeCharacters: (entries: Record<string, string>) => void;
  insertContext: InsertEdgeContext | null;
  autoAsk: boolean;
  pendingAutoExpand: boolean;

  // actions
  enterCanvas: (seed: string) => void;
  resetToLanding: () => void;
  setCurrent: (nodeId: string, decidedBy?: Decider, agentName?: string) => void;
  setSelected: (nodeId: string | null) => void;
  openInsertModal: (parentId: string, childId: string, mode?: "canon" | "what-if") => void;
  closeInsertModal: () => void;

  addBranches: (
    parentId: string,
    branches: Omit<
      StoryNode,
      "id" | "x" | "y" | "childrenIds" | "parentId" | "depth" | "status" | "decidedBy" | "staleState"
    >[],
    decidedBy?: Decider,
    agentName?: string,
    question?: string,
  ) => string[];

  insertBetween: (
    parentId: string,
    childId: string,
    branch: BranchSuggestion,
    mode: "canon" | "what-if",
    decidedBy: Decider,
    agentName?: string,
  ) => string | null;

  applyRewrite: (
    nodeId: string,
    patch: Partial<StoryNode>,
    agentName: string,
    reason: string,
  ) => void;

  patchNodeProse: (
    nodeId: string,
    patch: { body?: string; summary?: string; rawBrainstorm?: string; renderedImagePrompt?: string },
  ) => void;

  setNodeImage: (nodeId: string, url: string) => void;
  removeInserted: (nodeId: string) => void;
  markGenerating: (nodeId: string, on: boolean) => void;

  appendAgent: (ev: AgentEvent) => void;
  updateAgent: (id: string, patch: Partial<AgentEvent>) => void;
  clearAgents: () => void;

  addRenderJob: (job: RenderJob) => void;
  updateRenderJob: (id: string, patch: Partial<RenderJob>) => void;
  removeRenderJob: (id: string) => void;

  consumePendingAutoExpand: () => boolean;
}

// ---- create store -----------------------------------------------------------

function freshTree(seed: string): { nodes: Map<string, StoryNode>; rootId: string } {
  const map = buildRootTree(seed);
  layoutTree(map, "root");
  return { nodes: map, rootId: "root" };
}

export const useStory = create<StoreState>()((set, get) => {
  const initial = freshTree(DEMO_SEED);
  return {
    mode: "landing",
    seed: DEMO_SEED,
    rootId: initial.rootId,
    nodes: initial.nodes,
    currentId: "root",
    selectedId: null,
    storybookEndpointId: null,
    renderJobs: [],
    agents: [],
    industryMode: "filmmaking",
    characters: {},
    characterRefs: {},
    insertContext: null,
    autoAsk: true,
    pendingAutoExpand: false,

    consumePendingAutoExpand: () => {
      const was = get().pendingAutoExpand;
      if (was) set({ pendingAutoExpand: false });
      return was;
    },

    enterCanvas: (seed) =>
      set((s) => {
        if (!seed.trim() || seed.trim() === s.seed) {
          return { mode: "canvas", seed };
        }
        const fresh = freshTree(seed);
        return {
          mode: "canvas",
          seed,
          rootId: fresh.rootId,
          nodes: fresh.nodes,
          currentId: "root",
          agents: [],
          characters: {},
          characterRefs: {},
          pendingAutoExpand: true,
        };
      }),

    resetToLanding: () =>
      set((s) => {
        const fresh = freshTree(s.seed);
        return {
          mode: "landing",
          rootId: fresh.rootId,
          nodes: fresh.nodes,
          currentId: "root",
          selectedId: null,
          storybookEndpointId: null,
          renderJobs: [],
          agents: [],
          characters: {},
          characterRefs: {},
          pendingAutoExpand: false,
        };
      }),

    setCurrent: (nodeId, decidedBy = "human", agentName) =>
      set((s) => {
        const target = s.nodes.get(nodeId);
        if (!target) return {};
        const next = new Map(s.nodes);
        const patched = { ...target, decidedBy, decidedByAgent: agentName };
        next.set(nodeId, patched);
        relayoutAndRecompute(next, s.rootId, nodeId);
        return { currentId: nodeId, nodes: next, selectedId: nodeId };
      }),

    setSelected: (nodeId) => set({ selectedId: nodeId }),

    openInsertModal: (parentId, childId, mode) =>
      set({ insertContext: { parentId, childId, mode } }),

    closeInsertModal: () => set({ insertContext: null }),

    addBranches: (parentId, branches, decidedBy = "agent", agentName = "hermes-brainstorm", question) => {
      const newIds: string[] = [];
      set((s) => {
        const parent = s.nodes.get(parentId);
        if (!parent) return {};
        const next = new Map(s.nodes);
        branches.forEach((b) => {
          const id = nextId("b");
          newIds.push(id);
          next.set(id, {
            ...b,
            id,
            parentId,
            childrenIds: [],
            depth: parent.depth + 1,
            status: "unvisited" as NodeStatus,
            decidedBy,
            staleState: "fresh",
            x: 0,
            y: 0,
          });
        });
        const patchedParent: StoryNode = question
          ? { ...parent, childrenIds: [...parent.childrenIds, ...newIds], question }
          : { ...parent, childrenIds: [...parent.childrenIds, ...newIds] };
        next.set(parentId, patchedParent);
        relayoutAndRecompute(next, s.rootId, s.currentId);
        return { nodes: next };
      });
      return newIds;
    },

    insertBetween: (parentId, childId, branch, mode, decidedBy, agentName) => {
      let createdId: string | null = null;
      set((s) => {
        const parent = s.nodes.get(parentId);
        const child = s.nodes.get(childId);
        if (!parent || !child) return {};
        if (!parent.childrenIds.includes(childId)) return {};

        const next = new Map(s.nodes);
        const newId = nextId("ins");
        createdId = newId;
        const insertedDepth = parent.depth + 1;

        if (mode === "canon") {
          next.set(newId, {
            id: newId,
            parentId,
            childrenIds: [childId],
            depth: insertedDepth,
            title: branch.title.slice(0, 200),
            summary: branch.summary.slice(0, 400),
            body: branch.body,
            imagePrompt: branch.imagePrompt,
            imageUrl: imageUrl({
              prompt: branch.imagePrompt,
              seed: seedFromString(newId + branch.title),
            }),
            mood: branch.mood,
            tone: branch.tone,
            status: "canon",
            decidedBy,
            inserted: true,
            staleState: "fresh",
            x: 0,
            y: 0,
          });
          next.set(parentId, {
            ...parent,
            childrenIds: parent.childrenIds.map((id) =>
              id === childId ? newId : id,
            ),
          });
          next.set(childId, { ...child, parentId: newId });
          const allDownstream = [childId, ...collectDescendants(childId, next)];
          allDownstream.forEach((id) => {
            const n = next.get(id);
            if (!n) return;
            next.set(id, {
              ...n,
              depth: n.depth + 1,
              staleState: "stale" as const,
              insertCauseId: newId,
              originalBody: n.originalBody ?? n.body,
              originalTitle: n.originalTitle ?? n.title,
              originalSummary: n.originalSummary ?? n.summary,
              originalImagePrompt: n.originalImagePrompt ?? n.imagePrompt,
              originalImageUrl: n.originalImageUrl ?? n.imageUrl,
            });
          });
        } else {
          next.set(newId, {
            id: newId,
            parentId,
            childrenIds: [],
            depth: insertedDepth,
            title: branch.title.slice(0, 200),
            summary: branch.summary.slice(0, 400),
            body: branch.body,
            imagePrompt: branch.imagePrompt,
            imageUrl: imageUrl({
              prompt: branch.imagePrompt,
              seed: seedFromString(newId + branch.title),
            }),
            mood: branch.mood,
            tone: "what-if",
            status: "unvisited",
            decidedBy,
            inserted: true,
            staleState: "fresh",
            x: 0,
            y: 0,
          });
          next.set(parentId, {
            ...parent,
            childrenIds: [...parent.childrenIds, newId],
          });
        }

        relayoutAndRecompute(next, s.rootId, s.currentId);
        return { nodes: next, insertContext: null };
      });
      return createdId;
    },

    applyRewrite: (nodeId, patch, agentName, reason) =>
      set((s) => {
        const n = s.nodes.get(nodeId);
        if (!n) return {};
        const next = new Map(s.nodes);
        const titleChanged = patch.title !== undefined && patch.title !== n.title;
        const merged: StoryNode = {
          ...n,
          ...patch,
          originalTitle: n.originalTitle ?? n.title,
          originalSummary: n.originalSummary ?? n.summary,
          originalBody: n.originalBody ?? n.body,
          originalImagePrompt: n.originalImagePrompt ?? n.imagePrompt,
          originalImageUrl: n.originalImageUrl ?? n.imageUrl,
          label: titleChanged ? undefined : n.label,
          staleState: "rewritten",
          decidedBy: "agent",
        };
        if (patch.imagePrompt && patch.imagePrompt !== n.imagePrompt) {
          merged.imageUrl = imageUrl({
            prompt: patch.imagePrompt,
            seed: seedFromString(nodeId + patch.imagePrompt),
          });
        }
        next.set(nodeId, merged);
        return { nodes: next };
      }),

    patchNodeProse: (nodeId, patch) =>
      set((s) => {
        const n = s.nodes.get(nodeId);
        if (!n) return {};
        const next = new Map(s.nodes);
        next.set(nodeId, {
          ...n,
          ...(patch.body !== undefined ? { body: patch.body } : {}),
          ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
          ...(patch.rawBrainstorm !== undefined ? { rawBrainstorm: patch.rawBrainstorm } : {}),
          ...(patch.renderedImagePrompt !== undefined ? { renderedImagePrompt: patch.renderedImagePrompt } : {}),
        });
        return { nodes: next };
      }),

    setNodeImage: (nodeId, url) =>
      set((s) => {
        const n = s.nodes.get(nodeId);
        if (!n) return {};
        if (n.imageUrl === url) return {};
        const next = new Map(s.nodes);
        next.set(nodeId, { ...n, imageUrl: url });
        return { nodes: next };
      }),

    removeInserted: (nodeId) =>
      set((s) => {
        const node = s.nodes.get(nodeId);
        if (!node || !node.inserted) return {};
        if (!node.parentId) return {};
        const parent = s.nodes.get(node.parentId);
        if (!parent) return {};
        const next = new Map(s.nodes);
        const originalChildren = node.childrenIds;
        next.set(node.parentId, {
          ...parent,
          childrenIds: parent.childrenIds.flatMap((id) =>
            id === nodeId ? originalChildren : [id],
          ),
        });
        originalChildren.forEach((cid) => {
          const c = next.get(cid);
          if (!c) return;
          const descendants = [cid, ...collectDescendants(cid, next)];
          descendants.forEach((id) => {
            const d = next.get(id);
            if (!d) return;
            const restored = { ...d, depth: d.depth - 1 };
            if (id === cid) restored.parentId = node.parentId;
            restored.staleState = "fresh" as const;
            delete restored.originalTitle;
            delete restored.originalSummary;
            delete restored.originalBody;
            delete restored.originalImagePrompt;
            delete restored.originalImageUrl;
            delete restored.insertCauseId;
            next.set(id, restored);
          });
        });
        next.delete(nodeId);
        relayoutAndRecompute(next, s.rootId, s.currentId);
        return { nodes: next };
      }),

    markGenerating: (nodeId, on) =>
      set((s) => {
        const n = s.nodes.get(nodeId);
        if (!n) return {};
        const next = new Map(s.nodes);
        if (on) {
          next.set(nodeId, { ...n, status: "generating" });
          return { nodes: next };
        }
        relayoutAndRecompute(next, s.rootId, s.currentId);
        return { nodes: next };
      }),

    mergeCharacters: (entries) =>
      set((s) => ({ characters: { ...s.characters, ...entries } })),

    appendAgent: (ev) =>
      set((s) => ({ agents: [...s.agents.slice(-19), ev] })),

    updateAgent: (id, patch) =>
      set((s) => ({
        agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      })),

    clearAgents: () => set({ agents: [] }),

    addRenderJob: (job) =>
      set((s) => ({ renderJobs: [...s.renderJobs, job] })),

    updateRenderJob: (id, patch) =>
      set((s) => ({
        renderJobs: s.renderJobs.map((j) =>
          j.id === id ? { ...j, ...patch } : j,
        ),
      })),

    removeRenderJob: (id) =>
      set((s) => ({
        renderJobs: s.renderJobs.filter((j) => j.id !== id),
      })),
  };
});

// Derived selectors
export const selectCanonPath = (s: StoreState): string[] =>
  canonPath(s.nodes, s.rootId, s.currentId);

export const selectCurrentNode = (s: StoreState): StoryNode | undefined =>
  s.nodes.get(s.currentId);

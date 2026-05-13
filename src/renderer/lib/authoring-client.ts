/*  ──────────────────────────────────────────────────────────────────────
 *  Owned authoring client — renderer helpers for branching narrative flows.
 *
 *  Brainstorm, writer assist, continuity repair, policy detection,
 *  and character sheet generation now route through OpenCorn RPC into
 *  the owned stoira-mcp backend.
 *  ────────────────────────────────────────────────────────────────────── */

import { useStory, modeStylePrefix, modeLabels, modeRenderType } from "./store";
import type {
  AuthoringBrainstormResult,
  AuthoringBranchOption,
  ProductionLayer,
} from "../../shared/types";
import type {
  AgentEvent,
  AgentId,
  BranchSuggestion,
  IndustryMode,
  NodeMood,
  NodeTone,
  StoryNode,
} from "./types";

// ---- helpers ----------------------------------------------------------------

const tickerId = (() => {
  let n = 0;
  return () => `t-${Date.now().toString(36)}-${n++}`;
})();

function agentEvent(
  agent: AgentId,
  label: string,
  model = "deepseek-v4-flash",
): AgentEvent {
  return {
    id: tickerId(),
    agent,
    model,
    label,
    text: "",
    status: "thinking",
    startedAt: Date.now(),
  };
}

const MOODS: NodeMood[] = [
  "neutral",
  "hopeful",
  "tense",
  "danger",
  "climax",
  "quiet",
  "discovery",
];
const TONES: NodeTone[] = ["canon", "divergent", "what-if"];

function validateMood(m: string): NodeMood {
  return (MOODS as string[]).includes(m) ? (m as NodeMood) : "neutral";
}
function validateTone(m: string): NodeTone {
  return (TONES as string[]).includes(m) ? (m as NodeTone) : "divergent";
}

function canonTitlesUpTo(nodeId: string): string[] {
  const s = useStory.getState();
  const titles: string[] = [];
  let cursor: string | null = s.rootId;
  while (cursor) {
    const n = s.nodes.get(cursor);
    if (!n) break;
    titles.push(n.title);
    if (cursor === nodeId) break;
    const next =
      n.childrenIds.find((id) => s.nodes.get(id)?.status === "current") ??
      n.childrenIds.find((id) => s.nodes.get(id)?.status === "canon") ??
      null;
    cursor = next;
  }
  return titles;
}

function isAbortError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

/**
 * Depth-first walk of all downstream node IDs from a given node.
 */
function collectDownstream(
  startId: string,
  nodes: Map<string, StoryNode>,
): string[] {
  const result: string[] = [];
  function walk(id: string) {
    const n = nodes.get(id);
    if (!n) return;
    for (const childId of n.childrenIds) {
      result.push(childId);
      walk(childId);
    }
  }
  walk(startId);
  return result;
}

// ---- expandNode (brainstorm) ------------------------------------------------

const inflightExpand = new Set<string>();

export async function expandNode(
  nodeId: string,
  branchCount = 3,
  opts: { force?: boolean; productionLayer?: ProductionLayer } = {},
): Promise<void> {
  if (inflightExpand.has(nodeId)) return;
  inflightExpand.add(nodeId);
  const store = useStory.getState();
  const node = store.nodes.get(nodeId);
  if (!node) {
    inflightExpand.delete(nodeId);
    return;
  }
  if (!opts.force && node.childrenIds.length > 0) {
    inflightExpand.delete(nodeId);
    return;
  }

  const canonTitles = canonTitlesUpTo(nodeId);
  const labels = modeLabels(store.industryMode);
  const ev = agentEvent(
    "brainstorm",
    `BRAINSTORM · ${labels.forkVerb} "${node.title}"`,
  );
  store.appendAgent({ ...ev, status: "streaming" });
  store.beginBranchGeneration(nodeId);
  const isShell = !node.title;
  if (isShell) store.markGenerating(nodeId, true);

  try {
    const rpc = (window as any).__electrobun_rpc;
    const canonBeats = canonTitles.map((title) => ({ title, body: "" }));
    const focusBody = node.body ?? node.summary ?? "";

    const brainstorm: AuthoringBrainstormResult =
      await rpc.request.authoringBrainstorm({
        workflowId: store.workflowId ?? undefined,
        industryMode: store.industryMode,
        seed: store.seed,
        canonBeats,
        focusBeat: { title: node.title, body: focusBody, mood: node.mood },
        branchCount,
        productionLayer: opts.productionLayer,
      });

    if (brainstorm?.workflowId && brainstorm.workflowId !== store.workflowId) {
      store.setWorkflowId(brainstorm.workflowId);
    }

    const options: AuthoringBranchOption[] = Array.isArray(brainstorm?.options)
      ? brainstorm.options
      : [];
    const raw = JSON.stringify(brainstorm, null, 2);

    store.updateAgent(ev.id, {
      status: "streaming",
      text: `registering context${brainstorm?.motifsTop?.length ? ` · motifs: ${brainstorm.motifsTop.join(", ")}` : ""}`,
    });

    if (options.length === 0) {
      store.updateAgent(ev.id, {
        status: "done",
        text: "Story arc resolved — no further branches.",
      });
      return;
    }

    store.updateAgent(ev.id, {
      status: "done",
      text: options.map((o) => `• ${o.label}`).join("\n"),
    });

    store.patchNodeProse(nodeId, { rawBrainstorm: raw });

    const styleSuffix = modeStylePrefix(store.industryMode);
    const prepared = options.map((o) => {
      const rawTitle =
        o.label.slice(0, 400) || (o.summary.split(/[.!?]/)[0] ?? "").trim();
      const title =
        rawTitle.length <= 100
          ? rawTitle
          : rawTitle.slice(0, 100).replace(/\s+\S*$/, "") + "…";
      const summary = o.summary.slice(0, 600);
      const prompt = summary || title || node.imagePrompt;
      return {
        title,
        summary,
        body: summary,
        imagePrompt: prompt,
        imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ", " + styleSuffix)}?width=480&height=300&seed=${Date.now()}&model=flux&nologo=true`,
        mood: "neutral" as const,
        tone: "divergent" as const,
      };
    });
    store.addBranches(nodeId, prepared, "agent", "brainstorm");
  } catch (err) {
    if (isAbortError(err)) return;
    const message = err instanceof Error ? err.message : "unknown error";
    store.updateAgent(ev.id, { status: "error", text: message });
  } finally {
    if (isShell) store.markGenerating(nodeId, false);
    store.endBranchGeneration(nodeId);
    inflightExpand.delete(nodeId);
  }
}

// ---- writer-assist ----------------------------------------------------------

const inflightAssist = new Set<string>();

export async function writerAssist(args: {
  parentId: string;
  childId: string;
  intent: string;
  mode: "canon" | "what-if";
}): Promise<BranchSuggestion | null> {
  const key = `${args.parentId}→${args.childId}`;
  if (inflightAssist.has(key)) return null;
  inflightAssist.add(key);

  const store = useStory.getState();
  const parent = store.nodes.get(args.parentId);
  const child = store.nodes.get(args.childId);
  if (!parent || !child) {
    inflightAssist.delete(key);
    return null;
  }

  const assistLabels = modeLabels(store.industryMode);
  const ev = agentEvent(
    "writer-assist",
    `WRITER-ASSIST · ${assistLabels.beat} "${args.intent.slice(0, 40)}…"`,
  );
  store.appendAgent(ev);

  try {
    const rpc = (window as any).__electrobun_rpc;
    store.updateAgent(ev.id, {
      status: "streaming",
      text: "drafting inserted beat…",
    });
    const data = await rpc.request.authoringWriterAssist({
      workflowId: store.workflowId ?? undefined,
      seed: store.seed,
      canonTitles: canonTitlesUpTo(args.parentId),
      parentTitle: parent.title,
      childTitle: child.title,
      intent: args.intent,
      mode: args.mode,
    });

    store.updateAgent(ev.id, { status: "done", text: `→ ${data.title}` });
    return {
      title: (data.title ?? "UNTITLED").slice(0, 200),
      summary: (data.summary ?? "").slice(0, 400),
      body: (data.body ?? "").slice(0, 900),
      imagePrompt: data.imagePrompt ?? data.summary ?? "",
      mood: validateMood(data.mood),
      tone: validateTone(data.tone),
    };
  } catch (err) {
    if (isAbortError(err)) return null;
    const message = err instanceof Error ? err.message : "writer-assist error";
    store.updateAgent(ev.id, { status: "error", text: message });
    return null;
  } finally {
    inflightAssist.delete(key);
  }
}

// ---- reharmonize chain (critic → rewriter → judge) --------------------------

const inflightReharmonize = new Set<string>();

export async function reharmonize({
  insertedNodeId,
}: {
  insertedNodeId: string;
}): Promise<void> {
  return reharmonizeChain(insertedNodeId);
}

export async function reharmonizeChain(insertId: string): Promise<void> {
  if (inflightReharmonize.has(insertId)) return;
  inflightReharmonize.add(insertId);

  const store = useStory.getState();
  const insertNode = store.nodes.get(insertId);
  if (!insertNode) {
    inflightReharmonize.delete(insertId);
    return;
  }

  const ev = agentEvent(
    "director",
    `REHARMONIZE · cascading from "${insertNode.title.slice(0, 40)}"`,
  );
  store.appendAgent(ev);

  try {
    const downstream = collectDownstream(insertId, store.nodes);
    if (downstream.length === 0) {
      store.updateAgent(ev.id, {
        status: "done",
        text: "No downstream nodes to reharmonize.",
      });
      return;
    }
    const rpc = (window as any).__electrobun_rpc;
    const downstreamBeats = downstream
      .map((nodeId) => {
        const node = useStory.getState().nodes.get(nodeId);
        if (!node) return null;
        return {
          nodeId,
          title: node.title,
          body: node.body ?? node.summary ?? "",
        };
      })
      .filter(Boolean);

    const result = await rpc.request.reharmonizeStory({
      insertedBeat: {
        title: insertNode.title,
        body: insertNode.body ?? insertNode.summary ?? "",
      },
      downstreamBeats,
    });

    let rewritten = 0;
    for (const rewrite of result.rewrites ?? []) {
      if (!rewrite?.nodeId) continue;
      useStory.getState().applyRewrite(
        rewrite.nodeId,
        {
          title: rewrite.title.slice(0, 200),
          summary: rewrite.summary.slice(0, 400),
          body: rewrite.body,
          imagePrompt: rewrite.imagePrompt ?? rewrite.summary,
          mood: validateMood(rewrite.mood ?? "neutral"),
        },
        "reharmonize",
        rewrite.reason ?? "continuity realignment",
      );
      rewritten++;
    }

    store.updateAgent(ev.id, {
      status: "done",
      text: `Reharmonized ${downstream.length} nodes · ${rewritten} rewritten`,
    });
  } catch (err) {
    if (isAbortError(err)) return;
    store.updateAgent(ev.id, {
      status: "error",
      text: (err as Error).message,
    });
  } finally {
    inflightReharmonize.delete(insertId);
  }
}

// ---- image generation -------------------------------------------------------

const inflightImage = new Set<string>();

export async function generateNodeImage(
  nodeId: string,
  prompt: string,
): Promise<void> {
  if (inflightImage.has(nodeId)) return;
  inflightImage.add(nodeId);
  const store = useStory.getState();
  const node = store.nodes.get(nodeId);
  if (!node) {
    inflightImage.delete(nodeId);
    return;
  }

  const ev = agentEvent("writer", `IMAGE · "${node.title.slice(0, 40)}"`);
  store.appendAgent({ ...ev, status: "streaming" });

  try {
    const imgStyleSuffix = modeStylePrefix(store.industryMode);
    const render = modeRenderType(store.industryMode);
    // Use Pollinations directly — no Hermes skill needed for image gen
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt.slice(0, 400) + ", " + imgStyleSuffix,
    )}?width=480&height=300&seed=${Date.now()}&model=flux&nologo=true`;

    useStory.getState().setNodeImage(nodeId, url);
    store.updateAgent(ev.id, { status: "done", text: "image cached" });
  } catch {
    // swallow — placeholder stays
  } finally {
    inflightImage.delete(nodeId);
  }
}

// ---- copyright detection ----------------------------------------------------

export async function detectStoryPolicy(seed: string): Promise<void> {
  const store = useStory.getState();
  const ev = agentEvent(
    "copyright-detector",
    `COPYRIGHT-DETECTOR · scanning seed`,
  );
  store.appendAgent({ ...ev, status: "streaming" });

  try {
    const rpc = (window as any).__electrobun_rpc;
    const data = await rpc.request.detectStoryPolicy({ seed });
    store.updateAgent(ev.id, {
      status: "done",
      text:
        data.reason ??
        `IP: ${data.ipLevel ?? "unknown"} · ${data.modelPreference ?? "default"}`,
    });
  } catch {
    store.updateAgent(ev.id, { status: "done", text: "detection skipped" });
  }
}

// ---- character sheet --------------------------------------------------------

export async function generateCharacterSheet(seed: string): Promise<void> {
  const store = useStory.getState();
  const ev = agentEvent("character-sheet", "CAST-SHEET · building principals");
  store.appendAgent({ ...ev, status: "streaming" });

  try {
    const rpc = (window as any).__electrobun_rpc;
    store.updateAgent(ev.id, {
      status: "streaming",
      text: "building principal cast…",
    });
    const { entries } = await rpc.request.generateCharacterSheet({
      seed,
      franchise: null,
      allowIpNames: false,
    });

    if (!Array.isArray(entries) || entries.length === 0) {
      store.updateAgent(ev.id, {
        status: "done",
        text: "no characters detected",
      });
      return;
    }

    const descriptions: Record<string, string> = {};
    for (const e of entries) descriptions[e.name] = e.description;
    store.mergeCharacters(descriptions);
    store.updateAgent(ev.id, {
      status: "done",
      text: entries.map((e) => `• ${e.name}`).join("\n"),
    });
  } catch {
    store.updateAgent(ev.id, {
      status: "error",
      text: "character-sheet error",
    });
  }
}

// ---- brainstorm text parser -------------------------------------------------

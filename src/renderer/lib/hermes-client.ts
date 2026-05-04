/*  ──────────────────────────────────────────────────────────────────────
 *  Hermes Gateway client — HTTP calls to the narrative-brainstorm,
 *  writer-assist, critic/rewriter/judge cascade, image gen, copyright
 *  detection, and character sheet generation.
 *
 *  Simplified for OpenCorn Phase 3 — stubs that emit agent events and
 *  call /api/hermes on the Hermes gateway. Replace with real endpoints
 *  when the backend is wired up.
 *  ────────────────────────────────────────────────────────────────────── */

import { useStory, modeStylePrefix, modeLabels, modeRenderType } from "./store";
import type { AgentEvent, AgentId, BranchSuggestion, IndustryMode, NodeMood, NodeTone } from "./types";

// ---- helpers ----------------------------------------------------------------

const tickerId = (() => {
  let n = 0;
  return () => `t-${Date.now().toString(36)}-${n++}`;
})();

function agentEvent(
  agent: AgentId,
  label: string,
  model = "gemini-2.5-flash",
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
  "neutral", "hopeful", "tense", "danger", "climax", "quiet", "discovery",
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

// ---- expandNode (brainstorm) ------------------------------------------------

const inflightExpand = new Set<string>();

export async function expandNode(
  nodeId: string,
  branchCount = 3,
  opts: { force?: boolean } = {},
): Promise<void> {
  if (inflightExpand.has(nodeId)) return;
  inflightExpand.add(nodeId);
  const store = useStory.getState();
  const node = store.nodes.get(nodeId);
  if (!node) { inflightExpand.delete(nodeId); return; }
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
  const isShell = !node.title;
  if (isShell) store.markGenerating(nodeId, true);

  try {
    const res = await fetch("/api/hermes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "brainstorm",
        seed: store.seed,
        canonTitles,
        focusTitle: node.title,
        focusBody: node.body ?? node.summary,
        focusMood: node.mood,
        branches: branchCount,
        industryMode: store.industryMode,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      store.updateAgent(ev.id, { status: "error", text: text.slice(0, 240) });
      return;
    }

    const raw = await consumeStream(res, ev.id);
    const { options } = parseBrainstormText(raw);

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
      const rawTitle = o.label.slice(0, 400) || (o.summary.split(/[.!?]/)[0] ?? "").trim();
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
    store.addBranches(nodeId, prepared, "agent", "hermes-brainstorm");
  } catch (err) {
    if (isAbortError(err)) return;
    const message = err instanceof Error ? err.message : "unknown error";
    store.updateAgent(ev.id, { status: "error", text: message });
  } finally {
    if (isShell) store.markGenerating(nodeId, false);
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
  if (!parent || !child) { inflightAssist.delete(key); return null; }

  const assistLabels = modeLabels(store.industryMode);
  const ev = agentEvent("writer-assist", `WRITER-ASSIST · ${assistLabels.beat} "${args.intent.slice(0, 40)}…"`);
  store.appendAgent(ev);

  try {
    const res = await fetch("/api/hermes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "writer-assist",
        seed: store.seed,
        canonTitles: canonTitlesUpTo(args.parentId),
        parentTitle: parent.title,
        childTitle: child.title,
        intent: args.intent,
        mode: args.mode,
        industryMode: store.industryMode,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      store.updateAgent(ev.id, { status: "error", text: text.slice(0, 240) });
      return null;
    }
    const raw = await consumeStream(res, ev.id);
    const data = parseJsonSafe(raw) as {
      title: string; summary: string; body: string;
      imagePrompt: string; mood: string; tone: string;
    };
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

// ---- reharmonize (critic → rewriter → judge) --------------------------------

const inflightReharmonize = new Set<string>();

export async function reharmonize({
  insertedNodeId,
}: { insertedNodeId: string }): Promise<void> {
  if (inflightReharmonize.has(insertedNodeId)) return;
  inflightReharmonize.add(insertedNodeId);

  const store = useStory.getState();
  const ev = agentEvent("director", `REHARMONIZE · cascading from "${insertedNodeId}"`);
  store.appendAgent(ev);

  try {
    const res = await fetch("/api/hermes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "reharmonize", insertedNodeId }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      store.updateAgent(ev.id, { status: "error", text: text.slice(0, 240) });
      return;
    }
    store.updateAgent(ev.id, { status: "done", text: "Reharmonize complete" });
  } catch (err) {
    if (isAbortError(err)) return;
    store.updateAgent(ev.id, { status: "error", text: (err as Error).message });
  } finally {
    inflightReharmonize.delete(insertedNodeId);
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
  if (!node) { inflightImage.delete(nodeId); return; }

  const ev = agentEvent("writer", `IMAGE · "${node.title.slice(0, 40)}"`);
  store.appendAgent({ ...ev, status: "streaming" });

  try {
    const render = modeRenderType(store.industryMode);
    const imgStyleSuffix = modeStylePrefix(store.industryMode);
    const res = await fetch("/api/hermes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "image-gen",
        prompt: prompt.slice(0, 400) + ", " + imgStyleSuffix,
        style: store.industryMode,
        aspect: render.aspectRatio,
      }),
    });
    if (!res.ok) {
      store.updateAgent(ev.id, { status: "error", text: "image gen failed" });
      return;
    }
    const data = (await res.json()) as { url?: string };
    if (data.url) {
      useStory.getState().setNodeImage(nodeId, data.url);
      store.updateAgent(ev.id, { status: "done", text: "image cached" });
    } else {
      store.updateAgent(ev.id, { status: "error", text: "no image returned" });
    }
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
    const res = await fetch("/api/hermes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "copyright-detect", seed }),
    });
    if (!res.ok) {
      store.updateAgent(ev.id, { status: "done", text: "detection skipped" });
      return;
    }
    store.updateAgent(ev.id, { status: "done", text: "detection complete" });
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
    const res = await fetch("/api/hermes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "character-sheet", seed }),
    });
    if (!res.ok) {
      store.updateAgent(ev.id, { status: "error", text: "skill call failed" });
      return;
    }
    const data = (await res.json()) as {
      characters?: { name: string; description: string }[];
    };
    const entries = data.characters ?? [];
    if (entries.length === 0) {
      store.updateAgent(ev.id, { status: "done", text: "no characters detected" });
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
    store.updateAgent(ev.id, { status: "error", text: "character-sheet error" });
  }
}

// ---- stream consumer --------------------------------------------------------

async function consumeStream(
  res: Response,
  agentId: string,
): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let acc = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
      useStory.getState().updateAgent(agentId, { status: "streaming", text: acc });
    }
  } finally {
    useStory.getState().updateAgent(agentId, { status: "streaming", text: acc });
  }
  return acc;
}

// ---- brainstorm text parser -------------------------------------------------

function parseBrainstormText(raw: string): {
  stateDescription: string;
  options: Array<{ label: string; summary: string }>;
} {
  const cleaned = raw
    .replace(/^\s*```\w*\s*|\s*```\s*$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const lines = cleaned.split("\n").map((l) => l.replace(/\r$/, ""));

  const stripEmph = (s: string) => s.replace(/\*\*|__|\*|_/g, "").trim();

  const reHeader = /^\s{0,3}(?:\*\*)?(\d+)(?:\*\*)?\.\s*(.+)$/;
  const headerIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (reHeader.test(lines[i])) headerIndices.push(i);
  }

  let firstOptIdx = -1;
  if (headerIndices.length > 0) {
    // Take the last group of numbered headers
    let groupStart = headerIndices[0];
    let prevNum = 0;
    for (const idx of headerIndices) {
      const m = lines[idx].match(reHeader);
      const num = m ? parseInt(m[1], 10) : 0;
      if (num === 1 && prevNum >= 1) groupStart = idx;
      prevNum = num;
    }
    firstOptIdx = groupStart;
  }

  // Scene prose before options
  const scanStart = firstOptIdx === -1 ? lines.length : firstOptIdx;
  const sceneLines: string[] = [];
  for (let i = scanStart - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (t === "") { if (sceneLines.length > 0) break; continue; }
    if (reHeader.test(lines[i])) break;
    sceneLines.unshift(lines[i]);
  }
  const stateDescription = sceneLines
    .map(stripEmph)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const options: Array<{ label: string; summary: string }> = [];
  if (firstOptIdx === -1) return { stateDescription, options };

  let current: { title: string; summaryLines: string[] } | null = null;
  const pushCurrent = () => {
    if (!current) return;
    const title = stripEmph(current.title).trim();
    const summary = current.summaryLines
      .map((l) => stripEmph(l))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (title || summary)
      options.push({
        label: title || summary.split(/\s+/).slice(0, 3).join(" "),
        summary: summary || title,
      });
    current = null;
  };

  for (let i = firstOptIdx; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(reHeader);
    if (m) {
      pushCurrent();
      current = { title: m[2].trim(), summaryLines: [] };
      continue;
    }
    if (current && line.trim()) current.summaryLines.push(line);
  }
  pushCurrent();

  return {
    stateDescription,
    options: options.slice(0, 3).map((o) => ({
      label: o.label.slice(0, 200),
      summary: o.summary,
    })),
  };
}

function parseJsonSafe(raw: string): unknown {
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  try { return JSON.parse(cleaned); } catch { /* continue */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* continue */ }
  }
  throw new Error("Hermes returned non-JSON");
}

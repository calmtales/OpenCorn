/*  ──────────────────────────────────────────────────────────────────────
 *  Hermes Gateway client — HTTP calls to the narrative-brainstorm,
 *  writer-assist, critic/rewriter/judge cascade, image gen, copyright
 *  detection, and character sheet generation.
 *
 *  All skill calls go through the Hermes gateway at localhost:8642
 *  via hermes-gateway.ts (OpenAI-compatible chat completions).
 *  ────────────────────────────────────────────────────────────────────── */

import { useStory, modeStylePrefix, modeLabels, modeRenderType } from "./store";
import type { AgentEvent, AgentId, BranchSuggestion, IndustryMode, NodeMood, NodeTone, StoryNode } from "./types";
import { callSkillStream, consumeSSEStream } from "./hermes-gateway";

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
    // Build a natural-language prompt for the brainstorm skill
    const canonBlock = canonTitles.length > 0
      ? canonTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")
      : "(story start)";
    const focusBody = node.body ?? node.summary ?? "";

    const userMessage = [
      `Seed: ${store.seed}`,
      "",
      `Canon path:`,
      canonBlock,
      "",
      `Current beat: "${node.title}"`,
      focusBody,
      `Mood: ${node.mood}`,
      "",
      `Branch into ${branchCount} new checkpoint options.`,
    ].join("\n");

    const res = await callSkillStream("noustiny-narrative-brainstorm", userMessage, {
      maxTokens: 2048,
    });

    const raw = await consumeSSEStream(res, (text) => {
      store.updateAgent(ev.id, { status: "streaming", text });
    });

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
    const res = await callSkillStream("noustiny-narrative-writer-assist", {
      seed: store.seed,
      canonTitles: canonTitlesUpTo(args.parentId),
      parentTitle: parent.title,
      childTitle: child.title,
      intent: args.intent,
      mode: args.mode,
    }, { maxTokens: 1024 });

    const raw = await consumeSSEStream(res, (text) => {
      store.updateAgent(ev.id, { status: "streaming", text });
    });

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

// ---- reharmonize chain (critic → rewriter → judge) --------------------------

const inflightReharmonize = new Set<string>();

export async function reharmonize({
  insertedNodeId,
}: { insertedNodeId: string }): Promise<void> {
  return reharmonizeChain(insertedNodeId);
}

export async function reharmonizeChain(insertId: string): Promise<void> {
  if (inflightReharmonize.has(insertId)) return;
  inflightReharmonize.add(insertId);

  const store = useStory.getState();
  const insertNode = store.nodes.get(insertId);
  if (!insertNode) { inflightReharmonize.delete(insertId); return; }

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

    // recentChain tracks the live state of already-processed downstream beats
    const recentChain: Array<{ title: string; body: string }> = [];
    let rewritten = 0;

    for (const nodeId of downstream) {
      // Re-read store each iteration (state may change from applyRewrite)
      const freshStore = useStory.getState();
      const node = freshStore.nodes.get(nodeId);
      if (!node) continue;

      const insertBody = insertNode.body ?? insertNode.summary;
      const nodeBody = node.body ?? node.summary;

      // ── Step 1: Critic ──
      const criticRes = await callSkillStream(
        "noustiny-narrative-continuity-critic",
        {
          insertTitle: insertNode.title,
          insertBody,
          nodeTitle: node.title,
          nodeBody,
          recentChain,
        },
        { maxTokens: 512 },
      );
      const criticRaw = await consumeSSEStream(criticRes);
      const critic = parseJsonSafe(criticRaw) as {
        verdict: string;
        reason: string;
        severity: number;
      };

      if (critic.verdict === "still_valid") {
        recentChain.push({ title: node.title, body: nodeBody });
        continue;
      }

      if (critic.verdict === "must_delete") {
        // Leave the node in place but mark it; director can delete later
        recentChain.push({ title: node.title, body: nodeBody });
        continue;
      }

      // ── Step 2: Rewriter (needs_rewrite) ──
      const rewriterRes = await callSkillStream(
        "noustiny-narrative-rewriter",
        {
          insertTitle: insertNode.title,
          insertBody,
          nodeTitle: node.title,
          nodeBody,
          criticReason: critic.reason,
          recentChain,
        },
        { maxTokens: 1024 },
      );
      const rewriterRaw = await consumeSSEStream(rewriterRes);
      const rewrite = parseJsonSafe(rewriterRaw) as {
        title: string;
        summary: string;
        body: string;
        imagePrompt: string;
        mood: string;
        reason: string;
      };

      // ── Step 3: Judge ──
      const judgeRes = await callSkillStream(
        "noustiny-narrative-judge",
        {
          insertTitle: insertNode.title,
          insertBody,
          originalTitle: node.title,
          originalBody: nodeBody,
          rewrittenTitle: rewrite.title,
          rewrittenBody: rewrite.body,
          recentChain,
        },
        { maxTokens: 512 },
      );
      const judgeRaw = await consumeSSEStream(judgeRes);
      const judge = parseJsonSafe(judgeRaw) as {
        approved: boolean;
        score: number;
        reason: string;
      };

      if (judge.approved) {
        useStory.getState().applyRewrite(
          nodeId,
          {
            title: rewrite.title.slice(0, 200),
            summary: rewrite.summary.slice(0, 400),
            body: rewrite.body,
            imagePrompt: rewrite.imagePrompt ?? rewrite.summary,
            mood: validateMood(rewrite.mood),
          },
          "reharmonize",
          judge.reason,
        );
        recentChain.push({ title: rewrite.title, body: rewrite.body });
        rewritten++;
      } else {
        // Rejected — keep original
        recentChain.push({ title: node.title, body: nodeBody });
      }
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
  if (!node) { inflightImage.delete(nodeId); return; }

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
    const res = await callSkillStream(
      "noustiny-story-copyright-detector",
      { seed },
      { maxTokens: 512 },
    );
    const raw = await consumeSSEStream(res, (text) => {
      store.updateAgent(ev.id, { status: "streaming", text });
    });
    const data = parseJsonSafe(raw) as {
      ip_level?: string;
      franchise?: string | null;
      model_preference?: string;
      reason?: string;
    };
    store.updateAgent(ev.id, {
      status: "done",
      text: data.reason ?? `IP: ${data.ip_level ?? "unknown"} · ${data.model_preference ?? "default"}`,
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
    const res = await callSkillStream(
      "noustiny-character-sheet-builder",
      { seed, franchise: null, allow_ip_names: false },
      { maxTokens: 2048 },
    );
    const raw = await consumeSSEStream(res, (text) => {
      store.updateAgent(ev.id, { status: "streaming", text });
    });

    // Skill returns a JSON array directly: [{ name, description, portrait_prompt }]
    const entries = parseJsonSafe(raw) as Array<{
      name: string;
      description: string;
      portrait_prompt?: string;
    }>;

    if (!Array.isArray(entries) || entries.length === 0) {
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
  // Also try array format (for character sheet)
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch { /* continue */ }
  }
  throw new Error("Hermes returned non-JSON");
}

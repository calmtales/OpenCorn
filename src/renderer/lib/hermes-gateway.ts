/*  ──────────────────────────────────────────────────────────────────────
 *  Hermes Gateway client — direct HTTP calls to the Hermes gateway at
 *  http://localhost:8642/v1/chat/completions (OpenAI-compatible).
 *
 *  Skills are loaded from ~/.hermes/skills/creative/ via the main-process
 *  RPC handler and cached in-memory for the session.
 *  ────────────────────────────────────────────────────────────────────── */

const HERMES_URL = "http://localhost:8642/v1/chat/completions";
const HERMES_API_KEY = "noustiny-dev";
const DEFAULT_MODEL = "deepseek/deepseek-v4-flash";

// ---- skill cache ------------------------------------------------------------

const skillCache = new Map<string, string>();

function getBunRpc() {
  return (window as any).__electrobun_rpc;
}

/**
 * Load a SKILL.md from the main process via RPC and cache it.
 */
export async function loadSkill(skillName: string): Promise<string> {
  const cached = skillCache.get(skillName);
  if (cached) return cached;
  const rpc = getBunRpc();
  const { content } = await rpc.request.loadSkill({ skillName });
  skillCache.set(skillName, content);
  return content;
}

// ---- call skill (streaming) -------------------------------------------------

export interface CallSkillOpts {
  model?: string;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * Call a Hermes skill via the OpenAI-compatible streaming API.
 * Returns the raw `Response` — caller can stream from it.
 */
export async function callSkillStream(
  skillName: string,
  input: Record<string, unknown> | string,
  opts?: CallSkillOpts,
): Promise<Response> {
  const skillBody = await loadSkill(skillName);
  const systemPrompt =
    `[SYSTEM: The user has invoked the "${skillName}" skill, ` +
    `indicating they want you to follow its instructions.]\n\n${skillBody}`;
  const userMessage =
    typeof input === "string" ? input : JSON.stringify(input, null, 2);

  const res = await fetch(HERMES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": HERMES_API_KEY,
    },
    body: JSON.stringify({
      model: opts?.model ?? DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: opts?.maxTokens ?? 2048,
      stream: true,
    }),
    signal: opts?.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Hermes gateway ${res.status}: ${text.slice(0, 200)}`);
  }

  return res;
}

/**
 * Convenience: call a skill and return the full response text.
 */
export async function callSkillText(
  skillName: string,
  input: Record<string, unknown> | string,
  opts?: CallSkillOpts,
): Promise<string> {
  const res = await callSkillStream(skillName, input, opts);
  return consumeSSEStream(res);
}

// ---- SSE stream consumer ----------------------------------------------------

/**
 * Consume an OpenAI-compatible SSE stream.
 * Calls `onChunk` with the accumulated text on every delta.
 * Returns the final accumulated text.
 */
export async function consumeSSEStream(
  res: Response,
  onChunk?: (accumulated: string) => void,
): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let acc = "";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Process only up to the last newline to avoid splitting SSE frames
      const lastNL = buffer.lastIndexOf("\n");
      if (lastNL === -1) continue;
      const complete = buffer.slice(0, lastNL + 1);
      buffer = buffer.slice(lastNL + 1);

      for (const line of complete.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;
        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta: string | undefined =
            json.choices?.[0]?.delta?.content;
          if (delta) {
            acc += delta;
            onChunk?.(acc);
          }
        } catch {
          // malformed JSON chunk — skip
        }
      }
    }

    // Flush remaining buffer
    const trimmed = buffer.trim();
    if (trimmed && trimmed !== "data: [DONE]" && trimmed.startsWith("data: ")) {
      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta: string | undefined =
          json.choices?.[0]?.delta?.content;
        if (delta) {
          acc += delta;
          onChunk?.(acc);
        }
      } catch {
        // ignore
      }
    }
  } finally {
    reader.releaseLock();
  }

  return acc;
}

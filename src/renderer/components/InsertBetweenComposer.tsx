import { useEffect, useMemo, useState } from "react";
import { GitBranchPlus, Split, X } from "lucide-react";
import { useStory } from "../lib/store";
import { writerAssist } from "../lib/authoring-client";
import type { BranchSuggestion } from "../lib/types";

const s = {
  shell: {
    position: "absolute" as const,
    right: 18,
    bottom: 18,
    zIndex: 70,
    width: 390,
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(79,195,247,0.24)",
    background:
      "linear-gradient(180deg, rgba(13,17,24,0.98), rgba(8,11,16,0.96))",
    boxShadow: "0 22px 50px rgba(0,0,0,0.48)",
    color: "#f2f5f8",
  },
  top: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.16em",
    textTransform: "uppercase" as const,
    color: "#4fc3f7",
  },
  closeBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(214,222,233,0.82)",
    cursor: "pointer",
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: "#f2f5f8",
  },
  meta: {
    fontSize: 11,
    lineHeight: 1.5,
    color: "rgba(170,185,205,0.72)",
  },
  segmented: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  },
  segment: (active: boolean) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 34,
    borderRadius: 999,
    border: `1px solid ${active ? "rgba(233,193,107,0.42)" : "rgba(255,255,255,0.08)"}`,
    background: active ? "rgba(233,193,107,0.12)" : "rgba(255,255,255,0.03)",
    color: active ? "#e9c16b" : "rgba(214,222,233,0.78)",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
  }),
  textArea: {
    width: "100%",
    minHeight: 96,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(4,6,10,0.86)",
    color: "#f2f5f8",
    fontSize: 12,
    lineHeight: 1.55,
    fontFamily: "inherit",
    resize: "vertical" as const,
    outline: "none",
  },
  actionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  submitBtn: (disabled: boolean) => ({
    border: "1px solid rgba(79,195,247,0.36)",
    background: disabled ? "rgba(79,195,247,0.06)" : "rgba(79,195,247,0.14)",
    color: disabled ? "rgba(79,195,247,0.42)" : "#4fc3f7",
    borderRadius: 999,
    padding: "9px 13px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
  }),
  error: {
    fontSize: 11,
    lineHeight: 1.45,
    color: "#ff8b8b",
  },
} as const;

function fallbackBranch(
  parentTitle: string,
  childTitle: string,
  intent: string,
  mode: "canon" | "what-if",
): BranchSuggestion {
  const title =
    mode === "canon"
      ? `Inserted beat before ${childTitle || "next beat"}`
      : `Alternate route after ${parentTitle || "current beat"}`;
  const summary =
    intent ||
    (mode === "canon"
      ? "A connective beat that clarifies cause and consequence before the next canon moment."
      : "A sibling route that explores a different consequence without rewriting the canon path.");
  return {
    title,
    summary,
    body: summary,
    imagePrompt: summary,
    mood: "discovery",
    tone: mode === "canon" ? "canon" : "what-if",
    label: mode === "canon" ? "insert" : "alternate",
  };
}

export function InsertBetweenComposer() {
  const insertContext = useStory((state) => state.insertContext);
  const nodes = useStory((state) => state.nodes);
  const closeInsertModal = useStory((state) => state.closeInsertModal);
  const insertBetween = useStory((state) => state.insertBetween);
  const setCurrent = useStory((state) => state.setCurrent);
  const [mode, setMode] = useState<"canon" | "what-if">("canon");
  const [intent, setIntent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parent = insertContext ? nodes.get(insertContext.parentId) : null;
  const child = insertContext ? nodes.get(insertContext.childId) : null;

  useEffect(() => {
    if (!insertContext) return;
    setMode(insertContext.mode ?? "canon");
    setIntent("");
    setError(null);
  }, [insertContext]);

  const defaultIntent = useMemo(() => {
    if (!parent || !child) return "";
    return `Bridge "${parent.title}" into "${child.title}" with a clear cause-and-effect beat.`;
  }, [child, parent]);

  if (!insertContext || !parent || !child) return null;

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    const trimmedIntent = (intent.trim() || defaultIntent).trim();
    try {
      const suggestion = await writerAssist({
        parentId: insertContext.parentId,
        childId: insertContext.childId,
        intent: trimmedIntent,
        mode,
      });
      const branch =
        suggestion ??
        fallbackBranch(parent.title, child.title, trimmedIntent, mode);
      const createdId = insertBetween(
        insertContext.parentId,
        insertContext.childId,
        branch,
        mode,
        "human",
        "writer-assist",
      );
      if (createdId) {
        setCurrent(createdId, "human", "writer-assist");
      }
    } catch (err) {
      const branch = fallbackBranch(
        parent.title,
        child.title,
        trimmedIntent,
        mode,
      );
      const createdId = insertBetween(
        insertContext.parentId,
        insertContext.childId,
        branch,
        mode,
        "human",
        "writer-assist",
      );
      if (createdId) {
        setCurrent(createdId, "human", "writer-assist");
      } else {
        setError(err instanceof Error ? err.message : "Could not insert beat");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={s.shell} aria-label="Insert between composer">
      <div style={s.top}>
        <div>
          <div style={s.kicker}>
            {mode === "canon" ? (
              <Split size={13} strokeWidth={2.4} />
            ) : (
              <GitBranchPlus size={13} strokeWidth={2.4} />
            )}
            {mode === "canon" ? "insert between" : "explore alternate"}
          </div>
          <div style={s.title}>
            {parent.title} &rarr; {child.title}
          </div>
        </div>
        <button type="button" style={s.closeBtn} onClick={closeInsertModal}>
          <X size={14} strokeWidth={2.3} />
        </button>
      </div>

      <div style={s.meta}>{defaultIntent}</div>

      <div style={s.segmented}>
        <button
          type="button"
          style={s.segment(mode === "canon")}
          onClick={() => setMode("canon")}
        >
          <Split size={12} strokeWidth={2.3} />
          Insert between
        </button>
        <button
          type="button"
          style={s.segment(mode === "what-if")}
          onClick={() => setMode("what-if")}
        >
          <GitBranchPlus size={12} strokeWidth={2.3} />
          Explore alternate
        </button>
      </div>

      <textarea
        style={s.textArea}
        value={intent}
        onChange={(event) => setIntent(event.target.value)}
        placeholder="Describe what this inserted beat should accomplish."
      />

      {error ? <div style={s.error}>{error}</div> : null}

      <div style={s.actionRow}>
        <span style={s.meta}>
          {mode === "canon"
            ? "Adds a canon beat between the two connected nodes."
            : "Adds a sibling branch from the same parent."}
        </span>
        <button
          type="button"
          style={s.submitBtn(saving)}
          disabled={saving}
          onClick={handleSubmit}
        >
          {saving ? "writing" : mode === "canon" ? "insert" : "explore"}
        </button>
      </div>
    </section>
  );
}

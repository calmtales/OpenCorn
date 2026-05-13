import { useEffect, useState } from "react";
import type {
  WritersRoomApproval,
  WritersRoomFormat,
  WritersRoomPackageTier,
  WritersRoomPack,
  WritersRoomRefinementInput,
  WritersRoomReviewRole,
  WritersRoomStageId,
} from "../../shared/types";

const FORMATS: Array<{ value: WritersRoomFormat; label: string }> = [
  { value: "feature-film", label: "Feature Film" },
  { value: "web-series", label: "Web Series" },
  { value: "animation-anime", label: "Animation & Anime" },
  { value: "ott-original", label: "OTT Original" },
  { value: "franchise-ip", label: "Franchise & IP" },
  { value: "ad-film", label: "Ad Film" },
  { value: "docu-drama", label: "Docu-Drama" },
];

const TIERS: Array<{
  value: WritersRoomPackageTier;
  label: string;
  detail: string;
}> = [
  { value: "lite", label: "Lite", detail: "Hooks, beat sheet, treatment" },
  {
    value: "studio",
    label: "Studio",
    detail: "Adds character, scene, dialogue, pitch copy",
  },
  {
    value: "franchise",
    label: "Franchise",
    detail: "Adds world bible and expansion roadmap",
  },
];

const REVIEW_ROLES: Array<{ value: WritersRoomReviewRole; label: string }> = [
  { value: "writer", label: "Writer" },
  { value: "showrunner", label: "Showrunner" },
  { value: "producer", label: "Producer" },
];

const APPROVALS: Array<{ value: WritersRoomApproval; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "changes_requested", label: "Changes Requested" },
  { value: "rejected", label: "Rejected" },
];

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(8,11,16,0.98), rgba(7,10,14,0.94))",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: "18px 18px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  headerCopy: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    minWidth: 0,
  },
  kicker: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.24em",
    textTransform: "uppercase" as const,
    color: "rgba(233,193,107,0.72)",
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "-0.03em",
    color: "#f2f5f8",
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(170,185,205,0.74)",
  },
  closeBtn: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(214,222,233,0.88)",
    borderRadius: 10,
    width: 32,
    height: 32,
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
  },
  body: {
    flex: 1,
    overflow: "auto",
    padding: 18,
    display: "flex",
    flexDirection: "column" as const,
    gap: 14,
  },
  controlCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.06)",
    background:
      "linear-gradient(180deg, rgba(18,22,30,0.92), rgba(11,14,20,0.88))",
  },
  label: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(214,222,233,0.86)",
  },
  select: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(7,10,15,0.9)",
    color: "#f2f5f8",
    padding: "10px 12px",
    fontSize: 12,
    outline: "none",
  },
  tierGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },
  tierBtn: (active: boolean) => ({
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
    gap: 5,
    minHeight: 76,
    padding: 10,
    borderRadius: 12,
    border: `1px solid ${active ? "rgba(233,193,107,0.4)" : "rgba(255,255,255,0.08)"}`,
    background: active
      ? "linear-gradient(180deg, rgba(233,193,107,0.16), rgba(233,193,107,0.08))"
      : "rgba(255,255,255,0.03)",
    color: active ? "#f3d38a" : "rgba(214,222,233,0.88)",
    cursor: "pointer",
    textAlign: "left" as const,
  }),
  tierTitle: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
  },
  tierDetail: {
    fontSize: 11,
    lineHeight: 1.4,
    color: "rgba(170,185,205,0.72)",
  },
  actionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  generateBtn: (loading: boolean) => ({
    border: "1px solid rgba(233,193,107,0.4)",
    background: loading
      ? "rgba(233,193,107,0.08)"
      : "linear-gradient(180deg, rgba(233,193,107,0.18), rgba(233,193,107,0.1))",
    color: "#f3d38a",
    borderRadius: 999,
    padding: "10px 16px",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.16em",
    cursor: loading ? "wait" : "pointer",
  }),
  seedPreview: {
    fontSize: 11,
    lineHeight: 1.55,
    color: "rgba(170,185,205,0.74)",
  },
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(10,13,18,0.78)",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.16em",
    textTransform: "uppercase" as const,
    color: "rgba(233,193,107,0.72)",
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    color: "rgba(214,222,233,0.84)",
  },
  summary: {
    fontSize: 12,
    lineHeight: 1.6,
    color: "rgba(214,222,233,0.86)",
  },
  list: {
    display: "grid",
    gap: 8,
  },
  listItem: {
    borderRadius: 12,
    padding: 10,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.05)",
  },
  listName: {
    fontSize: 12,
    fontWeight: 600,
    color: "#f2f5f8",
  },
  listMeta: {
    marginTop: 4,
    fontSize: 11,
    color: "rgba(170,185,205,0.72)",
  },
  stageCard: {
    display: "grid",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(79,195,247,0.16)",
    background: "rgba(79,195,247,0.05)",
  },
  stageTop: {
    display: "grid",
    gridTemplateColumns: "24px 1fr auto",
    gap: 10,
    alignItems: "center",
  },
  stageIndex: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: 999,
    border: "1px solid rgba(79,195,247,0.32)",
    color: "#4fc3f7",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 800,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  textArea: {
    width: "100%",
    minHeight: 92,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(7,10,15,0.9)",
    color: "#f2f5f8",
    fontSize: 12,
    lineHeight: 1.55,
    fontFamily: "inherit",
    resize: "vertical" as const,
    outline: "none",
  },
  checkboxRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 7,
  },
  checkboxBtn: (active: boolean) => ({
    border: `1px solid ${active ? "rgba(79,195,247,0.42)" : "rgba(255,255,255,0.08)"}`,
    background: active ? "rgba(79,195,247,0.12)" : "rgba(255,255,255,0.03)",
    color: active ? "#4fc3f7" : "rgba(214,222,233,0.78)",
    borderRadius: 999,
    padding: "6px 9px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
  }),
  deliverableCard: {
    display: "grid",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background:
      "linear-gradient(180deg, rgba(20,24,32,0.82), rgba(11,14,20,0.92))",
  },
  deliverableTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  deliverableTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#f2f5f8",
  },
  deliverableSummary: {
    fontSize: 11,
    lineHeight: 1.5,
    color: "rgba(170,185,205,0.78)",
  },
  deliverableBody: {
    fontSize: 12,
    lineHeight: 1.6,
    color: "rgba(214,222,233,0.88)",
    whiteSpace: "pre-wrap" as const,
  },
  saveBtn: (disabled: boolean) => ({
    alignSelf: "flex-start",
    border: "1px solid rgba(79,195,247,0.36)",
    background: disabled ? "rgba(79,195,247,0.05)" : "rgba(79,195,247,0.12)",
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
  empty: {
    padding: 18,
    borderRadius: 16,
    border: "1px dashed rgba(255,255,255,0.1)",
    background: "rgba(9,12,18,0.68)",
    color: "rgba(170,185,205,0.74)",
    fontSize: 12,
    lineHeight: 1.6,
  },
};

interface Props {
  pack: WritersRoomPack | null;
  loading: boolean;
  seed: string;
  workflowId?: string | null;
  embedded?: boolean;
  onClose: () => void;
  onGenerate: (
    format: WritersRoomFormat,
    packageTier: WritersRoomPackageTier,
  ) => Promise<void> | void;
  onRefinement?: (
    input: WritersRoomRefinementInput,
  ) => Promise<WritersRoomPack> | WritersRoomPack | void;
  onRegenerateDeliverable?: (
    deliverableId: string,
    userNotes?: string,
  ) => Promise<void> | void;
  onUpdateDeliverableBody?: (
    deliverableId: string,
    body: string,
  ) => Promise<void> | void;
}

export function WritersRoomPanel({
  pack,
  loading,
  seed,
  workflowId,
  embedded = false,
  onClose,
  onGenerate,
  onRefinement,
  onRegenerateDeliverable,
  onUpdateDeliverableBody,
}: Props) {
  const [format, setFormat] = useState<WritersRoomFormat>(
    pack?.format ?? "feature-film",
  );
  const [packageTier, setPackageTier] = useState<WritersRoomPackageTier>(
    pack?.packageTier ?? "studio",
  );
  const [refinementRole, setRefinementRole] =
    useState<WritersRoomReviewRole>("writer");
  const [refinementStageId, setRefinementStageId] =
    useState<WritersRoomStageId>("human-refinement");
  const [refinementApproval, setRefinementApproval] =
    useState<WritersRoomApproval>("pending");
  const [refinementNotes, setRefinementNotes] = useState("");
  const [selectedDeliverableIds, setSelectedDeliverableIds] = useState<
    string[]
  >([]);
  const [savingRefinement, setSavingRefinement] = useState(false);
  const [editingDeliverableId, setEditingDeliverableId] = useState<
    string | null
  >(null);
  const [editDraft, setEditDraft] = useState("");
  const [regenNotesId, setRegenNotesId] = useState<string | null>(null);
  const [regenNotes, setRegenNotes] = useState("");

  useEffect(() => {
    if (!pack) return;
    setFormat(pack.format);
    setPackageTier(pack.packageTier);
    setRefinementStageId(pack.stages[0]?.id ?? "human-refinement");
  }, [pack]);

  const handleGenerate = () => {
    void onGenerate(format, packageTier);
  };

  const toggleDeliverable = (deliverableId: string) => {
    setSelectedDeliverableIds((current) =>
      current.includes(deliverableId)
        ? current.filter((id) => id !== deliverableId)
        : [...current, deliverableId],
    );
  };

  const handleSaveRefinement = async () => {
    const workflowIdForPack = pack?.workflowId || workflowId || "";
    if (!workflowIdForPack || !onRefinement || !refinementNotes.trim()) return;

    setSavingRefinement(true);
    try {
      await onRefinement({
        workflowId: workflowIdForPack,
        role: refinementRole,
        stageId: refinementStageId,
        notes: refinementNotes.trim(),
        approval: refinementApproval,
        deliverableIds: selectedDeliverableIds,
      });
      setRefinementNotes("");
      setSelectedDeliverableIds([]);
    } finally {
      setSavingRefinement(false);
    }
  };

  const seedPreview = (pack?.seed ?? seed).trim();
  const refinementDisabled =
    savingRefinement || !onRefinement || !pack || !refinementNotes.trim();
  const moodArc = Array.isArray(pack?.analysis.moodArc)
    ? pack.analysis.moodArc
    : [];
  const motifsTop = Array.isArray(pack?.analysis.motifsTop)
    ? pack.analysis.motifsTop
    : [];
  const analysisCharacters = Array.isArray(pack?.analysis.characters)
    ? pack.analysis.characters
    : [];
  const analysisObjects = Array.isArray(pack?.analysis.objects)
    ? pack.analysis.objects
    : [];
  const deliverableGroups = pack?.stages.length
    ? pack.stages.map((stage) => ({
        stage,
        deliverables: pack.deliverables.filter(
          (deliverable) => deliverable.stageId === stage.id,
        ),
      }))
    : pack
      ? [
          {
            stage: {
              id: "draft-generation" as WritersRoomStageId,
              title: "Deliverables",
              summary: "Legacy writers-room pack artifacts",
              order: 1,
              status: "ready" as const,
              deliverableIds: pack.deliverables.map(
                (deliverable) => deliverable.id,
              ),
            },
            deliverables: pack.deliverables,
          },
        ]
      : [];

  return (
    <div
      style={
        embedded
          ? {
              ...s.container,
              height: "auto",
              overflow: "visible",
              background: "transparent",
            }
          : s.container
      }
    >
      {!embedded && (
        <div style={s.header}>
          <div style={s.headerCopy}>
            <span style={s.kicker}>writers room</span>
            <div style={s.title}>Narrative Development Pack</div>
            <div style={s.subtitle}>
              Generate a reusable development packet with format-aware
              deliverables, then keep reopening it from archive/history.
            </div>
          </div>
          <button
            style={s.closeBtn}
            onClick={onClose}
            aria-label="Close writers room panel"
          >
            ×
          </button>
        </div>
      )}

      <div style={embedded ? { ...s.body, padding: 0 } : s.body}>
        <div style={s.controlCard}>
          <label style={s.label}>
            Format
            <select
              style={s.select}
              value={format}
              onChange={(event) =>
                setFormat(event.target.value as WritersRoomFormat)
              }
            >
              {FORMATS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          <div style={s.label}>
            Package Tier
            <div style={s.tierGrid}>
              {TIERS.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  style={s.tierBtn(packageTier === entry.value)}
                  onClick={() => setPackageTier(entry.value)}
                >
                  <span style={s.tierTitle}>{entry.label}</span>
                  <span style={s.tierDetail}>{entry.detail}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={s.actionRow}>
            <div style={s.seedPreview}>
              {seedPreview
                ? seedPreview
                : "Open or start a workflow first so the panel has a seed to develop."}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                style={s.generateBtn(loading)}
                onClick={handleGenerate}
                disabled={loading || !seedPreview}
              >
                {loading ? "Building..." : pack ? "Refresh Pack" : "Build Pack"}
              </button>
            </div>
          </div>
        </div>

        {pack ? (
          <>
            <section style={s.section}>
              <div style={s.sectionTitle}>Overview</div>
              <div style={s.metaRow}>
                <span style={s.pill}>{pack.format}</span>
                <span style={s.pill}>{pack.packageTier}</span>
                {workflowId || pack.workflowId ? (
                  <span style={s.pill}>{workflowId ?? pack.workflowId}</span>
                ) : null}
              </div>
              <div style={s.title}>{pack.title}</div>
              <div style={s.summary}>{pack.summary}</div>
            </section>

            <section style={s.section}>
              <div style={s.sectionTitle}>Story Signals</div>
              <div style={s.metaRow}>
                <span style={s.pill}>register: {pack.analysis.register}</span>
                <span style={s.pill}>ip: {pack.analysis.ip.level}</span>
                {pack.analysis.ip.franchise ? (
                  <span style={s.pill}>{pack.analysis.ip.franchise}</span>
                ) : null}
              </div>
              <div style={s.summary}>{pack.analysis.seedSummary}</div>
              {moodArc.length > 0 ? (
                <div style={s.list}>
                  <div style={s.listItem}>
                    <div style={s.listName}>Mood Arc</div>
                    <div style={s.listMeta}>{moodArc.join(" → ")}</div>
                  </div>
                </div>
              ) : null}
              {motifsTop.length > 0 ? (
                <div style={s.list}>
                  <div style={s.listItem}>
                    <div style={s.listName}>Motifs</div>
                    <div style={s.listMeta}>{motifsTop.join(", ")}</div>
                  </div>
                </div>
              ) : null}
            </section>

            <section style={s.section}>
              <div style={s.sectionTitle}>7-Step Workflow</div>
              <div style={s.list}>
                {pack.stages.map((stage) => {
                  const stageDeliverables = pack.deliverables.filter(
                    (deliverable) =>
                      stage.deliverableIds.includes(deliverable.id),
                  );
                  return (
                    <article key={stage.id} style={s.stageCard}>
                      <div style={s.stageTop}>
                        <span style={s.stageIndex}>{stage.order}</span>
                        <div>
                          <div style={s.listName}>{stage.title}</div>
                          <div style={s.listMeta}>{stage.summary}</div>
                        </div>
                        <span style={s.pill}>{stage.status}</span>
                      </div>
                      {stageDeliverables.length > 0 ? (
                        <div style={s.metaRow}>
                          {stageDeliverables.map((deliverable) => (
                            <span key={deliverable.id} style={s.pill}>
                              {deliverable.title}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>

            {analysisCharacters.length > 0 ? (
              <section style={s.section}>
                <div style={s.sectionTitle}>Characters</div>
                <div style={s.list}>
                  {analysisCharacters.map((character) => (
                    <div
                      key={`${character.name}-${character.mentions}`}
                      style={s.listItem}
                    >
                      <div style={s.listName}>{character.name}</div>
                      <div style={s.listMeta}>
                        {character.mentions} mentions
                        {character.span ? ` · ${character.span}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {analysisObjects.length > 0 ? (
              <section style={s.section}>
                <div style={s.sectionTitle}>Objects</div>
                <div style={s.list}>
                  {analysisObjects.map((objectEntry) => (
                    <div
                      key={`${objectEntry.name}-${objectEntry.mentions}`}
                      style={s.listItem}
                    >
                      <div style={s.listName}>{objectEntry.name}</div>
                      <div style={s.listMeta}>
                        {objectEntry.mentions} mentions
                        {objectEntry.span ? ` · ${objectEntry.span}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section style={s.section}>
              <div style={s.sectionTitle}>Deliverables</div>
              <div style={s.list}>
                {deliverableGroups.flatMap(({ stage, deliverables }) =>
                  deliverables.map((deliverable) => {
                    const isEditing = editingDeliverableId === deliverable.id;
                    const isEnriching =
                      deliverable.enrichmentStatus === "enriching";
                    const showRegenNotes = regenNotesId === deliverable.id;
                    const statusBadge =
                      deliverable.enrichmentStatus === "enriching"
                        ? "enriching…"
                        : deliverable.enrichmentStatus === "enriched"
                          ? "✓ enriched"
                          : deliverable.enrichmentStatus === "edited"
                            ? "✎ edited"
                            : null;

                    return (
                      <article key={deliverable.id} style={s.deliverableCard}>
                        <div style={s.deliverableTop}>
                          <div style={s.deliverableTitle}>
                            {deliverable.title}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              alignItems: "center",
                            }}
                          >
                            {statusBadge && (
                              <span
                                style={{
                                  ...s.pill,
                                  color:
                                    deliverable.enrichmentStatus === "enriching"
                                      ? "#fbc02d"
                                      : deliverable.enrichmentStatus ===
                                          "enriched"
                                        ? "#66bb6a"
                                        : "#4fc3f7",
                                  borderColor:
                                    deliverable.enrichmentStatus === "enriching"
                                      ? "rgba(251,192,45,0.3)"
                                      : deliverable.enrichmentStatus ===
                                          "enriched"
                                        ? "rgba(102,187,106,0.3)"
                                        : "rgba(79,195,247,0.3)",
                                }}
                              >
                                {statusBadge}
                              </span>
                            )}
                            <span style={s.pill}>{stage.title}</span>
                          </div>
                        </div>
                        <div style={s.deliverableSummary}>
                          {deliverable.summary}
                        </div>

                        {isEditing ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 8,
                            }}
                          >
                            <textarea
                              style={{ ...s.textArea, minHeight: 160 }}
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              autoFocus
                            />
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                type="button"
                                style={s.saveBtn(false)}
                                onClick={() => {
                                  onUpdateDeliverableBody?.(
                                    deliverable.id,
                                    editDraft,
                                  );
                                  setEditingDeliverableId(null);
                                  setEditDraft("");
                                }}
                              >
                                save
                              </button>
                              <button
                                type="button"
                                style={{
                                  ...s.saveBtn(false),
                                  color: "rgba(214,222,233,0.6)",
                                  borderColor: "rgba(255,255,255,0.08)",
                                }}
                                onClick={() => {
                                  setEditingDeliverableId(null);
                                  setEditDraft("");
                                }}
                              >
                                cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              ...s.deliverableBody,
                              ...(isEnriching
                                ? { opacity: 0.6, fontStyle: "italic" }
                                : {}),
                            }}
                          >
                            {isEnriching
                              ? "Generating content…"
                              : deliverable.body}
                          </div>
                        )}

                        {!isEditing && !isEnriching && (
                          <div
                            style={{ display: "flex", gap: 6, marginTop: 2 }}
                          >
                            <button
                              type="button"
                              style={{
                                border: "1px solid rgba(255,255,255,0.08)",
                                background: "rgba(255,255,255,0.03)",
                                color: "rgba(214,222,233,0.7)",
                                borderRadius: 999,
                                padding: "5px 10px",
                                cursor: "pointer",
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                              onClick={() => {
                                setEditingDeliverableId(deliverable.id);
                                setEditDraft(deliverable.body);
                              }}
                            >
                              edit
                            </button>
                            {onRegenerateDeliverable && (
                              <>
                                <button
                                  type="button"
                                  style={{
                                    border: "1px solid rgba(233,193,107,0.3)",
                                    background: "rgba(233,193,107,0.08)",
                                    color: "#f3d38a",
                                    borderRadius: 999,
                                    padding: "5px 10px",
                                    cursor: "pointer",
                                    fontSize: 10,
                                    fontWeight: 600,
                                  }}
                                  onClick={() =>
                                    onRegenerateDeliverable(deliverable.id)
                                  }
                                >
                                  regenerate
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    border: "1px solid rgba(79,195,247,0.2)",
                                    background: "rgba(79,195,247,0.06)",
                                    color: "rgba(79,195,247,0.8)",
                                    borderRadius: 999,
                                    padding: "5px 10px",
                                    cursor: "pointer",
                                    fontSize: 10,
                                    fontWeight: 600,
                                  }}
                                  onClick={() => {
                                    if (showRegenNotes) {
                                      setRegenNotesId(null);
                                      setRegenNotes("");
                                    } else {
                                      setRegenNotesId(deliverable.id);
                                      setRegenNotes("");
                                    }
                                  }}
                                >
                                  {showRegenNotes
                                    ? "cancel notes"
                                    : "regenerate with notes"}
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {showRegenNotes && !isEditing && !isEnriching && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <textarea
                              style={{ ...s.textArea, minHeight: 60 }}
                              value={regenNotes}
                              onChange={(e) => setRegenNotes(e.target.value)}
                              placeholder="e.g. make it darker, focus on the antagonist, more dialogue…"
                              autoFocus
                            />
                            <button
                              type="button"
                              style={s.saveBtn(!regenNotes.trim())}
                              disabled={!regenNotes.trim()}
                              onClick={() => {
                                onRegenerateDeliverable?.(
                                  deliverable.id,
                                  regenNotes.trim(),
                                );
                                setRegenNotesId(null);
                                setRegenNotes("");
                              }}
                            >
                              regenerate
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  }),
                )}
              </div>
            </section>

            <section style={s.section}>
              <div style={s.sectionTitle}>Human Refinement</div>
              <div style={s.list}>
                {pack.roleReviews.map((review) => (
                  <article key={review.role} style={s.listItem}>
                    <div style={s.deliverableTop}>
                      <div style={s.listName}>{review.label}</div>
                      <span style={s.pill}>{review.approval}</span>
                    </div>
                    <div style={s.listMeta}>{review.responsibility}</div>
                    {review.notes ? (
                      <div style={s.summary}>{review.notes}</div>
                    ) : null}
                  </article>
                ))}
              </div>

              <div style={s.formGrid}>
                <label style={s.label}>
                  role
                  <select
                    style={s.select}
                    value={refinementRole}
                    onChange={(event) =>
                      setRefinementRole(
                        event.target.value as WritersRoomReviewRole,
                      )
                    }
                  >
                    {REVIEW_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={s.label}>
                  stage
                  <select
                    style={s.select}
                    value={refinementStageId}
                    onChange={(event) =>
                      setRefinementStageId(
                        event.target.value as WritersRoomStageId,
                      )
                    }
                  >
                    {pack.stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.order}. {stage.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label style={s.label}>
                approval
                <select
                  style={s.select}
                  value={refinementApproval}
                  onChange={(event) =>
                    setRefinementApproval(
                      event.target.value as WritersRoomApproval,
                    )
                  }
                >
                  {APPROVALS.map((approval) => (
                    <option key={approval.value} value={approval.value}>
                      {approval.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={s.label}>
                touched artifacts
                <div style={s.checkboxRow}>
                  {pack.deliverables.map((deliverable) => (
                    <button
                      key={deliverable.id}
                      type="button"
                      style={s.checkboxBtn(
                        selectedDeliverableIds.includes(deliverable.id),
                      )}
                      onClick={() => toggleDeliverable(deliverable.id)}
                    >
                      {deliverable.title}
                    </button>
                  ))}
                </div>
              </label>

              <label style={s.label}>
                notes
                <textarea
                  style={s.textArea}
                  value={refinementNotes}
                  onChange={(event) => setRefinementNotes(event.target.value)}
                  placeholder="Record writer, showrunner, or producer refinement notes for this stage."
                />
              </label>

              <button
                type="button"
                style={s.saveBtn(refinementDisabled)}
                disabled={refinementDisabled}
                onClick={handleSaveRefinement}
              >
                {savingRefinement ? "saving" : "save refinement"}
              </button>
            </section>

            <section style={s.section}>
              <div style={s.sectionTitle}>Revision History</div>
              <div style={s.list}>
                {[...pack.revisionHistory].reverse().map((revision) => (
                  <article key={revision.id} style={s.listItem}>
                    <div style={s.deliverableTop}>
                      <div style={s.listName}>{revision.event}</div>
                      <span style={s.pill}>{revision.stageId}</span>
                    </div>
                    <div style={s.listMeta}>
                      {revision.actor}
                      {revision.role ? ` · ${revision.role}` : ""}
                      {revision.approval ? ` · ${revision.approval}` : ""}
                      {revision.createdAt ? ` · ${revision.createdAt}` : ""}
                    </div>
                    <div style={s.summary}>{revision.summary}</div>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : (
          <div style={s.empty}>
            No writers-room pack is loaded for this workflow yet. Choose a
            format and tier, then build one from the current seed.
          </div>
        )}
      </div>
    </div>
  );
}

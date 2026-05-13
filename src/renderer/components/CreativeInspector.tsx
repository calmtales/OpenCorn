import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Check,
  Clapperboard,
  Library,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type {
  AppSettings,
  CameraAngle,
  LightingMood,
  ProductionLayer,
  ProjectLogEntry,
  Scene,
  WritersRoomFormat,
  WritersRoomPackageTier,
  WritersRoomPack,
  WritersRoomRefinementInput,
} from "../../shared/types";
import type { IndustryMode, StoryNode } from "../lib/types";
import { WritersRoomPanel } from "./WritersRoomPanel";

export type InspectorTab = "overview" | "writersroom" | "activity";

const CAMERA_ANGLES: Array<{ value: CameraAngle; label: string }> = [
  { value: "wide", label: "Wide" },
  { value: "medium", label: "Medium" },
  { value: "close-up", label: "Close-up" },
  { value: "tracking", label: "Tracking" },
  { value: "dolly", label: "Dolly" },
];

const LIGHTING_MOODS: Array<{ value: LightingMood; label: string }> = [
  { value: "natural", label: "Natural" },
  { value: "dramatic", label: "Dramatic" },
  { value: "warm", label: "Warm" },
  { value: "cool", label: "Cool" },
  { value: "noir", label: "Noir" },
  { value: "golden-hour", label: "Golden Hour" },
  { value: "neon", label: "Neon" },
];

const LAYER_LABELS: Record<ProductionLayer, string> = {
  "writers-room": "Writers Room",
  "storyboard-previs": "Storyboard + Previs",
  "virtual-production": "Virtual Production",
  "post-localization": "Post + Localization",
  "ip-franchise": "IP + Franchise",
};

const PIPELINE_LABELS: Record<string, string> = {
  idle: "Idle",
  generating_screenplay: "Writing screenplay",
  generating_keyframes: "Generating keyframes",
  generating_video: "Generating scene videos",
  waiting_approval: "Waiting for approval",
  processing_audio: "Building audio",
  stitching: "Stitching final cut",
  complete: "Complete",
};

const s = {
  shell: {
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    minHeight: 0,
    background:
      "linear-gradient(180deg, rgba(11,14,20,0.98), rgba(7,10,15,0.96))",
    borderLeft: "1px solid rgba(255,255,255,0.06)",
  },
  header: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    padding: "18px 18px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  headerTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    color: "rgba(79,195,247,0.78)",
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "-0.03em",
    color: "#f2f5f8",
  },
  closeBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(214,222,233,0.84)",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(170,185,205,0.72)",
  },
  tabRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },
  tabBtn: (active: boolean) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 38,
    borderRadius: 10,
    border: `1px solid ${active ? "rgba(79,195,247,0.36)" : "rgba(255,255,255,0.08)"}`,
    background: active ? "rgba(79,195,247,0.12)" : "rgba(255,255,255,0.03)",
    color: active ? "#4fc3f7" : "rgba(214,222,233,0.82)",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
  }),
  body: {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    padding: 18,
    display: "flex",
    flexDirection: "column" as const,
    gap: 14,
  },
  card: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.06)",
    background:
      "linear-gradient(180deg, rgba(19,23,32,0.9), rgba(11,14,19,0.88))",
  },
  cardTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.16em",
    textTransform: "uppercase" as const,
    color: "rgba(233,193,107,0.78)",
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 9px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(214,222,233,0.88)",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },
  headline: {
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: "-0.03em",
    color: "#f2f5f8",
  },
  bodyText: {
    fontSize: 12,
    lineHeight: 1.65,
    color: "rgba(214,222,233,0.84)",
    whiteSpace: "pre-wrap" as const,
  },
  stageRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  stageValue: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: "#4fc3f7",
  },
  progressTrack: {
    width: "100%",
    height: 5,
    overflow: "hidden",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
  },
  progressFill: (progress: number) => ({
    width: `${Math.max(0, Math.min(100, progress))}%`,
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #4fc3f7, #e9c16b)",
    transition: "width 0.24s ease",
  }),
  approveBtn: {
    alignSelf: "flex-start",
    border: "1px solid rgba(233,193,107,0.42)",
    background: "rgba(233,193,107,0.12)",
    color: "#e9c16b",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
  },
  textArea: {
    width: "100%",
    minHeight: 120,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(7,10,15,0.9)",
    color: "#f2f5f8",
    fontSize: 12,
    lineHeight: 1.6,
    fontFamily: "inherit",
    resize: "vertical" as const,
    outline: "none",
  },
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  label: {
    display: "grid",
    gap: 6,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: "rgba(170,185,205,0.72)",
  },
  select: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(7,10,15,0.9)",
    color: "#f2f5f8",
    padding: "9px 10px",
    fontSize: 12,
    outline: "none",
  },
  saveBtn: {
    alignSelf: "flex-start",
    border: "1px solid rgba(79,195,247,0.36)",
    background: "rgba(79,195,247,0.12)",
    color: "#4fc3f7",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
  },
  activityHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  refreshBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(214,222,233,0.82)",
    borderRadius: 999,
    padding: "7px 11px",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
  },
  logList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  logItem: {
    display: "grid",
    gap: 6,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.05)",
    background: "rgba(255,255,255,0.03)",
  },
  logTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  logEvent: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: "#4fc3f7",
  },
  logTime: {
    fontSize: 10,
    color: "rgba(170,185,205,0.7)",
  },
  logDetails: {
    fontSize: 11,
    lineHeight: 1.55,
    color: "rgba(214,222,233,0.78)",
  },
  empty: {
    padding: 18,
    borderRadius: 14,
    border: "1px dashed rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(170,185,205,0.7)",
    fontSize: 12,
    lineHeight: 1.6,
  },
} as const;

function layerLabel(layer: ProductionLayer) {
  return LAYER_LABELS[layer] ?? layer;
}

function pipelineLabel(stage: string) {
  return PIPELINE_LABELS[stage] ?? stage.replace(/_/g, " ");
}

function formatLogTime(value: string) {
  if (!value) return "Unknown time";
  try {
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return value;
  }
}

function summarizeDetails(details: Record<string, unknown>) {
  const entries = Object.entries(details)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    )
    .slice(0, 6)
    .map(([key, value]) => {
      const formatted = Array.isArray(value)
        ? value.join(", ")
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
      return `${key.replace(/_/g, " ")}: ${formatted}`;
    });
  return entries.join(" · ");
}

interface Props {
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onClose: () => void;
  seed: string;
  workflowId: string | null;
  industryMode: IndustryMode;
  activeLayer: ProductionLayer;
  writersRoomMode: boolean;
  writersRoomStatusLabel?: string;
  writersRoomStatusDetail?: string;
  pipelineStage: string;
  pipelineProgress: number;
  pendingStage?: string;
  error: string | null;
  settings: AppSettings;
  currentNode: StoryNode | null;
  currentScene: Scene | null;
  writersRoomPack: WritersRoomPack | null;
  writersRoomLoading: boolean;
  projectLog: ProjectLogEntry[];
  projectLogLoading: boolean;
  projectLogPath?: string | null;
  onRefreshLogs: () => void;
  onGenerateWritersRoomPack: (
    format: WritersRoomFormat,
    packageTier: WritersRoomPackageTier,
  ) => Promise<void> | void;
  onRecordWritersRoomRefinement: (
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
  onSceneUpdate: (sceneId: string, updates: Partial<Scene>) => void;
  onApprovePipeline?: () => void;
}

export function CreativeInspector({
  tab,
  onTabChange,
  onClose,
  seed,
  workflowId,
  industryMode,
  activeLayer,
  writersRoomMode,
  writersRoomStatusLabel,
  writersRoomStatusDetail,
  pipelineStage,
  pipelineProgress,
  pendingStage,
  error,
  settings,
  currentNode,
  currentScene,
  writersRoomPack,
  writersRoomLoading,
  projectLog,
  projectLogLoading,
  projectLogPath,
  onRefreshLogs,
  onGenerateWritersRoomPack,
  onRecordWritersRoomRefinement,
  onRegenerateDeliverable,
  onUpdateDeliverableBody,
  onSceneUpdate,
  onApprovePipeline,
}: Props) {
  const [promptDraft, setPromptDraft] = useState("");
  const [cameraAngle, setCameraAngle] = useState<CameraAngle | "">("");
  const [lightingMood, setLightingMood] = useState<LightingMood | "">("");

  useEffect(() => {
    setPromptDraft(
      currentScene?.customPrompt ??
        currentScene?.description ??
        currentNode?.body ??
        currentNode?.summary ??
        "",
    );
    setCameraAngle(currentScene?.cameraAngle ?? "");
    setLightingMood(currentScene?.lightingMood ?? "");
  }, [
    currentNode?.body,
    currentNode?.summary,
    currentNode?.id,
    currentScene?.cameraAngle,
    currentScene?.customPrompt,
    currentScene?.description,
    currentScene?.id,
    currentScene?.lightingMood,
  ]);

  const reversedLog = useMemo(() => [...projectLog].reverse(), [projectLog]);

  const handleSaveScene = () => {
    if (!currentScene) return;
    onSceneUpdate(currentScene.id, {
      customPrompt: promptDraft.trim() || undefined,
      cameraAngle: cameraAngle || undefined,
      lightingMood: lightingMood || undefined,
    });
  };

  return (
    <aside style={s.shell} aria-label="Creative inspector">
      <div style={s.header}>
        <div style={s.headerTop}>
          <div>
            <div style={s.kicker}>
              <Sparkles size={13} strokeWidth={2.2} />
              creative inspector
            </div>
            <div style={s.title}>Project Context</div>
          </div>
          <button
            type="button"
            style={s.closeBtn}
            onClick={onClose}
            aria-label="Collapse creative inspector"
            title="Collapse creative inspector"
          >
            ×
          </button>
        </div>
        <div style={s.subtitle}>
          Keep the active beat, writers-room packet, and project activity in one
          persistent place while the canvas stays fully visible.
        </div>
        <div style={s.tabRow}>
          <button
            type="button"
            style={s.tabBtn(tab === "overview")}
            onClick={() => onTabChange("overview")}
          >
            <Clapperboard size={13} strokeWidth={2.2} />
            overview
          </button>
          <button
            type="button"
            style={s.tabBtn(tab === "writersroom")}
            onClick={() => onTabChange("writersroom")}
          >
            <Library size={13} strokeWidth={2.2} />
            writers room
          </button>
          <button
            type="button"
            style={s.tabBtn(tab === "activity")}
            onClick={() => onTabChange("activity")}
          >
            <Activity size={13} strokeWidth={2.2} />
            activity
          </button>
        </div>
      </div>

      <div style={s.body}>
        {tab === "overview" && (
          <>
            <section style={s.card}>
              <div style={s.cardTitle}>
                <Clapperboard size={13} strokeWidth={2.2} />
                current project
              </div>
              <div style={s.metaRow}>
                <span style={s.pill}>{layerLabel(activeLayer)}</span>
                <span style={s.pill}>{industryMode}</span>
                {workflowId ? <span style={s.pill}>{workflowId}</span> : null}
              </div>
              <div style={s.headline}>{seed || "Untitled workflow"}</div>
              <div style={s.bodyText}>
                {error
                  ? error
                  : `The canvas is currently operating at the ${layerLabel(activeLayer)} layer.`}
              </div>
            </section>

            {writersRoomMode ? (
              <section style={s.card}>
                <div style={s.cardTitle}>
                  <Library size={13} strokeWidth={2.2} />
                  writers room status
                </div>
                <div style={s.stageRow}>
                  <div style={s.stageValue}>
                    {writersRoomStatusLabel ?? "writers room"}
                  </div>
                  {writersRoomPack ? (
                    <div style={s.logTime}>
                      {writersRoomPack.stages.length} stages
                    </div>
                  ) : null}
                </div>
                <div style={s.bodyText}>
                  {writersRoomStatusDetail ??
                    "The active layer is operating in writers-room mode."}
                </div>
                {writersRoomPack ? (
                  <div style={s.metaRow}>
                    <span style={s.pill}>{writersRoomPack.format}</span>
                    <span style={s.pill}>{writersRoomPack.packageTier}</span>
                    <span style={s.pill}>
                      {writersRoomPack.revisionHistory.length} revisions
                    </span>
                  </div>
                ) : null}
              </section>
            ) : (
              <section style={s.card}>
                <div style={s.cardTitle}>
                  <Activity size={13} strokeWidth={2.2} />
                  pipeline
                </div>
                <div style={s.stageRow}>
                  <div style={s.stageValue}>{pipelineLabel(pipelineStage)}</div>
                  <div style={s.logTime}>{pipelineProgress}%</div>
                </div>
                <div style={s.progressTrack}>
                  <div style={s.progressFill(pipelineProgress)} />
                </div>
                {pendingStage ? (
                  <div style={s.bodyText}>
                    Waiting on approval for {pendingStage.replace(/_/g, " ")}.
                  </div>
                ) : null}
                {pipelineStage === "waiting_approval" && onApprovePipeline && (
                  <button
                    type="button"
                    style={s.approveBtn}
                    onClick={onApprovePipeline}
                  >
                    <Check size={13} strokeWidth={2.4} />
                    approve and continue
                  </button>
                )}
              </section>
            )}

            <section style={s.card}>
              <div style={s.cardTitle}>
                <Sparkles size={13} strokeWidth={2.2} />
                active beat
              </div>
              {currentNode ? (
                <>
                  <div style={s.metaRow}>
                    <span style={s.pill}>{currentNode.status}</span>
                    <span style={s.pill}>{currentNode.tone}</span>
                    <span style={s.pill}>{currentNode.mood}</span>
                  </div>
                  <div style={s.headline}>
                    {currentNode.title || "Untitled"}
                  </div>
                  {currentScene ? (
                    <>
                      <label style={s.label}>
                        scene prompt
                        <textarea
                          style={s.textArea}
                          value={promptDraft}
                          onChange={(event) =>
                            setPromptDraft(event.target.value)
                          }
                          placeholder="Describe the scene intent, staging, or visual direction."
                        />
                      </label>
                      <div style={s.fieldGrid}>
                        <label style={s.label}>
                          camera angle
                          <select
                            style={s.select}
                            value={cameraAngle}
                            onChange={(event) =>
                              setCameraAngle(
                                event.target.value as CameraAngle | "",
                              )
                            }
                          >
                            <option value="">Unspecified</option>
                            {CAMERA_ANGLES.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label style={s.label}>
                          lighting mood
                          <select
                            style={s.select}
                            value={lightingMood}
                            onChange={(event) =>
                              setLightingMood(
                                event.target.value as LightingMood | "",
                              )
                            }
                          >
                            <option value="">Unspecified</option>
                            {LIGHTING_MOODS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <button
                        type="button"
                        style={s.saveBtn}
                        onClick={handleSaveScene}
                      >
                        save prompt context
                      </button>
                    </>
                  ) : (
                    <div style={s.bodyText}>
                      {currentNode.body ||
                        currentNode.summary ||
                        "No prose saved for this beat yet."}
                    </div>
                  )}
                </>
              ) : (
                <div style={s.empty}>
                  Select a beat on the canvas to inspect and edit it here.
                </div>
              )}
            </section>
          </>
        )}

        {tab === "writersroom" && (
          <WritersRoomPanel
            embedded
            pack={writersRoomPack}
            loading={writersRoomLoading}
            seed={seed}
            workflowId={workflowId}
            onClose={() => onTabChange("overview")}
            onGenerate={onGenerateWritersRoomPack}
            onRefinement={onRecordWritersRoomRefinement}
            onRegenerateDeliverable={onRegenerateDeliverable}
            onUpdateDeliverableBody={onUpdateDeliverableBody}
          />
        )}

        {tab === "activity" && (
          <section style={s.card}>
            <div style={s.activityHeader}>
              <div>
                <div style={s.cardTitle}>
                  <Activity size={13} strokeWidth={2.2} />
                  project activity
                </div>
                {projectLogPath ? (
                  <div style={s.logTime}>{projectLogPath}</div>
                ) : null}
              </div>
              <button
                type="button"
                style={s.refreshBtn}
                onClick={onRefreshLogs}
              >
                <RefreshCw size={12} strokeWidth={2.2} />
                {projectLogLoading ? "refreshing" : "refresh"}
              </button>
            </div>

            {reversedLog.length > 0 ? (
              <div style={s.logList}>
                {reversedLog.map((entry, index) => (
                  <article
                    key={`${entry.ts}-${entry.event}-${index}`}
                    style={s.logItem}
                  >
                    <div style={s.logTop}>
                      <span style={s.logEvent}>
                        {entry.event.replace(/\./g, " ")}
                      </span>
                      <span style={s.logTime}>{formatLogTime(entry.ts)}</span>
                    </div>
                    <div style={s.logDetails}>
                      {summarizeDetails(entry.details) ||
                        "No additional details recorded for this event."}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div style={s.empty}>
                {workflowId
                  ? "No project events have been written yet. Start a workflow action or refresh again."
                  : "No workflow is active yet, so there is no log stream to inspect."}
              </div>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}

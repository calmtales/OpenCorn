import {
  Activity,
  Clapperboard,
  Download,
  FolderArchive,
  Library,
  Plus,
  Telescope,
  Video,
} from "lucide-react";
import type {
  AppSettings,
  ProductionLayer,
  WritersRoomStage,
} from "../../shared/types";
import type { IndustryMode } from "../lib/types";
import { ModeSelector } from "./ModeSelector";
import type { InspectorTab } from "./CreativeInspector";

const LAYERS: Array<{
  value: ProductionLayer;
  label: string;
  detail: string;
  icon: typeof Library;
}> = [
  {
    value: "writers-room",
    label: "Writers Room",
    detail: "Premise, hooks, treatment, character logic",
    icon: Library,
  },
  {
    value: "storyboard-previs",
    label: "Storyboard + Previs",
    detail: "Script, boards, keyframes, timing",
    icon: Clapperboard,
  },
  {
    value: "virtual-production",
    label: "Virtual Production",
    detail: "Shot support, assets, references, approvals",
    icon: Telescope,
  },
  {
    value: "post-localization",
    label: "Post + Localization",
    detail: "Edit, dialogue, subtitles, delivery",
    icon: Download,
  },
  {
    value: "ip-franchise",
    label: "IP + Franchise",
    detail: "World bible, roadmap, canon guardrails",
    icon: Video,
  },
];

const PIPELINE_STEPS = [
  { id: "screenplay", label: "Screenplay" },
  { id: "keyframes", label: "Keyframes" },
  { id: "scene_videos", label: "Scene Videos" },
  { id: "audio", label: "Audio" },
  { id: "stitch", label: "Final Stitch" },
] as const;

const s = {
  rail: {
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    minHeight: 0,
    padding: 16,
    gap: 14,
    background:
      "linear-gradient(180deg, rgba(8,11,16,0.98), rgba(6,8,12,0.96))",
    borderRight: "1px solid rgba(255,255,255,0.06)",
  },
  railHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  railTitle: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    color: "rgba(170,185,205,0.7)",
  },
  collapseBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(214,222,233,0.82)",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
  },
  hero: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.06)",
    background:
      "linear-gradient(180deg, rgba(21,25,34,0.92), rgba(10,13,18,0.9))",
    boxShadow: "0 18px 40px rgba(0,0,0,0.3)",
  },
  kicker: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    color: "rgba(79,195,247,0.78)",
  },
  seed: {
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: "-0.03em",
    color: "#f2f5f8",
    lineHeight: 1.3,
  },
  meta: {
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(170,185,205,0.72)",
  },
  buttonRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  },
  button: (accent: boolean) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 38,
    borderRadius: 999,
    border: `1px solid ${accent ? "rgba(233,193,107,0.4)" : "rgba(255,255,255,0.08)"}`,
    background: accent ? "rgba(233,193,107,0.12)" : "rgba(255,255,255,0.03)",
    color: accent ? "#e9c16b" : "rgba(214,222,233,0.84)",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
  }),
  section: {
    display: "grid",
    gap: 10,
  },
  statusCard: {
    display: "grid",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(79,195,247,0.16)",
    background:
      "linear-gradient(180deg, rgba(17,22,31,0.92), rgba(9,12,18,0.9))",
  },
  statusLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.16em",
    textTransform: "uppercase" as const,
    color: "#4fc3f7",
  },
  statusDetail: {
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(214,222,233,0.76)",
  },
  sectionTitle: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    color: "rgba(233,193,107,0.72)",
  },
  stack: {
    display: "grid",
    gap: 8,
  },
  layerBtn: (active: boolean) => ({
    display: "grid",
    gridTemplateColumns: "22px 1fr",
    gap: 10,
    alignItems: "start",
    padding: 12,
    borderRadius: 14,
    border: `1px solid ${active ? "rgba(79,195,247,0.34)" : "rgba(255,255,255,0.06)"}`,
    background: active ? "rgba(79,195,247,0.1)" : "rgba(255,255,255,0.03)",
    color: active ? "#4fc3f7" : "rgba(214,222,233,0.84)",
  }),
  layerTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#f2f5f8",
  },
  layerDetail: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 1.45,
    color: "rgba(170,185,205,0.68)",
  },
  pillRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },
  pill: (active: boolean) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 34,
    borderRadius: 10,
    border: `1px solid ${active ? "rgba(79,195,247,0.34)" : "rgba(255,255,255,0.08)"}`,
    background: active ? "rgba(79,195,247,0.12)" : "rgba(255,255,255,0.03)",
    color: active ? "#4fc3f7" : "rgba(214,222,233,0.82)",
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
  }),
  pipelineList: {
    display: "grid",
    gap: 7,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.03)",
  },
  pipelineItem: (state: "done" | "active" | "idle") => ({
    display: "grid",
    gridTemplateColumns: "16px 1fr auto",
    gap: 10,
    alignItems: "center",
    color:
      state === "done"
        ? "rgba(233,193,107,0.9)"
        : state === "active"
          ? "#4fc3f7"
          : "rgba(170,185,205,0.58)",
  }),
  stepDot: (state: "done" | "active" | "idle") => ({
    width: 10,
    height: 10,
    borderRadius: 999,
    background:
      state === "done"
        ? "#e9c16b"
        : state === "active"
          ? "#4fc3f7"
          : "rgba(255,255,255,0.16)",
    boxShadow: state === "active" ? "0 0 12px rgba(79,195,247,0.45)" : "none",
  }),
  stepLabel: {
    fontSize: 12,
    fontWeight: 600,
  },
  stepMeta: {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },
} as const;

function pipelineStepId(
  stage: string,
  pendingStage?: string,
): (typeof PIPELINE_STEPS)[number]["id"] | undefined {
  if (stage === "complete") return "stitch";
  if (stage === "generating_screenplay") return "screenplay";
  if (stage === "generating_keyframes") return "keyframes";
  if (stage === "generating_video") return "scene_videos";
  if (stage === "processing_audio") return "audio";
  if (stage === "stitching") return "stitch";
  if (stage === "waiting_approval") {
    if (
      pendingStage === "keyframes" ||
      pendingStage === "scene_videos" ||
      pendingStage === "audio" ||
      pendingStage === "stitch"
    ) {
      return pendingStage;
    }
    return "keyframes";
  }
  return undefined;
}

function pipelineStepState(
  id: (typeof PIPELINE_STEPS)[number]["id"],
  stage: string,
  pendingStage: string | undefined,
  settings: AppSettings,
) {
  if (id === "audio" && !settings.enableAudio) {
    return "idle" as const;
  }

  const activeId = pipelineStepId(stage, pendingStage);
  const order = PIPELINE_STEPS.map((item) => item.id);
  const activeIndex = activeId ? order.indexOf(activeId) : -1;
  const currentIndex = order.indexOf(id);

  if (stage === "complete") return "done" as const;
  if (activeIndex === -1) return "idle" as const;
  if (currentIndex < activeIndex) return "done" as const;
  if (currentIndex === activeIndex) return "active" as const;
  return "idle" as const;
}

interface Props {
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
  settings: AppSettings;
  hasWritersRoom: boolean;
  writersRoomStages?: WritersRoomStage[];
  inspectorTab: InspectorTab;
  onInspectorTabChange: (tab: InspectorTab) => void;
  onOpenArchive: () => void;
  onNewProject: () => void;
  onCollapse: () => void;
}

export function StudioRail({
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
  settings,
  hasWritersRoom,
  writersRoomStages = [],
  inspectorTab,
  onInspectorTabChange,
  onOpenArchive,
  onNewProject,
  onCollapse,
}: Props) {
  return (
    <aside style={s.rail} aria-label="Production rail">
      <div style={s.railHeader}>
        <div style={s.railTitle}>production rail</div>
        <button
          type="button"
          style={s.collapseBtn}
          onClick={onCollapse}
          aria-label="Collapse production rail"
          title="Collapse production rail"
        >
          ×
        </button>
      </div>

      <section style={s.hero}>
        <div style={s.kicker}>creative pipeline canvas</div>
        <div style={s.seed}>{seed || "Untitled project"}</div>
        <div style={s.meta}>
          {workflowId ? `${workflowId} · ` : ""}
          {industryMode} mode ·{" "}
          {writersRoomMode && writersRoomStatusLabel
            ? writersRoomStatusLabel
            : `${Math.round(pipelineProgress)}% through current run`}
        </div>
        <div style={s.buttonRow}>
          <button type="button" style={s.button(false)} onClick={onOpenArchive}>
            <FolderArchive size={13} strokeWidth={2.2} />
            archive
          </button>
          <button type="button" style={s.button(true)} onClick={onNewProject}>
            <Plus size={13} strokeWidth={2.4} />
            new seed
          </button>
        </div>
      </section>

      <section style={s.section}>
        <div style={s.sectionTitle}>industry mode</div>
        <ModeSelector />
      </section>

      <section style={s.section}>
        <div style={s.sectionTitle}>production layers</div>
        <div style={s.stack}>
          {LAYERS.map((layer) => {
            const Icon = layer.icon;
            const active = layer.value === activeLayer;
            return (
              <div key={layer.value} style={s.layerBtn(active)}>
                <Icon size={16} strokeWidth={2.2} />
                <div>
                  <div style={s.layerTitle}>{layer.label}</div>
                  <div style={s.layerDetail}>{layer.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={s.section}>
        <div style={s.sectionTitle}>inspector focus</div>
        <div style={s.pillRow}>
          <button
            type="button"
            style={s.pill(inspectorTab === "overview")}
            onClick={() => onInspectorTabChange("overview")}
          >
            <Clapperboard size={12} strokeWidth={2.2} />
            overview
          </button>
          <button
            type="button"
            style={s.pill(inspectorTab === "writersroom")}
            onClick={() => onInspectorTabChange("writersroom")}
          >
            <Library size={12} strokeWidth={2.2} />
            writers
          </button>
          <button
            type="button"
            style={s.pill(inspectorTab === "activity")}
            onClick={() => onInspectorTabChange("activity")}
          >
            <Activity size={12} strokeWidth={2.2} />
            activity
          </button>
        </div>
      </section>

      {writersRoomMode ? (
        <section style={s.section}>
          <div style={s.sectionTitle}>writers room status</div>
          <div style={s.statusCard}>
            <div style={s.statusLabel}>
              {writersRoomStatusLabel ?? "writers room"}
            </div>
            <div style={s.statusDetail}>
              {writersRoomStatusDetail ??
                "The active layer is operating in writers-room mode."}
            </div>
          </div>
        </section>
      ) : (
        <section style={s.section}>
          <div style={s.sectionTitle}>pipeline spine</div>
          <div style={s.pipelineList}>
            {PIPELINE_STEPS.map((step) => {
              const state = pipelineStepState(
                step.id,
                pipelineStage,
                pendingStage,
                settings,
              );
              return (
                <div key={step.id} style={s.pipelineItem(state)}>
                  <span style={s.stepDot(state)} />
                  <span style={s.stepLabel}>{step.label}</span>
                  <span style={s.stepMeta}>
                    {step.id === "audio" && !settings.enableAudio
                      ? "off"
                      : state}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {hasWritersRoom && writersRoomStages.length > 0 ? (
        <section style={s.section}>
          <div style={s.sectionTitle}>writers room stages</div>
          <div style={s.pipelineList}>
            {writersRoomStages.map((stage) => (
              <div key={stage.id} style={s.pipelineItem("done")}>
                <span style={s.stepDot("done")} />
                <span style={s.stepLabel}>{stage.title}</span>
                <span style={s.stepMeta}>{stage.deliverableIds.length}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {hasWritersRoom && inspectorTab !== "writersroom" ? (
        <button
          type="button"
          style={s.button(true)}
          onClick={() => onInspectorTabChange("writersroom")}
        >
          <Library size={13} strokeWidth={2.2} />
          open writers room pack
        </button>
      ) : null}
    </aside>
  );
}

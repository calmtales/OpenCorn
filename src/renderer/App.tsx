import {
  useState,
  useCallback,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useMemo,
} from "react";
import type {
  FilmStyle,
  Storyboard,
  AppSettings,
  Scene,
  StylePreset,
  AuthoringBrainstormResult,
  LayerStartOptions,
  ProductionLayer,
  WorkflowResumePayload,
  WritersRoomFormat,
  WritersRoomPackageTier,
  WritersRoomPack,
  WritersRoomRefinementInput,
  ProjectLogEntry,
} from "../shared/types";
import { McpStatus } from "./components/McpStatus";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { ToastContainer } from "./components/ToastContainer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SplashScreen } from "./components/SplashScreen";
import { SeedInput } from "./components/SeedInput";
import { Canvas, ReactFlowProvider } from "./components/Canvas";
import {
  AgentTicker,
  type SystemActivityCardData,
} from "./components/AgentTicker";
import { BeatChooser } from "./components/BeatChooser";
import { ProjectsDashboard } from "./components/ProjectsDashboard";
import { InsertBetweenComposer } from "./components/InsertBetweenComposer";
import {
  CreativeInspector,
  type InspectorTab,
} from "./components/CreativeInspector";
import { StudioRail } from "./components/StudioRail";
import {
  useStory,
  modeLabels,
  modeRenderType,
  selectCanonPath,
} from "./lib/store";
import { useShallow } from "zustand/react/shallow";
import type { IndustryMode } from "./lib/types";
import { useFilmPipeline } from "./hooks/useFilmPipeline";
import { useToast } from "./hooks/useToast";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { expandNode } from "./lib/authoring-client";

// Lazy load — commented out for Phase 3 refactor (source files kept)
// const ComfyUIPanel = lazy(() => import("./components/ComfyUIPanel").then(m => ({ default: m.ComfyUIPanel })));
// const LocalModels = lazy(() => import("./components/LocalModels").then(m => ({ default: m.LocalModels })));
const PresetGallery = lazy(() =>
  import("./components/PresetGallery").then((m) => ({
    default: m.PresetGallery,
  })),
);
// const BatchPanel = lazy(() => import("./components/BatchPanel").then(m => ({ default: m.BatchPanel })));
const SettingsPanel = lazy(() =>
  import("./components/SettingsPanel").then((m) => ({
    default: m.SettingsPanel,
  })),
);

// Phase 3 imports — kept for use in canvas-mode header
import { ExportPanel } from "./components/ExportPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { PromptCraft } from "./components/PromptCraft";
import {
  AlertTriangle,
  Skull,
  Heart,
  Sparkles,
  ChevronLeft,
  Eye,
  Lock,
  Check,
  ChevronRight,
  ArrowRight,
  X,
  Bot,
  User,
  Circle,
  Square,
  Crosshair,
  Clapperboard,
  Palette,
  Landmark,
  Megaphone,
  Telescope,
  Video,
  Search,
  MoveRight,
  Sun,
  Zap,
  Flame,
  Snowflake,
  Moon,
  Sunrise,
  Flag,
  Camera,
  ToyBrick,
  Library,
  History,
  Settings,
  Layers,
  Box,
  PenTool,
  Layout,
  Download,
  FolderArchive,
  Plus,
  Activity,
} from "lucide-react";

type SidePanel = "settings" | "history" | "promptcraft" | "presets" | null;

const VERSION = "0.5.0";

function isWritersRoomLayer(layer: ProductionLayer): boolean {
  return layer === "writers-room" || layer === "ip-franchise";
}

function writersRoomStatusSummary(
  pack: WritersRoomPack | null,
  loading: boolean,
): { label: string; detail: string } {
  if (loading) {
    return {
      label: "Building writers room",
      detail:
        "Generating the seven-stage development pack for the active seed.",
    };
  }

  if (!pack) {
    return {
      label: "Seed ready",
      detail:
        "Generate a writers-room pack to structure the project into stages and deliverables.",
    };
  }

  if (pack.status === "error") {
    return {
      label: "Writers room error",
      detail: "The current pack needs regeneration before review can continue.",
    };
  }

  const requestedChanges = pack.roleReviews.filter(
    (review) => review.approval === "changes_requested",
  ).length;
  if (requestedChanges > 0) {
    return {
      label: "Refinement requested",
      detail: `${requestedChanges} review lane${requestedChanges === 1 ? " is" : "s are"} asking for changes before sign-off.`,
    };
  }

  const pendingReviews = pack.roleReviews.filter(
    (review) => review.approval === "pending",
  ).length;
  if (pendingReviews > 0) {
    return {
      label: "Refinement pending",
      detail: `${pendingReviews} review lane${pendingReviews === 1 ? " remains" : "s remain"} open across the pack.`,
    };
  }

  if ((pack.revisionHistory?.length ?? 0) > 1) {
    return {
      label: "Pack updated",
      detail:
        "Recent feedback has been recorded and the revision history is current.",
    };
  }

  return {
    label: "Writers room ready",
    detail: `${pack.stages.length}-stage pack is ready for review, branching, and refinement.`,
  };
}

function inspectorTabMeta(tab: InspectorTab): {
  label: string;
  Icon: typeof Clapperboard;
} {
  switch (tab) {
    case "writersroom":
      return { label: "Writers", Icon: Library };
    case "activity":
      return { label: "Activity", Icon: Activity };
    case "overview":
    default:
      return { label: "Overview", Icon: Clapperboard };
  }
}

function Logo({ size = 28 }: { size?: number }) {
  return (
    <div style={styles.logo}>
      <Clapperboard
        size={size}
        color="var(--accent)"
        strokeWidth={2.5}
        style={{ filter: "drop-shadow(0 0 8px rgba(79,195,247,0.4))" }}
      />
      <span style={styles.logoText}>
        <span style={styles.logoAccent}>Open</span>Corn
      </span>
    </div>
  );
}

/** HUD-style navigation bar shared by landing & projects modes. */
function HudNav({
  current,
  onNewProject,
}: {
  current: "landing" | "projects";
  onNewProject?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(6,8,12,0.84)",
        backdropFilter: "blur(12px)",
        flexShrink: 0,
      }}
      role="banner"
    >
      <Logo />
      <nav
        style={{ display: "flex", alignItems: "center", gap: 6 }}
        aria-label="Main navigation"
      >
        <button
          style={styles.navTab(current === "landing")}
          onClick={() => useStory.getState().resetToLanding()}
          aria-current={current === "landing" ? "page" : undefined}
        >
          <Circle size={13} strokeWidth={2.5} />
          New Studio
        </button>
        <button
          style={styles.navTab(current === "projects")}
          onClick={() => useStory.getState().navigateToProjects()}
          aria-current={current === "projects" ? "page" : undefined}
        >
          <Square size={13} strokeWidth={2.5} />
          Archive
        </button>
        {onNewProject && current === "projects" && (
          <button
            style={{
              ...styles.navTab(false),
              marginLeft: 8,
              borderColor: "rgba(233,193,107,0.35)",
              color: "#e9c16b",
            }}
            onClick={onNewProject}
          >
            <Plus size={13} strokeWidth={3} />
            New Project
          </button>
        )}
      </nav>
      <span style={styles.landingHint}>v{VERSION}</span>
    </div>
  );
}

const styles = {
  app: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
    background:
      "radial-gradient(circle at top, rgba(20,26,36,0.95), var(--bg-primary) 45%, #040507 100%)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 20px",
    background: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border-subtle)",
    flexShrink: 0,
    zIndex: 10,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: "-0.04em",
    textTransform: "uppercase" as const,
    fontFamily: "var(--font-display)",
  },
  logoAccent: {
    color: "var(--accent)",
  },
  headerCenter: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  headerBtn: (active: boolean = false) => ({
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 10px",
    background: active ? "var(--accent-muted)" : "transparent",
    border: `1px solid ${active ? "var(--accent)" : "transparent"}`,
    borderRadius: "var(--radius-sm)",
    color: active ? "var(--accent)" : "var(--text-secondary)",
    fontSize: 11,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--duration-fast) var(--ease-out)",
  }),
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  main: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  sidebar: (collapsed: boolean) => ({
    width: collapsed ? 0 : 300,
    flexShrink: 0,
    background: "var(--bg-secondary)",
    borderRight: collapsed ? "none" : "1px solid var(--border-subtle)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    transition: "width var(--duration-normal) var(--ease-out)",
  }),
  sidebarToggle: {
    position: "absolute" as const,
    top: "50%",
    right: -12,
    transform: "translateY(-50%)",
    width: 24,
    height: 48,
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderLeft: "none",
    borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-muted)",
    zIndex: 5,
  },
  content: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(6,8,12,0.15), rgba(6,8,12,0.45)), radial-gradient(circle at top, rgba(79,195,247,0.08), transparent 38%)",
    position: "relative" as const,
  },
  viewport: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
  },
  storyboardArea: {
    flex: 1,
    overflow: "auto",
    padding: 20,
  },
  previewPanel: {
    width: 340,
    flexShrink: 0,
    background: "var(--bg-secondary)",
    borderLeft: "1px solid var(--border-subtle)",
    display: "flex",
    flexDirection: "column" as const,
  },
  sidePanel: {
    position: "absolute" as const,
    top: 0,
    right: 0,
    width: 360,
    height: "100%",
    background: "var(--bg-secondary)",
    borderLeft: "1px solid var(--border-subtle)",
    zIndex: 20,
    boxShadow: "var(--shadow-lg)",
    animation: "slide-in-right 0.25s var(--ease-out)",
  },
  collapsedRail: (side: "left" | "right") => ({
    height: "100%",
    minHeight: 0,
    display: "flex",
    alignItems: "stretch",
    justifyContent: "center",
    background:
      "linear-gradient(180deg, rgba(9,12,18,0.98), rgba(6,8,12,0.96))",
    borderRight: side === "left" ? "1px solid rgba(255,255,255,0.06)" : "none",
    borderLeft: side === "right" ? "1px solid rgba(255,255,255,0.06)" : "none",
  }),
  collapsedRailButton: {
    width: "100%",
    height: "100%",
    border: "none",
    background: "transparent",
    color: "rgba(214,222,233,0.82)",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: "16px 6px",
  },
  collapsedRailLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.16em",
    textTransform: "uppercase" as const,
    writingMode: "vertical-rl" as const,
    transform: "rotate(180deg)",
  },
  timelineArea: {
    flexShrink: 0,
    borderTop: "1px solid var(--border)",
    background: "var(--bg-secondary)",
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 16px",
    background: "var(--bg-tertiary)",
    borderTop: "1px solid var(--border-subtle)",
    color: "var(--text-muted)",
    flexShrink: 0,
    zIndex: 10,
  },
  stageLabel: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
  },
  progressDot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    flexShrink: 0,
  },
  progressBar: {
    height: 2,
    background: "var(--bg-tertiary)",
    position: "relative" as const,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "var(--accent)",
    transition: "width 0.5s var(--ease-out)",
  },
  shortcutsHint: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    fontSize: 11,
    fontWeight: 500,
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
  },
  kbd: {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    padding: "2px 6px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    color: "#fff",
    fontFamily: "var(--font-mono)",
    boxShadow: "0 2px 0 rgba(0,0,0,0.3)",
  },
  panelLoading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "var(--text-muted)",
    fontSize: 12,
  },
  landingShell: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
    padding: 24,
    overflow: "auto",
    background:
      "radial-gradient(circle at center, rgba(79,195,247,0.03), transparent 70%)",
  },
  landingCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
    minHeight: "calc(100vh - 96px)",
  },
  landingProjectsSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    padding: 18,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(12,15,21,0.92), rgba(8,10,14,0.86))",
    boxShadow: "0 18px 42px rgba(0,0,0,0.28)",
  },
  landingHero: {
    padding: 18,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(12,15,21,0.92), rgba(8,10,14,0.86))",
    boxShadow: "0 18px 42px rgba(0,0,0,0.28)",
  },
  landingCopy: {
    fontSize: 13,
    lineHeight: 1.6,
    color: "var(--text-secondary)",
    marginTop: 10,
  },
  landingHint: {
    marginTop: 12,
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.22em",
    color: "rgba(170,185,205,0.4)",
  },
  highContrastBtn: (active: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 8px",
    background: active ? "var(--accent-muted)" : "transparent",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    borderRadius: "var(--radius-sm)",
    color: active ? "var(--accent)" : "var(--text-muted)",
    fontSize: 10,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--duration-fast) var(--ease-out)",
  }),
  navTab: (active: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 20px",
    background: active ? "rgba(233,193,107,0.12)" : "rgba(10,13,18,0.5)",
    border: `1.5px solid ${active ? "rgba(233,193,107,0.5)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 8,
    color: active ? "#e9c16b" : "rgba(170,185,205,0.6)",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.14em",
    cursor: "pointer",
    transition: "all 0.16s ease",
    boxShadow: active ? "0 4px 20px rgba(233,193,107,0.15)" : "none",
  }),
};

function PanelSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={<div style={styles.panelLoading}>Loading panel...</div>}
    >
      {children}
    </Suspense>
  );
}

const PIPELINE_STAGE_LABELS: Record<string, string> = {
  generating_screenplay: "Writing screenplay…",
  generating_keyframes: "Rendering keyframes…",
  generating_video: "Generating video…",
  waiting_approval: "Waiting for approval…",
  processing_audio: "Processing audio…",
  stitching: "Stitching…",
  complete: "Complete",
};

function pipelineStatusText(
  stage: string,
  progress: number,
  error?: string | null,
): string | null {
  if (error) return `⚠ ${error.slice(0, 120)}`;
  if (stage === "idle") return null;
  const label = PIPELINE_STAGE_LABELS[stage] ?? stage;
  if (
    stage === "generating_screenplay" ||
    (stage === "generating_keyframes" && progress <= 25)
  ) {
    return label;
  }
  return `${label} ${progress}%`;
}

function approvalActionLabel(pendingStage?: string): string {
  switch (pendingStage) {
    case "keyframes":
      return "Approve Storyboard";
    case "scene_videos":
      return "Approve Keyframes";
    case "audio":
      return "Approve Scene Videos";
    case "stitch":
      return "Approve Audio";
    default:
      return "Approve & Continue";
  }
}

function nextActionText(
  stage: string,
  pendingStage: string | undefined,
  settings: AppSettings,
): string | null {
  if (stage !== "waiting_approval") return null;

  switch (pendingStage) {
    case "keyframes":
      return `Next action: review the development output and approve to start ${settings.imageProvider === "seedream" ? "SeeDream" : "Nano Banana"} keyframes through RHClaw.`;
    case "scene_videos":
      return "Next action: approve the keyframes to start scene video generation.";
    case "audio":
      return "Next action: approve the scene videos to start audio generation.";
    case "stitch":
      return "Next action: approve audio to stitch the final delivery.";
    default:
      return "Next action: approve the current stage to continue the pipeline.";
  }
}

function StatusBar({
  stage,
  progress,
  pendingStage,
  error,
  settings,
  statusOverrideText,
  onApprove,
}: {
  stage: string;
  progress: number;
  pendingStage?: string;
  error: string | null;
  settings: AppSettings;
  statusOverrideText?: string | null;
  onApprove?: () => void;
}) {
  const nextAction = nextActionText(stage, pendingStage, settings);

  return (
    <div style={styles.statusBar}>
      <div style={styles.stageLabel}>
        <Activity
          size={14}
          color={stage === "complete" ? "var(--success)" : "var(--accent)"}
          style={{
            animation:
              stage !== "complete" && stage !== "idle"
                ? "pulse 2s infinite"
                : "none",
          }}
        />
        {statusOverrideText ||
          pipelineStatusText(stage, progress, error) ||
          "System Ready"}
        {stage === "waiting_approval" && onApprove && (
          <button
            onClick={onApprove}
            style={{
              marginLeft: 10,
              border: "1px solid rgba(233,193,107,0.45)",
              background: "rgba(233,193,107,0.14)",
              color: "#e9c16b",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {approvalActionLabel(pendingStage)}
          </button>
        )}
        {nextAction && (
          <span
            style={{
              marginLeft: 10,
              color: "rgba(170,185,205,0.72)",
              fontSize: 10,
              letterSpacing: "0.04em",
            }}
          >
            {nextAction}
          </span>
        )}
      </div>
      <div style={styles.shortcutsHint}>
        <span style={styles.kbd}>SHIFT</span> + Click for multi-select
        <span style={styles.kbd}>SPACE</span> to search
        <span style={styles.kbd}>?</span> for shortcuts
      </div>
    </div>
  );
}

function getBunRpc() {
  return (window as any).__electrobun_rpc;
}

const LAYER_LABELS: Record<ProductionLayer, string> = {
  "writers-room": "Writers Room",
  "storyboard-previs": "Storyboard + Previs",
  "virtual-production": "AI Virtual Production + Production Support",
  "post-localization": "Post-Production + Localization Pipeline",
  "ip-franchise": "IP + Franchise Layer",
};

const LAYER_BRANCHES: Partial<
  Record<
    ProductionLayer,
    Array<{ title: string; summary: string; label: string }>
  >
> = {
  "virtual-production": [
    {
      title: "Shot Support Plan",
      summary:
        "Break the seed into shot objectives, required plates, virtual camera notes, and approval checkpoints.",
      label: "shot plan",
    },
    {
      title: "Asset + Reference Intake",
      summary:
        "List characters, environments, props, voice and image references, then flag missing production inputs.",
      label: "asset intake",
    },
    {
      title: "Production Risk Board",
      summary:
        "Identify provider, style, continuity, timing, and cost risks before generating expensive media.",
      label: "risk board",
    },
    {
      title: "Approval Run Sheet",
      summary:
        "Sequence human approvals for keyframes, scene videos, audio, stitch, and final delivery.",
      label: "run sheet",
    },
  ],
  "post-localization": [
    {
      title: "Edit Assembly Map",
      summary:
        "Define selects, transitions, pacing targets, missing inserts, and final runtime constraints.",
      label: "edit map",
    },
    {
      title: "Audio + Dialogue Pass",
      summary:
        "Plan dialogue cleanup, TTS/voice locking, background music, mix levels, and export stems.",
      label: "audio pass",
    },
    {
      title: "Localization Matrix",
      summary:
        "Track subtitle languages, cultural adaptation notes, burned-in text, and platform-specific versions.",
      label: "localization",
    },
    {
      title: "Delivery Checklist",
      summary:
        "Prepare formats, resolutions, captions, thumbnails, metadata, and archival outputs.",
      label: "delivery",
    },
  ],
};

function layerBranches(layer: ProductionLayer) {
  return (LAYER_BRANCHES[layer] ?? []).map((branch, index) => ({
    title: branch.title,
    summary: branch.summary,
    body: branch.summary,
    imagePrompt: `${branch.title}: ${branch.summary}`,
    imageUrl: "",
    mood: (index === 0 ? "discovery" : "neutral") as "discovery" | "neutral",
    tone: "divergent" as const,
    label: branch.label,
  }));
}

/** Breadcrumb trail: canon path from root → current beat, clickable. */
function BreadcrumbTrail() {
  const canonPathArr = useStory(useShallow(selectCanonPath));
  const nodes = useStory((s) => s.nodes);
  const setCurrent = useStory((s) => s.setCurrent);

  if (canonPathArr.length <= 1) return null;

  const crumbStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    cursor: "pointer",
    padding: "2px 6px",
    borderRadius: "var(--radius-sm)",
    transition: "all 0.12s ease",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "4px 20px",
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-subtle)",
        flexShrink: 0,
        overflow: "hidden",
        whiteSpace: "nowrap",
      }}
      role="navigation"
      aria-label="Story path breadcrumb"
    >
      {canonPathArr.map((nodeId, idx) => {
        const node = nodes.get(nodeId);
        if (!node) return null;
        const isLast = idx === canonPathArr.length - 1;
        const shortTitle =
          node.title.length > 30 ? node.title.slice(0, 28) + "…" : node.title;
        return (
          <span
            key={nodeId}
            style={{ display: "inline-flex", alignItems: "center", gap: 2 }}
          >
            {idx > 0 && (
              <ChevronRight
                size={12}
                color="rgba(170,185,205,0.25)"
                style={{ margin: "0 2px" }}
              />
            )}
            <button
              type="button"
              onClick={() => setCurrent(nodeId, "human")}
              style={{
                ...crumbStyle,
                color: isLast ? "#4fc3f7" : "rgba(170,185,205,0.55)",
                fontWeight: isLast ? 600 : 400,
                background: isLast ? "rgba(79,195,247,0.08)" : "transparent",
                border: "none",
              }}
              title={node.title}
            >
              {shortTitle}
            </button>
          </span>
        );
      })}
    </div>
  );
}

interface ExportProps {
  workflowId: string | null;
  videoUrl: string | null;
  onSnapshot: () => Promise<void>;
}

export default function App() {
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("overview");
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [rightInspectorOpen, setRightInspectorOpen] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [highContrast, setHighContrast] = useState(() => {
    try {
      return localStorage.getItem("opencorn-high-contrast") === "true";
    } catch {
      return false;
    }
  });

  // Zustand branching canvas state
  const mode = useStory((s) => s.mode);
  const storyNodes = useStory((s) => s.nodes);
  const currentId = useStory((s) => s.currentId);
  const industryMode = useStory((s) => s.industryMode);
  const canvasWorkflowId = useStory((s) => s.workflowId);
  const branchGeneratingCount = useStory(
    (s) => s.branchGeneratingNodeIds.length,
  );

  // Existing film pipeline (kept for MCP + render flow)
  const pipeline = useFilmPipeline();
  const toast = useToast();
  const lastLoadedStoryboardIdRef = useRef<string | null>(null);
  const [writersRoomPack, setWritersRoomPack] =
    useState<WritersRoomPack | null>(null);
  const [writersRoomLoading, setWritersRoomLoading] = useState(false);
  const [activeLayer, setActiveLayer] =
    useState<ProductionLayer>("writers-room");
  const [projectLog, setProjectLog] = useState<ProjectLogEntry[]>([]);
  const [projectLogLoading, setProjectLogLoading] = useState(false);
  const [projectLogPath, setProjectLogPath] = useState<string | null>(null);
  const activeWorkflowId = pipeline.workflowId ?? canvasWorkflowId;
  const writersRoomMode = isWritersRoomLayer(activeLayer);
  const writersRoomStatus = useMemo(
    () =>
      writersRoomMode
        ? writersRoomStatusSummary(writersRoomPack, writersRoomLoading)
        : null,
    [writersRoomLoading, writersRoomMode, writersRoomPack],
  );
  const currentNode = useMemo(
    () => storyNodes.get(currentId) ?? null,
    [currentId, storyNodes],
  );
  const currentScene = useMemo(
    () =>
      pipeline.storyboard?.scenes.find((scene) => scene.id === currentId) ??
      null,
    [currentId, pipeline.storyboard],
  );
  const systemActivities = useMemo<SystemActivityCardData[]>(() => {
    const items: SystemActivityCardData[] = [];

    if (branchGeneratingCount > 0) {
      items.push({
        id: "canvas-branching",
        label: "Canvas Branching",
        text:
          branchGeneratingCount === 1
            ? "Generating new routes from the current beat."
            : `Generating new routes from ${branchGeneratingCount} beats.`,
        accent: "#4fc3f7",
        status: "active",
      });
    }

    if (writersRoomLoading) {
      items.push({
        id: "writers-room-pack",
        label: "Writers Room",
        text: "Building the narrative development pack for the active seed.",
        accent: "#e9c16b",
        status: "active",
      });
    }

    if (pipeline.error) {
      items.push({
        id: "pipeline-error",
        label: "Pipeline",
        text: pipeline.error,
        accent: "#e74c3c",
        status: "error",
      });
    } else if (pipeline.stage !== "idle" && pipeline.stage !== "complete") {
      items.push({
        id: "pipeline-stage",
        label: "Pipeline",
        text:
          pipeline.stage === "waiting_approval"
            ? (nextActionText(
                pipeline.stage,
                pipeline.pendingStage,
                pipeline.settings,
              ) ?? "Waiting for approval to continue the pipeline.")
            : (pipelineStatusText(pipeline.stage, pipeline.progress) ??
              "Processing current stage."),
        accent: pipeline.stage === "waiting_approval" ? "#e9c16b" : "#a78bfa",
        status: pipeline.stage === "waiting_approval" ? "waiting" : "active",
      });
    }

    return items;
  }, [
    branchGeneratingCount,
    pipeline.error,
    pipeline.pendingStage,
    pipeline.progress,
    pipeline.settings,
    pipeline.stage,
    writersRoomLoading,
  ]);

  const syncStoryboardToCanvas = useCallback(
    (storyboard: Storyboard | null) => {
      if (!storyboard) return;
      // Skip redundant reloads when the storyboard ID hasn't changed
      // (scene-level patches go through handleSceneUpdate → patchNodeProse)
      if (lastLoadedStoryboardIdRef.current === storyboard.id) return;
      const store = useStory.getState();
      store.loadStoryboard(storyboard, store.seed, store.currentId);
      lastLoadedStoryboardIdRef.current = storyboard.id;
    },
    [],
  );

  const hydrateCreativeRoomToCanvas = useCallback(
    (creativeRoom: AuthoringBrainstormResult, fallbackSeed?: string): void => {
      const store = useStory.getState();
      const seed =
        creativeRoom.seed?.trim() ||
        fallbackSeed?.trim() ||
        store.seed ||
        "Creative workflow";

      lastLoadedStoryboardIdRef.current = null;
      store.resetToLanding();
      store.enterCanvas(seed, creativeRoom.industryMode ?? "filmmaking");

      if (creativeRoom.workflowId) {
        store.setWorkflowId(creativeRoom.workflowId);
      }

      store.patchNodeProse("root", {
        body: creativeRoom.contextBrief?.trim() || seed,
        summary: (creativeRoom.contextBrief?.trim() || seed).slice(0, 400),
        rawBrainstorm: JSON.stringify(creativeRoom, null, 2),
        renderedImagePrompt:
          creativeRoom.motifsTop?.join(", ") ||
          creativeRoom.contextBrief ||
          seed,
      });

      const mappedBranches = creativeRoom.options.map((option, index) => ({
        title: option.label,
        summary: option.summary,
        body: [option.summary, option.nextAction, option.rationale]
          .filter(Boolean)
          .join("\n\n"),
        imagePrompt: option.promptSeed || option.summary || option.label,
        imageUrl: "",
        mood: (index === 0 ? "discovery" : "neutral") as
          | "discovery"
          | "neutral",
        tone: "divergent" as const,
        label: option.deliverable,
      }));

      if (mappedBranches.length > 0) {
        store.addBranches(
          "root",
          mappedBranches,
          "agent",
          "brainstorm",
          creativeRoom.title,
        );
      }
    },
    [],
  );

  const hydrateWritersRoomPackToCanvas = useCallback(
    (pack: WritersRoomPack, fallbackSeed?: string): void => {
      const store = useStory.getState();
      const seed = pack.seed?.trim() || fallbackSeed?.trim() || store.seed;

      lastLoadedStoryboardIdRef.current = null;
      store.resetToLanding();
      store.enterCanvas(seed, "filmmaking");
      store.setWorkflowId(pack.workflowId);

      const rootBody = [pack.title, pack.summary, pack.analysis.seedSummary]
        .filter(Boolean)
        .join("\n\n");
      const motifPrompt = Array.isArray(pack.analysis.motifsTop)
        ? pack.analysis.motifsTop.join(", ")
        : "";

      store.patchNodeProse("root", {
        body: rootBody,
        summary: pack.summary.slice(0, 400),
        rawBrainstorm: JSON.stringify(pack, null, 2),
        renderedImagePrompt: motifPrompt || pack.summary || pack.seed,
      });

      if (pack.stages.length === 0) {
        const branches = pack.deliverables.map((deliverable, index) => ({
          title: deliverable.title,
          summary: deliverable.summary,
          body: deliverable.body,
          imagePrompt: `${deliverable.title}: ${deliverable.summary}`,
          imageUrl: "",
          mood: (index === 0 ? "discovery" : "neutral") as
            | "discovery"
            | "neutral",
          tone: "divergent" as const,
          label: deliverable.tier,
        }));

        if (branches.length > 0) {
          store.addBranches(
            "root",
            branches,
            "agent",
            "writer-assist",
            pack.title,
          );
        }
        return;
      }

      // Hub-and-spoke: all stages as direct children of root (depth 1),
      // deliverables as children of their stage (depth 2). Max depth = 2.
      const stageBranches = pack.stages.map((stage) => {
        const stageDeliverables = pack.deliverables.filter(
          (deliverable) => deliverable.stageId === stage.id,
        );
        return {
          title: `${stage.order}. ${stage.title}`,
          summary: stage.summary,
          body: [
            stage.summary,
            stageDeliverables.length > 0
              ? `Artifacts: ${stageDeliverables.map((item) => item.title).join(", ")}`
              : "Artifacts pending refinement.",
          ].join("\n\n"),
          imagePrompt: `${stage.title}: ${stage.summary}`,
          imageUrl: "",
          mood: stage.id === "human-refinement" ? "hopeful" : "discovery",
          tone: "canon" as const,
          kind: "writers-room-stage" as const,
          label: "stage",
        };
      });

      const stageNodeIds = store.addBranches(
        "root",
        stageBranches,
        "agent",
        "writer-assist",
        pack.title,
      );

      // Map stage.id → nodeId for deliverable attachment
      const stageIdToNodeId: Record<string, string> = {};
      pack.stages.forEach((stage, idx) => {
        if (stageNodeIds[idx]) {
          stageIdToNodeId[stage.id] = stageNodeIds[idx];
        }
      });

      // Attach deliverables as children of their stage (depth 2)
      for (const stage of pack.stages) {
        const stageNodeId = stageIdToNodeId[stage.id];
        if (!stageNodeId) continue;

        const deliverableBranches = pack.deliverables
          .filter((deliverable) => deliverable.stageId === stage.id)
          .map((deliverable, index) => ({
            title: deliverable.title,
            summary: deliverable.summary,
            body: deliverable.body,
            imagePrompt: `${deliverable.title}: ${deliverable.summary}`,
            imageUrl: "",
            mood: (index === 0 ? "discovery" : "neutral") as
              | "discovery"
              | "neutral",
            tone: "divergent" as const,
            label: deliverable.tier,
          }));

        if (deliverableBranches.length > 0) {
          store.addBranches(
            stageNodeId,
            deliverableBranches,
            "agent",
            "writer-assist",
            stage.title,
          );
        }
      }

      // Suppress stale branchFocusRequest from hydration loop, then
      // set current to first stage and let Canvas fitView handle framing.
      useStory.setState({ branchFocusRequest: null });
      if (stageNodeIds.length > 0) {
        store.setCurrent(stageNodeIds[0], "agent", "writer-assist");
      }

      // Fire-and-forget: generate RHClaw images for each stage node.
      // Updates arrive asynchronously and patch the canvas in-place.
      const rpc = getBunRpc();
      if (rpc) {
        for (let i = 0; i < stageNodeIds.length; i++) {
          const nodeId = stageNodeIds[i];
          const stage = pack.stages[i];
          if (!nodeId || !stage) continue;
          rpc.request
            .generateImage({
              prompt: `${stage.title}: ${stage.summary}, cinematic concept art, dramatic lighting`,
            })
            .then((result: { imageUrl: string }) => {
              if (result?.imageUrl) {
                useStory.getState().setNodeImage(nodeId, result.imageUrl);
              }
            })
            .catch((err: unknown) => {
              console.warn(
                `[writers-room] image gen failed for stage ${stage.title}:`,
                err,
              );
            });
        }
      }
    },
    [],
  );

  const syncWritersRoomPackToCanvas = useCallback((pack: WritersRoomPack) => {
    const store = useStory.getState();
    store.patchNodeProse("root", {
      rawBrainstorm: JSON.stringify(pack, null, 2),
    });

    for (const [nodeId, node] of store.nodes.entries()) {
      const deliverable = pack.deliverables.find(
        (entry) => entry.title === node.title,
      );
      if (!deliverable) continue;
      store.patchNodeProse(nodeId, {
        summary: deliverable.summary.slice(0, 400),
        body: deliverable.body,
      });
    }
  }, []);

  const handleLandingSubmit = useCallback(
    async (
      seed: string,
      industry: IndustryMode,
      productionLayer: ProductionLayer,
      options: LayerStartOptions,
    ) => {
      const store = useStory.getState();
      setWritersRoomPack(null);
      setActiveLayer(productionLayer);
      store.enterCanvas(seed, industry);

      if (
        productionLayer === "writers-room" ||
        productionLayer === "ip-franchise"
      ) {
        pipeline.reset();
        setWritersRoomLoading(true);
        setInspectorTab("writersroom");

        const format =
          productionLayer === "ip-franchise"
            ? "franchise-ip"
            : (options.writersRoomFormat ?? "feature-film");
        const packageTier =
          productionLayer === "ip-franchise"
            ? "franchise"
            : (options.writersRoomTier ?? "studio");

        try {
          const rpc = getBunRpc();
          const pack = await rpc.request.generateWritersRoomPack({
            seed,
            format,
            packageTier,
            productionLayer,
          });
          setWritersRoomPack(pack);
          hydrateWritersRoomPackToCanvas(pack, seed);
          if (pack.workflowId) {
            useStory.getState().setWorkflowId(pack.workflowId);
          }
          toast.success(`${LAYER_LABELS[productionLayer]} ready`);
        } catch (err) {
          toast.error(
            err instanceof Error
              ? err.message
              : `Failed to start ${LAYER_LABELS[productionLayer]}`,
          );
        } finally {
          setWritersRoomLoading(false);
        }
        return;
      }

      if (
        productionLayer === "virtual-production" ||
        productionLayer === "post-localization"
      ) {
        pipeline.reset();
        setInspectorTab("overview");

        try {
          const rpc = getBunRpc();
          const { workflowId } = await rpc.request.submitIdea({
            idea: seed,
            style: pipeline.settings.style,
            settings: pipeline.settings,
            industryMode: industry,
            productionLayer,
          });
          store.setWorkflowId(workflowId);
        } catch (err) {
          toast.error(
            err instanceof Error
              ? err.message
              : `Failed to create ${LAYER_LABELS[productionLayer]} project`,
          );
          return;
        }

        store.patchNodeProse("root", {
          body: `${LAYER_LABELS[productionLayer]}\n\n${seed}`,
          summary: seed.slice(0, 400),
          renderedImagePrompt: `${LAYER_LABELS[productionLayer]}: ${seed}`,
        });
        const branches = layerBranches(productionLayer);
        if (branches.length > 0) {
          store.addBranches(
            "root",
            branches,
            "agent",
            "layer-router",
            LAYER_LABELS[productionLayer],
          );
        }

        toast.info(`Opening ${LAYER_LABELS[productionLayer]}...`);
        void expandNode("root", 4, {
          force: true,
          productionLayer,
        }).catch((err) => {
          toast.error(
            err instanceof Error
              ? err.message
              : "Failed to generate layer branches",
          );
        });
        return;
      }

      if (industry !== "filmmaking") {
        pipeline.reset();
        setInspectorTab("overview");
        try {
          const rpc = getBunRpc();
          const { workflowId } = await rpc.request.submitIdea({
            idea: seed,
            style: pipeline.settings.style,
            settings: pipeline.settings,
            industryMode: industry,
            productionLayer,
          });
          useStory.getState().setWorkflowId(workflowId);
        } catch (err) {
          toast.error(
            err instanceof Error
              ? err.message
              : "Failed to create creative workflow",
          );
          return;
        }

        toast.info(`Opening ${industry} development room...`);
        void expandNode("root", 4, { force: true }).catch((err) => {
          toast.error(
            err instanceof Error
              ? err.message
              : "Failed to generate next actions",
          );
        });
        return;
      }

      try {
        setInspectorTab("overview");
        await pipeline.submitIdea(
          seed,
          pipeline.settings.style,
          industry,
          productionLayer,
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to start pipeline",
        );
      }
    },
    [pipeline, toast],
  );

  const handleHistoryResume = useCallback(
    async (workflowId: string) => {
      try {
        const resumed: WorkflowResumePayload =
          await pipeline.resumeWorkflow(workflowId);
        const resumedLayer =
          resumed.productionLayer ??
          (resumed.writersRoomPack
            ? resumed.writersRoomPack.format === "franchise-ip"
              ? "ip-franchise"
              : "writers-room"
            : resumed.storyboard
              ? "storyboard-previs"
              : activeLayer);

        setActiveLayer(resumedLayer);
        setInspectorTab(resumed.writersRoomPack ? "writersroom" : "overview");

        setWritersRoomPack(resumed.writersRoomPack ?? null);

        if (resumed.storyboard) {
          lastLoadedStoryboardIdRef.current = resumed.storyboard.id;
          useStory
            .getState()
            .loadStoryboard(
              resumed.storyboard,
              resumed.storyboard.idea || workflowId,
            );
          if (resumed.writersRoomPack) {
            setWritersRoomPack(resumed.writersRoomPack);
          }
        } else if (resumed.creativeRoom) {
          hydrateCreativeRoomToCanvas(
            resumed.creativeRoom,
            resumed.creativeRoom.seed || workflowId,
          );
        } else if (resumed.writersRoomPack) {
          hydrateWritersRoomPackToCanvas(
            resumed.writersRoomPack,
            resumed.writersRoomPack.seed || workflowId,
          );
        } else {
          lastLoadedStoryboardIdRef.current = null;
          useStory
            .getState()
            .enterCanvas(workflowId, resumed.industryMode ?? industryMode);
          useStory.getState().setWorkflowId(workflowId);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : `Failed to resume ${workflowId}`,
        );
      }
    },
    [
      activeLayer,
      hydrateCreativeRoomToCanvas,
      hydrateWritersRoomPackToCanvas,
      industryMode,
      pipeline,
      toast,
    ],
  );

  const handleHistoryOpen = useCallback(
    async (workflowId: string) => {
      await handleHistoryResume(workflowId);
    },
    [handleHistoryResume],
  );

  const handleSceneUpdate = useCallback(
    (sceneId: string, updates: Partial<Scene>) => {
      const currentStoryboard = pipeline.storyboard;
      if (!currentStoryboard) return;

      const currentScene = currentStoryboard.scenes.find(
        (scene) => scene.id === sceneId,
      );
      if (!currentScene) return;

      pipeline.updateScene(sceneId, updates);

      const next = useStory.getState();
      const node = next.nodes.get(sceneId);
      if (node) {
        const mergedPrompt = (
          updates.customPrompt ??
          currentScene.customPrompt ??
          currentScene.description ??
          node.body ??
          node.summary ??
          ""
        ).trim();
        next.patchNodeProse(sceneId, {
          body: mergedPrompt,
          summary: (
            updates.customPrompt ??
            currentScene.description ??
            currentScene.customPrompt ??
            node.summary ??
            ""
          )
            .toString()
            .slice(0, 400),
          renderedImagePrompt: mergedPrompt,
          customPrompt: updates.customPrompt ?? currentScene.customPrompt,
          cameraAngle: updates.cameraAngle ?? currentScene.cameraAngle,
          lightingMood: updates.lightingMood ?? currentScene.lightingMood,
          characterRefUrl:
            updates.characterRefUrl ?? currentScene.characterRefUrl,
        });
      }
    },
    [pipeline],
  );

  const handlePresetApply = useCallback(
    (preset: StylePreset) => {
      const nextSettings = {
        ...pipeline.settings,
        style: preset.style,
        aspectRatio: preset.aspectRatio,
        sceneCount: preset.sceneCount,
      };
      pipeline.updateSettings(nextSettings);
      const rpc = (window as any).__electrobun_rpc;
      void rpc?.request?.saveSettings?.({ settings: nextSettings });
      toast.success(`Applied ${preset.name}`);
    },
    [pipeline, toast],
  );

  useEffect(() => {
    if (!pipeline.storyboard) return;
    syncStoryboardToCanvas(pipeline.storyboard);
  }, [pipeline.storyboard, syncStoryboardToCanvas]);

  useEffect(() => {
    if (mode === "canvas") return;
    setWritersRoomPack(null);
    setWritersRoomLoading(false);
    setProjectLog([]);
    setProjectLogPath(null);
    setInspectorTab("overview");
  }, [mode]);

  useEffect(() => {
    if (writersRoomPack || inspectorTab !== "writersroom") return;
    setInspectorTab("overview");
  }, [inspectorTab, writersRoomPack]);

  // High contrast mode toggle
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-high-contrast",
      highContrast ? "true" : "false",
    );
    try {
      localStorage.setItem("opencorn-high-contrast", String(highContrast));
    } catch {}
  }, [highContrast]);

  // Industry mode change — update render defaults
  useEffect(() => {
    const render = modeRenderType(industryMode);
    // Update CSS custom properties so downstream panels pick up the mode
    document.documentElement.style.setProperty(
      "--mode-aspect-ratio",
      render.aspectRatio,
    );
    document.documentElement.style.setProperty(
      "--mode-format",
      `"${render.format}"`,
    );
    document.documentElement.setAttribute("data-industry-mode", industryMode);
  }, [industryMode]);

  const togglePanel = useCallback((panel: SidePanel) => {
    setSidePanel((prev) => (prev === panel ? null : panel));
  }, []);

  const handleInspectorTabChange = useCallback((tab: InspectorTab) => {
    setInspectorTab(tab);
    setRightInspectorOpen(true);
  }, []);

  const handleSettingsChange = useCallback(
    (settings: AppSettings) => {
      pipeline.updateSettings(settings);
    },
    [pipeline],
  );

  const handleGenerateWritersRoomPack = useCallback(
    async (format: WritersRoomFormat, packageTier: WritersRoomPackageTier) => {
      const store = useStory.getState();
      const seed =
        store.seed?.trim() || pipeline.storyboard?.idea?.trim() || "";

      if (!seed) {
        toast.error("No active seed available for writers-room generation");
        return;
      }

      setWritersRoomLoading(true);

      try {
        const rpc = getBunRpc();
        const workflowId = pipeline.workflowId ?? store.workflowId ?? undefined;
        const pack = await rpc.request.generateWritersRoomPack({
          seed,
          format,
          packageTier,
          workflowId,
          productionLayer:
            format === "franchise-ip" ? "ip-franchise" : "writers-room",
        });

        setWritersRoomPack(pack);
        hydrateWritersRoomPackToCanvas(pack, seed);
        if (pack.workflowId) {
          store.setWorkflowId(pack.workflowId);
        }
        setActiveLayer(
          format === "franchise-ip" ? "ip-franchise" : "writers-room",
        );
        setInspectorTab("writersroom");
        toast.success("Writers-room pack ready");
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to generate writers-room pack",
        );
      } finally {
        setWritersRoomLoading(false);
      }
    },
    [
      hydrateWritersRoomPackToCanvas,
      pipeline.storyboard,
      pipeline.workflowId,
      toast,
    ],
  );

  const refreshProjectLog = useCallback(
    async (silent = false) => {
      if (!activeWorkflowId) {
        setProjectLog([]);
        setProjectLogPath(null);
        return;
      }

      if (!silent) {
        setProjectLogLoading(true);
      }

      try {
        const rpc = getBunRpc();
        const result = await rpc.request.getProjectLog({
          workflowId: activeWorkflowId,
          limit: 80,
        });
        setProjectLog(result.events ?? []);
        setProjectLogPath(result.logPath ?? null);
      } catch {
        if (!silent) {
          setProjectLog([]);
          setProjectLogPath(null);
        }
      } finally {
        if (!silent) {
          setProjectLogLoading(false);
        }
      }
    },
    [activeWorkflowId],
  );

  const handleRecordWritersRoomRefinement = useCallback(
    async (input: WritersRoomRefinementInput): Promise<WritersRoomPack> => {
      const rpc = getBunRpc();
      const pack = await rpc.request.recordWritersRoomRefinement(input);
      setWritersRoomPack(pack);
      toast.success("Writers-room refinement saved");
      void refreshProjectLog(true);
      return pack;
    },
    [refreshProjectLog, toast],
  );

  const handleRegenerateDeliverable = useCallback(
    async (deliverableId: string, userNotes?: string) => {
      if (!writersRoomPack) return;

      try {
        const rpc = getBunRpc();
        const pack = await rpc.request.regenerateWritersRoomDeliverable({
          workflowId: writersRoomPack.workflowId,
          deliverableId,
          notes: userNotes,
        });
        setWritersRoomPack(pack);
        syncWritersRoomPackToCanvas(pack);
        void refreshProjectLog(true);
        toast.success(`${deliverableId} regenerated`);
      } catch {
        toast.error(`Failed to regenerate ${deliverableId}`);
      }
    },
    [refreshProjectLog, syncWritersRoomPackToCanvas, toast, writersRoomPack],
  );

  const handleUpdateDeliverableBody = useCallback(
    async (deliverableId: string, body: string) => {
      if (!writersRoomPack) return;

      try {
        const rpc = getBunRpc();
        const pack = await rpc.request.updateWritersRoomDeliverable({
          workflowId: writersRoomPack.workflowId,
          deliverableId,
          body,
        });
        setWritersRoomPack(pack);
        syncWritersRoomPackToCanvas(pack);
        void refreshProjectLog(true);
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : `Failed to update ${deliverableId}`,
        );
      }
    },
    [refreshProjectLog, syncWritersRoomPackToCanvas, toast, writersRoomPack],
  );

  useEffect(() => {
    if (mode !== "canvas" || !activeWorkflowId) {
      setProjectLog([]);
      setProjectLogPath(null);
      return;
    }

    void refreshProjectLog(false);
    const intervalId = window.setInterval(() => {
      void refreshProjectLog(true);
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [activeWorkflowId, mode, refreshProjectLog]);

  const handleApprovePipeline = useCallback(async () => {
    try {
      const started = await pipeline.approvePipelineStage();
      if (started) {
        toast.success("Approval recorded. Continuing pipeline...");
      } else {
        toast.info("No pending approval stage to continue.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to continue pipeline",
      );
    }
  }, [pipeline, toast]);

  const handleEscape = useCallback(() => {
    if (showShortcuts) setShowShortcuts(false);
    else if (sidePanel) setSidePanel(null);
  }, [sidePanel, showShortcuts]);

  useKeyboardShortcuts({
    onSettings: () => togglePanel("settings"),
    onHistory: () => togglePanel("history"),
    onPromptCraft: () => togglePanel("promptcraft"),
    onPresets: () => togglePanel("presets"),
    onShortcuts: () => setShowShortcuts((v) => !v),
    onEscape: handleEscape,
  });

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // ─── Landing mode ───────────────────────────────────────────────────
  if (mode === "landing") {
    return (
      <ErrorBoundary>
        <div style={styles.app}>
          <HudNav current="landing" />

          <div style={styles.landingShell}>
            <div style={styles.landingCard}>
              <SeedInput onSubmit={handleLandingSubmit} />
            </div>

            <section style={styles.landingProjectsSection}>
              <ProjectsDashboard
                onOpen={handleHistoryOpen}
                onResume={handleHistoryResume}
                onDelete={async (workflowId) => {
                  const rpc = getBunRpc();
                  const result = await rpc?.request?.deleteWorkflow?.({
                    workflowId,
                  });
                  if (!result?.success) {
                    throw new Error("Delete failed");
                  }
                }}
              />
            </section>
          </div>

          <ToastContainer toasts={toast.toasts} onDismiss={toast.removeToast} />
          {showShortcuts && (
            <ShortcutsModal onClose={() => setShowShortcuts(false)} />
          )}
        </div>
      </ErrorBoundary>
    );
  }

  // ─── Projects dashboard ──────────────────────────────────────────────
  if (mode === "projects") {
    return (
      <ErrorBoundary>
        <div style={styles.app}>
          <HudNav
            current="projects"
            onNewProject={() => useStory.getState().resetToLanding()}
          />

          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: 24,
              background:
                "radial-gradient(circle at center, rgba(79,195,247,0.03), transparent 70%)",
            }}
          >
            <ProjectsDashboard
              onOpen={handleHistoryOpen}
              onResume={handleHistoryResume}
              onDelete={async (workflowId) => {
                const rpc = (window as any).__electrobun_rpc;
                const result = await rpc?.request?.deleteWorkflow?.({
                  workflowId,
                });
                if (!result?.success) {
                  throw new Error("Delete failed");
                }
              }}
            />
          </div>

          <ToastContainer toasts={toast.toasts} onDismiss={toast.removeToast} />
          {showShortcuts && (
            <ShortcutsModal onClose={() => setShowShortcuts(false)} />
          )}
        </div>
      </ErrorBoundary>
    );
  }

  // ─── Canvas mode ────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <div style={styles.app}>
        {/* Screen reader live region */}
        <div
          id="sr-announcer"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
          }}
        />

        {/* Header */}
        <div style={styles.header} role="banner">
          <div style={{ display: "flex", alignItems: "center" }}>
            <Logo />
            <button
              style={{ ...styles.navTab(false), marginLeft: 14 }}
              onClick={() => useStory.getState().navigateToProjects()}
              title="Back to projects dashboard"
              aria-label="Back to projects"
            >
              <FolderArchive size={14} strokeWidth={2.5} />
              Archive
            </button>
          </div>

          <nav
            style={styles.headerCenter}
            role="navigation"
            aria-label="Main navigation"
          >
            <button
              style={styles.headerBtn(sidePanel === "settings")}
              onClick={() => togglePanel("settings")}
              title="Settings (Cmd+,)"
              aria-label="Open settings panel"
              aria-pressed={sidePanel === "settings"}
            >
              <Settings size={14} strokeWidth={2.5} />
              Settings
            </button>
            <button
              style={styles.headerBtn(sidePanel === "history")}
              onClick={() => togglePanel("history")}
              title="History (Cmd+H)"
              aria-label="Open history panel"
              aria-pressed={sidePanel === "history"}
            >
              <History size={14} strokeWidth={2.5} />
              History
            </button>
            <button
              style={styles.headerBtn(sidePanel === "promptcraft")}
              onClick={() => togglePanel("promptcraft")}
              title="Prompt Craft (Cmd+P)"
              aria-label="Open prompt editor"
              aria-pressed={sidePanel === "promptcraft"}
            >
              <PenTool size={14} strokeWidth={2.5} />
              Craft
            </button>
            <button
              style={styles.headerBtn(sidePanel === "presets")}
              onClick={() => togglePanel("presets")}
              title="Style Presets (Cmd+S)"
              aria-label="Open style presets"
              aria-pressed={sidePanel === "presets"}
            >
              <Layers size={14} strokeWidth={2.5} />
              Styles
            </button>
          </nav>

          <div style={styles.headerRight}>
            <McpStatus connected={!!activeWorkflowId} />
            <button
              style={styles.highContrastBtn(highContrast)}
              onClick={() => {
                const next = !highContrast;
                setHighContrast(next);
                localStorage.setItem("opencorn-high-contrast", String(next));
              }}
              title="Toggle high contrast mode"
            >
              <Box size={14} strokeWidth={2.5} />
              Contrast
            </button>
            <ExportPanel
              workflowId={activeWorkflowId}
              videoUrl={pipeline.videoUrl}
              onSnapshot={async () => {
                const rpc = getBunRpc();
                try {
                  const result = await rpc?.request?.createSnapshot?.({
                    name: `snapshot-${Date.now()}`,
                  });
                  if (result) {
                    useStory.getState().addSnapshot({
                      snapshotName: result.snapshotName,
                      createdAt: result.createdAt,
                      sceneCount: result.sceneCount,
                      path: result.path,
                    });
                    toast.success("Snapshot created");
                  }
                } catch (err) {
                  toast.error("Failed to create snapshot");
                }
              }}
            />
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflow: "hidden",
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: [
              leftRailOpen ? "minmax(220px, 260px)" : "52px",
              "minmax(0, 1fr)",
              rightInspectorOpen ? "minmax(360px, 420px)" : "52px",
            ].join(" "),
          }}
        >
          {leftRailOpen ? (
            <StudioRail
              seed={useStory.getState().seed}
              workflowId={activeWorkflowId}
              industryMode={industryMode}
              activeLayer={activeLayer}
              writersRoomMode={writersRoomMode}
              writersRoomStatusLabel={writersRoomStatus?.label}
              writersRoomStatusDetail={writersRoomStatus?.detail}
              pipelineStage={pipeline.stage}
              pipelineProgress={pipeline.progress}
              pendingStage={pipeline.pendingStage}
              settings={pipeline.settings}
              hasWritersRoom={!!writersRoomPack}
              writersRoomStages={writersRoomPack?.stages ?? []}
              inspectorTab={inspectorTab}
              onInspectorTabChange={handleInspectorTabChange}
              onOpenArchive={() => useStory.getState().navigateToProjects()}
              onNewProject={() => useStory.getState().resetToLanding()}
              onCollapse={() => setLeftRailOpen(false)}
            />
          ) : (
            <aside
              style={styles.collapsedRail("left")}
              aria-label="Open production rail"
            >
              <button
                type="button"
                style={styles.collapsedRailButton}
                onClick={() => setLeftRailOpen(true)}
                aria-label="Open production rail"
                title="Open production rail"
              >
                <ChevronRight size={16} strokeWidth={2.4} />
                <span style={styles.collapsedRailLabel}>Rail</span>
              </button>
            </aside>
          )}

          <div
            style={{
              minWidth: 0,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <BreadcrumbTrail />

            <div
              style={{
                flex: 1,
                position: "relative",
                overflow: "hidden",
                minHeight: 0,
              }}
            >
              <ReactFlowProvider>
                <Canvas />
              </ReactFlowProvider>
              {writersRoomLoading && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 30,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 16,
                    background: "rgba(4,5,7,0.82)",
                    backdropFilter: "blur(6px)",
                    pointerEvents: "none",
                  }}
                >
                  <Activity
                    size={28}
                    color="#4fc3f7"
                    style={{ animation: "pulse 2s infinite" }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: "#4fc3f7",
                    }}
                  >
                    Building writers room
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "rgba(214,222,233,0.55)",
                      maxWidth: 320,
                      textAlign: "center",
                      lineHeight: 1.5,
                    }}
                  >
                    Generating the seven-stage development pack for the active
                    seed.
                  </span>
                </div>
              )}
              <AgentTicker systemActivities={systemActivities} />
              <BeatChooser />
              <InsertBetweenComposer />

              {sidePanel === "settings" && (
                <div
                  style={styles.sidePanel}
                  role="dialog"
                  aria-label="Settings panel"
                  aria-modal="true"
                >
                  <PanelSuspense>
                    <SettingsPanel
                      onClose={() => setSidePanel(null)}
                      onSettingsChange={handleSettingsChange}
                    />
                  </PanelSuspense>
                </div>
              )}
              {sidePanel === "history" && (
                <div
                  style={styles.sidePanel}
                  role="dialog"
                  aria-label="History panel"
                  aria-modal="true"
                >
                  <HistoryPanel
                    onClose={() => setSidePanel(null)}
                    onResume={handleHistoryResume}
                  />
                </div>
              )}
              {sidePanel === "promptcraft" && (
                <div
                  style={styles.sidePanel}
                  role="dialog"
                  aria-label="Prompt editor panel"
                  aria-modal="true"
                >
                  <PromptCraft
                    storyboard={pipeline.storyboard}
                    onSceneUpdate={handleSceneUpdate}
                    onClose={() => setSidePanel(null)}
                  />
                </div>
              )}
              {sidePanel === "presets" && (
                <div
                  style={styles.sidePanel}
                  role="dialog"
                  aria-label="Style presets panel"
                  aria-modal="true"
                >
                  <PanelSuspense>
                    <PresetGallery
                      onClose={() => setSidePanel(null)}
                      onApply={handlePresetApply}
                    />
                  </PanelSuspense>
                </div>
              )}
            </div>

            <StatusBar
              stage={pipeline.stage}
              progress={pipeline.progress}
              pendingStage={pipeline.pendingStage}
              error={pipeline.error}
              settings={pipeline.settings}
              statusOverrideText={
                writersRoomMode ? writersRoomStatus?.label : null
              }
              onApprove={
                !writersRoomMode && pipeline.storyboard
                  ? handleApprovePipeline
                  : undefined
              }
            />
          </div>

          {rightInspectorOpen ? (
            <CreativeInspector
              tab={inspectorTab}
              onTabChange={handleInspectorTabChange}
              onClose={() => setRightInspectorOpen(false)}
              seed={useStory.getState().seed}
              workflowId={activeWorkflowId}
              industryMode={industryMode}
              activeLayer={activeLayer}
              writersRoomMode={writersRoomMode}
              writersRoomStatusLabel={writersRoomStatus?.label}
              writersRoomStatusDetail={writersRoomStatus?.detail}
              pipelineStage={pipeline.stage}
              pipelineProgress={pipeline.progress}
              pendingStage={pipeline.pendingStage}
              error={pipeline.error}
              settings={pipeline.settings}
              currentNode={currentNode}
              currentScene={currentScene}
              writersRoomPack={writersRoomPack}
              writersRoomLoading={writersRoomLoading}
              projectLog={projectLog}
              projectLogLoading={projectLogLoading}
              projectLogPath={projectLogPath}
              onRefreshLogs={() => {
                void refreshProjectLog(false);
              }}
              onGenerateWritersRoomPack={handleGenerateWritersRoomPack}
              onRecordWritersRoomRefinement={handleRecordWritersRoomRefinement}
              onRegenerateDeliverable={handleRegenerateDeliverable}
              onUpdateDeliverableBody={handleUpdateDeliverableBody}
              onSceneUpdate={handleSceneUpdate}
              onApprovePipeline={
                !writersRoomMode && pipeline.storyboard
                  ? handleApprovePipeline
                  : undefined
              }
            />
          ) : (
            <aside
              style={styles.collapsedRail("right")}
              aria-label="Open creative inspector"
            >
              <button
                type="button"
                style={styles.collapsedRailButton}
                onClick={() => setRightInspectorOpen(true)}
                aria-label={`Open ${inspectorTabMeta(inspectorTab).label.toLowerCase()} inspector`}
                title={`Open ${inspectorTabMeta(inspectorTab).label.toLowerCase()} inspector`}
              >
                {(() => {
                  const { Icon, label } = inspectorTabMeta(inspectorTab);
                  return (
                    <>
                      <ChevronLeft size={16} strokeWidth={2.4} />
                      <Icon size={15} strokeWidth={2.2} />
                      <span style={styles.collapsedRailLabel}>{label}</span>
                    </>
                  );
                })()}
              </button>
            </aside>
          )}
        </div>

        <ToastContainer toasts={toast.toasts} onDismiss={toast.removeToast} />
        {showShortcuts && (
          <ShortcutsModal onClose={() => setShowShortcuts(false)} />
        )}
      </div>
    </ErrorBoundary>
  );
}

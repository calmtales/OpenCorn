import { useState, useCallback, lazy, Suspense, useEffect, useRef } from "react";
import type { FilmStyle, Storyboard, AppSettings, Scene, StylePreset } from "../shared/types";
import { McpStatus } from "./components/McpStatus";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { ToastContainer } from "./components/ToastContainer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SplashScreen } from "./components/SplashScreen";
import { SeedInput } from "./components/SeedInput";
import { Canvas, ReactFlowProvider } from "./components/Canvas";
import { AgentTicker } from "./components/AgentTicker";
import { BeatChooser } from "./components/BeatChooser";
import { ProjectsDashboard } from "./components/ProjectsDashboard";
import { useStory, modeLabels, modeRenderType, selectCanonPath } from "./lib/store";
import { useShallow } from "zustand/react/shallow";
import type { IndustryMode } from "./lib/types";
import { useFilmPipeline } from "./hooks/useFilmPipeline";
import { useToast } from "./hooks/useToast";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

// Lazy load — commented out for Phase 3 refactor (source files kept)
// const ComfyUIPanel = lazy(() => import("./components/ComfyUIPanel").then(m => ({ default: m.ComfyUIPanel })));
// const LocalModels = lazy(() => import("./components/LocalModels").then(m => ({ default: m.LocalModels })));
const PresetGallery = lazy(() => import("./components/PresetGallery").then(m => ({ default: m.PresetGallery })));
// const BatchPanel = lazy(() => import("./components/BatchPanel").then(m => ({ default: m.BatchPanel })));
const SettingsPanel = lazy(() => import("./components/SettingsPanel").then(m => ({ default: m.SettingsPanel })));

// Phase 3 imports — kept for use in canvas-mode header
import { ExportPanel } from "./components/ExportPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { PromptCraft } from "./components/PromptCraft";
import { ModeSelector } from "./components/ModeSelector";

type SidePanel = "settings" | "history" | "promptcraft" | "presets" | null;

const VERSION = "0.4.0";

function Logo({ size = 22 }: { size?: number }) {
  return (
    <div style={styles.logo}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="4" fill="var(--accent)" />
        <path d="M8 8L16 12L8 16V8Z" fill="var(--bg-primary)" />
      </svg>
      <span style={styles.logoText}>
        <span style={styles.logoAccent}>Open</span>Corn
      </span>
    </div>
  );
}

const styles = {
  app: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    overflow: "hidden",
    background: "radial-gradient(circle at top, rgba(20,26,36,0.95), var(--bg-primary) 45%, #040507 100%)",
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
    fontSize: 17,
    fontWeight: 700,
    letterSpacing: "-0.03em",
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
    background: "linear-gradient(180deg, rgba(6,8,12,0.15), rgba(6,8,12,0.45)), radial-gradient(circle at top, rgba(79,195,247,0.08), transparent 38%)",
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
  timelineArea: {
    flexShrink: 0,
    borderTop: "1px solid var(--border)",
    background: "var(--bg-secondary)",
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "5px 16px",
    background: "var(--bg-tertiary)",
    borderTop: "1px solid var(--border-subtle)",
    fontSize: 11,
    color: "var(--text-muted)",
    flexShrink: 0,
  },
  stageLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
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
    gap: 12,
    fontSize: 10,
  },
  kbd: {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    padding: "1px 5px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 3,
    fontSize: 9,
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
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
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
    gap: 20,
    padding: 24,
    overflow: "auto",
    background: "radial-gradient(circle at center, rgba(79,195,247,0.03), transparent 70%)",
  },
  landingCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
    minHeight: 0,
    maxHeight: "100%",
  },
  landingHero: {
    padding: 18,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(12,15,21,0.92), rgba(8,10,14,0.86))",
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
    fontSize: 10,
    textTransform: "uppercase" as const,
    letterSpacing: "0.22em",
    color: "rgba(170,185,205,0.55)",
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
};

function PanelSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div style={styles.panelLoading}>Loading panel...</div>}>
      {children}
    </Suspense>
  );
}

const PIPELINE_STAGE_LABELS: Record<string, string> = {
  generating_screenplay: "Writing screenplay…",
  generating_keyframes: "Rendering keyframes…",
  generating_video: "Generating video…",
  processing_audio: "Processing audio…",
  stitching: "Stitching…",
  complete: "Complete",
};

function pipelineStatusText(stage: string, progress: number): string | null {
  if (stage === "idle") return null;
  const label = PIPELINE_STAGE_LABELS[stage] ?? stage;
  return `${label} ${progress}%`;
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
        const shortTitle = node.title.length > 30 ? node.title.slice(0, 28) + "…" : node.title;
        return (
          <span key={nodeId} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
            {idx > 0 && (
              <span style={{ color: "rgba(170,185,205,0.25)", fontSize: 10, margin: "0 2px" }}>›</span>
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

export default function App() {
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [highContrast, setHighContrast] = useState(() => {
    try { return localStorage.getItem("opencorn-high-contrast") === "true"; } catch { return false; }
  });

  // Zustand branching canvas state
  const mode = useStory((s) => s.mode);
  const storyNodes = useStory((s) => s.nodes);
  const industryMode = useStory((s) => s.industryMode);

  // Existing film pipeline (kept for MCP + render flow)
  const pipeline = useFilmPipeline();
  const toast = useToast();
  const lastLoadedStoryboardIdRef = useRef<string | null>(null);

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

  const handleLandingSubmit = useCallback(
    async (seed: string, industry: IndustryMode) => {
      const store = useStory.getState();
      store.enterCanvas(seed, industry);
      try {
        await pipeline.submitIdea(seed, pipeline.settings.style);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to start film generation");
      }
    },
    [pipeline, toast],
  );

  const handleHistoryOpen = useCallback(
    async (workflowId: string) => {
      try {
        // Load storyboard into canvas without restarting pipeline
        const rpc = (window as any).__electrobun_rpc;
        const entry = await rpc?.request?.getStoryboard?.({ workflowId }).catch(() => null);
        if (entry) {
          lastLoadedStoryboardIdRef.current = entry.id;
          useStory.getState().loadStoryboard(entry, entry.idea || workflowId);
        } else {
          // Fall back to resumeWorkflow if storyboard not in local store
          await handleHistoryResume(workflowId);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Failed to open ${workflowId}`);
      }
    },
    [toast],
  );

  const handleHistoryResume = useCallback(
    async (workflowId: string) => {
      try {
        const storyboard = await pipeline.resumeWorkflow(workflowId);
        // Switch to canvas mode using the storyboard returned directly from the RPC,
        // avoiding stale-closure issues with the `pipeline` reference.
        if (storyboard) {
          lastLoadedStoryboardIdRef.current = storyboard.id;
          useStory.getState().loadStoryboard(storyboard, storyboard.idea || workflowId);
        } else {
          useStory.getState().enterCanvas(workflowId, industryMode);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Failed to resume ${workflowId}`);
      }
    },
    [pipeline, toast, industryMode],
  );

  const handleSceneUpdate = useCallback(
    (sceneId: string, updates: Partial<Scene>) => {
      const currentStoryboard = pipeline.storyboard;
      if (!currentStoryboard) return;

      const currentScene = currentStoryboard.scenes.find((scene) => scene.id === sceneId);
      if (!currentScene) return;

      pipeline.updateScene(sceneId, updates);

      const next = useStory.getState();
      const node = next.nodes.get(sceneId);
      if (node) {
        const mergedPrompt = (updates.customPrompt ?? currentScene.customPrompt ?? currentScene.description ?? node.body ?? node.summary ?? "").trim();
        next.patchNodeProse(sceneId, {
          body: mergedPrompt,
          summary: (updates.customPrompt ?? currentScene.description ?? currentScene.customPrompt ?? node.summary ?? "").toString().slice(0, 400),
          renderedImagePrompt: mergedPrompt,
          customPrompt: updates.customPrompt ?? currentScene.customPrompt,
          cameraAngle: updates.cameraAngle ?? currentScene.cameraAngle,
          lightingMood: updates.lightingMood ?? currentScene.lightingMood,
          characterRefUrl: updates.characterRefUrl ?? currentScene.characterRefUrl,
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

  // High contrast mode toggle
  useEffect(() => {
    document.documentElement.setAttribute("data-high-contrast", highContrast ? "true" : "false");
    try { localStorage.setItem("opencorn-high-contrast", String(highContrast)); } catch {}
  }, [highContrast]);

  // Industry mode change — update render defaults
  useEffect(() => {
    const render = modeRenderType(industryMode);
    // Update CSS custom properties so downstream panels pick up the mode
    document.documentElement.style.setProperty("--mode-aspect-ratio", render.aspectRatio);
    document.documentElement.style.setProperty("--mode-format", `"${render.format}"`);
    document.documentElement.setAttribute("data-industry-mode", industryMode);
  }, [industryMode]);

  const togglePanel = useCallback(
    (panel: SidePanel) => {
      setSidePanel((prev) => (prev === panel ? null : panel));
    },
    [],
  );

  const handleSettingsChange = useCallback(
    (settings: AppSettings) => {
      pipeline.updateSettings(settings);
    },
    [pipeline],
  );

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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(6,8,12,0.84)",
              backdropFilter: "blur(12px)",
            }}
          >
            <Logo />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                style={styles.highContrastBtn(false)}
                onClick={() => useStory.getState().navigateToProjects()}
                title="Browse all projects"
              >
                Projects
              </button>
              <span style={styles.landingHint}>start • resume • create</span>
            </div>
          </div>

          <div style={styles.landingShell}>
            <div style={styles.landingCard}>
              <div style={styles.landingHero}>
                <div style={styles.logoText}>Create</div>
                <div style={styles.landingCopy}>
                  Describe your story idea and let the AI generate a branching narrative canvas with keyframes and video.
                </div>
                <div style={styles.landingHint}>enter a seed to begin</div>
              </div>
              <SeedInput onSubmit={handleLandingSubmit} />
            </div>

            <div style={styles.landingCard}>
              <div style={styles.landingHero}>
                <div style={styles.logoText}>Projects</div>
                <div style={styles.landingCopy}>
                  View all your saved workflows. Open, resume, or delete projects from a single dashboard.
                </div>
                <button
                  style={{
                    ...styles.highContrastBtn(false),
                    marginTop: 12,
                    alignSelf: "flex-start",
                  }}
                  onClick={() => useStory.getState().navigateToProjects()}
                >
                  Open Projects Dashboard →
                </button>
              </div>
            </div>
          </div>

          <ToastContainer toasts={toast.toasts} onDismiss={toast.removeToast} />
          {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
        </div>
      </ErrorBoundary>
    );
  }

  // ─── Projects dashboard ──────────────────────────────────────────────
  if (mode === "projects") {
    return (
      <ErrorBoundary>
        <div style={styles.app}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(6,8,12,0.84)",
              backdropFilter: "blur(12px)",
            }}
          >
            <Logo />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                style={styles.highContrastBtn(false)}
                onClick={() => useStory.getState().resetToLanding()}
                title="Start a new project"
              >
                + New Project
              </button>
              <span style={styles.landingHint}>v{VERSION}</span>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: 24,
              background: "radial-gradient(circle at center, rgba(79,195,247,0.03), transparent 70%)",
            }}
          >
            <ProjectsDashboard
              onOpen={handleHistoryOpen}
              onResume={handleHistoryResume}
              onDelete={async (workflowId) => {
                const rpc = (window as any).__electrobun_rpc;
                await rpc?.request?.deleteWorkflow?.({ workflowId });
              }}
            />
          </div>

          <ToastContainer toasts={toast.toasts} onDismiss={toast.removeToast} />
          {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
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
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
        />

        {/* Header */}
        <div style={styles.header} role="banner">
          <div style={{ display: "flex", alignItems: "center" }}>
            <Logo />
            {/* ← Projects quick nav */}
            <button
              style={{
                marginLeft: 14,
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 8px",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "var(--radius-sm)",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.18em",
                textTransform: "uppercase" as const,
                cursor: "pointer",
                transition: "all var(--duration-fast) var(--ease-out)",
              }}
              onClick={() => useStory.getState().navigateToProjects()}
              title="Back to projects dashboard"
              aria-label="Back to projects"
            >
              ← projects
            </button>
          </div>

          <nav style={styles.headerCenter} role="navigation" aria-label="Main navigation">
            <button
              style={styles.headerBtn(sidePanel === "settings")}
              onClick={() => togglePanel("settings")}
              title="Settings (Cmd+,)"
              aria-label="Open settings panel"
              aria-pressed={sidePanel === "settings"}
            >
              ⚙ Settings
            </button>
            <button
              style={styles.headerBtn(sidePanel === "history")}
              onClick={() => togglePanel("history")}
              title="History (Cmd+H)"
              aria-label="Open workflow history"
              aria-pressed={sidePanel === "history"}
            >
              🕐 History
            </button>
            <button
              style={styles.headerBtn(sidePanel === "promptcraft")}
              onClick={() => togglePanel("promptcraft")}
              title="PromptCraft (Cmd+P)"
              aria-label="Open prompt editor"
              aria-pressed={sidePanel === "promptcraft"}
            >
              📊 Craft
            </button>
            <button
              style={styles.headerBtn(sidePanel === "presets")}
              onClick={() => togglePanel("presets")}
              title="Style Presets (Cmd+Shift+P)"
              aria-label="Open style presets"
              aria-pressed={sidePanel === "presets"}
            >
              🎨 Presets
            </button>
          </nav>

          <div style={styles.headerRight}>
            <ModeSelector />
            <button
              style={styles.highContrastBtn(highContrast)}
              onClick={() => setHighContrast((v) => !v)}
              aria-label={highContrast ? "Disable high contrast mode" : "Enable high contrast mode"}
              title="Toggle high contrast"
            >
              HC
            </button>
            <McpStatus connected={!!pipeline.workflowId} />
            <ExportPanel
              videoUrl={pipeline.videoUrl}
              disabled={pipeline.stage !== "complete"}
            />
            <button
              style={styles.headerBtn()}
              onClick={async () => {
                const rpc = (window as any).__electrobun_rpc;
                try {
                  const result = await rpc?.request?.createSnapshot?.({ name: `snapshot-${Date.now()}` });
                  if (result) {
                    useStory.getState().addSnapshot({
                      snapshotName: result.snapshotName,
                      createdAt: result.createdAt,
                      sceneCount: result.sceneCount,
                      path: result.path,
                    });
                    toast.success(`Snapshot saved: ${result.snapshotName}`);
                  }
                } catch (err: any) {
                  toast.error(err?.message ?? "Failed to create snapshot");
                }
              }}
              title="Create snapshot of current screenplay"
              aria-label="Create snapshot"
            >
              📸 Snapshot
            </button>
          </div>
        </div>

        {/* Breadcrumb trail — canon path from root to current beat */}
        <BreadcrumbTrail />

        {/* Canvas body — full ReactFlow + overlays */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <ReactFlowProvider>
            <Canvas />
          </ReactFlowProvider>
          <AgentTicker />
          <BeatChooser />

          {/* Floating side panels */}
          {sidePanel === "settings" && (
            <div style={styles.sidePanel} role="dialog" aria-label="Settings panel" aria-modal="true">
              <PanelSuspense>
                <SettingsPanel onClose={() => setSidePanel(null)} onSettingsChange={handleSettingsChange} />
              </PanelSuspense>
            </div>
          )}
          {sidePanel === "history" && (
            <div style={styles.sidePanel} role="dialog" aria-label="History panel" aria-modal="true">
              <HistoryPanel onClose={() => setSidePanel(null)} onResume={handleHistoryResume} />
            </div>
          )}
          {sidePanel === "promptcraft" && (
            <div style={styles.sidePanel} role="dialog" aria-label="Prompt editor panel" aria-modal="true">
              <PromptCraft storyboard={pipeline.storyboard} onSceneUpdate={handleSceneUpdate} onClose={() => setSidePanel(null)} />
            </div>
          )}
          {sidePanel === "presets" && (
            <div style={styles.sidePanel} role="dialog" aria-label="Style presets panel" aria-modal="true">
              <PanelSuspense>
                <PresetGallery onClose={() => setSidePanel(null)} onApply={handlePresetApply} />
              </PanelSuspense>
            </div>
          )}
        </div>

        {/* Status bar — slim, non-intrusive canvas info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "3px 16px",
            background: "var(--bg-secondary)",
            borderTop: "1px solid var(--border-subtle)",
            fontSize: 10,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.14em",
            flexShrink: 0,
          }}
          role="status"
          aria-live="polite"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: pipeline.stage === "complete" ? "#4caf50" : pipeline.stage === "idle" ? "#4fc3f7" : "#ff9800",
                boxShadow: pipeline.stage === "idle"
                  ? "0 0 5px rgba(79,195,247,0.35)"
                  : pipeline.stage === "complete"
                    ? "0 0 5px rgba(76,175,80,0.35)"
                    : "0 0 5px rgba(255,152,0,0.35)",
              }}
              aria-hidden="true"
            />
            <span style={{ textTransform: "uppercase", opacity: 0.7 }}>
              {storyNodes.size} {modeLabels(industryMode).beat.toLowerCase()}s
            </span>
            {pipelineStatusText(pipeline.stage, pipeline.progress) && (
              <span style={{
                color: pipeline.stage === "complete" ? "#4caf50" : "var(--accent)",
                fontWeight: 500,
              }}>
                · {pipelineStatusText(pipeline.stage, pipeline.progress)}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: 0.5 }}>
            <span style={{ fontSize: 9 }}>
              <span style={styles.kbd} aria-hidden="true">⌘/</span> shortcuts
            </span>
            <span style={{ fontSize: 9 }}>v{VERSION}</span>
          </div>
        </div>

        <ToastContainer toasts={toast.toasts} onDismiss={toast.removeToast} />
        {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      </div>
    </ErrorBoundary>
  );
}

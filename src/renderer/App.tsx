import { useState, useCallback, lazy, Suspense, useEffect } from "react";
import type { FilmStyle, Storyboard, AppSettings, Scene, StylePreset } from "../shared/types";
import { IdeaInput } from "./components/IdeaInput";
import { StoryboardGrid } from "./components/StoryboardGrid";
import { TimelineBar } from "./components/TimelineBar";
import { PlayerPreview } from "./components/PlayerPreview";
import { McpStatus } from "./components/McpStatus";
import { ExportPanel } from "./components/ExportPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { PromptCraft } from "./components/PromptCraft";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { ToastContainer } from "./components/ToastContainer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SplashScreen } from "./components/SplashScreen";
import { useFilmPipeline } from "./hooks/useFilmPipeline";
import { useToast } from "./hooks/useToast";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

// Lazy load heavy panels — only bundle when opened
const ComfyUIPanel = lazy(() => import("./components/ComfyUIPanel").then(m => ({ default: m.ComfyUIPanel })));
const LocalModels = lazy(() => import("./components/LocalModels").then(m => ({ default: m.LocalModels })));
const PresetGallery = lazy(() => import("./components/PresetGallery").then(m => ({ default: m.PresetGallery })));
const BatchPanel = lazy(() => import("./components/BatchPanel").then(m => ({ default: m.BatchPanel })));
const SettingsPanel = lazy(() => import("./components/SettingsPanel").then(m => ({ default: m.SettingsPanel })));

type SidePanel = "settings" | "history" | "promptcraft" | "comfyui" | "localmodels" | "presets" | "batch" | null;

const VERSION = "0.4.0";

const styles = {
  app: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    overflow: "hidden",
    background: "var(--bg-primary)",
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
    background: "var(--bg-primary)",
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

export default function App() {
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [highContrast, setHighContrast] = useState(() => {
    try { return localStorage.getItem("opencorn-high-contrast") === "true"; } catch { return false; }
  });
  const pipeline = useFilmPipeline();
  const toast = useToast();

  const activeStoryboard = pipeline.storyboard ?? storyboard;

  // Screen reader announcements for pipeline stage changes
  useEffect(() => {
    const announcer = document.getElementById("sr-announcer");
    if (announcer) {
      const stageLabels: Record<string, string> = {
        generating_screenplay: "Generating screenplay",
        generating_keyframes: "Rendering keyframes",
        generating_video: "Generating video",
        processing_audio: "Processing audio",
        stitching: "Stitching final render",
        complete: "Film generation complete",
      };
      const label = stageLabels[pipeline.stage];
      if (label) announcer.textContent = label;
    }
  }, [pipeline.stage]);

  // High contrast mode toggle
  useEffect(() => {
    document.documentElement.setAttribute("data-high-contrast", highContrast ? "true" : "false");
    try { localStorage.setItem("opencorn-high-contrast", String(highContrast)); } catch {}
  }, [highContrast]);

  // Auto-save settings every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const rpc = (window as any).__electrobun_rpc;
        rpc?.request?.saveSettings?.({ settings: pipeline.settings }).catch(() => {});
      } catch {}
    }, 30_000);
    return () => clearInterval(interval);
  }, [pipeline.settings]);

  const handleSubmit = useCallback(
    async (idea: string, style: FilmStyle) => {
      try {
        await pipeline.submitIdea(idea, style);
      } catch (err) {
        toast.error("Failed to start generation. Check MCP connection.");
      }
    },
    [pipeline, toast]
  );

  const togglePanel = useCallback(
    (panel: SidePanel) => {
      setSidePanel((prev) => (prev === panel ? null : panel));
    },
    []
  );

  const handleResume = useCallback(
    (workflowId: string) => {
      pipeline.resumeWorkflow(workflowId);
    },
    [pipeline]
  );

  const handleSceneUpdate = useCallback(
    (sceneId: string, updates: Partial<Scene>) => {
      pipeline.updateScene(sceneId, updates);
    },
    [pipeline]
  );

  const handleSettingsChange = useCallback(
    (settings: AppSettings) => {
      pipeline.updateSettings(settings);
    },
    [pipeline]
  );

  const handleEscape = useCallback(() => {
    if (showShortcuts) {
      setShowShortcuts(false);
    } else if (sidePanel) {
      setSidePanel(null);
    }
  }, [sidePanel, showShortcuts]);

  const handlePresetApply = useCallback(
    (preset: StylePreset) => {
      pipeline.updateSettings({
        ...pipeline.settings,
        style: preset.style,
        aspectRatio: preset.aspectRatio,
        sceneCount: preset.sceneCount,
      });
    },
    [pipeline]
  );

  useKeyboardShortcuts({
    onSubmit: () => {
      if (pipeline.stage === "idle" || pipeline.stage === "complete") {
        // Handled by IdeaInput's own handler
      }
    },
    onSettings: () => togglePanel("settings"),
    onHistory: () => togglePanel("history"),
    onPromptCraft: () => togglePanel("promptcraft"),
    onComfyUI: () => togglePanel("comfyui"),
    onLocalModels: () => togglePanel("localmodels"),
    onPresets: () => togglePanel("presets"),
    onBatch: () => togglePanel("batch"),
    onShortcuts: () => setShowShortcuts((v) => !v),
    onEscape: handleEscape,
  });

  const stageLabels: Record<string, string> = {
    idle: "Ready",
    generating_screenplay: "Writing screenplay...",
    generating_keyframes: "Rendering keyframes...",
    generating_video: "Generating video...",
    processing_audio: "Processing audio...",
    stitching: "Stitching final render...",
    complete: "Complete",
  };

  const isActive = pipeline.stage !== "idle";

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <ErrorBoundary>
      <div style={styles.app}>
        {/* Screen reader live region for pipeline announcements */}
        <div id="sr-announcer" aria-live="polite" aria-atomic="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }} />

        {/* Header */}
        <div style={styles.header} role="banner">
          <div style={styles.logo}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="4" fill="var(--accent)" />
              <path d="M8 8L16 12L8 16V8Z" fill="var(--bg-primary)" />
            </svg>
            <span style={styles.logoText}>
              <span style={styles.logoAccent}>Open</span>Corn
            </span>
          </div>

          {/* Center nav buttons */}
          <nav style={styles.headerCenter} role="navigation" aria-label="Main navigation">
            <button
              style={styles.headerBtn(sidePanel === "settings")}
              onClick={() => togglePanel("settings")}
              title="Settings (Cmd+,)"
              aria-label="Open settings panel"
              aria-pressed={sidePanel === "settings"}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M11.2 2.8l-1.4 1.4M4.2 9.8l-1.4 1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Settings
            </button>
            <button
              style={styles.headerBtn(sidePanel === "history")}
              onClick={() => togglePanel("history")}
              title="History (Cmd+H)"
              aria-label="Open workflow history"
              aria-pressed={sidePanel === "history"}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M7 4v3l2.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              History
            </button>
            <button
              style={styles.headerBtn(sidePanel === "promptcraft")}
              onClick={() => togglePanel("promptcraft")}
              title="PromptCraft (Cmd+P)"
              aria-label="Open prompt editor"
              aria-pressed={sidePanel === "promptcraft"}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 11l3-8 3.5 5L12 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="11" cy="11" r="2" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              Craft
            </button>
            <button
              style={styles.headerBtn(sidePanel === "comfyui")}
              onClick={() => togglePanel("comfyui")}
              title="ComfyUI (Cmd+K)"
              aria-label="Open ComfyUI panel"
              aria-pressed={sidePanel === "comfyui"}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              ComfyUI
            </button>
            <button
              style={styles.headerBtn(sidePanel === "presets")}
              onClick={() => togglePanel("presets")}
              title="Style Presets (Cmd+Shift+P)"
              aria-label="Open style presets"
              aria-pressed={sidePanel === "presets"}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" opacity="0.3" />
                <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor" opacity="0.6" />
                <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.9" />
                <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" />
              </svg>
              Presets
            </button>
            <button
              style={styles.headerBtn(sidePanel === "batch")}
              onClick={() => togglePanel("batch")}
              title="Batch Mode (Cmd+B)"
              aria-label="Open batch processing"
              aria-pressed={sidePanel === "batch"}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Batch
            </button>
            <button
              style={styles.headerBtn(sidePanel === "localmodels")}
              onClick={() => togglePanel("localmodels")}
              title="Local Models (Cmd+L)"
              aria-label="Open local models manager"
              aria-pressed={sidePanel === "localmodels"}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M7 1v6M4 4l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 9v3a1 1 0 001 1h8a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Models
            </button>
          </nav>

          <div style={styles.headerRight}>
            <button
              style={styles.highContrastBtn(highContrast)}
              onClick={() => setHighContrast((v) => !v)}
              aria-label={highContrast ? "Disable high contrast mode" : "Enable high contrast mode"}
              aria-pressed={highContrast}
              title="Toggle high contrast"
            >
              HC
            </button>
            <McpStatus connected={!!pipeline.workflowId} />
            <ExportPanel
              videoUrl={pipeline.videoUrl}
              disabled={pipeline.stage !== "complete"}
            />
          </div>
        </div>

        {/* Progress bar */}
        {isActive && (
          <div style={styles.progressBar} role="progressbar" aria-valuenow={pipeline.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Generation progress: ${pipeline.progress}%`}>
            <div style={{ ...styles.progressFill, width: `${pipeline.progress}%` }} />
          </div>
        )}

        {/* Main area */}
        <div style={styles.main}>
          {/* Sidebar with IdeaInput */}
          <div style={{ ...styles.sidebar(sidebarCollapsed), position: "relative" as const }}>
            {!sidebarCollapsed && (
              <IdeaInput
                onSubmit={handleSubmit}
                disabled={pipeline.stage !== "idle" && pipeline.stage !== "complete"}
              />
            )}
            <button
              style={styles.sidebarToggle}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path
                  d={sidebarCollapsed ? "M2 1l5 4-5 4" : "M8 1L3 5l5 4"}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div style={styles.content}>
            <div style={styles.viewport}>
              <div style={styles.storyboardArea}>
                <StoryboardGrid storyboard={activeStoryboard} />
              </div>
              <div style={styles.previewPanel}>
                <PlayerPreview
                  videoUrl={pipeline.videoUrl}
                  scenes={activeStoryboard?.scenes}
                />
              </div>
            </div>
            <div style={styles.timelineArea}>
              <TimelineBar storyboard={activeStoryboard} />
            </div>

            {/* Floating side panels */}
            {sidePanel === "settings" && (
              <div style={styles.sidePanel} role="dialog" aria-label="Settings panel" aria-modal="true">
                <PanelSuspense>
                  <SettingsPanel
                    onClose={() => setSidePanel(null)}
                    onSettingsChange={handleSettingsChange}
                  />
                </PanelSuspense>
              </div>
            )}
            {sidePanel === "history" && (
              <div style={styles.sidePanel} role="dialog" aria-label="History panel" aria-modal="true">
                <HistoryPanel
                  onClose={() => setSidePanel(null)}
                  onResume={handleResume}
                />
              </div>
            )}
            {sidePanel === "promptcraft" && (
              <div style={styles.sidePanel} role="dialog" aria-label="Prompt editor panel" aria-modal="true">
                <PromptCraft
                  storyboard={activeStoryboard}
                  onSceneUpdate={handleSceneUpdate}
                  onClose={() => setSidePanel(null)}
                />
              </div>
            )}
            {sidePanel === "comfyui" && (
              <div style={styles.sidePanel} role="dialog" aria-label="ComfyUI panel" aria-modal="true">
                <PanelSuspense>
                  <ComfyUIPanel onClose={() => setSidePanel(null)} />
                </PanelSuspense>
              </div>
            )}
            {sidePanel === "localmodels" && (
              <div style={styles.sidePanel} role="dialog" aria-label="Local models panel" aria-modal="true">
                <PanelSuspense>
                  <LocalModels onClose={() => setSidePanel(null)} />
                </PanelSuspense>
              </div>
            )}
            {sidePanel === "presets" && (
              <div style={styles.sidePanel} role="dialog" aria-label="Style presets panel" aria-modal="true">
                <PanelSuspense>
                  <PresetGallery onClose={() => setSidePanel(null)} onApply={handlePresetApply} />
                </PanelSuspense>
              </div>
            )}
            {sidePanel === "batch" && (
              <div style={styles.sidePanel} role="dialog" aria-label="Batch processing panel" aria-modal="true">
                <PanelSuspense>
                  <BatchPanel onClose={() => setSidePanel(null)} />
                </PanelSuspense>
              </div>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div style={styles.statusBar} role="status" aria-live="polite">
          <div style={styles.stageLabel}>
            <div
              style={{
                ...styles.progressDot,
                background:
                  pipeline.stage === "complete"
                    ? "var(--success)"
                    : pipeline.stage === "idle"
                      ? "var(--text-muted)"
                      : "var(--accent)",
                boxShadow:
                  pipeline.stage !== "idle" && pipeline.stage !== "complete"
                    ? "0 0 6px var(--accent-glow)"
                    : pipeline.stage === "complete"
                      ? "0 0 6px var(--success-muted)"
                      : "none",
              }}
              aria-hidden="true"
            />
            <span>{stageLabels[pipeline.stage] ?? pipeline.stage}</span>
            {pipeline.error && (
              <span style={{ color: "var(--error)", marginLeft: 8 }}>
                {pipeline.error}
              </span>
            )}
          </div>
          <div style={styles.shortcutsHint}>
            <span>
              <span style={styles.kbd} aria-hidden="true">⌘↵</span> <span className="sr-only">Cmd+Enter to</span> Generate
            </span>
            <span>
              <span style={styles.kbd} aria-hidden="true">⌘,</span> Settings
            </span>
            <span>
              <span style={styles.kbd} aria-hidden="true">⌘K</span> ComfyUI
            </span>
            <span>
              <span style={styles.kbd} aria-hidden="true">⌘B</span> Batch
            </span>
            <span>
              <span style={styles.kbd} aria-hidden="true">⌘/</span> Shortcuts
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {isActive ? `${pipeline.progress}%` : ""}
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: 9, fontFamily: "var(--font-mono)" }}>
              v{VERSION}
            </span>
          </div>
        </div>

        {/* Toast notifications */}
        <ToastContainer toasts={toast.toasts} onDismiss={toast.removeToast} />

        {/* Keyboard shortcuts modal */}
        {showShortcuts && (
          <ShortcutsModal onClose={() => setShowShortcuts(false)} />
        )}
      </div>
    </ErrorBoundary>
  );
}

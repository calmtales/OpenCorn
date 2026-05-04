import { useState, useCallback, lazy, Suspense, useEffect } from "react";
import type { FilmStyle, Storyboard, AppSettings, Scene, StylePreset } from "../shared/types";
import { McpStatus } from "./components/McpStatus";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { ToastContainer } from "./components/ToastContainer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SplashScreen } from "./components/SplashScreen";
import { SeedInput } from "./components/SeedInput";
import { Canvas, ReactFlowProvider } from "./components/Canvas";
import { AgentTicker } from "./components/AgentTicker";
import { useStory, modeLabels, modeRenderType } from "./lib/store";
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
          <SeedInput />
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
          <div style={styles.logo}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="4" fill="var(--accent)" />
              <path d="M8 8L16 12L8 16V8Z" fill="var(--bg-primary)" />
            </svg>
            <span style={styles.logoText}>
              <span style={styles.logoAccent}>Open</span>Corn
            </span>
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
            {/* Back to landing */}
            <button
              style={styles.headerBtn(false)}
              onClick={() => useStory.getState().resetToLanding()}
              title="Back to seed input"
              aria-label="Return to seed input"
            >
              ✦ New Story
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
          </div>
        </div>

        {/* Canvas body — full ReactFlow + overlays */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <ReactFlowProvider>
            <Canvas />
          </ReactFlowProvider>
          <AgentTicker />

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
              <HistoryPanel onClose={() => setSidePanel(null)} onResume={() => {}} />
            </div>
          )}
          {sidePanel === "promptcraft" && (
            <div style={styles.sidePanel} role="dialog" aria-label="Prompt editor panel" aria-modal="true">
              <PromptCraft storyboard={null} onSceneUpdate={() => {}} onClose={() => setSidePanel(null)} />
            </div>
          )}
          {sidePanel === "presets" && (
            <div style={styles.sidePanel} role="dialog" aria-label="Style presets panel" aria-modal="true">
              <PanelSuspense>
                <PresetGallery onClose={() => setSidePanel(null)} onApply={() => {}} />
              </PanelSuspense>
            </div>
          )}
        </div>

        {/* Status bar — canvas mode info */}
        <div style={styles.statusBar} role="status" aria-live="polite">
          <div style={styles.stageLabel}>
            <div
              style={{
                ...styles.progressDot,
                background: "#4fc3f7",
                boxShadow: "0 0 6px rgba(79,195,247,0.4)",
              }}
              aria-hidden="true"
            />
            <span>Canvas · {storyNodes.size} {modeLabels(industryMode).beat.toLowerCase()}s</span>
          </div>
          <div style={styles.shortcutsHint}>
            <span>
              <span style={styles.kbd} aria-hidden="true">⌘,</span> Settings
            </span>
            <span>
              <span style={styles.kbd} aria-hidden="true">⌘/</span> Shortcuts
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: 9, fontFamily: "var(--font-mono)" }}>
              v{VERSION} · {industryMode}
            </span>
          </div>
        </div>

        <ToastContainer toasts={toast.toasts} onDismiss={toast.removeToast} />
        {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      </div>
    </ErrorBoundary>
  );
}

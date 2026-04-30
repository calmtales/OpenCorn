import { useState, useEffect } from "react";
import type {
  AppSettings,
  FilmStyle,
  VideoProvider,
  ImageProvider,
  AspectRatio,
  ExportFormat,
  ExportResolution,
} from "../../shared/types";
import { DEFAULT_SETTINGS } from "../../shared/types";

const VIDEO_PROVIDERS: { value: VideoProvider; label: string }[] = [
  { value: "sora2", label: "Sora 2" },
  { value: "seedance", label: "Seedance" },
  { value: "wan", label: "WAN" },
];

const IMAGE_PROVIDERS: { value: ImageProvider; label: string }[] = [
  { value: "nano_banana", label: "Nano Banana" },
  { value: "seedream", label: "SeeDream" },
  { value: "gemini", label: "Gemini" },
];

const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: "16:9", label: "16:9 Landscape" },
  { value: "9:16", label: "9:16 Portrait" },
  { value: "1:1", label: "1:1 Square" },
];

const FILM_STYLES: { value: FilmStyle; label: string; icon: string }[] = [
  { value: "anime", label: "Anime", icon: "🎌" },
  { value: "noir", label: "Film Noir", icon: "🎬" },
  { value: "cyberpunk", label: "Cyberpunk", icon: "🌆" },
  { value: "watercolor", label: "Watercolor", icon: "🎨" },
  { value: "realistic", label: "Realistic", icon: "📷" },
  { value: "stop-motion", label: "Stop Motion", icon: "🧸" },
];

const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "mp4", label: "MP4 (H.264)" },
  { value: "webm", label: "WebM (VP9)" },
  { value: "mov", label: "MOV (ProRes)" },
];

const RESOLUTIONS: { value: ExportResolution; label: string }[] = [
  { value: "480p", label: "480p SD" },
  { value: "720p", label: "720p HD" },
  { value: "1080p", label: "1080p FHD" },
  { value: "4k", label: "4K UHD" },
];

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid var(--border-subtle)",
    flexShrink: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: 4,
    display: "flex",
  },
  body: {
    flex: 1,
    overflow: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
  },
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
  },
  input: {
    width: "100%",
    padding: "8px 10px",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    fontSize: 12,
    outline: "none",
    fontFamily: "var(--font-mono)",
  },
  select: {
    width: "100%",
    padding: "8px 10px",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    fontSize: 12,
    outline: "none",
    appearance: "none" as const,
    cursor: "pointer",
  },
  styleGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 6,
  },
  styleBtn: (selected: boolean) => ({
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 4,
    padding: "8px 4px",
    background: selected ? "var(--accent-muted)" : "var(--bg-tertiary)",
    border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
    borderRadius: "var(--radius-sm)",
    color: selected ? "var(--accent)" : "var(--text-secondary)",
    fontSize: 10,
    fontWeight: selected ? 600 : 400,
    cursor: "pointer",
  }),
  styleIcon: {
    fontSize: 18,
  },
  sliderRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  slider: {
    flex: 1,
    appearance: "none" as const,
    height: 4,
    borderRadius: 2,
    background: "var(--bg-tertiary)",
    outline: "none",
    cursor: "pointer",
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--accent)",
    minWidth: 28,
    textAlign: "center" as const,
  },
  row: {
    display: "flex",
    gap: 10,
  },
  halfField: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  footer: {
    padding: "12px 16px",
    borderTop: "1px solid var(--border-subtle)",
    display: "flex",
    gap: 8,
    flexShrink: 0,
  },
  saveBtn: {
    flex: 1,
    padding: "8px 0",
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-sm)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  resetBtn: {
    padding: "8px 12px",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-secondary)",
    fontSize: 12,
    cursor: "pointer",
  },
};

interface Props {
  onClose: () => void;
  onSettingsChange?: (settings: AppSettings) => void;
}

export function SettingsPanel({ onClose, onSettingsChange }: Props) {
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });

  useEffect(() => {
    const rpc = (window as any).__electrobun_rpc;
    rpc?.request?.getSettings?.().then((s: AppSettings) => {
      if (s) setSettings(s);
    }).catch(() => {});
  }, []);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const rpc = (window as any).__electrobun_rpc;
    rpc?.request?.saveSettings?.({ settings }).catch(() => {});
    onSettingsChange?.(settings);
    window.dispatchEvent(new CustomEvent("toast", { detail: { id: "", type: "success", message: "Settings saved" } }));
    onClose();
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_SETTINGS });
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.title}>Settings</span>
        <button style={s.closeBtn} onClick={onClose} aria-label="Close settings">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div style={s.body}>
        {/* MCP Server URL */}
        <div style={s.section}>
          <label style={s.label}>MCP Server URL</label>
          <input
            style={s.input}
            value={settings.mcpServerUrl}
            onChange={(e) => update("mcpServerUrl", e.target.value)}
            placeholder="stdio://stoira_mcp_server.py"
          />
        </div>

        {/* Video Provider */}
        <div style={s.section}>
          <label style={s.label}>Video Provider</label>
          <select
            style={s.select}
            value={settings.videoProvider}
            onChange={(e) => update("videoProvider", e.target.value as VideoProvider)}
          >
            {VIDEO_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Image Provider */}
        <div style={s.section}>
          <label style={s.label}>Image Provider</label>
          <select
            style={s.select}
            value={settings.imageProvider}
            onChange={(e) => update("imageProvider", e.target.value as ImageProvider)}
          >
            {IMAGE_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Aspect Ratio + Scene Count */}
        <div style={s.row}>
          <div style={s.halfField}>
            <label style={s.label}>Aspect Ratio</label>
            <select
              style={s.select}
              value={settings.aspectRatio}
              onChange={(e) => update("aspectRatio", e.target.value as AspectRatio)}
            >
              {ASPECT_RATIOS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div style={s.halfField}>
            <label style={s.label}>Scenes: {settings.sceneCount}</label>
            <div style={s.sliderRow}>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>1</span>
              <input
                type="range"
                min={1}
                max={30}
                value={settings.sceneCount}
                onChange={(e) => update("sceneCount", Number(e.target.value))}
                style={s.slider}
              />
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>30</span>
              <span style={s.sliderValue}>{settings.sceneCount}</span>
            </div>
          </div>
        </div>

        {/* Style Picker */}
        <div style={s.section}>
          <label style={s.label}>Default Style</label>
          <div style={s.styleGrid}>
            {FILM_STYLES.map((st) => (
              <button
                key={st.value}
                style={s.styleBtn(settings.style === st.value)}
                onClick={() => update("style", st.value)}
              >
                <span style={s.styleIcon}>{st.icon}</span>
                <span>{st.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Export Format + Resolution */}
        <div style={s.row}>
          <div style={s.halfField}>
            <label style={s.label}>Export Format</label>
            <select
              style={s.select}
              value={settings.exportFormat}
              onChange={(e) => update("exportFormat", e.target.value as ExportFormat)}
            >
              {EXPORT_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div style={s.halfField}>
            <label style={s.label}>Resolution</label>
            <select
              style={s.select}
              value={settings.exportResolution}
              onChange={(e) => update("exportResolution", e.target.value as ExportResolution)}
            >
              {RESOLUTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={s.footer}>
        <button style={s.resetBtn} onClick={handleReset}>Reset</button>
        <button style={s.saveBtn} onClick={handleSave}>Save Settings</button>
      </div>
    </div>
  );
}

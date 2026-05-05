import { useState, useCallback } from "react";
import { useStory } from "../lib/store";
import type { CameraAngle, LightingMood } from "../../shared/types";

const CAMERA_ANGLES: { value: CameraAngle; label: string; icon: string }[] = [
  { value: "wide", label: "Wide", icon: "🔭" },
  { value: "medium", label: "Medium", icon: "🎥" },
  { value: "close-up", label: "Close-up", icon: "🔍" },
  { value: "tracking", label: "Tracking", icon: "🏃" },
  { value: "dolly", label: "Dolly", icon: "🎬" },
];

const LIGHTING_MOODS: { value: LightingMood; label: string; icon: string }[] = [
  { value: "natural", label: "Natural", icon: "☀️" },
  { value: "dramatic", label: "Dramatic", icon: "⚡" },
  { value: "warm", label: "Warm", icon: "🔥" },
  { value: "cool", label: "Cool", icon: "❄️" },
  { value: "noir", label: "Noir", icon: "🌑" },
  { value: "golden-hour", label: "Golden", icon: "🌅" },
  { value: "neon", label: "Neon", icon: "💜" },
];

const STYLES = ["anime", "realistic", "cinematic", "watercolor", "noir", "cyberpunk"];

const s = {
  panel: {
    position: "absolute" as const,
    bottom: 16,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(10,13,18,0.96)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "var(--radius-md)",
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
    backdropFilter: "blur(12px)",
    zIndex: 30,
    minWidth: 360,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--accent)",
    letterSpacing: "0.02em",
  },
  count: {
    fontSize: 10,
    color: "var(--text-muted)",
    fontWeight: 500,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: 2,
    display: "flex",
  },
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  label: {
    fontSize: 9,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "var(--text-muted)",
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 4,
  },
  chip: (selected: boolean) => ({
    padding: "4px 8px",
    background: selected ? "var(--accent-muted)" : "var(--bg-tertiary)",
    border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
    borderRadius: 20,
    color: selected ? "var(--accent)" : "var(--text-secondary)",
    fontSize: 10,
    fontWeight: selected ? 600 : 400,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
    whiteSpace: "nowrap" as const,
  }),
  applyBtn: {
    padding: "7px 14px",
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-sm)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    alignSelf: "flex-end",
  },
};

interface Props {
  selectedIds: string[];
  onClearSelection: () => void;
}

export function BulkActionPanel({ selectedIds, onClearSelection }: Props) {
  const [cameraAngle, setCameraAngle] = useState<CameraAngle | null>(null);
  const [lightingMood, setLightingMood] = useState<LightingMood | null>(null);
  const [style, setStyle] = useState<string | null>(null);

  const handleApply = useCallback(() => {
    const patch: Record<string, any> = {};
    if (cameraAngle) patch.cameraAngle = cameraAngle;
    if (lightingMood) patch.lightingMood = lightingMood;
    if (style) patch.style = style;

    if (Object.keys(patch).length === 0) return;

    // Apply to each selected node in the store
    const store = useStory.getState();
    selectedIds.forEach((nodeId) => {
      store.patchNodeProse(nodeId, patch);
    });

    // Also persist via RPC if available
    const rpc = (window as any).__electrobun_rpc;
    const storyboardId = store.nodes.get(store.rootId)?.title;
    if (rpc?.request?.bulkUpdateScenes && storyboardId) {
      rpc.request.bulkUpdateScenes({
        sceneIds: selectedIds,
        updates: patch,
      }).catch(() => {});
    }

    // Reset selections
    setCameraAngle(null);
    setLightingMood(null);
    setStyle(null);
    onClearSelection();
  }, [selectedIds, cameraAngle, lightingMood, style, onClearSelection]);

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span style={s.title}>Bulk Actions</span>
        <span style={s.count}>{selectedIds.length} scenes selected</span>
        <button style={s.closeBtn} onClick={onClearSelection} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Camera Angle */}
      <div style={s.section}>
        <div style={s.label}>Camera Angle</div>
        <div style={s.chipRow}>
          {CAMERA_ANGLES.map((cam) => (
            <button
              key={cam.value}
              style={s.chip(cameraAngle === cam.value)}
              onClick={() => setCameraAngle(cameraAngle === cam.value ? null : cam.value)}
            >
              <span>{cam.icon}</span>
              {cam.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lighting Mood */}
      <div style={s.section}>
        <div style={s.label}>Lighting Mood</div>
        <div style={s.chipRow}>
          {LIGHTING_MOODS.map((mood) => (
            <button
              key={mood.value}
              style={s.chip(lightingMood === mood.value)}
              onClick={() => setLightingMood(lightingMood === mood.value ? null : mood.value)}
            >
              <span>{mood.icon}</span>
              {mood.label}
            </button>
          ))}
        </div>
      </div>

      {/* Style */}
      <div style={s.section}>
        <div style={s.label}>Style</div>
        <div style={s.chipRow}>
          {STYLES.map((st) => (
            <button
              key={st}
              style={s.chip(style === st)}
              onClick={() => setStyle(style === st ? null : st)}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <button style={s.applyBtn} onClick={handleApply}>
        Apply to {selectedIds.length} scenes
      </button>
    </div>
  );
}
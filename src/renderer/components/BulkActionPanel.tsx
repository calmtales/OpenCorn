import { useState, useCallback, type ComponentType } from "react";
import { useStory } from "../lib/store";
import type { CameraAngle, LightingMood } from "../../shared/types";
import { 
  Telescope, Video, Search, MoveRight, Clapperboard,
  Sun, Zap, Flame, Snowflake, Moon, Sunrise, Sparkles, Camera, Palette, X
} from "lucide-react";

const CAMERA_ANGLES: { value: CameraAngle; label: string; icon: ComponentType<any> }[] = [
  { value: "wide", label: "Wide", icon: Telescope },
  { value: "medium", label: "Medium", icon: Video },
  { value: "close-up", label: "Close-up", icon: Search },
  { value: "tracking", label: "Tracking", icon: MoveRight },
  { value: "dolly", label: "Dolly", icon: Clapperboard },
];

const LIGHTING_MOODS: { value: LightingMood; label: string; icon: ComponentType<any> }[] = [
  { value: "natural", label: "Natural", icon: Sun },
  { value: "dramatic", label: "Dramatic", icon: Zap },
  { value: "warm", label: "Warm", icon: Flame },
  { value: "cool", label: "Cool", icon: Snowflake },
  { value: "noir", label: "Noir", icon: Moon },
  { value: "golden-hour", label: "Golden", icon: Sunrise },
  { value: "neon", label: "Neon", icon: Zap },
];

const STYLES: { value: string; label: string; icon: ComponentType<any> }[] = [
  { value: "anime", label: "Anime", icon: Sparkles },
  { value: "realistic", label: "Realistic", icon: Camera },
  { value: "cinematic", label: "Cinematic", icon: Clapperboard },
  { value: "watercolor", label: "Watercolor", icon: Palette },
  { value: "noir", label: "Noir", icon: Moon },
  { value: "cyberpunk", label: "Cyberpunk", icon: Zap },
];

const s = {
  panel: {
    position: "absolute" as const,
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(10,13,18,0.98)",
    border: "2px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
    backdropFilter: "blur(20px)",
    zIndex: 100,
    minWidth: 420,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 14,
    fontWeight: 800,
    color: "var(--accent)",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    fontFamily: "var(--font-display)",
  },
  count: {
    fontSize: 11,
    color: "var(--text-muted)",
    fontWeight: 600,
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
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: "0.14em",
    color: "var(--text-muted)",
    opacity: 0.8,
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 4,
  },
  chip: (selected: boolean) => ({
    padding: "8px 16px",
    background: selected ? "var(--accent-muted)" : "var(--bg-tertiary)",
    border: `1.5px solid ${selected ? "var(--accent)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 24,
    color: selected ? "var(--accent)" : "var(--text-secondary)",
    fontSize: 12,
    fontWeight: selected ? 800 : 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap" as const,
    transition: "all 0.16s ease",
  }),
  applyBtn: {
    padding: "10px 20px",
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-sm)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    cursor: "pointer",
    alignSelf: "flex-end",
    marginTop: 8,
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
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Camera Angle */}
      <div style={s.section}>
        <div style={s.label}>Camera Angle</div>
        <div style={s.chipRow}>
          {CAMERA_ANGLES.map((cam) => {
            const Icon = cam.icon;
            return (
              <button
                key={cam.value}
                style={s.chip(cameraAngle === cam.value)}
                onClick={() => setCameraAngle(cameraAngle === cam.value ? null : cam.value)}
              >
                <Icon size={12} strokeWidth={2.5} />
                {cam.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lighting Mood */}
      <div style={s.section}>
        <div style={s.label}>Lighting Mood</div>
        <div style={s.chipRow}>
          {LIGHTING_MOODS.map((mood) => {
            const Icon = mood.icon;
            return (
              <button
                key={mood.value}
                style={s.chip(lightingMood === mood.value)}
                onClick={() => setLightingMood(lightingMood === mood.value ? null : mood.value)}
              >
                <Icon size={12} strokeWidth={2.5} />
                {mood.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Style */}
      <div style={s.section}>
        <div style={s.label}>Style</div>
        <div style={s.chipRow}>
          {STYLES.map((st) => {
            const Icon = st.icon;
            return (
              <button
                key={st.value}
                style={s.chip(style === st.value)}
                onClick={() => setStyle(style === st.value ? null : st.value)}
              >
                <Icon size={12} strokeWidth={2.5} />
                {st.label}
              </button>
            );
          })}
        </div>
      </div>

      <button style={s.applyBtn} onClick={handleApply}>
        Apply to {selectedIds.length} scenes
      </button>
    </div>
  );
}
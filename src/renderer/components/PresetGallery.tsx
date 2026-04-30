import { useState, useCallback } from "react";
import type { FilmStyle, StylePreset, AspectRatio } from "../../shared/types";

const BUILT_IN_PRESETS: StylePreset[] = [
  {
    id: "arcane",
    name: "Arcane",
    description: "Riot's painterly 3D look — bold lighting, saturated shadows, hand-painted textures",
    thumbnail: "",
    style: "arcane",
    promptTemplate: "Arcane League of Legends style, painterly 3D rendering, bold dramatic lighting, saturated color palette, hand-painted textures, cinematic composition, {idea}",
    aspectRatio: "16:9",
    sceneCount: 6,
    recommendedModels: ["arcane-diffusion-v3", "sdxl-base"],
    tags: ["3d", "painterly", "dramatic"],
  },
  {
    id: "ghibli",
    name: "Studio Ghibli",
    description: "Soft watercolor backgrounds, warm lighting, whimsical character design",
    thumbnail: "",
    style: "ghibli",
    promptTemplate: "Studio Ghibli anime style, soft watercolor background, warm golden lighting, whimsical character design, lush natural scenery, Hayao Miyazaki inspired, {idea}",
    aspectRatio: "16:9",
    sceneCount: 8,
    recommendedModels: ["anything-v5", "sd-xl-ghibli"],
    tags: ["anime", "watercolor", "whimsical"],
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    description: "Neon-soaked cityscapes, rain reflections, holographic UI, dystopian future",
    thumbnail: "",
    style: "cyberpunk",
    promptTemplate: "Cyberpunk 2077 aesthetic, neon-soaked cityscape, rain reflections on wet streets, holographic advertisements, dystopian future, volumetric fog, {idea}",
    aspectRatio: "16:9",
    sceneCount: 5,
    recommendedModels: ["cyberrealistic-xl", "sdxl-base"],
    tags: ["neon", "dystopian", "sci-fi"],
  },
  {
    id: "noir",
    name: "Film Noir",
    description: "High contrast black & white, venetian blind shadows, detective story mood",
    thumbnail: "",
    style: "noir",
    promptTemplate: "Classic film noir style, high contrast black and white, dramatic venetian blind shadows, 1940s aesthetic, moody detective story atmosphere, deep focus cinematography, {idea}",
    aspectRatio: "16:9",
    sceneCount: 5,
    recommendedModels: ["dreamshaper-xl", "sdxl-base"],
    tags: ["bw", "dramatic", "vintage"],
  },
  {
    id: "anime",
    name: "Anime",
    description: "Clean line art, vibrant cel-shading, expressive character animation",
    thumbnail: "",
    style: "anime",
    promptTemplate: "High quality anime style, clean line art, vibrant cel shading, expressive characters, dynamic camera angles, Makoto Shinkai lighting, {idea}",
    aspectRatio: "16:9",
    sceneCount: 6,
    recommendedModels: ["anything-v5", "animagine-xl"],
    tags: ["anime", "cel-shaded", "vibrant"],
  },
  {
    id: "oil-painting",
    name: "Oil Painting",
    description: "Thick impasto brush strokes, classical composition, rich earth tones",
    thumbnail: "",
    style: "oil-painting",
    promptTemplate: "Oil painting style, thick impasto brush strokes, classical composition, rich earth tones and warm palette, museum quality, Renaissance inspired, {idea}",
    aspectRatio: "16:9",
    sceneCount: 4,
    recommendedModels: ["sdxl-base", "deliberate-v5"],
    tags: ["classical", "painterly", "warm"],
  },
  {
    id: "realistic",
    name: "Photorealistic",
    description: "Ultra-detailed photography, natural lighting, shallow depth of field",
    thumbnail: "",
    style: "realistic",
    promptTemplate: "Photorealistic, ultra high detail, natural lighting, shallow depth of field, 8K resolution, professional cinematography, {idea}",
    aspectRatio: "16:9",
    sceneCount: 5,
    recommendedModels: ["juggernaut-xl", "realvis-xl"],
    tags: ["photo", "realistic", "detailed"],
  },
  {
    id: "claymation",
    name: "Claymation",
    description: "Stop-motion clay look, Aardman/Nickelodeon vibes, warm and tactile",
    thumbnail: "",
    style: "claymation",
    promptTemplate: "Claymation stop-motion style, clay texture, Aardman Animations aesthetic, warm lighting, tactile handmade feel, Wallace and Gromit inspired, {idea}",
    aspectRatio: "16:9",
    sceneCount: 5,
    recommendedModels: ["claymation-sdxl", "sdxl-base"],
    tags: ["clay", "stop-motion", "tactile"],
  },
];

const STYLE_GRADIENTS: Record<string, string> = {
  arcane: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #e94560 100%)",
  ghibli: "linear-gradient(135deg, #87ceeb 0%, #98d98e 50%, #f5deb3 100%)",
  cyberpunk: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
  noir: "linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 50%, #1a1a1a 100%)",
  anime: "linear-gradient(135deg, #ff6b9d 0%, #c44dff 50%, #6e3cff 100%)",
  "oil-painting": "linear-gradient(135deg, #8b6914 0%, #c4956a 50%, #f5deb3 100%)",
  realistic: "linear-gradient(135deg, #2d3436 0%, #636e72 50%, #b2bec3 100%)",
  claymation: "linear-gradient(135deg, #f39c12 0%, #e74c3c 50%, #8e44ad 100%)",
};

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
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  card: (selected: boolean) => ({
    display: "flex",
    flexDirection: "column" as const,
    borderRadius: "var(--radius-md)",
    border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
    overflow: "hidden",
    cursor: "pointer",
    transition: "all var(--duration-fast) var(--ease-out)",
    background: "var(--bg-card)",
  }),
  thumbnail: (gradient: string) => ({
    height: 70,
    background: gradient,
    position: "relative" as const,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }),
  thumbOverlay: {
    position: "absolute" as const,
    inset: 0,
    background: "rgba(0,0,0,0.15)",
  },
  thumbName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
    textShadow: "0 1px 4px rgba(0,0,0,0.5)",
    zIndex: 1,
  },
  cardBody: {
    padding: "8px 10px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  cardDesc: {
    fontSize: 10,
    color: "var(--text-secondary)",
    lineHeight: 1.3,
    display: "-webkit-box" as const,
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
  },
  cardMeta: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 9,
    color: "var(--text-muted)",
    marginTop: 2,
  },
  tag: {
    padding: "1px 5px",
    background: "var(--bg-elevated)",
    borderRadius: 10,
    fontSize: 8,
  },
  selectedOverlay: {
    position: "absolute" as const,
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "var(--accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  detail: {
    padding: 16,
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  detailName: {
    fontSize: 16,
    fontWeight: 700,
  },
  detailDesc: {
    fontSize: 12,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },
  detailSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
  },
  promptPreview: {
    padding: "8px 10px",
    background: "var(--bg-tertiary)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    fontSize: 11,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    fontFamily: "var(--font-mono)",
  },
  modelList: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 4,
  },
  modelTag: {
    padding: "2px 8px",
    background: "var(--accent-muted)",
    border: "1px solid rgba(232,93,38,0.2)",
    borderRadius: 10,
    fontSize: 10,
    color: "var(--accent)",
    fontWeight: 500,
  },
  applyBtn: {
    padding: "10px 0",
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-sm)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  },
  backBtn: {
    padding: "4px 8px",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-secondary)",
    fontSize: 10,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
};

interface Props {
  onClose: () => void;
  onApply?: (preset: StylePreset) => void;
}

export function PresetGallery({ onClose, onApply }: Props) {
  const [selected, setSelected] = useState<StylePreset | null>(null);

  const handleApply = useCallback(() => {
    if (!selected) return;
    onApply?.(selected);
    window.dispatchEvent(
      new CustomEvent("toast", {
        detail: { id: "", type: "success", message: `Applied "${selected.name}" preset` },
      })
    );
    onClose();
  }, [selected, onApply, onClose]);

  if (selected) {
    return (
      <div style={s.container}>
        <div style={s.header}>
          <button style={s.backBtn} onClick={() => setSelected(null)}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M8 1L3 5l5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <span style={s.title}>{selected.name}</span>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={s.body}>
          <div style={s.detail}>
            <div style={{
              ...s.thumbnail(STYLE_GRADIENTS[selected.style] ?? STYLE_GRADIENTS.anime),
              borderRadius: "var(--radius-md)",
            }}>
              <div style={s.thumbOverlay} />
              <span style={{ ...s.thumbName, fontSize: 20 }}>{selected.name}</span>
            </div>

            <p style={s.detailDesc}>{selected.description}</p>

            <div style={s.detailSection}>
              <span style={s.detailLabel}>Prompt Template</span>
              <div style={s.promptPreview}>{selected.promptTemplate}</div>
            </div>

            <div style={s.detailSection}>
              <span style={s.detailLabel}>Configuration</span>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                Style: {selected.style} &middot; Aspect: {selected.aspectRatio} &middot; Scenes: {selected.sceneCount}
              </div>
            </div>

            <div style={s.detailSection}>
              <span style={s.detailLabel}>Recommended Models</span>
              <div style={s.modelList}>
                {selected.recommendedModels.map((m) => (
                  <span key={m} style={s.modelTag}>{m}</span>
                ))}
              </div>
            </div>

            <div style={s.detailSection}>
              <span style={s.detailLabel}>Tags</span>
              <div style={s.modelList}>
                {selected.tags.map((t) => (
                  <span key={t} style={s.tag}>{t}</span>
                ))}
              </div>
            </div>

            <button style={s.applyBtn} onClick={handleApply}>
              Apply This Preset
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.title}>Style Presets</span>
        <button style={s.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div style={s.body}>
        <div style={s.grid}>
          {BUILT_IN_PRESETS.map((preset) => (
            <div
              key={preset.id}
              style={s.card(false)}
              onClick={() => setSelected(preset)}
            >
              <div style={s.thumbnail(STYLE_GRADIENTS[preset.style] ?? STYLE_GRADIENTS.anime)}>
                <div style={s.thumbOverlay} />
                <span style={s.thumbName}>{preset.name}</span>
              </div>
              <div style={s.cardBody}>
                <span style={s.cardDesc}>{preset.description}</span>
                <div style={s.cardMeta}>
                  <span>{preset.sceneCount} scenes</span>
                  <span>&middot;</span>
                  <span>{preset.aspectRatio}</span>
                  {preset.tags.slice(0, 2).map((t) => (
                    <span key={t} style={s.tag}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

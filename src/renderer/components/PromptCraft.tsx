import { useState, useRef, useCallback } from "react";
import type {
  Storyboard,
  Scene,
  CameraAngle,
  LightingMood,
} from "../../shared/types";

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
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
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
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  sceneCard: (active: boolean) => ({
    background: active ? "var(--bg-elevated)" : "var(--bg-card)",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    borderRadius: "var(--radius-md)",
    padding: 12,
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    transition: "border-color var(--duration-fast) var(--ease-out)",
  }),
  sceneHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  sceneNum: {
    background: "var(--accent-muted)",
    color: "var(--accent)",
    borderRadius: "var(--radius-sm)",
    padding: "2px 8px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.04em",
  },
  sceneTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-primary)",
    flex: 1,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "var(--text-muted)",
    marginBottom: 4,
  },
  textarea: {
    width: "100%",
    minHeight: 60,
    padding: "8px 10px",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-primary)",
    fontSize: 12,
    lineHeight: 1.5,
    resize: "vertical" as const,
    outline: "none",
    fontFamily: "inherit",
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
  chipIcon: {
    fontSize: 12,
  },
  dropZone: (dragOver: boolean) => ({
    padding: "12px",
    border: `1px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
    borderRadius: "var(--radius-sm)",
    background: dragOver ? "var(--accent-muted)" : "var(--bg-tertiary)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    transition: "all var(--duration-fast) var(--ease-out)",
  }),
  dropText: {
    fontSize: 10,
    color: "var(--text-muted)",
    textAlign: "center" as const,
  },
  refPreview: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 8px",
    background: "var(--bg-tertiary)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
  },
  refThumb: {
    width: 32,
    height: 32,
    borderRadius: "var(--radius-sm)",
    objectFit: "cover" as const,
  },
  refName: {
    fontSize: 10,
    color: "var(--text-secondary)",
    flex: 1,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  refRemove: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: 2,
    display: "flex",
  },
  empty: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 40,
    color: "var(--text-muted)",
    textAlign: "center" as const,
  },
  emptyIcon: {
    opacity: 0.15,
  },
};

interface Props {
  storyboard: Storyboard | null;
  onSceneUpdate?: (sceneId: string, updates: Partial<Scene>) => void;
  onClose: () => void;
}

export function PromptCraft({ storyboard, onSceneUpdate, onClose }: Props) {
  const [activeScene, setActiveScene] = useState<string | null>(null);
  const [dragOverScene, setDragOverScene] = useState<string | null>(null);
  const [refImages, setRefImages] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadSceneId, setUploadSceneId] = useState<string | null>(null);

  const scenes = storyboard?.scenes.sort((a, b) => a.order - b.order) ?? [];

  const handleUpdate = useCallback(
    (sceneId: string, field: string, value: any) => {
      onSceneUpdate?.(sceneId, { [field]: value });
    },
    [onSceneUpdate]
  );

  const handleDragOver = (e: React.DragEvent, sceneId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverScene(sceneId);
  };

  const handleDragLeave = () => {
    setDragOverScene(null);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent, sceneId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverScene(null);

      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith("image/")) {
        const url = URL.createObjectURL(files[0]);
        setRefImages((prev) => ({ ...prev, [sceneId]: url }));
        handleUpdate(sceneId, "characterRefUrl", url);
      }
    },
    [handleUpdate]
  );

  const handleFileSelect = useCallback(
    (sceneId: string) => {
      setUploadSceneId(sceneId);
      fileInputRef.current?.click();
    },
    []
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && uploadSceneId) {
        const url = URL.createObjectURL(file);
        setRefImages((prev) => ({ ...prev, [uploadSceneId]: url }));
        handleUpdate(uploadSceneId, "characterRefUrl", url);
      }
      setUploadSceneId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [uploadSceneId, handleUpdate]
  );

  const removeRef = useCallback(
    (sceneId: string) => {
      setRefImages((prev) => {
        const next = { ...prev };
        delete next[sceneId];
        return next;
      });
      handleUpdate(sceneId, "characterRefUrl", undefined);
    },
    [handleUpdate]
  );

  if (!storyboard || scenes.length === 0) {
    return (
      <div style={s.container}>
        <div style={s.header}>
          <span style={s.title}>PromptCraft</span>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div style={s.empty}>
          <div style={s.emptyIcon}>
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
              <path d="M8 36L18 10H30L40 36H8Z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M20 24H28M24 20V28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 12 }}>No storyboard to edit</div>
          <div style={{ fontSize: 11 }}>Generate a film first, then customize scene prompts here</div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.title}>PromptCraft</span>
        <div style={s.headerRight}>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {scenes.length} scene{scenes.length !== 1 ? "s" : ""}
          </span>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <div style={s.body}>
        {scenes.map((scene) => {
          const isActive = activeScene === scene.id;
          const refUrl = refImages[scene.id] ?? scene.characterRefUrl;
          const isDragOver = dragOverScene === scene.id;

          return (
            <div
              key={scene.id}
              style={s.sceneCard(isActive)}
              onClick={() => setActiveScene(isActive ? null : scene.id)}
            >
              <div style={s.sceneHeader}>
                <span style={s.sceneNum}>SC {scene.order + 1}</span>
                <span style={s.sceneTitle}>{scene.title}</span>
              </div>

              {/* Custom prompt */}
              <div onClick={(e) => e.stopPropagation()}>
                <div style={s.fieldLabel}>Scene Prompt</div>
                <textarea
                  style={s.textarea}
                  value={scene.customPrompt ?? scene.description}
                  onChange={(e) => handleUpdate(scene.id, "customPrompt", e.target.value)}
                  placeholder="Describe what happens in this scene..."
                  onFocus={() => setActiveScene(scene.id)}
                />
              </div>

              {isActive && (
                <>
                  {/* Camera angle */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <div style={s.fieldLabel}>Camera Angle</div>
                    <div style={s.chipRow}>
                      {CAMERA_ANGLES.map((cam) => (
                        <button
                          key={cam.value}
                          style={s.chip(scene.cameraAngle === cam.value)}
                          onClick={() =>
                            handleUpdate(
                              scene.id,
                              "cameraAngle",
                              scene.cameraAngle === cam.value ? undefined : cam.value
                            )
                          }
                        >
                          <span style={s.chipIcon}>{cam.icon}</span>
                          {cam.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lighting mood */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <div style={s.fieldLabel}>Lighting Mood</div>
                    <div style={s.chipRow}>
                      {LIGHTING_MOODS.map((mood) => (
                        <button
                          key={mood.value}
                          style={s.chip(scene.lightingMood === mood.value)}
                          onClick={() =>
                            handleUpdate(
                              scene.id,
                              "lightingMood",
                              scene.lightingMood === mood.value ? undefined : mood.value
                            )
                          }
                        >
                          <span style={s.chipIcon}>{mood.icon}</span>
                          {mood.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Character reference upload */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <div style={s.fieldLabel}>Character Reference</div>
                    {refUrl ? (
                      <div style={s.refPreview}>
                        <img src={refUrl} alt="Character ref" style={s.refThumb} />
                        <span style={s.refName}>Character reference image</span>
                        <button style={s.refRemove} onClick={() => removeRef(scene.id)}>
                          <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div
                        style={s.dropZone(isDragOver)}
                        onDragOver={(e) => handleDragOver(e, scene.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, scene.id)}
                        onClick={() => handleFileSelect(scene.id)}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <path d="M12 16V4M12 4L8 8M12 4l4 4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        <span style={s.dropText}>
                          Drop image or click to upload
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";
import type { Scene } from "../../shared/types";

const SPEED_OPTIONS = [0.5, 1, 2];

const s = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 16px",
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
    borderBottom: "1px solid var(--border-subtle)",
    flexShrink: 0,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  iconBtn: (active: boolean = false) => ({
    background: active ? "var(--accent-muted)" : "none",
    border: "none",
    color: active ? "var(--accent)" : "var(--text-muted)",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    borderRadius: "var(--radius-sm)",
    transition: "all var(--duration-fast) var(--ease-out)",
  }),
  viewport: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#000",
    position: "relative" as const,
    overflow: "hidden",
    minHeight: 0,
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "contain" as const,
  },
  empty: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    color: "var(--text-muted)",
    padding: 24,
    textAlign: "center" as const,
  },
  emptyIcon: {
    opacity: 0.2,
  },
  controls: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 0,
    flexShrink: 0,
    background: "var(--bg-secondary)",
    borderTop: "1px solid var(--border-subtle)",
  },
  scrubberRow: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    padding: "0 12px",
    height: 24,
    position: "relative" as const,
  },
  scrubberTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    background: "var(--bg-tertiary)",
    position: "relative" as const,
    cursor: "pointer",
  },
  scrubberFill: (pct: number) => ({
    position: "absolute" as const,
    top: 0,
    left: 0,
    height: "100%",
    width: `${pct}%`,
    borderRadius: 2,
    background: "var(--accent)",
    transition: "width 0.1s linear",
  }),
  scrubberHandle: (pct: number) => ({
    position: "absolute" as const,
    top: "50%",
    left: `${pct}%`,
    transform: "translate(-50%, -50%)",
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "var(--accent)",
    boxShadow: "0 0 4px var(--accent-glow)",
    cursor: "grab",
    opacity: 1,
    transition: "opacity var(--duration-fast)",
  }),
  sceneThumbnails: {
    display: "flex",
    gap: 2,
    padding: "4px 12px 0",
    overflow: "auto",
  },
  thumb: (active: boolean) => ({
    width: 36,
    height: 20,
    borderRadius: 2,
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    overflow: "hidden",
    cursor: "pointer",
    flexShrink: 0,
    background: "var(--bg-tertiary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 8,
    color: active ? "var(--accent)" : "var(--text-muted)",
    fontWeight: active ? 700 : 400,
  }),
  thumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
  },
  controlRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px 8px",
  },
  playBtn: (playing: boolean) => ({
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "var(--accent)",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    flexShrink: 0,
  }),
  time: {
    fontSize: 10,
    color: "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
    minWidth: 70,
  },
  spacer: { flex: 1 },
  speedBtn: (active: boolean) => ({
    padding: "2px 6px",
    background: active ? "var(--accent-muted)" : "var(--bg-tertiary)",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    borderRadius: "var(--radius-sm)",
    color: active ? "var(--accent)" : "var(--text-secondary)",
    fontSize: 9,
    fontWeight: 600,
    cursor: "pointer",
    fontVariantNumeric: "tabular-nums",
  }),
  loopBtn: (active: boolean) => ({
    padding: "2px 6px",
    background: active ? "var(--accent-muted)" : "var(--bg-tertiary)",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    borderRadius: "var(--radius-sm)",
    color: active ? "var(--accent)" : "var(--text-secondary)",
    fontSize: 9,
    fontWeight: 600,
    cursor: "pointer",
  }),
  downloadBtn: {
    padding: "2px 6px",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    color: "var(--text-secondary)",
    fontSize: 9,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 3,
  },
  fullscreenContainer: {
    position: "fixed" as const,
    inset: 0,
    background: "#000",
    zIndex: 9000,
    display: "flex",
    flexDirection: "column" as const,
  },
  fullscreenClose: {
    position: "absolute" as const,
    top: 16,
    right: 16,
    zIndex: 9001,
    background: "rgba(0,0,0,0.6)",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    padding: 8,
    borderRadius: "50%",
    display: "flex",
  },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

interface Props {
  videoUrl: string | null;
  scenes?: Scene[];
  onDownloadScene?: (sceneId: string) => void;
}

export function PlayerPreview({ videoUrl, scenes, onDownloadScene }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeSceneIdx, setActiveSceneIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onDur = () => setDuration(v.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      setPlaying(false);
      if (loop) {
        v.currentTime = 0;
        v.play();
      }
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onDur);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnd);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onDur);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnd);
    };
  }, [videoUrl, loop]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  // Track which scene is active based on time
  useEffect(() => {
    if (!scenes || scenes.length === 0) return;
    let elapsed = 0;
    for (let i = 0; i < scenes.length; i++) {
      elapsed += scenes[i].duration;
      if (currentTime < elapsed) {
        setActiveSceneIdx(i);
        break;
      }
    }
  }, [currentTime, scenes]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  const handleScrub = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const v = videoRef.current;
      if (!v || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      v.currentTime = pct * duration;
    },
    [duration]
  );

  const handleThumbClick = useCallback(
    (idx: number) => {
      if (!scenes) return;
      let time = 0;
      for (let i = 0; i < idx; i++) time += scenes[i].duration;
      if (videoRef.current) videoRef.current.currentTime = time;
    },
    [scenes]
  );

  const toggleFullscreen = useCallback(() => {
    setFullscreen((f) => !f);
  }, []);

  const handleDownload = useCallback(() => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = "opencorn-scene.mp4";
    a.click();
  }, [videoUrl]);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const playerContent = (
    <>
      <div style={s.viewport}>
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            style={s.video}
            playsInline
            onClick={togglePlay}
          />
        ) : (
          <div style={s.empty}>
            <div style={s.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M20 16L32 24L20 32V16Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Video preview will appear here
            </div>
            <div style={{ fontSize: 11 }}>
              Generate a film to see the result
            </div>
          </div>
        )}
      </div>

      {videoUrl && (
        <div style={s.controls}>
          {/* Scene thumbnails */}
          {scenes && scenes.length > 0 && (
            <div style={s.sceneThumbnails}>
              {scenes.map((scene, i) => (
                <div
                  key={scene.id}
                  style={s.thumb(i === activeSceneIdx)}
                  onClick={() => handleThumbClick(i)}
                  title={scene.title}
                >
                  {scene.keyframes[0]?.imageUrl ? (
                    <img src={scene.keyframes[0].imageUrl} alt="" style={s.thumbImg} />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Scrubber */}
          <div style={s.scrubberRow}>
            <div style={s.scrubberTrack} onClick={handleScrub}>
              <div style={s.scrubberFill(pct)} />
              <div style={s.scrubberHandle(pct)} />
            </div>
          </div>

          {/* Controls row */}
          <div style={s.controlRow}>
            <button style={s.playBtn(playing)} onClick={togglePlay}>
              {playing ? (
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <rect x="2" y="1" width="3" height="12" rx="1" fill="currentColor" />
                  <rect x="9" y="1" width="3" height="12" rx="1" fill="currentColor" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M3 1L12 7L3 13V1Z" fill="currentColor" />
                </svg>
              )}
            </button>
            <span style={s.time}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div style={s.spacer} />

            {/* Speed buttons */}
            {SPEED_OPTIONS.map((sp) => (
              <button
                key={sp}
                style={s.speedBtn(speed === sp)}
                onClick={() => setSpeed(sp)}
              >
                {sp}x
              </button>
            ))}

            {/* Loop toggle */}
            <button
              style={s.loopBtn(loop)}
              onClick={() => setLoop(!loop)}
              title="Loop"
            >
              Loop
            </button>

            {/* Download */}
            <button style={s.downloadBtn} onClick={handleDownload}>
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <path d="M7 1V9M7 9L4 6M7 9L10 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M2 10V12H12V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            {/* Fullscreen */}
            <button
              style={s.iconBtn()}
              onClick={toggleFullscreen}
              title="Fullscreen (Cmd+F)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 5V2a1 1 0 011-1h3M9 1h2a1 1 0 011 1v3M13 9v2a1 1 0 01-1 1h-3M5 13H3a1 1 0 01-1-1v-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );

  if (fullscreen) {
    return (
      <div style={s.fullscreenContainer} ref={containerRef}>
        <button style={s.fullscreenClose} onClick={toggleFullscreen}>
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        {playerContent}
      </div>
    );
  }

  return (
    <div style={s.container} ref={containerRef}>
      {playerContent}
    </div>
  );
}

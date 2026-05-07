import { useState, useCallback } from "react";
import { Download, Camera, Check, Clock } from "lucide-react";

const EXPORT_FORMATS = [
  { value: "mp4", label: "MP4 (H.264)" },
  { value: "webm", label: "WebM (VP9)" },
  { value: "mov", label: "MOV (ProRes)" },
] as const;

interface ExportEntry {
  id: string;
  format: string;
  url: string;
  downloadedAt: string;
}

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    position: "relative" as const,
  },
  button: (disabled: boolean, active: boolean = false) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 14px",
    background: active ? "var(--accent-muted)" : (disabled ? "rgba(10,13,18,0.4)" : "var(--bg-elevated)"),
    border: `1.5px solid ${active ? "var(--accent)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 6,
    color: disabled ? "var(--text-muted)" : (active ? "var(--accent)" : "var(--text-secondary)"),
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.16s ease",
  }),
  primaryBtn: (disabled: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 16px",
    background: disabled ? "rgba(10,13,18,0.4)" : "var(--accent)",
    border: "none",
    borderRadius: 6,
    color: disabled ? "var(--text-muted)" : "#fff",
    fontSize: 12,
    fontWeight: 800,
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.14em",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.16s ease",
    boxShadow: disabled ? "none" : "0 4px 20px rgba(79,195,247,0.25)",
  }),
  dropdown: {
    position: "absolute" as const,
    top: "calc(100% + 8px)",
    right: 0,
    background: "rgba(10,13,18,0.96)",
    border: "1.5px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 8,
    minWidth: 200,
    zIndex: 100,
    boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
    backdropFilter: "blur(12px)",
  },
  dropdownLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
    color: "var(--text-muted)",
    padding: "8px 10px 4px",
    opacity: 0.6,
  },
  formatBtn: (selected: boolean) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "8px 12px",
    background: selected ? "rgba(79,195,247,0.1)" : "transparent",
    border: "none",
    borderRadius: 6,
    color: selected ? "var(--accent)" : "var(--text-secondary)",
    fontSize: 12,
    fontWeight: selected ? 700 : 500,
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all 0.12s ease",
  }),
  downloadBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    padding: "10px 12px",
    marginTop: 8,
    background: "var(--accent)",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
    fontFamily: "var(--font-mono)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    cursor: "pointer",
  },
  historySection: {
    borderTop: "1px solid rgba(255,255,255,0.08)",
    marginTop: 8,
    paddingTop: 8,
  },
  historyLabel: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
    color: "var(--text-muted)",
    padding: "4px 10px 4px",
    opacity: 0.5,
  },
  historyItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 12px",
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    cursor: "pointer",
    borderRadius: 6,
    transition: "all 0.12s ease",
  },
};

interface Props {
  workflowId: string | null;
  videoUrl: string | null;
  onSnapshot: () => Promise<void>;
}

export function ExportPanel({ workflowId, videoUrl, onSnapshot }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<string>("mp4");
  const [history, setHistory] = useState<ExportEntry[]>([]);
  const [isSnapshotting, setIsSnapshotting] = useState(false);

  const handleDownload = useCallback(() => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `opencorn-film-${workflowId?.slice(0, 8)}.${format}`;
    a.click();

    setHistory((prev) => [
      {
        id: `exp-${Date.now()}`,
        format,
        url: videoUrl,
        downloadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev.slice(0, 4),
    ]);
    setOpen(false);
  }, [videoUrl, format, workflowId]);

  const handleSnapshot = async () => {
    setIsSnapshotting(true);
    try {
      await onSnapshot();
    } finally {
      setIsSnapshotting(false);
    }
  };

  const hasVideo = !!videoUrl;

  return (
    <div style={styles.container}>
      <button
        style={styles.button(false, false)}
        onClick={handleSnapshot}
        disabled={isSnapshotting}
        title="Create a point-in-time snapshot of the screenplay"
      >
        <Camera size={14} strokeWidth={2.5} />
        {isSnapshotting ? "Saving..." : "Snapshot"}
      </button>

      <button
        style={styles.primaryBtn(!hasVideo)}
        onClick={() => hasVideo && setOpen(!open)}
        disabled={!hasVideo}
      >
        <Download size={14} strokeWidth={3} />
        Export
      </button>

      {open && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownLabel}>Format</div>
          {EXPORT_FORMATS.map((f) => (
            <button
              key={f.value}
              style={styles.formatBtn(format === f.value)}
              onClick={() => setFormat(f.value)}
            >
              <span>{f.label}</span>
              {format === f.value && <Check size={12} strokeWidth={3} />}
            </button>
          ))}
          <button style={styles.downloadBtn} onClick={handleDownload}>
            Download .{format}
          </button>

          {history.length > 0 && (
            <div style={styles.historySection}>
              <div style={styles.historyLabel}>Recent</div>
              {history.map((entry) => (
                <div
                  key={entry.id}
                  style={styles.historyItem}
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = entry.url;
                    a.download = `opencorn-film.${entry.format}`;
                    a.click();
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock size={10} opacity={0.5} />
                    <span>.{entry.format}</span>
                  </div>
                  <span style={{ opacity: 0.4, fontSize: 10 }}>{entry.downloadedAt}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

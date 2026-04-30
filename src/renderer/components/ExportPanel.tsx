import { useState } from "react";

const EXPORT_FORMATS = [
  { value: "mp4", label: "MP4 (H.264)" },
  { value: "webm", label: "WebM (VP9)" },
  { value: "mov", label: "MOV (ProRes)" },
] as const;

const styles = {
  container: {
    position: "relative" as const,
  },
  button: (disabled: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    background: disabled ? "var(--bg-tertiary)" : "var(--accent)",
    border: "none",
    borderRadius: 6,
    color: disabled ? "var(--text-muted)" : "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 0.15s ease",
  }),
  dropdown: {
    position: "absolute" as const,
    top: "calc(100% + 6px)",
    right: 0,
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 6,
    minWidth: 180,
    zIndex: 100,
    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  },
  dropdownLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    color: "var(--text-muted)",
    padding: "6px 8px 4px",
  },
  formatBtn: (selected: boolean) => ({
    display: "block",
    width: "100%",
    padding: "8px 10px",
    background: selected ? "var(--bg-tertiary)" : "transparent",
    border: "none",
    borderRadius: 4,
    color: selected ? "var(--accent)" : "var(--text-primary)",
    fontSize: 12,
    fontWeight: selected ? 600 : 400,
    cursor: "pointer",
    textAlign: "left" as const,
  }),
  downloadBtn: {
    display: "block",
    width: "100%",
    padding: "8px 10px",
    marginTop: 4,
    background: "var(--accent)",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
};

interface Props {
  videoUrl: string | null;
  disabled: boolean;
}

export function ExportPanel({ videoUrl, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<string>("mp4");

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `opencorn-film.${format}`;
    a.click();
    setOpen(false);
  };

  return (
    <div style={styles.container}>
      <button
        style={styles.button(disabled)}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 1V9M7 9L4 6M7 9L10 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 10V12H12V10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
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
              {f.label}
            </button>
          ))}
          <button style={styles.downloadBtn} onClick={handleDownload}>
            Download .{format}
          </button>
        </div>
      )}
    </div>
  );
}

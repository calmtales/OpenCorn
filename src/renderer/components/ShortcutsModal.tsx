const s = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    animation: "fade-in 0.15s ease",
  },
  modal: {
    width: 420,
    maxHeight: "80vh",
    background: "var(--bg-secondary)",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-lg)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column" as const,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    borderBottom: "1px solid var(--border-subtle)",
  },
  title: {
    fontSize: 14,
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
    padding: "16px 18px",
    overflow: "auto",
    display: "flex",
    flexDirection: "column" as const,
    gap: 18,
  },
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
    marginBottom: 4,
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "4px 0",
  },
  label: {
    fontSize: 12,
    color: "var(--text-secondary)",
  },
  kbdGroup: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  kbd: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 22,
    padding: "2px 7px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 500,
    color: "var(--text-primary)",
    fontFamily: "var(--font-mono)",
    lineHeight: "16px",
  },
  plus: {
    fontSize: 10,
    color: "var(--text-muted)",
  },
  hint: {
    fontSize: 10,
    color: "var(--text-muted)",
    textAlign: "center" as const,
    padding: "8px 0 0",
    borderTop: "1px solid var(--border-subtle)",
  },
};

interface Shortcut {
  keys: string[];
  label: string;
}

const SHORTCUTS: { section: string; items: Shortcut[] }[] = [
  {
    section: "Generation",
    items: [
      { keys: ["Cmd", "Enter"], label: "Submit idea / Generate film" },
      { keys: ["Cmd", "Shift", "P"], label: "Open Preset Gallery" },
      { keys: ["Cmd", "B"], label: "Open Batch Mode" },
    ],
  },
  {
    section: "Panels",
    items: [
      { keys: ["Cmd", ","], label: "Settings" },
      { keys: ["Cmd", "H"], label: "History" },
      { keys: ["Cmd", "P"], label: "PromptCraft" },
      { keys: ["Cmd", "K"], label: "ComfyUI" },
      { keys: ["Cmd", "L"], label: "Local Models" },
    ],
  },
  {
    section: "Playback",
    items: [
      { keys: ["Space"], label: "Play / Pause" },
      { keys: ["Cmd", "F"], label: "Toggle fullscreen" },
    ],
  },
  {
    section: "General",
    items: [
      { keys: ["Cmd", "/"], label: "Keyboard shortcuts (this modal)" },
      { keys: ["Esc"], label: "Close panel / modal" },
    ],
  },
];

interface Props {
  onClose: () => void;
}

export function ShortcutsModal({ onClose }: Props) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.title}>Keyboard Shortcuts</span>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div style={s.body}>
          {SHORTCUTS.map((group) => (
            <div key={group.section} style={s.section}>
              <div style={s.sectionTitle}>{group.section}</div>
              {group.items.map((item) => (
                <div key={item.label} style={s.row}>
                  <span style={s.label}>{item.label}</span>
                  <div style={s.kbdGroup}>
                    {item.keys.map((key, i) => (
                      <span key={i}>
                        <span style={s.kbd}>
                          {key === "Cmd" ? (navigator.platform.includes("Mac") ? "Cmd" : "Ctrl") : key}
                        </span>
                        {i < item.keys.length - 1 && <span style={s.plus}>+</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div style={s.hint}>
            Press <span style={s.kbd}>Esc</span> or <span style={s.kbd}>Cmd</span><span style={s.plus}>+</span><span style={s.kbd}>/</span> to close
          </div>
        </div>
      </div>
    </div>
  );
}

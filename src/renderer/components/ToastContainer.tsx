import type { Toast } from "../../shared/types";

const icons: Record<string, string> = {
  success: "M5 13l4 4L19 7",
  error: "M6 18L18 6M6 6l12 12",
  warning: "M12 9v4m0 4h.01",
  info: "M13 16h-1v-4h-1m1-4h.01",
};

const colors: Record<string, { bg: string; border: string; icon: string }> = {
  success: {
    bg: "rgba(52, 208, 88, 0.12)",
    border: "rgba(52, 208, 88, 0.25)",
    icon: "var(--success)",
  },
  error: {
    bg: "rgba(234, 74, 74, 0.12)",
    border: "rgba(234, 74, 74, 0.25)",
    icon: "var(--error)",
  },
  warning: {
    bg: "rgba(227, 179, 65, 0.12)",
    border: "rgba(227, 179, 65, 0.25)",
    icon: "var(--warning)",
  },
  info: {
    bg: "rgba(59, 130, 246, 0.12)",
    border: "rgba(59, 130, 246, 0.25)",
    icon: "#3b82f6",
  },
};

const styles = {
  container: {
    position: "fixed" as const,
    bottom: 16,
    right: 16,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    zIndex: 9999,
    pointerEvents: "none" as const,
  },
  toast: (type: string) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    background: colors[type]?.bg ?? colors.info.bg,
    border: `1px solid ${colors[type]?.border ?? colors.info.border}`,
    borderRadius: "var(--radius-md)",
    backdropFilter: "blur(12px)",
    fontSize: 12,
    color: "var(--text-primary)",
    maxWidth: 340,
    pointerEvents: "auto" as const,
    animation: "toast-in 0.3s var(--ease-out)",
    boxShadow: "var(--shadow-lg)",
  }),
  iconWrapper: {
    flexShrink: 0,
    width: 18,
    height: 18,
  },
  message: {
    flex: 1,
    lineHeight: 1.4,
  },
  close: {
    flexShrink: 0,
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: 2,
    display: "flex",
    opacity: 0.6,
  },
};

interface Props {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div style={styles.container}>
      {toasts.map((t) => {
        const color = colors[t.type] ?? colors.info;
        const iconPath = icons[t.type] ?? icons.info;
        return (
          <div key={t.id} style={styles.toast(t.type)}>
            <div style={styles.iconWrapper}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke={color.icon} strokeWidth="1.5" />
                <path d={iconPath} stroke={color.icon} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={styles.message}>{t.message}</span>
            <button style={styles.close} onClick={() => onDismiss(t.id)} aria-label="Dismiss">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

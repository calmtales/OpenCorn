import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("OpenCorn render error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="20" stroke="var(--error)" strokeWidth="2" />
                <path d="M17 17l14 14M31 17L17 31" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h2 style={styles.title}>Something went wrong</h2>
            <p style={styles.message}>
              {this.state.error?.message ?? "An unexpected error occurred while rendering."}
            </p>
            <div style={styles.actions}>
              <button style={styles.btn} onClick={this.handleReset}>
                Try Again
              </button>
              <button
                style={styles.btnSecondary}
                onClick={() => window.location.reload()}
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    background: "var(--bg-primary)",
    padding: 40,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    padding: 40,
    maxWidth: 400,
    textAlign: "center",
  },
  icon: {
    opacity: 0.6,
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: "var(--text-primary)",
    letterSpacing: "-0.02em",
  },
  message: {
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },
  actions: {
    display: "flex",
    gap: 10,
    marginTop: 8,
  },
  btn: {
    padding: "10px 20px",
    background: "var(--accent)",
    border: "none",
    borderRadius: "var(--radius-md)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnSecondary: {
    padding: "10px 20px",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-secondary)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
};

import { useEffect, useState } from "react";

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 12,
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    fontSize: 11,
    fontWeight: 500,
    color: "var(--text-secondary)",
    cursor: "default",
    userSelect: "none" as const,
  },
  dot: (connected: boolean) => ({
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: connected ? "var(--success)" : "var(--error)",
    boxShadow: connected
      ? "0 0 6px rgba(62, 207, 106, 0.4)"
      : "0 0 6px rgba(232, 64, 64, 0.4)",
  }),
};

export function McpStatus() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Poll MCP connection status every 5s
    const check = async () => {
      try {
        const rpc = (window as any).__electrobun_rpc;
        if (rpc?.request?.pollStatus) {
          // If we can call the RPC, the main process is alive
          setConnected(true);
        }
      } catch {
        setConnected(false);
      }
    };

    check();
    const interval = setInterval(check, 5000);

    // Also listen for custom events from the main process
    const onStatus = (e: CustomEvent) => {
      setConnected(e.detail?.connected ?? false);
    };
    window.addEventListener("mcp-status" as any, onStatus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("mcp-status" as any, onStatus);
    };
  }, []);

  return (
    <div style={styles.container} title={connected ? "MCP connected" : "MCP disconnected"}>
      <div style={styles.dot(connected)} />
      <span>{connected ? "MCP" : "MCP offline"}</span>
    </div>
  );
}

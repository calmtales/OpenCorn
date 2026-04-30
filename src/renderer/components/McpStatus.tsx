import { useEffect, useState } from "react";

const styles = {
  container: (connected: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 20,
    background: connected ? "var(--success-muted)" : "var(--bg-tertiary)",
    border: `1px solid ${connected ? "rgba(52, 208, 88, 0.2)" : "var(--border)"}`,
    fontSize: 11,
    fontWeight: 500,
    color: connected ? "var(--success)" : "var(--text-muted)",
    cursor: "default",
    userSelect: "none" as const,
    transition: "all var(--duration-normal) var(--ease-out)",
  }),
  dot: (connected: boolean) => ({
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: connected ? "var(--success)" : "var(--text-muted)",
    boxShadow: connected ? "0 0 6px var(--success-muted)" : "none",
    transition: "all var(--duration-normal) var(--ease-out)",
  }),
};

interface Props {
  connected: boolean;
}

export function McpStatus({ connected }: Props) {
  const [mcpAlive, setMcpAlive] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const rpc = (window as any).__electrobun_rpc;
        if (rpc?.request?.pollStatus) {
          setMcpAlive(true);
        }
      } catch {
        setMcpAlive(false);
      }
    };

    check();
    const interval = setInterval(check, 2000);

    const onStatus = (e: CustomEvent) => {
      setMcpAlive(e.detail?.connected ?? false);
    };
    window.addEventListener("mcp-status" as any, onStatus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("mcp-status" as any, onStatus);
    };
  }, []);

  const isActive = connected || mcpAlive;

  return (
    <div style={styles.container(isActive)} title={isActive ? "MCP connected" : "MCP offline"}>
      <div style={styles.dot(isActive)} />
      <span>{isActive ? "MCP" : "MCP offline"}</span>
    </div>
  );
}

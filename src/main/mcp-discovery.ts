/**
 * MCP server discovery — resolves the stoira-mcp server script from
 * configurable paths instead of a single hardcoded /tmp location.
 *
 * Discovery order for the server directory:
 *   1. $OPENCOORN_MCP_SERVER_DIR  (explicit override)
 *   2. $CWD/stoira-mcp            (dev checkout alongside app)
 *   3. $HOME/stoira-mcp           (common local install)
 *   4. $HOME/.stoira/mcp          (XDG-style hidden dir)
 *   5. /tmp/stoira-mcp            (legacy / CI fallback)
 */

import { existsSync } from "fs";
import { join, resolve, isAbsolute } from "path";

export const SERVER_SCRIPT = "stoira_mcp_server.py";
const VENV_REL = ".venv/bin/python3";

/** Ordered list of candidate directories to search. */
export function candidateDirs(): string[] {
  const home = process.env.HOME ?? "/home/ec2-user";
  const cwd = process.cwd();

  return [
    // 1. Explicit env override
    ...(process.env.OPENCOORN_MCP_SERVER_DIR
      ? [process.env.OPENCOORN_MCP_SERVER_DIR]
      : []),
    // 2. Next to CWD (dev checkout)
    join(cwd, "stoira-mcp"),
    // 3. Home directory
    join(home, "stoira-mcp"),
    // 4. XDG-style hidden dir
    join(home, ".stoira", "mcp"),
    // 5. Legacy / CI fallback
    "/tmp/stoira-mcp",
  ];
}

/**
 * Return the first candidate directory that contains SERVER_SCRIPT,
 * or `null` if none match.
 */
export function findServerDir(): string | null {
  for (const dir of candidateDirs()) {
    if (existsSync(join(dir, SERVER_SCRIPT))) return dir;
  }
  return null;
}

/**
 * Resolve the Python interpreter for the MCP server.
 * Prefers a local venv, then falls back to python3 on $PATH.
 */
export function resolvePython(serverDir: string): string {
  const venvPy = join(serverDir, VENV_REL);
  if (existsSync(venvPy)) return venvPy;
  return "python3";
}

/**
 * Build the environment block for the spawned MCP process.
 * Sets VIRTUAL_ENV when a venv is detected.
 */
export function buildMcpEnv(
  python: string,
  serverDir: string,
): Record<string, string> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  if (python.includes(".venv")) {
    env.VIRTUAL_ENV = join(serverDir, ".venv");
  }
  return env;
}

/**
 * Build the full spawn arguments for the MCP server.
 *
 * @param serverUrl  The mcpServerUrl from settings (e.g. "stdio://stoira_mcp_server.py").
 * @param serverDir  The resolved server directory.
 * @returns The argv array to pass to Bun.spawn / child_process.
 */
export function buildMcpArgs(
  serverUrl: string,
  serverDir: string,
): string[] {
  const python = resolvePython(serverDir);

  if (serverUrl.startsWith("stdio://")) {
    const script = serverUrl.slice("stdio://".length);
    const scriptPath = isAbsolute(script)
      ? script
      : join(serverDir, script);
    return [python, scriptPath, "--transport", "stdio"];
  }

  // Fallback: treat the whole value as a path
  const scriptPath = isAbsolute(serverUrl)
    ? serverUrl
    : join(serverDir, SERVER_SCRIPT);
  return [python, scriptPath, "--transport", "stdio"];
}

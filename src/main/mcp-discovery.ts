/**
 * MCP server discovery — resolves the stoira-mcp server script from
 * configurable paths instead of a single hardcoded /tmp location.
 *
 * Discovery order for the server directory:
 *   1.  $OPENCOORN_MCP_SERVER_DIR  (explicit override)
 *   2.  $CWD/stoira-mcp            (dev checkout alongside app)
 *   3.  <app-sibling>/stoira-mcp   (sibling of OpenCorn project root, found via source tree)
 *   4.  <exe-sibling>/stoira-mcp   (sibling of OpenCorn project root, found via executable)
 *   5.  <exe-dir>/stoira-mcp       (next to the running binary / bundle)
 *   6.  $HOME/stoira-mcp           (common local install)
 *   7.  $HOME/.stoira/mcp          (XDG-style hidden dir)
 *   8.  /tmp/stoira-mcp            (legacy / CI fallback)
 */

import { existsSync } from "fs";
import { join, resolve, isAbsolute, dirname, parse } from "path";

export const SERVER_SCRIPT = "stoira_mcp_server.py";
const VENV_REL = ".venv/bin/python3";

/**
 * Walk up from `start` looking for a directory that contains `marker`.
 * Returns the directory path or `null` if the filesystem root is reached.
 * Skips into `node_modules/` so nested package.json files don't short-circuit.
 */
export function findUpDir(start: string, marker: string): string | null {
  let dir = resolve(start);
  const { root } = parse(dir);
  while (true) {
    // Skip node_modules — we want the *project* root, not a dependency's
    if (!dir.includes(`${process.platform === "win32" ? "\\" : "/"}node_modules`)) {
      if (existsSync(join(dir, marker))) return dir;
    }
    const parent = dirname(dir);
    if (parent === dir || dir === root) return null;
    dir = parent;
  }
}

/**
 * Dedup-push a candidate into the list (preserves insertion order).
 */
function pushUnique(list: string[], candidate: string) {
  if (!list.includes(candidate)) list.push(candidate);
}

/** Ordered list of candidate directories to search. */
export function candidateDirs(): string[] {
  const home = process.env.HOME ?? "/home/ec2-user";
  const cwd = process.cwd();

  const dirs: string[] = [];

  // 1. Explicit env override (highest priority)
  if (process.env.OPENCOORN_MCP_SERVER_DIR) {
    dirs.push(process.env.OPENCOORN_MCP_SERVER_DIR);
  }

  // 2. Next to CWD (dev checkout)
  pushUnique(dirs, join(cwd, "stoira-mcp"));

  // 3. Sibling of the app's source tree
  //    e.g. import.meta.dir = …/OpenCorn-new/src/main → project root = …/OpenCorn-new
  //    → check …/stoira-mcp
  const appRoot = findUpDir(import.meta.dir, "package.json");
  if (appRoot) {
    pushUnique(dirs, join(dirname(appRoot), "stoira-mcp"));
  }

  // 4. Sibling of the running executable's project root
  //    (covers bundled / packaged installs where import.meta.dir differs from execPath)
  const execRoot = findUpDir(dirname(process.execPath), "package.json");
  if (execRoot && execRoot !== appRoot) {
    pushUnique(dirs, join(dirname(execRoot), "stoira-mcp"));
  }

  // 5. Next to the executable itself (flat layout: binary + server side-by-side)
  pushUnique(dirs, join(dirname(process.execPath), "stoira-mcp"));

  // 6. Home directory
  pushUnique(dirs, join(home, "stoira-mcp"));

  // 7. XDG-style hidden dir
  pushUnique(dirs, join(home, ".stoira", "mcp"));

  // 8. Legacy / CI fallback
  pushUnique(dirs, "/tmp/stoira-mcp");

  return dirs;
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

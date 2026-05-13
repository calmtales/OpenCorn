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

import { existsSync, readFileSync } from "fs";
import { execFileSync } from "child_process";
import { join, resolve, isAbsolute, dirname, parse } from "path";

export const SERVER_SCRIPT = "stoira_mcp_server.py";
const VENV_REL = ".venv/bin/python3";
const OPENROUTER_ENV_FILE = "openrouter.env";
const OPENROUTER_KEYCHAIN_SERVICE = "OpenCorn OpenRouter API Key";

function normalizeSecret(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseEnvValue(contents: string, key: string): string | undefined {
  for (const rawLine of contents.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const withoutExport = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;
    const eqIndex = withoutExport.indexOf("=");
    if (eqIndex === -1) continue;

    const parsedKey = withoutExport.slice(0, eqIndex).trim();
    if (parsedKey !== key) continue;

    let value = withoutExport.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return normalizeSecret(value);
  }

  return undefined;
}

function openRouterSecretPaths(): string[] {
  const home = process.env.HOME ?? "/home/ec2-user";
  const paths: string[] = [];

  if (process.env.OPENCOORN_OPENROUTER_ENV_FILE) {
    paths.push(process.env.OPENCOORN_OPENROUTER_ENV_FILE);
  }

  paths.push(join(home, ".config", "opencorn", OPENROUTER_ENV_FILE));
  paths.push(join(home, ".stoira", OPENROUTER_ENV_FILE));

  return Array.from(new Set(paths));
}

function readOpenRouterKeyFromEnvFile(): string | undefined {
  for (const path of openRouterSecretPaths()) {
    if (!existsSync(path)) continue;
    try {
      const contents = readFileSync(path, "utf-8");
      const value = parseEnvValue(contents, "OPENROUTER_API_KEY");
      if (value) return value;
    } catch {
      // Ignore unreadable secret files and continue to the next local source.
    }
  }

  return undefined;
}

function readOpenRouterKeyFromMacKeychain(): string | undefined {
  if (process.platform !== "darwin") return undefined;

  try {
    return normalizeSecret(
      execFileSync(
        "security",
        ["find-generic-password", "-w", "-s", OPENROUTER_KEYCHAIN_SERVICE],
        { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
      ),
    );
  } catch {
    return undefined;
  }
}

function resolveOpenRouterApiKey(): string | undefined {
  return (
    normalizeSecret(process.env.OPENROUTER_API_KEY) ??
    readOpenRouterKeyFromEnvFile() ??
    readOpenRouterKeyFromMacKeychain()
  );
}

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
    if (
      !dir.includes(`${process.platform === "win32" ? "\\" : "/"}node_modules`)
    ) {
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
  const env: Record<string, string> = { ...process.env } as Record<
    string,
    string
  >;
  if (python.includes(".venv")) {
    env.VIRTUAL_ENV = join(serverDir, ".venv");
  }
  const openRouterApiKey = resolveOpenRouterApiKey();
  if (openRouterApiKey) {
    env.OPENROUTER_API_KEY = openRouterApiKey;
  }
  if (!env.OPENROUTER_MODEL) {
    env.OPENROUTER_MODEL = "openrouter/free";
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
export function buildMcpArgs(serverUrl: string, serverDir: string): string[] {
  const python = resolvePython(serverDir);
  const normalized = (serverUrl ?? "").trim();

  if (normalized.startsWith("stdio://")) {
    const script = normalized.slice("stdio://".length);
    const scriptPath = isAbsolute(script) ? script : join(serverDir, script);
    return [python, scriptPath, "--transport", "stdio"];
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    throw new Error(
      "HTTP/S MCP endpoints are not supported yet. Use stdio://<script> for now.",
    );
  }

  if (!normalized) {
    return [python, join(serverDir, SERVER_SCRIPT), "--transport", "stdio"];
  }

  if (normalized.includes("://")) {
    throw new Error(`Unsupported MCP server URL scheme: ${normalized}`);
  }

  // Fallback: treat value as a script path (absolute or relative to serverDir)
  const scriptPath = isAbsolute(normalized)
    ? normalized
    : join(serverDir, normalized);
  return [python, scriptPath, "--transport", "stdio"];
}

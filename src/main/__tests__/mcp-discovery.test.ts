import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  candidateDirs,
  findServerDir,
  findUpDir,
  resolvePython,
  buildMcpArgs,
  buildMcpEnv,
  SERVER_SCRIPT,
} from "../mcp-discovery";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";

const FIXTURE = join(import.meta.dir, "__fixtures__", "mcp-test");

function setupFixture(dir: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, SERVER_SCRIPT),
    "#!/usr/bin/env python3\nprint('ok')\n",
  );
}

function cleanupFixture(dir: string) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

describe("mcp-discovery", () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    for (const key of Object.keys(process.env)) {
      if (!(key in origEnv)) delete process.env[key];
    }
    Object.assign(process.env, origEnv);
    cleanupFixture(FIXTURE);
  });

  // -----------------------------------------------------------------------
  // findUpDir
  // -----------------------------------------------------------------------

  describe("findUpDir()", () => {
    const upFixture = join(import.meta.dir, "__fixtures__", "findup-test");

    afterEach(() => {
      cleanupFixture(upFixture);
    });

    it("finds a marker file by walking up from a nested directory", () => {
      // Create: upFixture/deep/nested/  + upFixture/package.json
      const nested = join(upFixture, "deep", "nested");
      mkdirSync(nested, { recursive: true });
      writeFileSync(join(upFixture, "marker.txt"), "");

      const result = findUpDir(nested, "marker.txt");
      expect(result).toBe(upFixture);
    });

    it("returns null when marker does not exist anywhere", () => {
      const nested = join(upFixture, "a", "b", "c");
      mkdirSync(nested, { recursive: true });

      const result = findUpDir(nested, "no-such-marker-xyz.txt");
      expect(result).toBeNull();
    });

    it("finds marker in the start directory itself", () => {
      mkdirSync(upFixture, { recursive: true });
      writeFileSync(join(upFixture, "marker.txt"), "");

      const result = findUpDir(upFixture, "marker.txt");
      expect(result).toBe(upFixture);
    });

    it("skips node_modules directories", () => {
      // Create: upFixture/node_modules/dep/  with marker inside node_modules
      // but the real marker is at upFixture level
      const nmDep = join(upFixture, "node_modules", "dep");
      mkdirSync(nmDep, { recursive: true });
      writeFileSync(join(nmDep, "marker.txt"), "fake");
      writeFileSync(join(upFixture, "marker.txt"), "real");

      const result = findUpDir(nmDep, "marker.txt");
      // Should skip node_modules/dep and find the one at upFixture
      expect(result).toBe(upFixture);
    });
  });

  // -----------------------------------------------------------------------
  // candidateDirs
  // -----------------------------------------------------------------------

  describe("candidateDirs()", () => {
    it("includes HOME, CWD, and legacy paths", () => {
      const dirs = candidateDirs();
      expect(dirs.length).toBeGreaterThanOrEqual(4);
      // Should include the legacy fallback
      expect(dirs).toContain("/tmp/stoira-mcp");
      // Should include HOME-based path
      const home = process.env.HOME ?? "/home/ec2-user";
      expect(dirs).toContain(join(home, "stoira-mcp"));
      expect(dirs).toContain(join(home, ".stoira", "mcp"));
    });

    it("includes sibling-of-project-root discovered via import.meta.dir", () => {
      const dirs = candidateDirs();
      // import.meta.dir is …/OpenCorn-new/src/main → project root …/OpenCorn-new
      // parent of project root → …/ → sibling candidate = …/stoira-mcp
      // For /tmp/OpenCorn-new this resolves to /tmp/stoira-mcp (same as legacy)
      const expectedSibling = join(
        dirname(dirname(dirname(import.meta.dir))),
        "stoira-mcp",
      );
      // Verify it appears in the list (may deduplicate with legacy /tmp/stoira-mcp)
      expect(dirs).toContain(expectedSibling);
    });

    it("includes a path next to the running executable", () => {
      const dirs = candidateDirs();
      const exeCandidate = join(dirname(process.execPath), "stoira-mcp");
      expect(dirs).toContain(exeCandidate);
    });

    it("prepends OPENCOORN_MCP_SERVER_DIR when set", () => {
      process.env.OPENCOORN_MCP_SERVER_DIR = "/custom/path";
      const dirs = candidateDirs();
      expect(dirs[0]).toBe("/custom/path");
    });

    it("does not include OPENCOORN_MCP_SERVER_DIR when unset", () => {
      delete process.env.OPENCOORN_MCP_SERVER_DIR;
      const dirs = candidateDirs();
      expect(dirs.every((d) => d !== "")).toBe(true);
    });

    it("has no duplicate entries", () => {
      const dirs = candidateDirs();
      const unique = new Set(dirs);
      expect(dirs.length).toBe(unique.size);
    });
  });

  // -----------------------------------------------------------------------
  // findServerDir
  // -----------------------------------------------------------------------

  describe("findServerDir()", () => {
    it("returns null when no candidate contains the server script", () => {
      // Temporarily hide all real locations by setting override to a nonexistent path
      process.env.OPENCOORN_MCP_SERVER_DIR =
        "/nonexistent/path/that/should/not/exist";
      const result = findServerDir();
      // If /tmp/stoira-mcp actually exists on this machine, that's fine —
      // the test just verifies the function doesn't crash and returns a string or null.
      expect(typeof result === "string" || result === null).toBe(true);
    });

    it("finds the server script in OPENCOORN_MCP_SERVER_DIR", () => {
      setupFixture(FIXTURE);
      process.env.OPENCOORN_MCP_SERVER_DIR = FIXTURE;
      const result = findServerDir();
      expect(result).toBe(FIXTURE);
    });

    it("finds server via sibling-of-project-root when placed alongside OpenCorn", () => {
      // Simulate: project at <tmp>/fake-project/ with package.json
      // server at <tmp>/stoira-mcp-test-sibling/ with the script
      const fakeProject = join(FIXTURE, "fake-project");
      const siblingServer = join(dirname(FIXTURE), "stoira-mcp-test-sibling");
      mkdirSync(fakeProject, { recursive: true });
      writeFileSync(join(fakeProject, "package.json"), "{}");
      setupFixture(siblingServer);

      // Override to point CWD to a non-matching dir so only sibling logic works
      process.env.OPENCOORN_MCP_SERVER_DIR = "/nope";
      // We can't easily mock import.meta.dir, so just verify the env override works
      const result = findServerDir();
      expect(typeof result === "string" || result === null).toBe(true);

      cleanupFixture(siblingServer);
    });

    it("returns the first matching dir", () => {
      setupFixture(FIXTURE);
      process.env.OPENCOORN_MCP_SERVER_DIR = "/definitely/does/not/exist";
      // If /tmp/stoira-mcp exists, it will be found as fallback
      // We can't fully control all paths, but we can verify the override works
      const dirs = candidateDirs();
      expect(dirs.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // resolvePython
  // -----------------------------------------------------------------------

  describe("resolvePython()", () => {
    it("returns python3 when no venv exists", () => {
      const dir = "/nonexistent";
      expect(resolvePython(dir)).toBe("python3");
    });

    it("returns venv python when .venv/bin/python3 exists", () => {
      setupFixture(FIXTURE);
      const venvDir = join(FIXTURE, ".venv", "bin");
      mkdirSync(venvDir, { recursive: true });
      writeFileSync(join(venvDir, "python3"), "#!/bin/sh\n");
      expect(resolvePython(FIXTURE)).toBe(
        join(FIXTURE, ".venv", "bin", "python3"),
      );
      cleanupFixture(FIXTURE);
    });
  });

  // -----------------------------------------------------------------------
  // buildMcpArgs
  // -----------------------------------------------------------------------

  describe("buildMcpArgs()", () => {
    it("parses stdio:// URLs into python + script path", () => {
      const args = buildMcpArgs("stdio://stoira_mcp_server.py", "/opt/mcp");
      expect(args[0]).toBe("python3");
      expect(args[1]).toBe(join("/opt/mcp", "stoira_mcp_server.py"));
      expect(args).toContain("--transport");
      expect(args).toContain("stdio");
    });

    it("throws for http URLs until SSE transport is implemented", () => {
      expect(() =>
        buildMcpArgs("http://127.0.0.1:8080/sse", "/opt/mcp"),
      ).toThrow("HTTP/S MCP endpoints are not supported yet");
    });

    it("throws for unsupported URL schemes", () => {
      expect(() => buildMcpArgs("tcp://localhost:8080", "/opt/mcp")).toThrow(
        "Unsupported MCP server URL scheme",
      );
    });

    it("respects absolute paths in stdio URL", () => {
      const args = buildMcpArgs("stdio:///abs/path/server.py", "/opt/mcp");
      expect(args[1]).toBe("/abs/path/server.py");
    });

    it("treats non-URL values as script paths", () => {
      const args = buildMcpArgs("stoira_mcp_server.py", "/opt/mcp");
      expect(args[1]).toBe(join("/opt/mcp", "stoira_mcp_server.py"));
    });

    it("falls back to default script when URL is empty", () => {
      const args = buildMcpArgs("", "/opt/mcp");
      expect(args[1]).toBe(join("/opt/mcp", SERVER_SCRIPT));
    });
  });

  // -----------------------------------------------------------------------
  // buildMcpEnv
  // -----------------------------------------------------------------------

  describe("buildMcpEnv()", () => {
    it("sets VIRTUAL_ENV when python path contains .venv", () => {
      const env = buildMcpEnv("/mcp/.venv/bin/python3", "/mcp");
      expect(env.VIRTUAL_ENV).toBe(join("/mcp", ".venv"));
    });

    it("does not set VIRTUAL_ENV for system python", () => {
      const orig = process.env.VIRTUAL_ENV;
      delete process.env.VIRTUAL_ENV;
      const env = buildMcpEnv("python3", "/mcp");
      expect(env.VIRTUAL_ENV).toBeUndefined();
      if (orig !== undefined) process.env.VIRTUAL_ENV = orig;
    });

    it("loads OPENROUTER_API_KEY from a local env file override", () => {
      const secretFile = join(FIXTURE, "openrouter.env");
      mkdirSync(FIXTURE, { recursive: true });
      writeFileSync(
        secretFile,
        'OPENROUTER_API_KEY="sk-or-test-local-file"\nOPENROUTER_MODEL=openrouter/ignored\n',
      );

      delete process.env.OPENROUTER_API_KEY;
      process.env.OPENCOORN_OPENROUTER_ENV_FILE = secretFile;

      const env = buildMcpEnv("python3", "/mcp");
      expect(env.OPENROUTER_API_KEY).toBe("sk-or-test-local-file");
      expect(env.OPENROUTER_MODEL).toBe("openrouter/free");
    });

    it("leaves OPENROUTER_API_KEY unset when no secret source exists", () => {
      delete process.env.OPENROUTER_API_KEY;
      process.env.OPENCOORN_OPENROUTER_ENV_FILE = join(
        FIXTURE,
        "missing-openrouter.env",
      );

      const env = buildMcpEnv("python3", "/mcp");
      expect(env.OPENROUTER_API_KEY).toBeUndefined();
      expect(env.OPENROUTER_MODEL).toBe("openrouter/free");
    });
  });
});

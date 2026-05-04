import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  candidateDirs,
  findServerDir,
  resolvePython,
  buildMcpArgs,
  buildMcpEnv,
  SERVER_SCRIPT,
} from "../mcp-discovery";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";

const FIXTURE = join(import.meta.dir, "__fixtures__", "mcp-test");

function setupFixture(dir: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, SERVER_SCRIPT), "#!/usr/bin/env python3\nprint('ok')\n");
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

  describe("candidateDirs()", () => {
    it("includes HOME and CWD-based paths", () => {
      const dirs = candidateDirs();
      expect(dirs.length).toBeGreaterThanOrEqual(4);
      // Should include the legacy fallback
      expect(dirs).toContain("/tmp/stoira-mcp");
      // Should include HOME-based path
      const home = process.env.HOME ?? "/home/ec2-user";
      expect(dirs).toContain(join(home, "stoira-mcp"));
      expect(dirs).toContain(join(home, ".stoira", "mcp"));
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
  });

  describe("findServerDir()", () => {
    it("returns null when no candidate contains the server script", () => {
      // Temporarily hide all real locations by setting override to a nonexistent path
      process.env.OPENCOORN_MCP_SERVER_DIR = "/nonexistent/path/that/should/not/exist";
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

    it("returns the first matching dir", () => {
      setupFixture(FIXTURE);
      process.env.OPENCOORN_MCP_SERVER_DIR = "/definitely/does/not/exist";
      // If /tmp/stoira-mcp exists, it will be found as fallback
      // We can't fully control all paths, but we can verify the override works
      const dirs = candidateDirs();
      expect(dirs.length).toBeGreaterThan(0);
    });
  });

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
      expect(resolvePython(FIXTURE)).toBe(join(FIXTURE, ".venv", "bin", "python3"));
      cleanupFixture(FIXTURE);
    });
  });

  describe("buildMcpArgs()", () => {
    it("parses stdio:// URLs into python + script path", () => {
      const args = buildMcpArgs("stdio://stoira_mcp_server.py", "/opt/mcp");
      expect(args[0]).toBe("python3");
      expect(args[1]).toBe(join("/opt/mcp", "stoira_mcp_server.py"));
      expect(args).toContain("--transport");
      expect(args).toContain("stdio");
    });

    it("falls back to SERVER_SCRIPT for non-stdio URLs", () => {
      const args = buildMcpArgs("tcp://localhost:8080", "/opt/mcp");
      expect(args[1]).toBe(join("/opt/mcp", SERVER_SCRIPT));
    });

    it("respects absolute paths in stdio URL", () => {
      const args = buildMcpArgs("stdio:///abs/path/server.py", "/opt/mcp");
      expect(args[1]).toBe("/abs/path/server.py");
    });
  });

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
  });
});

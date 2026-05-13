import { describe, it, expect } from "bun:test";
import {
  DEFAULT_SETTINGS,
  type VideoProvider,
  type PipelineStage,
} from "../types";

describe("shared/types", () => {
  describe("VideoProvider", () => {
    it("includes ltx as a valid value", () => {
      const provider: VideoProvider = "ltx";
      expect(provider).toBe("ltx");
    });

    it("includes sora2, seedance, and wan", () => {
      const values: VideoProvider[] = ["ltx", "sora2", "seedance", "wan"];
      expect(values).toHaveLength(4);
    });

    it("default videoProvider is ltx", () => {
      expect(DEFAULT_SETTINGS.videoProvider).toBe("ltx");
    });
  });

  describe("DEFAULT_SETTINGS", () => {
    it("has all required fields", () => {
      expect(DEFAULT_SETTINGS.mcpServerUrl).toBeTruthy();
      expect(DEFAULT_SETTINGS.videoProvider).toBeTruthy();
      expect(DEFAULT_SETTINGS.imageProvider).toBeTruthy();
      expect(DEFAULT_SETTINGS.aspectRatio).toBeTruthy();
      expect(DEFAULT_SETTINGS.sceneCount).toBeGreaterThan(0);
      expect(DEFAULT_SETTINGS.style).toBeTruthy();
      expect(DEFAULT_SETTINGS.exportFormat).toBeTruthy();
      expect(DEFAULT_SETTINGS.exportResolution).toBeTruthy();
    });

    it("mcpServerUrl uses stdio scheme", () => {
      expect(DEFAULT_SETTINGS.mcpServerUrl).toMatch(/^stdio:\/\//);
    });

    it("defaults workflowMode to auto", () => {
      expect(DEFAULT_SETTINGS.workflowMode).toBe("auto");
    });
  });

  describe("PipelineStage", () => {
    it("includes waiting_approval", () => {
      const stage: PipelineStage = "waiting_approval";
      expect(stage).toBe("waiting_approval");
    });
  });
});

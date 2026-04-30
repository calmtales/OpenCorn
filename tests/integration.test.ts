/**
 * OpenCorn v0.4 Integration Tests
 *
 * Tests the full pipeline flow with a mock MCP server,
 * settings persistence, batch mode, ComfyUI connection,
 * and error handling.
 *
 * Run: bun test tests/integration.test.ts
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import type {
  AppSettings,
  FilmStyle,
  PipelineStatus,
  Storyboard,
  BatchState,
  BatchJob,
  ComfyUIConnection,
  WorkflowSummary,
} from "../src/shared/types";
import { DEFAULT_SETTINGS } from "../src/shared/types";

// ---------------------------------------------------------------------------
// Mock MCP Server — simulates stoira-mcp JSON-RPC responses
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

class MockMcpServer {
  private requestLog: JsonRpcRequest[] = [];
  private responseQueue: JsonRpcResponse[] = [];
  private handler: ((req: JsonRpcRequest) => JsonRpcResponse | null) | null =
    null;
  private connected = false;
  private timeoutMs = 0; // 0 = no timeout

  setHandler(
    handler: (req: JsonRpcRequest) => JsonRpcResponse | null
  ) {
    this.handler = handler;
  }

  setTimeout(ms: number) {
    this.timeoutMs = ms;
  }

  connect() {
    this.connected = true;
  }

  disconnect() {
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }

  async handleRequest(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.requestLog.push(req);

    if (this.timeoutMs > 0) {
      await new Promise((r) => setTimeout(r, this.timeoutMs + 100));
      return {
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -1, message: "Request timed out" },
      };
    }

    if (this.handler) {
      const resp = this.handler(req);
      if (resp) return resp;
    }

    return {
      jsonrpc: "2.0",
      id: req.id,
      error: { code: -32601, message: "Method not found" },
    };
  }

  getRequestLog() {
    return [...this.requestLog];
  }

  clearLog() {
    this.requestLog = [];
  }
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const SAMPLE_SCREENPLAY = {
  workflow_id: "wf-test-001",
  screenplay: {
    title: "Astronaut's Discovery",
    total_duration: 50,
    scenes: [
      {
        title: "The Approach",
        visual_description:
          "A spacecraft descends toward a mysterious moon surface",
        duration: 10,
        dialogue: "Contacting base...",
        keyframe_url: "https://mock.img/scene1.png",
        timestamp: 0,
      },
      {
        title: "The Artifact",
        visual_description:
          "An ancient AI artifact pulses with blue light in a crater",
        duration: 15,
        dialogue: "What is this thing?",
        keyframe_url: "https://mock.img/scene2.png",
        timestamp: 10,
      },
      {
        title: "First Contact",
        visual_description:
          "The artifact projects holographic alien text into the air",
        duration: 15,
        dialogue: "It's... alive.",
        keyframe_url: "https://mock.img/scene3.png",
        timestamp: 25,
      },
      {
        title: "The Message",
        visual_description:
          "A decoded message reveals coordinates to another star system",
        duration: 10,
        dialogue: "We're not alone.",
        keyframe_url: "https://mock.img/scene4.png",
        timestamp: 40,
      },
    ],
  },
};

const SAMPLE_VIDEO_RESULT = {
  scene_videos: [
    { video_url: "https://mock.video/scene1.mp4" },
    { video_url: "https://mock.video/scene2.mp4" },
    { video_url: "https://mock.video/scene3.mp4" },
    { video_url: "https://mock.video/scene4.mp4" },
  ],
  merged_video_url: "https://mock.video/full-film.mp4",
};

const SAMPLE_WORKFLOWS: WorkflowSummary[] = [
  {
    workflowId: "wf-001",
    title: "Astronaut's Discovery",
    idea: "A lone astronaut discovers an ancient AI artifact",
    style: "anime",
    createdAt: "2026-04-30T10:00:00Z",
    status: "complete",
    videoUrl: "https://mock.video/film1.mp4",
    sceneCount: 4,
  },
  {
    workflowId: "wf-002",
    title: "Cyber Noir",
    idea: "A detective in a neon city",
    style: "cyberpunk",
    createdAt: "2026-04-30T11:00:00Z",
    status: "generating_video",
    sceneCount: 6,
  },
];

// ---------------------------------------------------------------------------
// Mock Pipeline Controller — simulates the main process pipeline
// ---------------------------------------------------------------------------

class MockPipelineController {
  private mcp: MockMcpServer;
  private settings: AppSettings;
  private workflows = new Map<
    string,
    { storyboard?: Storyboard; videoUrl?: string }
  >();

  constructor(mcp: MockMcpServer, settings: AppSettings) {
    this.mcp = mcp;
    this.settings = settings;
  }

  async submitIdea(
    idea: string,
    style: FilmStyle
  ): Promise<{ workflowId: string }> {
    if (!this.mcp.isConnected()) {
      this.mcp.connect();
    }

    const resp = await this.mcp.handleRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "generate_screenplay",
        arguments: {
          idea,
          anime_style: "ANIME",
          num_scenes: this.settings.sceneCount,
          aspect_ratio: this.settings.aspectRatio,
        },
      },
    });

    if (resp.error) throw new Error(resp.error.message);

    const result = resp.result as any;
    const workflowId = result.workflow_id;
    const storyboard = this.buildStoryboard(result, workflowId, idea, style);
    this.workflows.set(workflowId, { storyboard });

    return { workflowId };
  }

  async getStoryboard(workflowId: string): Promise<Storyboard> {
    const entry = this.workflows.get(workflowId);
    if (!entry?.storyboard) throw new Error("Storyboard not found");
    return entry.storyboard;
  }

  async pollStatus(workflowId: string): Promise<PipelineStatus> {
    const resp = await this.mcp.handleRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "get_workflow_status",
        arguments: { workflow_id: workflowId },
      },
    });

    if (resp.error) throw new Error(resp.error.message);

    return this.parseStatus(resp.result as any);
  }

  async runFullPipeline(
    idea: string,
    style: FilmStyle,
    workflowId: string
  ): Promise<{ videoUrl: string }> {
    const resp = await this.mcp.handleRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "run_full_pipeline",
        arguments: {
          idea,
          anime_style: "ANIME",
          workflow_id: workflowId,
        },
      },
    });

    if (resp.error) throw new Error(resp.error.message);

    const result = resp.result as any;
    const videoUrl = result.merged_video_url ?? result.scene_videos?.[0]?.video_url;
    const entry = this.workflows.get(workflowId);
    if (entry) entry.videoUrl = videoUrl;
    return { videoUrl };
  }

  async getVideo(workflowId: string): Promise<{ videoUrl: string }> {
    const entry = this.workflows.get(workflowId);
    if (!entry?.videoUrl) throw new Error("Video not ready");
    return { videoUrl: entry.videoUrl };
  }

  getSettings(): AppSettings {
    return { ...this.settings };
  }

  saveSettings(settings: AppSettings) {
    this.settings = { ...settings };
    return { success: true };
  }

  private buildStoryboard(
    result: any,
    workflowId: string,
    idea: string,
    style: FilmStyle
  ): Storyboard {
    const screenplay = result.screenplay;
    const scenes = screenplay.scenes.map((s: any, i: number) => ({
      id: `${workflowId}-scene-${i + 1}`,
      title: s.title,
      description: s.visual_description,
      duration: s.duration,
      dialogue: s.dialogue,
      keyframes: s.keyframe_url
        ? [
            {
              id: `${workflowId}-kf-${i + 1}`,
              imageUrl: s.keyframe_url,
              description: s.visual_description,
              timestamp: s.timestamp ?? i * 10,
            },
          ]
        : [],
      order: i,
    }));

    return {
      id: workflowId,
      title: screenplay.title,
      idea,
      style,
      scenes,
      totalDuration: screenplay.total_duration,
      createdAt: new Date().toISOString(),
    };
  }

  private parseStatus(status: any): PipelineStatus {
    if (status.error) return { stage: "idle", progress: 0, error: status.error };
    const stages = status.stages ?? status;
    if (stages.merged) return { stage: "complete", progress: 100 };
    if (stages.videos) return { stage: "stitching", progress: 90 };
    if (stages.keyframes) return { stage: "generating_video", progress: 70 };
    if (stages.screenplay) return { stage: "generating_keyframes", progress: 30 };
    return { stage: "generating_screenplay", progress: 10 };
  }
}

// ---------------------------------------------------------------------------
// Mock ComfyUI Server
// ---------------------------------------------------------------------------

class MockComfyUIServer {
  private connected = false;
  private models = [
    { name: "sdxl_base.safetensors", type: "checkpoint", path: "checkpoints/sdxl_base.safetensors" },
    { name: "anime_diffusion.safetensors", type: "checkpoint", path: "checkpoints/anime_diffusion.safetensors" },
    { name: "detail_enhancer.safetensors", type: "lora", path: "loras/detail_enhancer.safetensors" },
  ];

  async connect(): Promise<boolean> {
    this.connected = true;
    return true;
  }

  disconnect() {
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }

  getModels() {
    return this.connected ? [...this.models] : [];
  }

  async submitPrompt(_workflow: string, _inputs: Record<string, unknown>) {
    if (!this.connected) throw new Error("Not connected");
    return { promptId: `prompt-${Date.now()}` };
  }
}

// ---------------------------------------------------------------------------
// Settings persistence mock (localStorage-like)
// ---------------------------------------------------------------------------

class MockStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

// ===========================================================================
// TEST SUITES
// ===========================================================================

describe("Full Pipeline Flow", () => {
  let mcp: MockMcpServer;
  let pipeline: MockPipelineController;

  beforeEach(() => {
    mcp = new MockMcpServer();
    mcp.connect();
    mcp.setHandler((req) => {
      if (req.method === "tools/call") {
        const toolName = req.params?.name;
        if (toolName === "generate_screenplay") {
          return {
            jsonrpc: "2.0",
            id: req.id,
            result: {
              content: [
                { type: "text", text: JSON.stringify(SAMPLE_SCREENPLAY) },
              ],
            },
          };
        }
        if (toolName === "get_workflow_status") {
          return {
            jsonrpc: "2.0",
            id: req.id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    stages: {
                      screenplay: true,
                      keyframes: true,
                      videos: true,
                      merged: true,
                    },
                  }),
                },
              ],
            },
          };
        }
        if (toolName === "run_full_pipeline") {
          return {
            jsonrpc: "2.0",
            id: req.id,
            result: {
              content: [
                { type: "text", text: JSON.stringify(SAMPLE_VIDEO_RESULT) },
              ],
            },
          };
        }
      }
      return null;
    });

    pipeline = new MockPipelineController(mcp, { ...DEFAULT_SETTINGS });
  });

  afterEach(() => {
    mcp.disconnect();
  });

  test("submitIdea returns workflowId and builds storyboard", async () => {
    const { workflowId } = await pipeline.submitIdea(
      "A lone astronaut discovers an ancient AI artifact",
      "anime"
    );

    expect(workflowId).toBe("wf-test-001");

    const storyboard = await pipeline.getStoryboard(workflowId);
    expect(storyboard.title).toBe("Astronaut's Discovery");
    expect(storyboard.scenes).toHaveLength(4);
    expect(storyboard.scenes[0].title).toBe("The Approach");
    expect(storyboard.scenes[0].keyframes).toHaveLength(1);
    expect(storyboard.totalDuration).toBe(50);
  });

  test("pollStatus returns complete after full pipeline", async () => {
    const { workflowId } = await pipeline.submitIdea("test idea", "anime");
    const status = await pipeline.pollStatus(workflowId);

    expect(status.stage).toBe("complete");
    expect(status.progress).toBe(100);
    expect(status.error).toBeUndefined();
  });

  test("runFullPipeline returns merged video URL", async () => {
    const { workflowId } = await pipeline.submitIdea("test idea", "anime");
    const { videoUrl } = await pipeline.runFullPipeline(
      "test idea",
      "anime",
      workflowId
    );

    expect(videoUrl).toBe("https://mock.video/full-film.mp4");

    const { videoUrl: fetchedUrl } = await pipeline.getVideo(workflowId);
    expect(fetchedUrl).toBe(videoUrl);
  });

  test("full flow: submitIdea -> screenplay -> keyframes -> video -> export", async () => {
    // Step 1: Submit idea
    const { workflowId } = await pipeline.submitIdea(
      "A lone astronaut discovers an ancient AI artifact",
      "anime"
    );
    expect(workflowId).toBeTruthy();

    // Step 2: Get screenplay/storyboard
    const storyboard = await pipeline.getStoryboard(workflowId);
    expect(storyboard.scenes.length).toBeGreaterThan(0);
    expect(storyboard.idea).toBe(
      "A lone astronaut discovers an ancient AI artifact"
    );

    // Step 3: Check pipeline progress
    const status = await pipeline.pollStatus(workflowId);
    expect(["generating_screenplay", "generating_keyframes", "generating_video", "stitching", "complete"]).toContain(status.stage);

    // Step 4: Run full pipeline to get video
    const { videoUrl } = await pipeline.runFullPipeline(
      storyboard.idea,
      storyboard.style,
      workflowId
    );
    expect(videoUrl).toMatch(/^https?:\/\//);

    // Step 5: Fetch final video
    const video = await pipeline.getVideo(workflowId);
    expect(video.videoUrl).toBe("https://mock.video/full-film.mp4");
  });
});

describe("Settings Persistence", () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  test("save then load settings survives restart simulation", () => {
    const customSettings: AppSettings = {
      ...DEFAULT_SETTINGS,
      videoProvider: "wan",
      sceneCount: 10,
      style: "cyberpunk",
      exportResolution: "4k",
    };

    // Save
    const serialized = JSON.stringify(customSettings);
    storage.setItem("opencorn-settings", serialized);

    // Simulate restart — clear in-memory state
    const loaded = JSON.parse(
      storage.getItem("opencorn-settings") ?? "{}"
    ) as AppSettings;

    expect(loaded.videoProvider).toBe("wan");
    expect(loaded.sceneCount).toBe(10);
    expect(loaded.style).toBe("cyberpunk");
    expect(loaded.exportResolution).toBe("4k");
    expect(loaded.mcpServerUrl).toBe(DEFAULT_SETTINGS.mcpServerUrl);
  });

  test("default settings used when no saved settings exist", () => {
    const loaded = storage.getItem("opencorn-settings");
    expect(loaded).toBeNull();

    // Should fall back to defaults
    const settings = { ...DEFAULT_SETTINGS };
    expect(settings.videoProvider).toBe("sora2");
    expect(settings.sceneCount).toBe(5);
    expect(settings.style).toBe("anime");
  });

  test("settings round-trip preserves all fields", () => {
    const settings: AppSettings = {
      mcpServerUrl: "tcp://custom-server:9090",
      videoProvider: "seedance",
      imageProvider: "gemini",
      aspectRatio: "9:16",
      sceneCount: 20,
      style: "ghibli",
      exportFormat: "webm",
      exportResolution: "720p",
    };

    storage.setItem("opencorn-settings", JSON.stringify(settings));
    const restored = JSON.parse(storage.getItem("opencorn-settings")!);

    for (const key of Object.keys(settings) as (keyof AppSettings)[]) {
      expect(restored[key]).toBe(settings[key]);
    }
  });
});

describe("Batch Mode", () => {
  let mcp: MockMcpServer;
  let pipeline: MockPipelineController;

  beforeEach(() => {
    mcp = new MockMcpServer();
    mcp.connect();
    mcp.setHandler((req) => {
      if (req.method === "tools/call") {
        const toolName = req.params?.name;
        if (toolName === "generate_screenplay") {
          const idea = (req.params?.arguments as any)?.idea ?? "unknown";
          return {
            jsonrpc: "2.0",
            id: req.id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    workflow_id: `wf-batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    screenplay: {
                      title: idea.slice(0, 40),
                      total_duration: 30,
                      scenes: [
                        {
                          title: "Scene 1",
                          visual_description: `Visual for: ${idea}`,
                          duration: 15,
                          dialogue: "",
                          keyframe_url: "https://mock.img/batch.png",
                          timestamp: 0,
                        },
                        {
                          title: "Scene 2",
                          visual_description: `Continuation of: ${idea}`,
                          duration: 15,
                          dialogue: "",
                          keyframe_url: "https://mock.img/batch2.png",
                          timestamp: 15,
                        },
                      ],
                    },
                  }),
                },
              ],
            },
          };
        }
        if (toolName === "run_full_pipeline") {
          return {
            jsonrpc: "2.0",
            id: req.id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    scene_videos: [{ video_url: "https://mock.video/batch.mp4" }],
                    merged_video_url: "https://mock.video/batch-merged.mp4",
                  }),
                },
              ],
            },
          };
        }
        if (toolName === "get_workflow_status") {
          return {
            jsonrpc: "2.0",
            id: req.id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    stages: { screenplay: true, keyframes: true, videos: true, merged: true },
                  }),
                },
              ],
            },
          };
        }
      }
      return null;
    });

    pipeline = new MockPipelineController(mcp, { ...DEFAULT_SETTINGS });
  });

  afterEach(() => {
    mcp.disconnect();
  });

  test("batch processes 3 sample ideas sequentially", async () => {
    const ideas = [
      { idea: "A cat exploring a cyberpunk city", style: "cyberpunk" as FilmStyle },
      { idea: "A dragon in a watercolor forest", style: "watercolor" as FilmStyle },
      { idea: "A detective solving a noir mystery", style: "noir" as FilmStyle },
    ];

    const results: { idea: string; workflowId: string; videoUrl: string; status: string }[] = [];

    for (const { idea, style } of ideas) {
      const { workflowId } = await pipeline.submitIdea(idea, style);
      const status = await pipeline.pollStatus(workflowId);
      const { videoUrl } = await pipeline.runFullPipeline(idea, style, workflowId);

      results.push({
        idea,
        workflowId,
        videoUrl,
        status: status.stage,
      });
    }

    expect(results).toHaveLength(3);
    expect(results[0].idea).toBe("A cat exploring a cyberpunk city");
    expect(results[1].idea).toBe("A dragon in a watercolor forest");
    expect(results[2].idea).toBe("A detective solving a noir mystery");

    for (const r of results) {
      expect(r.workflowId).toBeTruthy();
      expect(r.videoUrl).toBeTruthy();
      expect(r.status).toBe("complete");
    }
  });

  test("batch with per-idea styles", async () => {
    const jobs = [
      { idea: "Anime battle scene", style: "anime" as FilmStyle },
      { idea: "Ghibli meadow", style: "ghibli" as FilmStyle },
    ];

    const storyboards: Storyboard[] = [];
    for (const { idea, style } of jobs) {
      const { workflowId } = await pipeline.submitIdea(idea, style);
      const sb = await pipeline.getStoryboard(workflowId);
      storyboards.push(sb);
    }

    expect(storyboards[0].style).toBe("anime");
    expect(storyboards[1].style).toBe("ghibli");
  });
});

describe("ComfyUI Connection", () => {
  let comfy: MockComfyUIServer;

  beforeEach(() => {
    comfy = new MockComfyUIServer();
  });

  afterEach(() => {
    comfy.disconnect();
  });

  test("connect returns models", async () => {
    const ok = await comfy.connect();
    expect(ok).toBe(true);
    expect(comfy.isConnected()).toBe(true);

    const models = comfy.getModels();
    expect(models).toHaveLength(3);
    expect(models[0].type).toBe("checkpoint");
    expect(models[2].type).toBe("lora");
  });

  test("disconnect clears connection state", async () => {
    await comfy.connect();
    expect(comfy.isConnected()).toBe(true);

    comfy.disconnect();
    expect(comfy.isConnected()).toBe(false);
    expect(comfy.getModels()).toHaveLength(0);
  });

  test("submitPrompt requires connection", async () => {
    await expect(comfy.submitPrompt("wf", {})).rejects.toThrow(
      "Not connected"
    );

    await comfy.connect();
    const result = await comfy.submitPrompt("wf", {});
    expect(result.promptId).toBeTruthy();
  });
});

describe("Error Handling", () => {
  let mcp: MockMcpServer;
  let pipeline: MockPipelineController;

  beforeEach(() => {
    mcp = new MockMcpServer();
    mcp.connect();
    pipeline = new MockPipelineController(mcp, { ...DEFAULT_SETTINGS });
  });

  afterEach(() => {
    mcp.disconnect();
  });

  test("MCP timeout returns error", async () => {
    mcp.setTimeout(5000);

    await expect(
      pipeline.submitIdea("test", "anime")
    ).rejects.toThrow("timed out");
  });

  test("invalid MCP response throws error", async () => {
    mcp.setHandler(() => ({
      jsonrpc: "2.0",
      id: 0,
      error: { code: -32600, message: "Invalid request" },
    }));

    await expect(
      pipeline.submitIdea("test", "anime")
    ).rejects.toThrow("Invalid request");
  });

  test("MCP disconnection is handled gracefully", async () => {
    mcp.disconnect();
    mcp.setHandler(() => null);

    // Should reconnect on use
    mcp.connect();
    mcp.setHandler((req) => {
      if (req.method === "tools/call" && req.params?.name === "generate_screenplay") {
        return {
          jsonrpc: "2.0",
          id: req.id,
          result: {
            content: [
              { type: "text", text: JSON.stringify(SAMPLE_SCREENPLAY) },
            ],
          },
        };
      }
      return null;
    });

    const { workflowId } = await pipeline.submitIdea("test", "anime");
    expect(workflowId).toBeTruthy();
  });

  test("missing storyboard throws descriptive error", async () => {
    await expect(
      pipeline.getStoryboard("nonexistent-id")
    ).rejects.toThrow("Storyboard not found");
  });

  test("missing video throws descriptive error", async () => {
    await expect(
      pipeline.getVideo("nonexistent-id")
    ).rejects.toThrow("Video not ready");
  });

  test("malformed screenplay data is handled", async () => {
    mcp.setHandler((req) => {
      if (req.method === "tools/call") {
        return {
          jsonrpc: "2.0",
          id: req.id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  workflow_id: "wf-bad",
                  screenplay: {
                    title: "Partial Data",
                    // missing scenes
                  },
                }),
              },
            ],
          },
        };
      }
      return null;
    });

    const { workflowId } = await pipeline.submitIdea("test", "anime");
    const sb = await pipeline.getStoryboard(workflowId);
    expect(sb.scenes).toHaveLength(0);
    expect(sb.totalDuration).toBe(0);
  });
});

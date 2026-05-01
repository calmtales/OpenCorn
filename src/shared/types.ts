export type FilmStyle =
  | "anime"
  | "noir"
  | "cyberpunk"
  | "watercolor"
  | "realistic"
  | "stop-motion"
  | "arcane"
  | "ghibli"
  | "oil-painting"
  | "claymation";

export type PipelineStage =
  | "idle"
  | "generating_screenplay"
  | "generating_keyframes"
  | "generating_video"
  | "processing_audio"
  | "stitching"
  | "complete";

export type VideoProvider = "sora2" | "seedance" | "wan";
export type ImageProvider = "nano_banana" | "seedream" | "gemini";
export type AspectRatio = "9:16" | "16:9" | "1:1";
export type ExportFormat = "mp4" | "webm" | "mov";
export type ExportResolution = "480p" | "720p" | "1080p" | "4k";
export type CameraAngle = "wide" | "medium" | "close-up" | "tracking" | "dolly";
export type LightingMood =
  | "natural"
  | "dramatic"
  | "warm"
  | "cool"
  | "noir"
  | "golden-hour"
  | "neon";

export interface AppSettings {
  mcpServerUrl: string;
  videoProvider: VideoProvider;
  imageProvider: ImageProvider;
  aspectRatio: AspectRatio;
  sceneCount: number;
  style: FilmStyle;
  exportFormat: ExportFormat;
  exportResolution: ExportResolution;
}

export const DEFAULT_SETTINGS: AppSettings = {
  mcpServerUrl: "stdio://stoira_mcp_server.py",
  videoProvider: "sora2",
  imageProvider: "nano_banana",
  aspectRatio: "16:9",
  sceneCount: 5,
  style: "anime",
  exportFormat: "mp4",
  exportResolution: "1080p",
};

export interface PipelineStatus {
  stage: PipelineStage;
  progress: number; // 0-100
  error?: string;
}

export interface Keyframe {
  id: string;
  imageUrl: string;
  description: string;
  timestamp: number; // seconds in the film
}

export interface Scene {
  id: string;
  title: string;
  description: string;
  duration: number; // seconds
  dialogue?: string;
  keyframes: Keyframe[];
  order: number;
  // PromptCraft extensions
  customPrompt?: string;
  cameraAngle?: CameraAngle;
  lightingMood?: LightingMood;
  characterRefUrl?: string;
}

export interface Storyboard {
  id: string;
  title: string;
  idea: string;
  style: FilmStyle;
  scenes: Scene[];
  totalDuration: number;
  createdAt: string;
}

export interface FilmProject {
  workflowId: string;
  storyboard: Storyboard | null;
  videoUrl: string | null;
  audioUrl: string | null;
  status: PipelineStatus;
}

export interface WorkflowSummary {
  workflowId: string;
  title: string;
  idea: string;
  style: FilmStyle;
  createdAt: string;
  status: PipelineStage;
  videoUrl?: string;
  sceneCount: number;
}

export interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
}

// RPC contract: Bun-side handlers (callable from renderer)
// messages: payload types for messages this side *sends* to the webview
export interface BunRPC {
  requests: {
    submitIdea: (args: {
      idea: string;
      style: FilmStyle;
      settings: AppSettings;
    }) => { workflowId: string };
    getStoryboard: (args: { workflowId: string }) => Storyboard;
    pollStatus: (args: { workflowId: string }) => PipelineStatus;
    getVideo: (args: { workflowId: string }) => { videoUrl: string };
    listWorkflows: () => { workflows: WorkflowSummary[] };
    deleteWorkflow: (args: { workflowId: string }) => { success: boolean };
    resumeWorkflow: (args: { workflowId: string }) => { workflowId: string };
    updateScene: (args: {
      workflowId: string;
      sceneId: string;
      updates: Partial<Scene>;
    }) => { success: boolean };
    getSettings: () => AppSettings;
    saveSettings: (args: { settings: AppSettings }) => { success: boolean };
    // ComfyUI
    comfyConnect: (args: { url: string }) => { success: boolean; models: ComfyUIModel[] };
    comfyDisconnect: () => { success: boolean };
    comfyGetStatus: () => ComfyUIConnection;
    comfyScanModels: () => { models: ComfyUIModel[] };
    comfyImportWorkflow: (args: { json: string }) => { workflow: ComfyUIWorkflow };
    comfyExportWorkflow: (args: { workflowId: string }) => { json: string };
    comfySubmitPrompt: (args: { workflowId: string; inputs: Record<string, unknown> }) => { promptId: string };
    comfyPollStatus: (args: { promptId: string }) => ComfyUIQueueItem;
    comfyListQueue: () => { queue: ComfyUIQueueItem[] };
    // Local Models
    scanLocalModels: (args: { dir?: string }) => { models: LocalModel[] };
    getRecommendedModels: () => { models: RecommendedModel[] };
    downloadModel: (args: { modelId: string; url: string }) => { success: boolean };
    getVramInfo: () => { totalMb: number; usedMb: number; freeMb: number };
    benchmarkModel: (args: { modelId: string }) => { latencyMs: number };
    // Batch
    submitBatch: (args: { jobs: { idea: string; style: FilmStyle }[]; concurrency: number }) => { batchId: string };
    getBatchStatus: (args: { batchId: string }) => BatchState;
    cancelBatch: (args: { batchId: string }) => { success: boolean };
    exportBatchResults: (args: { batchId: string; format: "zip" | "individual" }) => { path: string };
  };
  messages: {
    onPipelineUpdate: { status: PipelineStatus };
    onStoryboardReady: { storyboard: Storyboard };
    onVideoReady: { videoUrl: string };
    onToast: { toast: Toast };
    onComfyUIUpdate: { connection: ComfyUIConnection };
    onBatchProgress: { jobId: string; status: BatchJob["status"]; progress: number };
  };
}

// --- ComfyUI Types ---
export type ComfyUIStatus = "disconnected" | "connecting" | "connected" | "error";

export interface ComfyUINode {
  id: string;
  type: string;
  title?: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
}

export interface ComfyUIWorkflow {
  id: string;
  name: string;
  nodes: ComfyUINode[];
  raw: Record<string, unknown>;
  source: "imported" | "bundled" | "custom";
}

export interface ComfyUIQueueItem {
  promptId: string;
  workflowName: string;
  status: "queued" | "running" | "completed" | "failed";
  progress?: number;
  outputUrl?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ComfyUIModel {
  name: string;
  type: "checkpoint" | "lora" | "vae" | "controlnet" | "upscale" | "clip" | "unet";
  path: string;
  sizeBytes?: number;
}

export interface ComfyUIConnection {
  status: ComfyUIStatus;
  url: string;
  models: ComfyUIModel[];
  workflows: ComfyUIWorkflow[];
  queue: ComfyUIQueueItem[];
}

// --- Local Models Types ---
export type ModelFormat = "gguf" | "onnx" | "safetensors" | "ckpt" | "pt";

export interface LocalModel {
  id: string;
  name: string;
  format: ModelFormat;
  path: string;
  sizeBytes: number;
  vramEstimateMb?: number;
  tags: string[];
  lastUsed?: string;
  benchmarkMs?: number;
}

export interface RecommendedModel {
  id: string;
  name: string;
  description: string;
  format: ModelFormat;
  downloadUrl: string;
  sizeBytes: number;
  vramEstimateMb: number;
  tags: string[];
  category: "image" | "video" | "audio" | "text";
}

export interface LocalModelsState {
  models: LocalModel[];
  scanning: boolean;
  downloadQueue: { modelId: string; progress: number; speed?: string }[];
  systemVramMb?: number;
  usedVramMb?: number;
}

// --- Preset Types ---
export interface StylePreset {
  id: string;
  name: string;
  description: string;
  thumbnail: string; // data URI or path
  style: FilmStyle;
  promptTemplate: string;
  aspectRatio: AspectRatio;
  sceneCount: number;
  recommendedModels: string[];
  tags: string[];
  isCustom?: boolean;
}

// --- Batch Mode Types ---
export interface BatchJob {
  id: string;
  idea: string;
  style: FilmStyle;
  status: "pending" | "running" | "complete" | "failed";
  workflowId?: string;
  progress: number;
  videoUrl?: string;
  error?: string;
  createdAt: string;
}

export interface BatchState {
  jobs: BatchJob[];
  isRunning: boolean;
  currentIndex: number;
  concurrency: number;
}

// RPC contract: Webview-side handlers (callable from Bun)
// messages: payload types for messages this side *receives* from bun
export interface WebviewRPC {
  requests: {};
  messages: {
    onPipelineUpdate: { status: PipelineStatus };
    onStoryboardReady: { storyboard: Storyboard };
    onVideoReady: { videoUrl: string };
    onToast: { toast: Toast };
    onComfyUIUpdate: { connection: ComfyUIConnection };
    onBatchProgress: { jobId: string; status: BatchJob["status"]; progress: number };
  };
}

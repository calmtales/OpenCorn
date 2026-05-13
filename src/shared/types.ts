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
  | "waiting_approval"
  | "processing_audio"
  | "stitching"
  | "complete";

export type WorkflowMode = "auto" | "approval";
export type ApprovalStage = "keyframes" | "scene_videos" | "audio" | "stitch";
export type IndustryMode =
  | "filmmaking"
  | "design"
  | "architecture"
  | "advertising";

export type WritersRoomFormat =
  | "feature-film"
  | "web-series"
  | "animation-anime"
  | "ott-original"
  | "franchise-ip"
  | "ad-film"
  | "docu-drama";

export type WritersRoomPackageTier = "lite" | "studio" | "franchise";

export type WritersRoomStageId =
  | "idea-intake"
  | "concept-expansion"
  | "structure-building"
  | "character-system"
  | "world-bible"
  | "draft-generation"
  | "human-refinement";

export type WritersRoomReviewRole = "writer" | "showrunner" | "producer";
export type WritersRoomApproval =
  | "pending"
  | "approved"
  | "changes_requested"
  | "rejected";

export type ProductionLayer =
  | "writers-room"
  | "storyboard-previs"
  | "virtual-production"
  | "post-localization"
  | "ip-franchise";

export interface LayerStartOptions {
  writersRoomFormat?: WritersRoomFormat;
  writersRoomTier?: WritersRoomPackageTier;
}

export interface WritersRoomAnalysisEntry {
  name: string;
  mentions: number;
  span?: string;
}

export interface WritersRoomAnalysis {
  seedSummary: string;
  register: string;
  moodArc: string[];
  motifsTop: string[];
  characters: WritersRoomAnalysisEntry[];
  objects: WritersRoomAnalysisEntry[];
  ip: {
    level: string;
    franchise?: string;
    modelPreference?: string;
  };
}

export interface WritersRoomDeliverable {
  id: string;
  stageId: WritersRoomStageId;
  title: string;
  summary: string;
  body: string;
  status: "ready" | "error";
  tier: WritersRoomPackageTier;
  enrichmentStatus?: "pending" | "enriching" | "enriched" | "edited";
}

export interface WritersRoomStage {
  id: WritersRoomStageId;
  title: string;
  summary: string;
  order: number;
  status: "ready" | "planned" | "error";
  deliverableIds: string[];
}

export interface WritersRoomRoleReview {
  role: WritersRoomReviewRole;
  label: string;
  responsibility: string;
  status: "pending" | "reviewed";
  approval: WritersRoomApproval;
  notes: string;
  stageId?: WritersRoomStageId;
  deliverableIds?: string[];
  updatedAt?: string;
}

export interface WritersRoomRevision {
  id: string;
  event: string;
  actor: string;
  role?: WritersRoomReviewRole;
  stageId: WritersRoomStageId;
  approval?: WritersRoomApproval;
  summary: string;
  changedDeliverableIds: string[];
  stageIds?: WritersRoomStageId[];
  createdAt: string;
}

export interface WritersRoomRefinementInput {
  workflowId: string;
  role: WritersRoomReviewRole;
  stageId: WritersRoomStageId;
  notes: string;
  approval?: WritersRoomApproval;
  deliverableIds?: string[];
}

export interface WritersRoomPack {
  workflowId: string;
  seed: string;
  format: WritersRoomFormat;
  packageTier: WritersRoomPackageTier;
  title: string;
  summary: string;
  analysis: WritersRoomAnalysis;
  stages: WritersRoomStage[];
  deliverables: WritersRoomDeliverable[];
  roleReviews: WritersRoomRoleReview[];
  revisionHistory: WritersRoomRevision[];
  status: "ready" | "error";
  createdAt: string;
  updatedAt?: string;
}

export interface ApprovalDecision {
  workflowId: string;
  stage: ApprovalStage;
  approved: boolean;
  decidedAt: string;
  actor: "human" | "agent";
  reason?: string;
}

export interface ApprovalState {
  workflowId: string;
  pendingStage?: ApprovalStage;
  history: ApprovalDecision[];
}

export type VideoProvider = "ltx" | "sora2" | "seedance" | "wan";
export type ImageProvider = "nano_banana" | "seedream" | "gemini";
export type AspectRatio = "9:16" | "16:9" | "1:1";
export type ExportFormat = "mp4" | "webm" | "mov";
export type ExportResolution = "480p" | "720p" | "1080p" | "4k";
export type TransitionType = "fade" | "crossfade" | "wipe" | "none";
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
  workflowMode: WorkflowMode;
  videoProvider: VideoProvider;
  imageProvider: ImageProvider;
  aspectRatio: AspectRatio;
  sceneCount: number;
  style: FilmStyle;
  exportFormat: ExportFormat;
  exportResolution: ExportResolution;
  enableAudio: boolean;
  enableSubtitles: boolean;
  transitionType: TransitionType;
  characterVoiceRefUrl?: string;
  characterRefUrl?: string;
  // Model routing
  brainstormModel?: string;
  writerModel?: string;
  directorModel?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  mcpServerUrl: "stdio://stoira_mcp_server.py",
  workflowMode: "auto",
  videoProvider: "ltx",
  imageProvider: "nano_banana",
  aspectRatio: "16:9",
  sceneCount: 5,
  style: "anime",
  exportFormat: "mp4",
  exportResolution: "1080p",
  enableAudio: false,
  enableSubtitles: false,
  transitionType: "crossfade",
  brainstormModel: undefined,
  writerModel: undefined,
  directorModel: undefined,
};

export interface PipelineStatus {
  stage: PipelineStage;
  progress: number; // 0-100
  error?: string;
  pendingStage?: ApprovalStage;
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
  voiceRefUrl?: string;
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

export interface AuthoringBeat {
  id?: string;
  title: string;
  body: string;
  mood?: string;
}

export interface AuthoringBranchOption {
  label: string;
  summary: string;
  deliverable?: string;
  nextAction?: string;
  rationale?: string;
  promptSeed?: string;
}

export interface AuthoringBrainstormResult {
  workflowId?: string;
  seed?: string;
  title?: string;
  industryMode?: IndustryMode;
  options: AuthoringBranchOption[];
  contextBrief?: string;
  motifsTop?: string[];
  status?: "ready" | "error";
  createdAt?: string;
}

export interface AuthoringWriterAssistResult {
  title: string;
  summary: string;
  body: string;
  imagePrompt: string;
  mood?: string;
  tone?: string;
}

export interface StoryPolicyResult {
  ipLevel: string;
  franchise?: string | null;
  modelPreference?: string;
  reason?: string;
}

export interface CharacterSheetEntry {
  name: string;
  description: string;
  portraitPrompt?: string;
}

export interface ReharmonizeRewrite {
  nodeId: string;
  title: string;
  summary: string;
  body: string;
  imagePrompt: string;
  mood?: string;
  reason?: string;
}

export interface ReharmonizeStoryResult {
  rewrites: ReharmonizeRewrite[];
  rewrittenCount: number;
}

export interface WorkflowResumePayload {
  workflowId: string;
  storyboard?: Storyboard;
  videoUrl?: string;
  creativeRoom?: AuthoringBrainstormResult;
  writersRoomPack?: WritersRoomPack;
  industryMode?: IndustryMode;
  productionLayer?: ProductionLayer;
}

export interface ProjectLogEntry {
  ts: string;
  event: string;
  details: Record<string, unknown>;
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
  industryMode?: IndustryMode;
  productionLayer?: ProductionLayer;
  writersRoomFormat?: WritersRoomFormat;
  writersRoomTier?: WritersRoomPackageTier;
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

export interface Snapshot {
  snapshot_name: string;
  created_at: string;
  scene_count: number;
  path: string;
}

// RPC contract: Bun-side handlers (callable from renderer)
// messages: payload types for messages this side *sends* to the webview
export interface BunRPC {
  requests: {
    submitIdea: (args: {
      idea: string;
      style: FilmStyle;
      settings: AppSettings;
      industryMode?: IndustryMode;
      productionLayer?: ProductionLayer;
    }) => {
      workflowId: string;
      storyboard?: Storyboard;
      creativeRoom?: AuthoringBrainstormResult;
    };
    getStoryboard: (args: { workflowId: string }) => Storyboard;
    pollStatus: (args: { workflowId: string }) => PipelineStatus;
    getVideo: (args: { workflowId: string }) => { videoUrl: string };
    approvePipelineStage: (args: { workflowId: string }) => {
      started: boolean;
    };
    getApprovalState: (args: { workflowId: string }) => ApprovalState;
    getProjectLog: (args: { workflowId: string; limit?: number }) => {
      workflowId: string;
      logPath?: string;
      events: ProjectLogEntry[];
    };
    authoringBrainstorm: (args: {
      workflowId?: string;
      industryMode?: IndustryMode;
      seed: string;
      canonBeats: AuthoringBeat[];
      focusBeat: AuthoringBeat;
      branchCount?: number;
      productionLayer?: ProductionLayer;
    }) => AuthoringBrainstormResult;
    generateWritersRoomPack: (args: {
      seed: string;
      format: WritersRoomFormat;
      packageTier: WritersRoomPackageTier;
      workflowId?: string;
      productionLayer?: ProductionLayer;
    }) => WritersRoomPack;
    regenerateWritersRoomDeliverable: (args: {
      workflowId: string;
      deliverableId: string;
      notes?: string;
    }) => WritersRoomPack;
    updateWritersRoomDeliverable: (args: {
      workflowId: string;
      deliverableId: string;
      body: string;
    }) => WritersRoomPack;
    recordWritersRoomRefinement: (
      args: WritersRoomRefinementInput,
    ) => WritersRoomPack;
    authoringWriterAssist: (args: {
      workflowId?: string;
      seed: string;
      canonTitles: string[];
      parentTitle: string;
      childTitle: string;
      intent: string;
      mode: "canon" | "what-if";
    }) => AuthoringWriterAssistResult;
    reharmonizeStory: (args: {
      insertedBeat: AuthoringBeat;
      downstreamBeats: Array<{ nodeId: string; title: string; body: string }>;
    }) => ReharmonizeStoryResult;
    detectStoryPolicy: (args: { seed: string }) => StoryPolicyResult;
    generateCharacterSheet: (args: {
      seed: string;
      franchise?: string | null;
      allowIpNames?: boolean;
    }) => { entries: CharacterSheetEntry[] };
    generateImage: (args: {
      prompt: string;
      imageModel?: string;
      referenceUrls?: string[];
    }) => { imageUrl: string };
    listWorkflows: () => { workflows: WorkflowSummary[] };
    deleteWorkflow: (args: { workflowId: string }) => { success: boolean };
    resumeWorkflow: (args: { workflowId: string }) => WorkflowResumePayload;
    updateScene: (args: {
      workflowId: string;
      sceneId: string;
      updates: Partial<Scene>;
    }) => { success: boolean };
    bulkUpdateScenes: (args: {
      sceneIds: string[];
      updates: Partial<Scene>;
    }) => { success: boolean; updatedCount: number };
    createSnapshot: (args: { name?: string }) => {
      snapshotName: string;
      path: string;
      createdAt: string;
      sceneCount: number;
    };
    listSnapshots: () => { snapshots: Snapshot[]; count: number };
    getSettings: () => AppSettings;
    getMcpStatus: () => { connected: boolean };
    saveSettings: (args: { settings: AppSettings }) => { success: boolean };
    // ComfyUI
    comfyConnect: (args: { url: string }) => {
      success: boolean;
      models: ComfyUIModel[];
    };
    comfyDisconnect: () => { success: boolean };
    comfyGetStatus: () => ComfyUIConnection;
    comfyScanModels: () => { models: ComfyUIModel[] };
    comfyImportWorkflow: (args: { json: string }) => {
      workflow: ComfyUIWorkflow;
    };
    comfyExportWorkflow: (args: { workflowId: string }) => { json: string };
    comfySubmitPrompt: (args: {
      workflowId: string;
      inputs: Record<string, unknown>;
    }) => { promptId: string };
    comfyPollStatus: (args: { promptId: string }) => ComfyUIQueueItem;
    comfyListQueue: () => { queue: ComfyUIQueueItem[] };
    // Local Models
    scanLocalModels: (args: { dir?: string }) => { models: LocalModel[] };
    getRecommendedModels: () => { models: RecommendedModel[] };
    downloadModel: (args: { modelId: string; url: string }) => {
      success: boolean;
    };
    getVramInfo: () => { totalMb: number; usedMb: number; freeMb: number };
    benchmarkModel: (args: { modelId: string }) => { latencyMs: number };
    // Batch
    submitBatch: (args: {
      jobs: { idea: string; style: FilmStyle }[];
      concurrency: number;
    }) => { batchId: string };
    getBatchStatus: (args: { batchId: string }) => BatchState;
    cancelBatch: (args: { batchId: string }) => { success: boolean };
    exportBatchResults: (args: {
      batchId: string;
      format: "zip" | "individual";
    }) => { path: string };
  };
  messages: {
    onPipelineUpdate: { status: PipelineStatus };
    onStoryboardReady: { storyboard: Storyboard };
    onVideoReady: { videoUrl: string };
    onToast: { toast: Toast };
    onComfyUIUpdate: { connection: ComfyUIConnection };
    onBatchProgress: {
      jobId: string;
      status: BatchJob["status"];
      progress: number;
    };
  };
}

// --- ComfyUI Types ---
export type ComfyUIStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

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
  type:
    | "checkpoint"
    | "lora"
    | "vae"
    | "controlnet"
    | "upscale"
    | "clip"
    | "unet";
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
    onBatchProgress: {
      jobId: string;
      status: BatchJob["status"];
      progress: number;
    };
  };
}

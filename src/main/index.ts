import {
  BrowserWindow,
  defineElectrobunRPC,
  type ElectrobunRPCSchema,
} from "electrobun/bun";
import type {
  BunRPC,
  WebviewRPC,
  PipelineStatus,
  Storyboard,
  Scene,
  FilmStyle,
  AppSettings,
  WorkflowSummary,
  ComfyUIModel,
  ComfyUIWorkflow,
  ComfyUIQueueItem,
  ComfyUIConnection,
  LocalModel,
  RecommendedModel,
  BatchJob,
  BatchState,
  Toast,
  ApprovalDecision,
  ApprovalStage,
  AuthoringBeat,
  AuthoringBrainstormResult,
  AuthoringWriterAssistResult,
  CharacterSheetEntry,
  IndustryMode,
  ProductionLayer,
  ReharmonizeStoryResult,
  StoryPolicyResult,
  WorkflowResumePayload,
  WritersRoomFormat,
  WritersRoomPackageTier,
  WritersRoomPack,
  WritersRoomRefinementInput,
  WritersRoomStageId,
  WritersRoomReviewRole,
  WritersRoomApproval,
  ProjectLogEntry,
} from "../shared/types";
import { DEFAULT_SETTINGS } from "../shared/types";
import { ComfyUIClient } from "./comfyui";
import {
  findServerDir,
  resolvePython,
  buildMcpArgs,
  buildMcpEnv,
  candidateDirs,
  SERVER_SCRIPT,
} from "./mcp-discovery";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";

// Map UI FilmStyle to stoira-mcp anime_style enum
const STYLE_MAP: Record<FilmStyle, string> = {
  anime: "ANIME",
  noir: "ANIME",
  cyberpunk: "THREE_D_ANIME",
  watercolor: "STUDIO_GHIBLI",
  realistic: "THREE_D_ANIME",
  "stop-motion": "PIXEL_ART",
  arcane: "THREE_D_ANIME",
  ghibli: "STUDIO_GHIBLI",
  "oil-painting": "STUDIO_GHIBLI",
  claymation: "PIXEL_ART",
};

// Reverse map: backend anime_style -> frontend FilmStyle (best guess)
const REVERSE_STYLE_MAP: Record<string, FilmStyle> = {
  ANIME: "anime",
  THREE_D_ANIME: "cyberpunk",
  STUDIO_GHIBLI: "ghibli",
  PIXEL_ART: "stop-motion",
};

function parseIndustryMode(value: unknown): IndustryMode {
  if (
    value === "filmmaking" ||
    value === "design" ||
    value === "architecture" ||
    value === "advertising"
  ) {
    return value;
  }
  return "filmmaking";
}

function parseProductionLayer(value: unknown): ProductionLayer | undefined {
  if (
    value === "writers-room" ||
    value === "storyboard-previs" ||
    value === "virtual-production" ||
    value === "post-localization" ||
    value === "ip-franchise"
  ) {
    return value;
  }
  return undefined;
}

function parseWritersRoomStageId(value: unknown): WritersRoomStageId {
  if (
    value === "idea-intake" ||
    value === "concept-expansion" ||
    value === "structure-building" ||
    value === "character-system" ||
    value === "world-bible" ||
    value === "draft-generation" ||
    value === "human-refinement"
  ) {
    return value;
  }
  return "human-refinement";
}

function parseWritersRoomReviewRole(value: unknown): WritersRoomReviewRole {
  if (value === "writer" || value === "showrunner" || value === "producer") {
    return value;
  }
  return "writer";
}

function parseWritersRoomApproval(value: unknown): WritersRoomApproval {
  if (
    value === "pending" ||
    value === "approved" ||
    value === "changes_requested" ||
    value === "rejected"
  ) {
    return value;
  }
  return "pending";
}

function parseCreativeRoomResult(
  result: any,
  fallback: {
    workflowId?: string;
    seed?: string;
    industryMode?: IndustryMode;
  } = {},
): AuthoringBrainstormResult {
  const options = Array.isArray(result?.options)
    ? result.options.map((option: any) => ({
        label: String(option?.label ?? "Untitled option"),
        summary: String(option?.summary ?? ""),
        deliverable: option?.deliverable
          ? String(option.deliverable)
          : undefined,
        nextAction: option?.next_action
          ? String(option.next_action)
          : option?.nextAction
            ? String(option.nextAction)
            : undefined,
        rationale: option?.rationale ? String(option.rationale) : undefined,
        promptSeed: option?.prompt_seed
          ? String(option.prompt_seed)
          : option?.promptSeed
            ? String(option.promptSeed)
            : undefined,
      }))
    : [];

  const motifs = result?.motifs_top ?? result?.motifsTop;

  return {
    workflowId:
      (result?.workflow_id as string | undefined) ?? fallback.workflowId,
    seed: String(result?.seed ?? fallback.seed ?? ""),
    title: result?.title ? String(result.title) : undefined,
    industryMode: parseIndustryMode(
      result?.industry_mode ?? fallback.industryMode,
    ),
    options,
    contextBrief:
      (result?.context_brief as string | undefined) ??
      (result?.contextBrief as string | undefined),
    motifsTop: Array.isArray(motifs)
      ? motifs.map((item: any) => String(item)).filter(Boolean)
      : undefined,
    status: result?.status === "error" ? "error" : "ready",
    createdAt: result?.created_at ? String(result.created_at) : undefined,
  };
}

function parseWritersRoomPackResult(
  result: any,
  fallback: {
    workflowId?: string;
    seed?: string;
    format?: WritersRoomFormat;
    packageTier?: WritersRoomPackageTier;
  } = {},
): WritersRoomPack {
  return {
    workflowId: String(result?.workflow_id ?? fallback.workflowId ?? ""),
    seed: String(result?.seed ?? fallback.seed ?? ""),
    format: String(
      result?.format ?? fallback.format ?? "feature-film",
    ) as WritersRoomFormat,
    packageTier: String(
      result?.package_tier ?? fallback.packageTier ?? "lite",
    ) as WritersRoomPackageTier,
    title: String(result?.title ?? "Writers Room Pack"),
    summary: String(result?.summary ?? ""),
    analysis: {
      seedSummary: String(result?.analysis?.seedSummary ?? ""),
      register: String(result?.analysis?.register ?? "balanced"),
      moodArc: Array.isArray(result?.analysis?.moodArc)
        ? result.analysis.moodArc.map((item: any) => String(item))
        : [],
      motifsTop: Array.isArray(result?.analysis?.motifsTop)
        ? result.analysis.motifsTop.map((item: any) => String(item))
        : [],
      characters: Array.isArray(result?.analysis?.characters)
        ? result.analysis.characters.map((entry: any) => ({
            name: String(entry?.name ?? "Unknown"),
            mentions: Number(entry?.mentions ?? 0),
            ...(entry?.span ? { span: String(entry.span) } : {}),
          }))
        : [],
      objects: Array.isArray(result?.analysis?.objects)
        ? result.analysis.objects.map((entry: any) => ({
            name: String(entry?.name ?? "Unknown"),
            mentions: Number(entry?.mentions ?? 0),
            ...(entry?.span ? { span: String(entry.span) } : {}),
          }))
        : [],
      ip: {
        level: String(result?.analysis?.ip?.level ?? "unknown"),
        ...(result?.analysis?.ip?.franchise
          ? { franchise: String(result.analysis.ip.franchise) }
          : {}),
        ...(result?.analysis?.ip?.modelPreference
          ? {
              modelPreference: String(result.analysis.ip.modelPreference),
            }
          : {}),
      },
    },
    stages: Array.isArray(result?.stages)
      ? result.stages.map((stage: any) => ({
          id: parseWritersRoomStageId(stage?.id),
          title: String(stage?.title ?? "Untitled Stage"),
          summary: String(stage?.summary ?? ""),
          order: Number(stage?.order ?? 0),
          status:
            stage?.status === "error"
              ? "error"
              : stage?.status === "planned"
                ? "planned"
                : "ready",
          deliverableIds: Array.isArray(stage?.deliverable_ids)
            ? stage.deliverable_ids.map((item: any) => String(item))
            : Array.isArray(stage?.deliverableIds)
              ? stage.deliverableIds.map((item: any) => String(item))
              : [],
        }))
      : [],
    deliverables: Array.isArray(result?.deliverables)
      ? result.deliverables.map((deliverable: any) => ({
          id: String(deliverable?.id ?? "unknown"),
          stageId: parseWritersRoomStageId(
            deliverable?.stage_id ?? deliverable?.stageId,
          ),
          title: String(deliverable?.title ?? "Untitled"),
          summary: String(deliverable?.summary ?? ""),
          body: String(deliverable?.body ?? ""),
          status: deliverable?.status === "error" ? "error" : "ready",
          tier: String(
            deliverable?.tier ??
              result?.package_tier ??
              fallback.packageTier ??
              "lite",
          ) as WritersRoomPackageTier,
          ...(deliverable?.enrichment_status || deliverable?.enrichmentStatus
            ? {
                enrichmentStatus: String(
                  deliverable?.enrichment_status ??
                    deliverable?.enrichmentStatus,
                ) as "pending" | "enriching" | "enriched" | "edited",
              }
            : {}),
        }))
      : [],
    roleReviews: Array.isArray(result?.role_reviews)
      ? result.role_reviews.map((review: any) => ({
          role: parseWritersRoomReviewRole(review?.role),
          label: String(review?.label ?? "Review"),
          responsibility: String(review?.responsibility ?? ""),
          status: review?.status === "reviewed" ? "reviewed" : "pending",
          approval: parseWritersRoomApproval(review?.approval),
          notes: String(review?.notes ?? ""),
          ...(review?.stage_id || review?.stageId
            ? {
                stageId: parseWritersRoomStageId(
                  review?.stage_id ?? review?.stageId,
                ),
              }
            : {}),
          ...(Array.isArray(review?.deliverable_ids)
            ? {
                deliverableIds: review.deliverable_ids.map((item: any) =>
                  String(item),
                ),
              }
            : Array.isArray(review?.deliverableIds)
              ? {
                  deliverableIds: review.deliverableIds.map((item: any) =>
                    String(item),
                  ),
                }
              : {}),
          ...(review?.updated_at || review?.updatedAt
            ? { updatedAt: String(review?.updated_at ?? review?.updatedAt) }
            : {}),
        }))
      : [],
    revisionHistory: Array.isArray(result?.revision_history)
      ? result.revision_history.map((revision: any) => ({
          id: String(revision?.id ?? "revision"),
          event: String(revision?.event ?? "revision"),
          actor: String(revision?.actor ?? "system"),
          ...(revision?.role
            ? { role: parseWritersRoomReviewRole(revision.role) }
            : {}),
          stageId: parseWritersRoomStageId(
            revision?.stage_id ?? revision?.stageId,
          ),
          ...(revision?.approval
            ? { approval: parseWritersRoomApproval(revision.approval) }
            : {}),
          summary: String(revision?.summary ?? ""),
          changedDeliverableIds: Array.isArray(
            revision?.changed_deliverable_ids,
          )
            ? revision.changed_deliverable_ids.map((item: any) => String(item))
            : Array.isArray(revision?.changedDeliverableIds)
              ? revision.changedDeliverableIds.map((item: any) => String(item))
              : [],
          ...(Array.isArray(revision?.stage_ids)
            ? {
                stageIds: revision.stage_ids.map((item: any) =>
                  parseWritersRoomStageId(item),
                ),
              }
            : Array.isArray(revision?.stageIds)
              ? {
                  stageIds: revision.stageIds.map((item: any) =>
                    parseWritersRoomStageId(item),
                  ),
                }
              : {}),
          createdAt: String(revision?.created_at ?? revision?.createdAt ?? ""),
        }))
      : [],
    status: result?.status === "error" ? "error" : "ready",
    createdAt: String(result?.created_at ?? new Date().toISOString()),
    ...(result?.updated_at ? { updatedAt: String(result.updated_at) } : {}),
  };
}

const SETTINGS_DIR = join(process.env.HOME ?? "/home/ec2-user", ".opencorn");
const SETTINGS_PATH = join(SETTINGS_DIR, "settings.json");
const PROJECTS_DIR = join(SETTINGS_DIR, "projects");

function projectLogPath(workflowId: string): string {
  return join(PROJECTS_DIR, workflowId, "events.jsonl");
}

function readProjectLog(
  workflowId: string,
  limit = 80,
): { logPath: string; events: ProjectLogEntry[] } {
  const logPath = projectLogPath(workflowId);
  if (!existsSync(logPath)) {
    return { logPath, events: [] };
  }

  try {
    const lines = readFileSync(logPath, "utf-8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const events = lines
      .slice(-Math.max(1, limit))
      .flatMap((line): ProjectLogEntry[] => {
        try {
          const parsed = JSON.parse(line) as Record<string, unknown>;
          const { ts, event, ...details } = parsed;
          return [
            {
              ts: String(ts ?? ""),
              event: String(event ?? "unknown"),
              details,
            },
          ];
        } catch {
          return [];
        }
      });

    return { logPath, events };
  } catch {
    return { logPath, events: [] };
  }
}

function logProjectEvent(
  workflowId: string | undefined,
  event: string,
  details: Record<string, unknown> = {},
) {
  if (!workflowId) return;
  try {
    const dir = join(PROJECTS_DIR, workflowId);
    mkdirSync(dir, { recursive: true });
    appendFileSync(
      projectLogPath(workflowId),
      JSON.stringify({ ts: new Date().toISOString(), event, ...details }) +
        "\n",
      "utf-8",
    );
  } catch (err) {
    console.warn("Failed to write project event log:", err);
  }
}

function loadPersistedSettings(): AppSettings {
  try {
    if (!existsSync(SETTINGS_PATH)) {
      return { ...DEFAULT_SETTINGS };
    }

    const parsed = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    return { ...DEFAULT_SETTINGS, ...(parsed as Partial<AppSettings>) };
  } catch (err) {
    console.warn("Failed to load persisted settings:", err);
    return { ...DEFAULT_SETTINGS };
  }
}

function persistSettings(settings: AppSettings) {
  mkdirSync(SETTINGS_DIR, { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

// MCP Client — connects to stoira-mcp server via stdio using line-delimited
// JSON-RPC messages (current Python MCP stdio transport behavior).
class McpClient {
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private connected = false;
  private initialized = false;
  private requestId = 0;
  private serverUrl = "stdio://stoira_mcp_server.py";
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();
  private stdoutBuffer = "";
  private pending = new Map<
    number,
    {
      resolve: (v: any) => void;
      reject: (e: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  setServerUrl(url: string) {
    this.serverUrl = url;
  }

  async connect(): Promise<boolean> {
    try {
      this.stdoutBuffer = "";

      const serverDir = findServerDir();
      if (!serverDir) {
        const tried = candidateDirs().join(", ");
        throw new Error(`Could not find ${SERVER_SCRIPT}. Searched: ${tried}`);
      }

      const cmd = buildMcpArgs(this.serverUrl, serverDir);
      const python = resolvePython(serverDir);

      this.proc = Bun.spawn(cmd, {
        stdio: ["pipe", "pipe", "pipe"],
        stderr: "pipe",
        env: buildMcpEnv(python, serverDir),
      });

      // Collect stderr for diagnostics
      const stderrChunks: string[] = [];
      const stderrReader = this.proc.stderr?.getReader();
      const drainStderr = async () => {
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await stderrReader!.read();
            if (done) break;
            stderrChunks.push(decoder.decode(value, { stream: true }));
          }
        } catch {}
      };
      drainStderr();

      // Clean up pending promises on process exit
      this.proc.exited.then(() => {
        this.connected = false;
        this.initialized = false;
        this.rejectAllPending("MCP process exited unexpectedly");
      });

      // Start reading stdout
      this.readLoop();

      // Detect early process exit (e.g. missing Python deps, wrong interpreter)
      await Bun.sleep(500);
      if (this.proc.exitCode !== null) {
        const stderr = stderrChunks.join("").trim();
        const serverDir = findServerDir() ?? "/path/to/stoira-mcp";
        const hint = stderr.includes("ModuleNotFoundError")
          ? `\nHint: run 'cd ${serverDir} && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt'`
          : "";
        throw new Error(
          `MCP server exited immediately (code ${this.proc.exitCode}).${hint}\n${stderr}`,
        );
      }

      this.connected = true;

      // MCP initialize handshake
      await this.initialize();
      return true;
    } catch (err) {
      console.error("MCP connect failed:", err);
      this.rejectAllPending("MCP connection failed");
      this.connected = false;
      this.proc?.kill();
      this.proc = null;
      return false;
    }
  }

  private async initialize(): Promise<void> {
    const result = await this.call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "opencorn",
        version: "0.4.0",
      },
    });

    // Send initialized notification
    this.notify("notifications/initialized", {});
    this.initialized = true;
    console.log("MCP initialized:", result?.serverInfo?.name ?? "unknown");
  }

  private rejectAllPending(reason: string) {
    for (const [, pendingRequest] of this.pending) {
      clearTimeout(pendingRequest.timeout);
      pendingRequest.reject(new Error(reason));
    }
    this.pending.clear();
  }

  private appendStdoutChunk(chunk: Uint8Array) {
    this.stdoutBuffer += this.decoder.decode(chunk, { stream: true });
  }

  private handleIncomingMessage(message: any) {
    if (message?.id == null || !this.pending.has(message.id)) return;

    const pendingRequest = this.pending.get(message.id)!;
    this.pending.delete(message.id);
    clearTimeout(pendingRequest.timeout);

    if (message.error) {
      pendingRequest.reject(
        new Error(message.error.message ?? "Unknown MCP error"),
      );
      return;
    }

    pendingRequest.resolve(message.result);
  }

  private processStdoutFrames() {
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const message = JSON.parse(trimmed);
        this.handleIncomingMessage(message);
      } catch {
        // Ignore malformed/non-JSON stdout lines and continue reading.
      }
    }
  }

  private sendMessage(payload: Record<string, unknown>) {
    if (!this.proc?.stdin) return;
    const msg = JSON.stringify(payload) + "\n";
    this.proc.stdin.write(this.encoder.encode(msg));
  }

  private async readLoop() {
    if (!this.proc?.stdout) return;
    const reader = this.proc.stdout.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.length === 0) continue;
      this.appendStdoutChunk(value);
      this.processStdoutFrames();
    }

    // Flush any trailing decoder state and parse remaining complete lines.
    const tail = this.decoder.decode();
    if (tail) {
      this.stdoutBuffer += tail;
      this.processStdoutFrames();
    }
  }

  private notify(method: string, params: Record<string, unknown>) {
    this.sendMessage({ jsonrpc: "2.0", method, params });
  }

  private async call(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 30_000,
  ) {
    if (!this.proc?.stdin || !this.connected)
      throw new Error("MCP not connected");

    // Guard against process that exited after connect() validated it
    if (this.proc.exitCode !== null)
      throw new Error(`MCP process exited (code ${this.proc.exitCode})`);

    const id = ++this.requestId;

    return new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("MCP request timed out"));
        }
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timeout });
      this.sendMessage({ jsonrpc: "2.0", id, method, params });
    });
  }

  private async callTool(
    name: string,
    args: Record<string, unknown> = {},
    timeoutMs?: number,
  ): Promise<any> {
    const result = await this.call(
      "tools/call",
      { name, arguments: args },
      timeoutMs,
    );
    // MCP tools/call returns { content: [{ type: "text", text: "..." }] }
    if (result?.content?.[0]?.text) {
      return JSON.parse(result.content[0].text);
    }
    return result;
  }

  isConnected() {
    return this.connected && this.initialized;
  }

  async listTools(): Promise<string[]> {
    const result = await this.call("tools/list", {});
    return result?.tools?.map((t: any) => t.name) ?? [];
  }

  async generateScreenplay(
    idea: string,
    style: FilmStyle,
    settings: AppSettings,
    workflowId?: string,
  ): Promise<{ workflowId: string; storyboard: Storyboard }> {
    const animeStyle = STYLE_MAP[style] ?? "ANIME";
    const toolArgs: Record<string, unknown> = {
      idea,
      anime_style: animeStyle,
      num_scenes: settings.sceneCount,
      dialogue_language: "en",
      workflow_id: workflowId,
      aspect_ratio: settings.aspectRatio,
      video_provider: settings.videoProvider,
      image_provider: settings.imageProvider,
    };
    // Pass model routing overrides
    if (settings.writerModel) toolArgs.model = settings.writerModel;

    const result = await this.callTool(
      "generate_screenplay",
      toolArgs,
      150_000,
    );

    const resolvedWorkflowId = result.workflow_id ?? workflowId;
    if (!resolvedWorkflowId) {
      throw new Error("generate_screenplay did not return a workflow_id");
    }
    if (workflowId && resolvedWorkflowId !== workflowId) {
      throw new Error(
        `Workflow ID mismatch: requested ${workflowId}, got ${resolvedWorkflowId}`,
      );
    }
    const screenplay = result.screenplay;
    const storyboard = this.parseScreenplay(
      screenplay,
      resolvedWorkflowId,
      idea,
      style,
    );

    return { workflowId: resolvedWorkflowId, storyboard };
  }

  async getWorkflowStatus(workflowId: string): Promise<PipelineStatus> {
    const result = await this.callTool("get_workflow_status", {
      workflow_id: workflowId,
    });
    return this.parseWorkflowStatus(result);
  }

  async runFullPipeline(
    idea: string,
    style: FilmStyle,
    settings: AppSettings,
    workflowId?: string,
  ): Promise<any> {
    const animeStyle = STYLE_MAP[style] ?? "ANIME";
    const toolArgs: Record<string, unknown> = {
      idea,
      anime_style: animeStyle,
      num_scenes: settings.sceneCount,
      workflow_id: workflowId,
      aspect_ratio: settings.aspectRatio,
      video_provider: settings.videoProvider,
      image_model: resolveImageModel(settings),
      export_format: settings.exportFormat,
      export_resolution: settings.exportResolution,
      enable_audio: settings.enableAudio,
      enable_subtitles: settings.enableSubtitles,
      transition_type: settings.transitionType,
      character_voice_ref_url: settings.characterVoiceRefUrl,
      character_ref_url: settings.characterRefUrl,
    };
    // Pass model routing overrides
    if (settings.writerModel) toolArgs.model = settings.writerModel;
    if (settings.directorModel)
      toolArgs.director_model = settings.directorModel;

    return this.callTool("run_full_pipeline", toolArgs);
  }

  async generateKeyframes(
    workflowId: string,
    settings: AppSettings,
  ): Promise<any> {
    return this.callTool(
      "generate_keyframes",
      {
        workflow_id: workflowId,
        character_ref_url: settings.characterRefUrl,
        image_model: resolveImageModel(settings),
      },
      30 * 60_000,
    );
  }

  async generateImage(args: {
    prompt: string;
    imageModel?: string;
    referenceUrls?: string[];
  }): Promise<{ imageUrl: string }> {
    const result = await this.callTool(
      "generate_image",
      {
        prompt: args.prompt,
        image_model: args.imageModel ?? "nano_banana",
        reference_urls: args.referenceUrls,
      },
      5 * 60_000,
    );
    const url = result?.keyframe_url ?? result?.image_url ?? result?.url ?? "";
    return { imageUrl: String(url) };
  }

  async generateSceneVideos(
    workflowId: string,
    settings: AppSettings,
  ): Promise<any> {
    return this.callTool(
      "generate_scene_videos",
      {
        workflow_id: workflowId,
        aspect_ratio: settings.aspectRatio,
        dialogue_language: "en",
        video_provider: settings.videoProvider,
      },
      2 * 60 * 60_000,
    );
  }

  async generateDialogueAudio(
    workflowId: string,
    settings: AppSettings,
  ): Promise<any> {
    return this.callTool(
      "generate_dialogue_audio",
      {
        workflow_id: workflowId,
        character_voice_ref_url: settings.characterVoiceRefUrl,
        language: "en",
      },
      30 * 60_000,
    );
  }

  async generateBackgroundMusic(workflowId: string): Promise<any> {
    return this.callTool(
      "generate_background_music",
      {
        workflow_id: workflowId,
        style: "anime-soundtrack",
      },
      30 * 60_000,
    );
  }

  async mixAudio(workflowId: string): Promise<any> {
    return this.callTool(
      "mix_audio",
      {
        workflow_id: workflowId,
      },
      30 * 60_000,
    );
  }

  async mergeVideos(workflowId: string, settings: AppSettings): Promise<any> {
    return this.callTool(
      "merge_videos",
      {
        workflow_id: workflowId,
        transition_type: settings.transitionType,
        add_subtitles: settings.enableSubtitles,
        subtitle_style: "anime",
      },
      45 * 60_000,
    );
  }

  async narrativeContextBuilder(
    canonBeats: AuthoringBeat[],
    focusBeat: AuthoringBeat,
  ): Promise<any> {
    return this.callTool("narrative_context_builder", {
      canonBeats,
      focusBeat,
      max_brief_chars: 1600,
    });
  }

  async motifTracker(
    scenes: Array<{ title: string; body: string }>,
  ): Promise<any> {
    return this.callTool("motif_tracker", {
      scenes,
      top_n: 5,
      min_scene_presence: 2,
    });
  }

  async detectStoryPolicy(seed: string): Promise<StoryPolicyResult> {
    const result = await this.callTool("story_copyright_detector", {
      seed,
    });

    return {
      ipLevel: String(result?.ip_level ?? "unknown"),
      ...(result?.franchise !== undefined
        ? { franchise: result.franchise ? String(result.franchise) : null }
        : {}),
      ...(result?.model_preference
        ? { modelPreference: String(result.model_preference) }
        : {}),
      ...(result?.reason ? { reason: String(result.reason) } : {}),
    };
  }

  async generateCharacterSheet(args: {
    seed: string;
    franchise?: string | null;
    allowIpNames?: boolean;
    model?: string;
  }): Promise<CharacterSheetEntry[]> {
    const result = await this.callTool("generate_character_sheet", {
      seed: args.seed,
      franchise: args.franchise ?? undefined,
      allow_ip_names: args.allowIpNames ?? false,
      model: args.model,
    });

    if (!Array.isArray(result)) return [];
    return result.map((entry: any) => ({
      name: String(entry?.name ?? "Unknown"),
      description: String(entry?.description ?? ""),
      ...(entry?.portrait_prompt || entry?.portraitPrompt
        ? {
            portraitPrompt: String(
              entry?.portrait_prompt ?? entry?.portraitPrompt,
            ),
          }
        : {}),
    }));
  }

  async reharmonizeStory(args: {
    insertedBeat: AuthoringBeat;
    downstreamBeats: Array<{ nodeId: string; title: string; body: string }>;
    model?: string;
  }): Promise<ReharmonizeStoryResult> {
    const result = await this.callTool("reharmonize_story", {
      inserted_beat: args.insertedBeat,
      downstream_beats: args.downstreamBeats.map((beat) => ({
        node_id: beat.nodeId,
        title: beat.title,
        body: beat.body,
      })),
      model: args.model,
    });

    const rewrites = Array.isArray(result?.rewrites)
      ? result.rewrites.map((rewrite: any) => ({
          nodeId: String(rewrite?.node_id ?? rewrite?.nodeId ?? ""),
          title: String(rewrite?.title ?? "Untitled"),
          summary: String(rewrite?.summary ?? ""),
          body: String(rewrite?.body ?? ""),
          imagePrompt: String(
            rewrite?.image_prompt ?? rewrite?.imagePrompt ?? "",
          ),
          ...(rewrite?.mood ? { mood: String(rewrite.mood) } : {}),
          ...(rewrite?.reason ? { reason: String(rewrite.reason) } : {}),
        }))
      : [];

    return {
      rewrites,
      rewrittenCount: Number(result?.rewritten_count ?? rewrites.length),
    };
  }

  async generateCreativeRoom(args: {
    workflowId?: string;
    industryMode: IndustryMode;
    seed: string;
    canonBeats: AuthoringBeat[];
    focusBeat: AuthoringBeat;
    branchCount?: number;
    model?: string;
  }): Promise<AuthoringBrainstormResult> {
    const result = await this.callTool("generate_creative_room", {
      workflow_id: args.workflowId,
      industry_mode: args.industryMode,
      seed: args.seed,
      canon_beats: args.canonBeats,
      focus_beat: args.focusBeat,
      branch_count: args.branchCount ?? 4,
      model: args.model,
    });

    return parseCreativeRoomResult(result, {
      workflowId: args.workflowId,
      seed: args.seed,
      industryMode: args.industryMode,
    });
  }

  async authoringWriterAssist(args: {
    workflowId?: string;
    seed: string;
    canonTitles: string[];
    parentTitle: string;
    childTitle: string;
    intent: string;
    mode: "canon" | "what-if";
    model?: string;
  }): Promise<AuthoringWriterAssistResult> {
    const result = await this.callTool("writer_assist", {
      workflow_id: args.workflowId,
      seed: args.seed,
      canon_titles: args.canonTitles,
      parent_title: args.parentTitle,
      child_title: args.childTitle,
      intent: args.intent,
      mode: args.mode,
      model: args.model,
    });

    return {
      title: String(result?.title ?? "Untitled"),
      summary: String(result?.summary ?? ""),
      body: String(result?.body ?? ""),
      imagePrompt: String(result?.image_prompt ?? result?.imagePrompt ?? ""),
      ...(result?.mood ? { mood: String(result.mood) } : {}),
      ...(result?.tone ? { tone: String(result.tone) } : {}),
    };
  }

  async generateWritersRoomPack(args: {
    seed: string;
    format: WritersRoomFormat;
    packageTier: WritersRoomPackageTier;
    workflowId?: string;
    model?: string;
  }): Promise<WritersRoomPack> {
    const result = await this.callTool(
      "generate_writers_room_pack",
      {
        seed: args.seed,
        format: args.format,
        package_tier: args.packageTier,
        workflow_id: args.workflowId,
        model: args.model,
      },
      10 * 60_000, // 10 min — pack generation is LLM-heavy (parallelised ~120s)
    );

    return parseWritersRoomPackResult(result, {
      workflowId: args.workflowId,
      seed: args.seed,
      format: args.format,
      packageTier: args.packageTier,
    });
  }

  async recordWritersRoomRefinement(
    args: WritersRoomRefinementInput,
  ): Promise<WritersRoomPack> {
    const result = await this.callTool(
      "record_writers_room_refinement",
      {
        workflow_id: args.workflowId,
        role: args.role,
        stage_id: args.stageId,
        notes: args.notes,
        approval: args.approval ?? "pending",
        deliverable_ids: args.deliverableIds ?? [],
        actor: "human",
      },
      10 * 60_000, // 10 min — may re-run LLM enrichment
    );

    return parseWritersRoomPackResult(result, {
      workflowId: args.workflowId,
    });
  }

  async regenerateWritersRoomDeliverable(args: {
    workflowId: string;
    deliverableId: string;
    notes?: string;
    model?: string;
  }): Promise<WritersRoomPack> {
    const result = await this.callTool(
      "regenerate_writers_room_deliverable",
      {
        workflow_id: args.workflowId,
        deliverable_id: args.deliverableId,
        notes: args.notes,
        actor: "agent",
        model: args.model,
      },
      5 * 60_000, // 5 min — single deliverable LLM call
    );

    return parseWritersRoomPackResult(result, {
      workflowId: args.workflowId,
    });
  }

  async updateWritersRoomDeliverable(args: {
    workflowId: string;
    deliverableId: string;
    body: string;
  }): Promise<WritersRoomPack> {
    const result = await this.callTool("update_writers_room_deliverable", {
      workflow_id: args.workflowId,
      deliverable_id: args.deliverableId,
      body: args.body,
      actor: "human",
    });

    return parseWritersRoomPackResult(result, {
      workflowId: args.workflowId,
    });
  }

  async getWorkflowArtifacts(workflowId: string): Promise<{
    creativeRoom?: AuthoringBrainstormResult;
    writersRoomPack?: WritersRoomPack;
  }> {
    const result = await this.callTool("get_workflow_artifacts", {
      workflow_id: workflowId,
    });

    return {
      ...(result?.creative_room
        ? {
            creativeRoom: parseCreativeRoomResult(result.creative_room, {
              workflowId,
              seed: result.creative_room?.seed,
              industryMode: parseIndustryMode(
                result.creative_room?.industry_mode,
              ),
            }),
          }
        : {}),
      ...(result?.writers_room
        ? {
            writersRoomPack: parseWritersRoomPackResult(result.writers_room, {
              workflowId,
              seed: result.writers_room?.seed,
              format: String(
                result.writers_room?.format ?? "feature-film",
              ) as WritersRoomFormat,
              packageTier: String(
                result.writers_room?.package_tier ?? "lite",
              ) as WritersRoomPackageTier,
            }),
          }
        : {}),
    };
  }

  async listWorkflows(): Promise<WorkflowSummary[]> {
    const result = await this.callTool("list_workflows", {});
    return (result?.workflows ?? []).map((w: any) => ({
      workflowId: w.workflow_id ?? w.id,
      title: w.title || "Untitled",
      idea: w.idea || "",
      style: (REVERSE_STYLE_MAP[w.style] ?? "anime") as FilmStyle,
      industryMode: parseIndustryMode(w.industry_mode),
      productionLayer:
        parseProductionLayer(w.production_layer) ??
        (w.writers_room_format === "franchise-ip"
          ? "ip-franchise"
          : w.writers_room_format
            ? "writers-room"
            : undefined),
      ...(w?.writers_room_format
        ? {
            writersRoomFormat: String(
              w.writers_room_format,
            ) as WritersRoomFormat,
          }
        : {}),
      ...(w?.writers_room_tier
        ? {
            writersRoomTier: String(
              w.writers_room_tier,
            ) as WritersRoomPackageTier,
          }
        : {}),
      createdAt: w.created_at ?? new Date().toISOString(),
      status: w.status ?? "idle",
      videoUrl: w.video_url ?? w.merged_video_url,
      sceneCount: w.scene_count ?? 0,
    }));
  }

  async deleteWorkflow(workflowId: string): Promise<boolean> {
    try {
      const result = await this.callTool("delete_workflow", {
        workflow_id: workflowId,
      });
      return result?.deleted === true;
    } catch {
      return false;
    }
  }

  async updateScene(
    workflowId: string,
    sceneId: string,
    updates: Partial<Scene>,
  ): Promise<boolean> {
    try {
      await this.callTool("update_scene", {
        workflow_id: workflowId,
        scene_id: sceneId,
        updates,
      });
      return true;
    } catch {
      return false;
    }
  }

  async bulkUpdateScenes(
    sceneIds: string[],
    updates: Partial<Scene>,
    workflowId?: string,
  ): Promise<{ success: boolean; updatedCount: number }> {
    const result = await this.callTool("bulk_update_scenes", {
      workflow_id: workflowId ?? "current",
      scene_ids: sceneIds,
      updates,
    });
    return {
      success: result.success,
      updatedCount: result.updated_count ?? sceneIds.length,
    };
  }

  async createSnapshot(
    workflowId: string,
    name?: string,
  ): Promise<{
    snapshotName: string;
    path: string;
    createdAt: string;
    sceneCount: number;
  }> {
    const result = await this.callTool("create_snapshot", {
      workflow_id: workflowId,
      ...(name ? { name } : {}),
    });
    return {
      snapshotName: result.snapshot_name,
      path: result.path,
      createdAt: result.created_at,
      sceneCount: result.scene_count,
    };
  }

  async listSnapshots(
    workflowId: string,
  ): Promise<{ snapshots: any[]; count: number }> {
    const result = await this.callTool("list_snapshots", {
      workflow_id: workflowId,
    });
    return {
      snapshots: result.snapshots ?? [],
      count: result.count ?? 0,
    };
  }

  private parseScreenplay(
    screenplay: any,
    workflowId: string,
    idea: string,
    style: FilmStyle,
  ): Storyboard {
    const scenes: Scene[] = (screenplay.scenes ?? []).map(
      (s: any, i: number) => ({
        id: `${workflowId}-scene-${i + 1}`,
        title: s.title ?? `Scene ${i + 1}`,
        description: s.visual_description ?? s.description ?? s.action ?? "",
        duration: s.duration ?? 10,
        dialogue: s.dialogue ?? undefined,
        keyframes: s.keyframe_url
          ? [
              {
                id: `${workflowId}-kf-${i + 1}`,
                imageUrl: s.keyframe_url,
                description: s.visual_description ?? "",
                timestamp: s.timestamp ?? i * 10,
              },
            ]
          : [],
        order: i,
      }),
    );

    return {
      id: workflowId,
      title: screenplay.title ?? idea.slice(0, 60),
      idea,
      style,
      scenes,
      totalDuration:
        screenplay.total_duration ??
        scenes.reduce((sum, s) => sum + s.duration, 0),
      createdAt: new Date().toISOString(),
    };
  }

  private parseWorkflowStatus(status: any): PipelineStatus {
    if (status.error) {
      return { stage: "idle", progress: 0, error: status.error };
    }

    // Approval-gated mode may return explicit paused state.
    if (
      status.awaiting_approval === true ||
      status.waiting_for_approval === true ||
      status.stage === "waiting_approval"
    ) {
      const progress =
        typeof status.progress === "number" ? status.progress : 50;
      return { stage: "waiting_approval", progress };
    }

    // The checkpoint returns _complete booleans + progress dicts
    const screenplayDone = status.screenplay_complete ?? false;
    const keyframesDone = status.keyframes_complete ?? false;
    const videosDone = status.videos_complete ?? false;
    const hasMerged = !!status.merged_video_url;

    // Granular progress from per-scene checkpoints
    const kfProgress = status.keyframes_progress ?? null;
    const vidProgress = status.videos_progress ?? null;

    if (hasMerged) return { stage: "complete", progress: 100 };
    if (videosDone) return { stage: "stitching", progress: 95 };

    // Video generation in progress — compute per-scene percentage
    if (vidProgress && (vidProgress.completed_scenes ?? []).length > 0) {
      const completed = (vidProgress.completed_scenes ?? []).length;
      const total = vidProgress.total_scenes ?? 1;
      // Video generation maps to 60–92% range
      const scenePct = total > 0 ? Math.round((completed / total) * 32) : 0;
      return { stage: "generating_video", progress: 60 + scenePct };
    }

    if (keyframesDone) return { stage: "generating_video", progress: 60 };

    // Keyframe generation in progress — compute per-scene percentage
    if (kfProgress && (kfProgress.completed_scenes ?? []).length > 0) {
      const completed = (kfProgress.completed_scenes ?? []).length;
      const total = kfProgress.total_scenes ?? 1;
      // Keyframe generation maps to 25–55% range
      const scenePct = total > 0 ? Math.round((completed / total) * 30) : 0;
      return { stage: "generating_keyframes", progress: 25 + scenePct };
    }

    if (screenplayDone) return { stage: "generating_keyframes", progress: 25 };
    return { stage: "generating_screenplay", progress: 8 };
  }

  disconnect() {
    this.proc?.kill();
    this.rejectAllPending("MCP client disconnected");
    this.stdoutBuffer = "";
    this.connected = false;
    this.initialized = false;
  }
}

// --- App entry ---
const mcp = new McpClient();
const comfy = new ComfyUIClient();
let currentSettings: AppSettings = loadPersistedSettings();
mcp.setServerUrl(currentSettings.mcpServerUrl);
type WorkflowStoreEntry = {
  storyboard?: Storyboard;
  videoUrl?: string;
  scenes?: Scene[];
  idea?: string;
  style?: FilmStyle;
  industryMode?: IndustryMode;
  productionLayer?: ProductionLayer;
  settings?: AppSettings;
  creativeRoom?: AuthoringBrainstormResult;
  writersRoomPack?: WritersRoomPack;
  running?: boolean;
  screenplayPending?: boolean;
  nextStage?: ApprovalStage;
  pendingApprovalStage?: ApprovalStage;
  approvalHistory: ApprovalDecision[];
};

const workflowStore = new Map<string, WorkflowStoreEntry>();
const batchStore = new Map<string, BatchState>();
let batchCounter = 0;

// RPC schema: bun handles requests from renderer, sends messages to renderer
interface AppRPCSchema extends ElectrobunRPCSchema {
  bun: {
    requests: {
      submitIdea: {
        params: {
          idea: string;
          style: FilmStyle;
          settings: AppSettings;
          industryMode?: IndustryMode;
          productionLayer?: ProductionLayer;
        };
        response: {
          workflowId: string;
          storyboard?: Storyboard;
          creativeRoom?: AuthoringBrainstormResult;
        };
      };
      getStoryboard: { params: { workflowId: string }; response: Storyboard };
      pollStatus: { params: { workflowId: string }; response: PipelineStatus };
      getVideo: {
        params: { workflowId: string };
        response: { videoUrl: string };
      };
      approvePipelineStage: {
        params: { workflowId: string; stage?: ApprovalStage; reason?: string };
        response: { started: boolean };
      };
      getApprovalState: {
        params: { workflowId: string };
        response: {
          workflowId: string;
          pendingStage?: ApprovalStage;
          history: ApprovalDecision[];
        };
      };
      getProjectLog: {
        params: { workflowId: string; limit?: number };
        response: {
          workflowId: string;
          logPath?: string;
          events: ProjectLogEntry[];
        };
      };
      authoringBrainstorm: {
        params: {
          workflowId?: string;
          industryMode?: IndustryMode;
          seed: string;
          canonBeats: AuthoringBeat[];
          focusBeat: AuthoringBeat;
          branchCount?: number;
          productionLayer?: ProductionLayer;
        };
        response: AuthoringBrainstormResult;
      };
      generateWritersRoomPack: {
        params: {
          seed: string;
          format: WritersRoomFormat;
          packageTier: WritersRoomPackageTier;
          workflowId?: string;
          productionLayer?: ProductionLayer;
        };
        response: WritersRoomPack;
      };
      regenerateWritersRoomDeliverable: {
        params: {
          workflowId: string;
          deliverableId: string;
          notes?: string;
        };
        response: WritersRoomPack;
      };
      updateWritersRoomDeliverable: {
        params: {
          workflowId: string;
          deliverableId: string;
          body: string;
        };
        response: WritersRoomPack;
      };
      recordWritersRoomRefinement: {
        params: WritersRoomRefinementInput;
        response: WritersRoomPack;
      };
      authoringWriterAssist: {
        params: {
          workflowId?: string;
          seed: string;
          canonTitles: string[];
          parentTitle: string;
          childTitle: string;
          intent: string;
          mode: "canon" | "what-if";
        };
        response: AuthoringWriterAssistResult;
      };
      reharmonizeStory: {
        params: {
          insertedBeat: AuthoringBeat;
          downstreamBeats: Array<{
            nodeId: string;
            title: string;
            body: string;
          }>;
        };
        response: ReharmonizeStoryResult;
      };
      detectStoryPolicy: {
        params: { seed: string };
        response: StoryPolicyResult;
      };
      generateCharacterSheet: {
        params: {
          seed: string;
          franchise?: string | null;
          allowIpNames?: boolean;
        };
        response: { entries: CharacterSheetEntry[] };
      };
      generateImage: {
        params: {
          prompt: string;
          imageModel?: string;
          referenceUrls?: string[];
        };
        response: { imageUrl: string };
      };
      listWorkflows: {
        params: undefined;
        response: { workflows: WorkflowSummary[] };
      };
      deleteWorkflow: {
        params: { workflowId: string };
        response: { success: boolean };
      };
      resumeWorkflow: {
        params: { workflowId: string };
        response: WorkflowResumePayload;
      };
      updateScene: {
        params: {
          workflowId: string;
          sceneId: string;
          updates: Partial<Scene>;
        };
        response: { success: boolean };
      };
      bulkUpdateScenes: {
        params: { sceneIds: string[]; updates: Partial<Scene> };
        response: { success: boolean; updatedCount: number };
      };
      createSnapshot: {
        params: { name?: string };
        response: {
          snapshotName: string;
          path: string;
          createdAt: string;
          sceneCount: number;
        };
      };
      listSnapshots: {
        params: undefined;
        response: { snapshots: any[]; count: number };
      };
      getSettings: { params: undefined; response: AppSettings };
      getMcpStatus: { params: undefined; response: { connected: boolean } };
      saveSettings: {
        params: { settings: AppSettings };
        response: { success: boolean };
      };
      comfyConnect: {
        params: { url: string };
        response: { success: boolean; models: ComfyUIModel[] };
      };
      comfyDisconnect: { params: undefined; response: { success: boolean } };
      comfyGetStatus: { params: undefined; response: ComfyUIConnection };
      comfyScanModels: {
        params: undefined;
        response: { models: ComfyUIModel[] };
      };
      comfyImportWorkflow: {
        params: { json: string };
        response: { workflow: ComfyUIWorkflow };
      };
      comfyExportWorkflow: {
        params: { workflowId: string };
        response: { json: string };
      };
      comfySubmitPrompt: {
        params: { workflowId: string; inputs: Record<string, unknown> };
        response: { promptId: string };
      };
      comfyPollStatus: {
        params: { promptId: string };
        response: ComfyUIQueueItem;
      };
      comfyListQueue: {
        params: undefined;
        response: { queue: ComfyUIQueueItem[] };
      };
      scanLocalModels: {
        params: { dir?: string };
        response: { models: LocalModel[] };
      };
      getRecommendedModels: {
        params: undefined;
        response: { models: RecommendedModel[] };
      };
      downloadModel: {
        params: { modelId: string; url: string };
        response: { success: boolean };
      };
      getVramInfo: {
        params: undefined;
        response: { totalMb: number; usedMb: number; freeMb: number };
      };
      benchmarkModel: {
        params: { modelId: string };
        response: { latencyMs: number };
      };
      submitBatch: {
        params: {
          jobs: { idea: string; style: FilmStyle }[];
          concurrency: number;
        };
        response: { batchId: string };
      };
      getBatchStatus: { params: { batchId: string }; response: BatchState };
      cancelBatch: {
        params: { batchId: string };
        response: { success: boolean };
      };
      exportBatchResults: {
        params: { batchId: string; format: "zip" | "individual" };
        response: { path: string };
      };
    };
    messages: {};
  };
  webview: {
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
  };
}

// Create RPC first, then window — Electrobun wires transport automatically
const rpc = defineElectrobunRPC<AppRPCSchema, "bun">("bun", {
  handlers: { requests: {}, messages: {} },
});

const STAGE_PROGRESS: Record<ApprovalStage, number> = {
  keyframes: 25,
  scene_videos: 60,
  audio: 80,
  stitch: 95,
};

const STAGE_STATUS: Record<ApprovalStage, PipelineStatus["stage"]> = {
  keyframes: "generating_keyframes",
  scene_videos: "generating_video",
  audio: "processing_audio",
  stitch: "stitching",
};

const NEXT_STAGE: Record<ApprovalStage, ApprovalStage | null> = {
  keyframes: "scene_videos",
  scene_videos: "audio",
  audio: "stitch",
  stitch: null,
};

function generateWorkflowId(): string {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, "0");
  return [
    "workflow",
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`,
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`,
  ].join("_");
}

function resolveImageModel(settings: AppSettings): "nano_banana" | "seedream" {
  return settings.imageProvider === "seedream" ? "seedream" : "nano_banana";
}

function ensureWorkflowEntry(workflowId: string): WorkflowStoreEntry {
  const existing = workflowStore.get(workflowId);
  if (existing) return existing;
  const created: WorkflowStoreEntry = { approvalHistory: [] };
  workflowStore.set(workflowId, created);
  return created;
}

function stageIsRequired(stage: ApprovalStage, settings: AppSettings): boolean {
  if (stage === "audio") return settings.enableAudio;
  return true;
}

function firstRequiredStage(settings: AppSettings): ApprovalStage {
  return "keyframes";
}

function nextRequiredStage(
  from: ApprovalStage,
  settings: AppSettings,
): ApprovalStage | null {
  let cursor = NEXT_STAGE[from];
  while (cursor) {
    if (stageIsRequired(cursor, settings)) return cursor;
    cursor = NEXT_STAGE[cursor];
  }
  return null;
}

function recordApprovalDecision(
  entry: WorkflowStoreEntry,
  workflowId: string,
  stage: ApprovalStage,
  approved: boolean,
  reason?: string,
) {
  entry.approvalHistory.push({
    workflowId,
    stage,
    approved,
    decidedAt: new Date().toISOString(),
    actor: "human",
    reason,
  });
}

async function runStage(
  workflowId: string,
  stage: ApprovalStage,
  settings: AppSettings,
): Promise<any> {
  if (stage === "keyframes") return mcp.generateKeyframes(workflowId, settings);
  if (stage === "scene_videos")
    return mcp.generateSceneVideos(workflowId, settings);
  if (stage === "audio") {
    if (!settings.enableAudio) return null;
    await mcp.generateDialogueAudio(workflowId, settings);
    await mcp.generateBackgroundMusic(workflowId);
    return mcp.mixAudio(workflowId);
  }
  return mcp.mergeVideos(workflowId, settings);
}

async function continueWorkflowPipeline(
  workflowId: string,
  approvedStage?: ApprovalStage,
): Promise<void> {
  const entry = ensureWorkflowEntry(workflowId);
  if (!entry.settings) throw new Error("Workflow settings missing");
  const settings = entry.settings;

  if (entry.running) return;
  entry.running = true;

  try {
    while (entry.nextStage) {
      const stage = entry.nextStage;

      if (settings.workflowMode === "approval" && stage !== approvedStage) {
        entry.pendingApprovalStage = stage;
        entry.running = false;
        logProjectEvent(workflowId, "pipeline.waiting_for_approval", {
          stage,
          progress: STAGE_PROGRESS[stage],
        });
        rpc.send("onPipelineUpdate", {
          status: {
            stage: "waiting_approval",
            progress: STAGE_PROGRESS[stage],
            pendingStage: stage,
          },
        });
        return;
      }

      entry.pendingApprovalStage = undefined;
      logProjectEvent(workflowId, "pipeline.stage_started", {
        stage,
        progress: STAGE_PROGRESS[stage],
      });
      rpc.send("onPipelineUpdate", {
        status: {
          stage: STAGE_STATUS[stage],
          progress: STAGE_PROGRESS[stage],
        },
      });

      const result = await runStage(workflowId, stage, settings);
      logProjectEvent(workflowId, "pipeline.stage_completed", { stage });
      approvedStage = undefined;

      if (stage === "stitch") {
        const mergedUrl = result?.merged_video_url ?? result?.video_url;
        if (mergedUrl) {
          entry.videoUrl = mergedUrl;
          rpc.send("onVideoReady", { videoUrl: mergedUrl });
        }
      }

      entry.nextStage = nextRequiredStage(stage, settings) ?? undefined;
    }

    entry.running = false;
    logProjectEvent(workflowId, "pipeline.completed", { progress: 100 });
    rpc.send("onPipelineUpdate", {
      status: { stage: "complete", progress: 100 },
    });
  } catch (err) {
    entry.running = false;
    logProjectEvent(workflowId, "pipeline.error", { error: String(err) });
    rpc.send("onPipelineUpdate", {
      status: { stage: "idle", progress: 0, error: String(err) },
    });
    throw err;
  }
}

// Set request handlers (called async by Electrobun, so `rpc` is fully initialized
// by the time any handler closure executes — safe to reference rpc.send())
rpc.setRequestHandler({
  submitIdea: async ({
    idea,
    style,
    settings,
    industryMode = "filmmaking",
    productionLayer = "storyboard-previs",
  }: {
    idea: string;
    style: FilmStyle;
    settings: AppSettings;
    industryMode?: IndustryMode;
    productionLayer?: ProductionLayer;
  }) => {
    currentSettings = settings ?? currentSettings;
    mcp.setServerUrl(currentSettings.mcpServerUrl);

    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok) throw new Error("Failed to connect to stoira-mcp server");
    }

    const workflowId = generateWorkflowId();
    const shouldGenerateStoryboard =
      industryMode === "filmmaking" && productionLayer === "storyboard-previs";

    workflowStore.set(workflowId, {
      idea,
      style,
      industryMode,
      productionLayer,
      settings: { ...currentSettings },
      approvalHistory: [],
      running: false,
      screenplayPending: shouldGenerateStoryboard,
    });
    logProjectEvent(workflowId, "workflow.created", {
      idea,
      style,
      industryMode,
      productionLayer,
      workflowMode: currentSettings.workflowMode,
    });

    if (!shouldGenerateStoryboard) {
      logProjectEvent(workflowId, "workflow.authoring_only", {
        reason:
          industryMode !== "filmmaking"
            ? "non_filmmaking_mode"
            : "non_storyboard_layer",
      });
      return { workflowId };
    }

    void (async () => {
      try {
        const { storyboard } = await mcp.generateScreenplay(
          idea,
          style,
          currentSettings,
          workflowId,
        );

        const entry = ensureWorkflowEntry(workflowId);
        entry.storyboard = storyboard;
        entry.idea = idea;
        entry.style = style;
        entry.industryMode = industryMode;
        entry.productionLayer = productionLayer;
        entry.settings = { ...currentSettings };
        entry.screenplayPending = false;
        entry.nextStage = firstRequiredStage(currentSettings);
        entry.pendingApprovalStage =
          currentSettings.workflowMode === "approval"
            ? firstRequiredStage(currentSettings)
            : undefined;

        rpc.send("onStoryboardReady", { storyboard });
        logProjectEvent(workflowId, "storyboard.ready", {
          sceneCount: storyboard.scenes.length,
          title: storyboard.title,
        });

        if (currentSettings.workflowMode === "approval") {
          const pendingStage = firstRequiredStage(currentSettings);
          logProjectEvent(workflowId, "pipeline.waiting_for_approval", {
            stage: pendingStage,
            progress: STAGE_PROGRESS[pendingStage],
          });
          rpc.send("onPipelineUpdate", {
            status: {
              stage: "waiting_approval",
              progress: STAGE_PROGRESS[pendingStage],
              pendingStage,
            },
          });
          rpc.send("onToast", {
            toast: {
              id: `approval-${workflowId}`,
              type: "info",
              message: `Approval mode: review storyboard and approve ${pendingStage.replace("_", " ")} stage.`,
              duration: 6000,
            },
          });
          return;
        }

        void continueWorkflowPipeline(workflowId).catch((err) => {
          console.error("Pipeline failed:", err);
        });
      } catch (err) {
        const entry = ensureWorkflowEntry(workflowId);
        entry.screenplayPending = false;
        entry.running = false;
        logProjectEvent(workflowId, "screenplay.error", {
          error: String(err),
        });
        rpc.send("onPipelineUpdate", {
          status: { stage: "idle", progress: 0, error: String(err) },
        });
      }
    })();

    return { workflowId };
  },

  getStoryboard: async ({ workflowId }: { workflowId: string }) => {
    const entry = workflowStore.get(workflowId);
    if (entry?.storyboard) return entry.storyboard;
    throw new Error("Storyboard not found for workflow " + workflowId);
  },

  pollStatus: async ({ workflowId }: { workflowId: string }) => {
    const entry = workflowStore.get(workflowId);
    if (entry?.screenplayPending) {
      return { stage: "generating_screenplay", progress: 8 };
    }
    if (entry?.industryMode && entry.industryMode !== "filmmaking") {
      return { stage: "idle", progress: 0 };
    }
    if (entry?.pendingApprovalStage) {
      return {
        stage: "waiting_approval",
        progress: STAGE_PROGRESS[entry.pendingApprovalStage],
        pendingStage: entry.pendingApprovalStage,
      };
    }
    if (!mcp.isConnected()) throw new Error("MCP not connected");
    return mcp.getWorkflowStatus(workflowId);
  },

  getVideo: async ({ workflowId }: { workflowId: string }) => {
    const entry = workflowStore.get(workflowId);
    if (entry?.videoUrl) return { videoUrl: entry.videoUrl };
    throw new Error("Video not ready for workflow " + workflowId);
  },

  approvePipelineStage: async ({
    workflowId,
    stage,
    reason,
  }: {
    workflowId: string;
    stage?: ApprovalStage;
    reason?: string;
  }) => {
    const entry = workflowStore.get(workflowId);
    if (!entry) throw new Error("Workflow not found: " + workflowId);
    if (entry.running || entry.videoUrl) return { started: false };
    if (!entry.settings) {
      throw new Error("Workflow context missing; cannot continue pipeline");
    }

    const pendingStage = entry.pendingApprovalStage;
    if (!pendingStage) return { started: false };
    if (stage && stage !== pendingStage) {
      throw new Error(
        `Stage mismatch. Pending approval is '${pendingStage}', got '${stage}'.`,
      );
    }

    recordApprovalDecision(entry, workflowId, pendingStage, true, reason);
    entry.pendingApprovalStage = undefined;
    logProjectEvent(workflowId, "approval.recorded", {
      stage: pendingStage,
      reason,
    });

    void continueWorkflowPipeline(workflowId, pendingStage).catch((err) => {
      console.error("Pipeline failed after approval:", err);
    });

    return { started: true };
  },

  getApprovalState: async ({ workflowId }: { workflowId: string }) => {
    const entry = workflowStore.get(workflowId);
    if (!entry) {
      return { workflowId, pendingStage: undefined, history: [] };
    }
    return {
      workflowId,
      pendingStage: entry.pendingApprovalStage,
      history: entry.approvalHistory,
    };
  },

  getProjectLog: async ({
    workflowId,
    limit = 80,
  }: {
    workflowId: string;
    limit?: number;
  }) => {
    const { logPath, events } = readProjectLog(workflowId, limit);
    return {
      workflowId,
      logPath,
      events,
    };
  },

  authoringBrainstorm: async ({
    workflowId,
    industryMode = "filmmaking",
    seed,
    canonBeats,
    focusBeat,
    branchCount = 3,
    productionLayer,
  }: {
    workflowId?: string;
    industryMode?: IndustryMode;
    seed: string;
    canonBeats: AuthoringBeat[];
    focusBeat: AuthoringBeat;
    branchCount?: number;
    productionLayer?: ProductionLayer;
  }): Promise<AuthoringBrainstormResult> => {
    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok) throw new Error("Failed to connect to stoira-mcp server");
    }

    const mode = parseIndustryMode(industryMode);
    logProjectEvent(workflowId, "creative_room.requested", {
      industryMode: mode,
      productionLayer,
      branchCount,
      focusTitle: focusBeat.title,
    });

    try {
      const creativeRoom = await mcp.generateCreativeRoom({
        workflowId,
        industryMode: mode,
        seed,
        canonBeats,
        focusBeat,
        branchCount,
        model: currentSettings.brainstormModel,
      });

      if (creativeRoom.workflowId) {
        const entry = ensureWorkflowEntry(creativeRoom.workflowId);
        entry.industryMode = mode;
        entry.productionLayer = productionLayer;
        entry.idea = entry.idea ?? seed;
        entry.settings = entry.settings ?? { ...currentSettings };
        entry.creativeRoom = creativeRoom;
      }

      logProjectEvent(
        creativeRoom.workflowId ?? workflowId,
        "creative_room.ready",
        {
          industryMode: mode,
          productionLayer,
          branchCount: creativeRoom.options.length,
          title: creativeRoom.title,
        },
      );

      return creativeRoom;
    } catch {
      // Fallback to deterministic local synthesis if creative-room tool fails.
      const context = await mcp.narrativeContextBuilder(canonBeats, focusBeat);
      const motifRes = await mcp.motifTracker([
        ...canonBeats.map((b) => ({ title: b.title, body: b.body })),
        { title: focusBeat.title, body: focusBeat.body },
      ]);

      const motifs = (motifRes?.motifs ?? motifRes?.motifs_top ?? [])
        .map((m: any) => m?.token)
        .filter(Boolean)
        .slice(0, 5);
      const register = context?.signals?.register_hint ?? "balanced";

      const templates = [
        `Escalate: ${focusBeat.title}`,
        `Reveal hidden motive around ${focusBeat.title}`,
        motifs[0]
          ? `Return of motif '${motifs[0]}'`
          : `Fork toward a high-pressure consequence`,
        `Quiet character beat after ${focusBeat.title}`,
        `Hard pivot to a divergent route`,
      ];

      const options = templates
        .slice(0, Math.max(1, Math.min(branchCount, 5)))
        .map((label, idx) => ({
          label,
          summary:
            idx === 0
              ? `Raise stakes while preserving ${register} register continuity from canon.`
              : idx === 1
                ? `Expose intent and tighten causality with the prior canon chain.`
                : idx === 2
                  ? `Reinforce recurring motif pressure and push the branch into a decision point.`
                  : idx === 3
                    ? `Introduce contrast and emotional reset before the next conflict peak.`
                    : `Open a what-if lane that can canonize later without breaking continuity.`,
        }));

      return {
        workflowId,
        industryMode: mode,
        options,
        contextBrief: context?.brief,
        motifsTop: motifs,
      };
    }
  },

  generateWritersRoomPack: async ({
    seed,
    format,
    packageTier,
    workflowId,
    productionLayer = "writers-room",
  }: {
    seed: string;
    format: WritersRoomFormat;
    packageTier: WritersRoomPackageTier;
    workflowId?: string;
    productionLayer?: ProductionLayer;
  }): Promise<WritersRoomPack> => {
    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok) throw new Error("Failed to connect to stoira-mcp server");
    }

    logProjectEvent(workflowId, "writers_room.requested", {
      format,
      packageTier,
      productionLayer,
    });

    const pack = await mcp.generateWritersRoomPack({
      seed,
      format,
      packageTier,
      workflowId,
      model: currentSettings.writerModel,
    });

    if (pack.workflowId) {
      const entry = ensureWorkflowEntry(pack.workflowId);
      entry.idea = seed;
      entry.writersRoomPack = pack;
      entry.settings = entry.settings ?? { ...currentSettings };
      entry.industryMode = "filmmaking";
      entry.productionLayer = productionLayer;
    }

    logProjectEvent(pack.workflowId, "writers_room.ready", {
      format: pack.format,
      packageTier: pack.packageTier,
      productionLayer,
      deliverableCount: pack.deliverables.length,
    });

    return pack;
  },

  regenerateWritersRoomDeliverable: async ({
    workflowId,
    deliverableId,
    notes,
  }: {
    workflowId: string;
    deliverableId: string;
    notes?: string;
  }): Promise<WritersRoomPack> => {
    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok) throw new Error("Failed to connect to stoira-mcp server");
    }

    const pack = await mcp.regenerateWritersRoomDeliverable({
      workflowId,
      deliverableId,
      notes,
      model: currentSettings.writerModel,
    });

    if (pack.workflowId) {
      const entry = ensureWorkflowEntry(pack.workflowId);
      entry.writersRoomPack = pack;
      entry.idea = entry.idea ?? pack.seed;
      entry.settings = entry.settings ?? { ...currentSettings };
    }

    logProjectEvent(pack.workflowId, "writers_room.deliverable_regenerated", {
      deliverableId,
    });

    return pack;
  },

  updateWritersRoomDeliverable: async ({
    workflowId,
    deliverableId,
    body,
  }: {
    workflowId: string;
    deliverableId: string;
    body: string;
  }): Promise<WritersRoomPack> => {
    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok) throw new Error("Failed to connect to stoira-mcp server");
    }

    const pack = await mcp.updateWritersRoomDeliverable({
      workflowId,
      deliverableId,
      body,
    });

    if (pack.workflowId) {
      const entry = ensureWorkflowEntry(pack.workflowId);
      entry.writersRoomPack = pack;
      entry.idea = entry.idea ?? pack.seed;
      entry.settings = entry.settings ?? { ...currentSettings };
    }

    logProjectEvent(pack.workflowId, "writers_room.deliverable_updated", {
      deliverableId,
    });

    return pack;
  },

  recordWritersRoomRefinement: async ({
    workflowId,
    role,
    stageId,
    notes,
    approval = "pending",
    deliverableIds = [],
  }: WritersRoomRefinementInput): Promise<WritersRoomPack> => {
    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok) throw new Error("Failed to connect to stoira-mcp server");
    }

    logProjectEvent(workflowId, "writers_room.refinement_requested", {
      role,
      stageId,
      approval,
      deliverableIds,
    });

    const pack = await mcp.recordWritersRoomRefinement({
      workflowId,
      role,
      stageId,
      notes,
      approval,
      deliverableIds,
    });

    if (pack.workflowId) {
      const entry = ensureWorkflowEntry(pack.workflowId);
      entry.writersRoomPack = pack;
      entry.idea = entry.idea ?? pack.seed;
      entry.settings = entry.settings ?? { ...currentSettings };
      entry.industryMode = "filmmaking";
      entry.productionLayer =
        entry.productionLayer ??
        (pack.format === "franchise-ip" ? "ip-franchise" : "writers-room");
    }

    logProjectEvent(pack.workflowId, "writers_room.refinement_recorded", {
      role,
      stageId,
      approval,
      deliverableIds,
      revisionCount: pack.revisionHistory.length,
    });

    return pack;
  },

  authoringWriterAssist: async ({
    workflowId,
    seed,
    canonTitles,
    parentTitle,
    childTitle,
    intent,
    mode,
  }: {
    workflowId?: string;
    seed: string;
    canonTitles: string[];
    parentTitle: string;
    childTitle: string;
    intent: string;
    mode: "canon" | "what-if";
  }): Promise<AuthoringWriterAssistResult> => {
    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok) throw new Error("Failed to connect to stoira-mcp server");
    }

    return mcp.authoringWriterAssist({
      workflowId,
      seed,
      canonTitles,
      parentTitle,
      childTitle,
      intent,
      mode,
      model: currentSettings.writerModel,
    });
  },

  reharmonizeStory: async ({
    insertedBeat,
    downstreamBeats,
  }: {
    insertedBeat: AuthoringBeat;
    downstreamBeats: Array<{ nodeId: string; title: string; body: string }>;
  }): Promise<ReharmonizeStoryResult> => {
    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok) throw new Error("Failed to connect to stoira-mcp server");
    }

    return mcp.reharmonizeStory({
      insertedBeat,
      downstreamBeats,
      model: currentSettings.directorModel,
    });
  },

  detectStoryPolicy: async ({
    seed,
  }: {
    seed: string;
  }): Promise<StoryPolicyResult> => {
    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok) throw new Error("Failed to connect to stoira-mcp server");
    }

    return mcp.detectStoryPolicy(seed);
  },

  generateCharacterSheet: async ({
    seed,
    franchise,
    allowIpNames = false,
  }: {
    seed: string;
    franchise?: string | null;
    allowIpNames?: boolean;
  }): Promise<{ entries: CharacterSheetEntry[] }> => {
    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok) throw new Error("Failed to connect to stoira-mcp server");
    }

    const entries = await mcp.generateCharacterSheet({
      seed,
      franchise,
      allowIpNames,
      model: currentSettings.writerModel,
    });
    return { entries };
  },

  generateImage: async ({
    prompt,
    imageModel,
    referenceUrls,
  }: {
    prompt: string;
    imageModel?: string;
    referenceUrls?: string[];
  }): Promise<{ imageUrl: string }> => {
    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok) throw new Error("Failed to connect to stoira-mcp server");
    }
    return mcp.generateImage({
      prompt,
      imageModel: imageModel ?? resolveImageModel(currentSettings),
      referenceUrls,
    });
  },

  listWorkflows: async () => {
    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok) return { workflows: [] };
    }
    const workflows = await mcp.listWorkflows();
    return { workflows };
  },

  deleteWorkflow: async ({ workflowId }: { workflowId: string }) => {
    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok) return { success: false };
    }

    const ok = await mcp.deleteWorkflow(workflowId);
    if (ok) {
      workflowStore.delete(workflowId);
    }
    return { success: ok };
  },

  resumeWorkflow: async ({ workflowId }: { workflowId: string }) => {
    logProjectEvent(workflowId, "workflow.resume_requested");
    const entry = workflowStore.get(workflowId);
    let storyboard = entry?.storyboard ?? null;
    let videoUrl = entry?.videoUrl ?? null;
    let creativeRoom = entry?.creativeRoom;
    let writersRoomPack = entry?.writersRoomPack;
    let industryMode = entry?.industryMode;

    if (!mcp.isConnected()) {
      const ok = await mcp.connect();
      if (!ok && !entry) {
        return { workflowId };
      }
    }

    // Push stored storyboard to renderer immediately if available
    if (storyboard) {
      rpc.send("onStoryboardReady", { storyboard });
    }

    // Push stored video if available
    if (videoUrl) {
      rpc.send("onVideoReady", { videoUrl });
    }

    // If no local storyboard, try fetching persisted artifacts from MCP first.
    if (!storyboard && mcp.isConnected()) {
      try {
        const artifacts = await mcp.getWorkflowArtifacts(workflowId);
        if (artifacts.creativeRoom) {
          creativeRoom = artifacts.creativeRoom;
          const cached = ensureWorkflowEntry(workflowId);
          cached.creativeRoom = creativeRoom;
          cached.idea = cached.idea ?? creativeRoom.seed;
          cached.industryMode = creativeRoom.industryMode ?? "filmmaking";
          cached.settings = cached.settings ?? { ...currentSettings };
          cached.productionLayer =
            cached.productionLayer ?? "storyboard-previs";
          industryMode = cached.industryMode;
        }
        if (artifacts.writersRoomPack) {
          writersRoomPack = artifacts.writersRoomPack;
          const cached = ensureWorkflowEntry(workflowId);
          cached.writersRoomPack = writersRoomPack;
          cached.idea = cached.idea ?? writersRoomPack.seed;
          cached.industryMode = "filmmaking";
          cached.settings = cached.settings ?? { ...currentSettings };
          cached.productionLayer =
            cached.productionLayer ??
            (writersRoomPack.format === "franchise-ip"
              ? "ip-franchise"
              : "writers-room");
          industryMode = cached.industryMode;
        }
      } catch {
        // Artifact lookup failed — continue with workflow metadata fallback.
      }

      if (!storyboard && !creativeRoom && !writersRoomPack) {
        try {
          const workflows = await mcp.listWorkflows();
          const wf = workflows.find((item) => item.workflowId === workflowId);
          if (wf) {
            industryMode = wf.industryMode ?? industryMode ?? "filmmaking";

            if (industryMode === "filmmaking" && !wf.writersRoomFormat) {
              storyboard = {
                id: workflowId,
                title: wf.title,
                idea: wf.idea,
                style: wf.style,
                scenes: [],
                totalDuration: 0,
                createdAt: wf.createdAt,
              };
              const cached = ensureWorkflowEntry(workflowId);
              cached.storyboard = storyboard;
              cached.industryMode = industryMode;
              cached.idea = cached.idea ?? wf.idea;
              cached.style = cached.style ?? wf.style;
              cached.settings = cached.settings ?? { ...currentSettings };
              rpc.send("onStoryboardReady", { storyboard });
            }
          }
        } catch {
          // MCP lookup failed — renderer will just have the workflowId.
        }
      }

      // Check current MCP pipeline status and push immediately for film workflows.
      try {
        const status = await mcp.getWorkflowStatus(workflowId);
        rpc.send("onPipelineUpdate", { status });
      } catch {
        if (
          !creativeRoom &&
          !writersRoomPack &&
          industryMode === "filmmaking"
        ) {
          rpc.send("onPipelineUpdate", {
            status: { stage: "generating_screenplay", progress: 10 },
          });
        }
      }
    }

    const resolvedEntry = workflowStore.get(workflowId);

    if (resolvedEntry?.pendingApprovalStage && !videoUrl && storyboard) {
      rpc.send("onPipelineUpdate", {
        status: {
          stage: "waiting_approval",
          progress: STAGE_PROGRESS[resolvedEntry.pendingApprovalStage],
          pendingStage: resolvedEntry.pendingApprovalStage,
        },
      });
    }

    logProjectEvent(workflowId, "workflow.resume_completed", {
      hasStoryboard: !!storyboard,
      hasCreativeRoom: !!creativeRoom,
      hasWritersRoomPack: !!writersRoomPack,
      hasVideo: !!videoUrl,
      logPath: projectLogPath(workflowId),
    });

    return {
      workflowId,
      storyboard: storyboard ?? undefined,
      videoUrl: videoUrl ?? undefined,
      ...(creativeRoom ? { creativeRoom } : {}),
      ...(writersRoomPack ? { writersRoomPack } : {}),
      ...(industryMode ? { industryMode } : {}),
      ...(resolvedEntry?.productionLayer
        ? { productionLayer: resolvedEntry.productionLayer }
        : {}),
    };
  },

  updateScene: async ({
    workflowId,
    sceneId,
    updates,
  }: {
    workflowId: string;
    sceneId: string;
    updates: Partial<Scene>;
  }) => {
    const entry = workflowStore.get(workflowId);
    if (entry?.storyboard) {
      entry.storyboard.scenes = entry.storyboard.scenes.map((s) =>
        s.id === sceneId ? { ...s, ...updates } : s,
      );
    }

    if (mcp.isConnected()) {
      await mcp.updateScene(workflowId, sceneId, updates);
    }

    return { success: true };
  },

  bulkUpdateScenes: async ({
    sceneIds,
    updates,
  }: {
    sceneIds: string[];
    updates: Partial<Scene>;
  }) => {
    // Find current workflow from store
    const activeWorkflowId = Array.from(workflowStore.keys()).pop();
    if (!activeWorkflowId) throw new Error("No active workflow");

    // Update local storyboard
    const entry = workflowStore.get(activeWorkflowId);
    if (entry?.storyboard) {
      entry.storyboard.scenes = entry.storyboard.scenes.map((s) =>
        sceneIds.includes(s.id) ? { ...s, ...updates } : s,
      );
    }

    // Persist to MCP server
    if (mcp.isConnected()) {
      const result = await mcp.bulkUpdateScenes(
        sceneIds,
        updates,
        activeWorkflowId,
      );
      return result;
    }

    return { success: true, updatedCount: sceneIds.length };
  },

  createSnapshot: async ({ name }: { name?: string }) => {
    const activeWorkflowId = Array.from(workflowStore.keys()).pop();
    if (!activeWorkflowId) throw new Error("No active workflow");
    if (!mcp.isConnected()) throw new Error("MCP not connected");
    return mcp.createSnapshot(activeWorkflowId, name);
  },

  listSnapshots: async () => {
    const activeWorkflowId = Array.from(workflowStore.keys()).pop();
    if (!activeWorkflowId) throw new Error("No active workflow");
    if (!mcp.isConnected()) throw new Error("MCP not connected");
    return mcp.listSnapshots(activeWorkflowId);
  },

  getSettings: async () => {
    return currentSettings;
  },

  getMcpStatus: async () => {
    return { connected: mcp.isConnected() };
  },

  saveSettings: async ({ settings }: { settings: AppSettings }) => {
    currentSettings = settings;
    persistSettings(currentSettings);
    mcp.setServerUrl(currentSettings.mcpServerUrl);
    return { success: true };
  },

  // --- ComfyUI ---
  comfyConnect: async ({ url }: { url: string }) => {
    const ok = await comfy.connect(url);
    const conn = comfy.getConnection();
    rpc.send("onComfyUIUpdate", { connection: conn });
    return { success: ok, models: conn.models };
  },

  comfyDisconnect: async () => {
    comfy.disconnect();
    const conn = comfy.getConnection();
    rpc.send("onComfyUIUpdate", { connection: conn });
    return { success: true };
  },

  comfyGetStatus: async () => {
    return comfy.getConnection();
  },

  comfyScanModels: async () => {
    const models = await comfy.scanModels();
    return { models };
  },

  comfyImportWorkflow: async ({ json }: { json: string }) => {
    const workflow = await comfy.importWorkflow(json);
    return { workflow };
  },

  comfyExportWorkflow: async ({ workflowId }: { workflowId: string }) => {
    const json = comfy.exportWorkflow(workflowId);
    if (!json) throw new Error("Workflow not found");
    return { json };
  },

  comfySubmitPrompt: async ({
    workflowId,
    inputs,
  }: {
    workflowId: string;
    inputs: Record<string, unknown>;
  }) => {
    const workflows = comfy.getWorkflows();
    const wf = workflows.find((w) => w.id === workflowId);
    if (!wf) throw new Error("Workflow not found");
    const promptId = await comfy.submitPrompt(wf, inputs);
    return { promptId };
  },

  comfyPollStatus: async ({ promptId }: { promptId: string }) => {
    return comfy.pollStatus(promptId);
  },

  comfyListQueue: async () => {
    const queue = await comfy.getQueue();
    return { queue };
  },

  // --- Local Models ---
  scanLocalModels: async ({ dir }: { dir?: string }) => {
    const modelsDir = dir ?? `${process.env.HOME}/.stoira/models`;
    const models: LocalModel[] = [];

    try {
      const { readdirSync, statSync, existsSync } = await import("fs");
      const { join, extname, basename } = await import("path");

      if (!existsSync(modelsDir)) {
        return { models: [] };
      }

      const files = readdirSync(modelsDir);
      for (const file of files) {
        const filePath = join(modelsDir, file);
        const stat = statSync(filePath);
        if (!stat.isFile()) continue;

        const ext = extname(file).toLowerCase().slice(1);
        const formats = ["gguf", "onnx", "safetensors", "ckpt", "pt"];
        if (!formats.includes(ext)) continue;

        const sizeBytes = stat.size;
        // Rough VRAM estimate: model size * 1.2 for overhead
        const vramEstimateMb = Math.round((sizeBytes * 1.2) / (1024 * 1024));

        // Extract tags from filename
        const name = basename(file, extname(file));
        const tags: string[] = [];
        if (
          name.toLowerCase().includes("sdxl") ||
          name.toLowerCase().includes("xl")
        )
          tags.push("sdxl");
        if (
          name.toLowerCase().includes("sd15") ||
          name.toLowerCase().includes("1.5")
        )
          tags.push("sd1.5");
        if (name.toLowerCase().includes("flux")) tags.push("flux");
        if (name.toLowerCase().includes("lora")) tags.push("lora");
        if (
          name.toLowerCase().includes("controlnet") ||
          name.toLowerCase().includes("cn")
        )
          tags.push("controlnet");

        models.push({
          id: `local-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          name: file,
          format: ext as any,
          path: filePath,
          sizeBytes,
          vramEstimateMb,
          tags,
        });
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return { models };
  },

  getRecommendedModels: async () => {
    const models: RecommendedModel[] = [
      {
        id: "sdxl-base",
        name: "Stable Diffusion XL Base",
        description: "High-quality general-purpose image generation model",
        format: "safetensors",
        downloadUrl:
          "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors",
        sizeBytes: 6_940_000_000,
        vramEstimateMb: 8_300,
        tags: ["sdxl", "general"],
        category: "image",
      },
      {
        id: "sd15-pruned",
        name: "Stable Diffusion 1.5 Pruned",
        description: "Lightweight SD model, good for low VRAM setups",
        format: "safetensors",
        downloadUrl:
          "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors",
        sizeBytes: 2_130_000_000,
        vramEstimateMb: 4_000,
        tags: ["sd1.5", "lightweight"],
        category: "image",
      },
      {
        id: "flux-dev",
        name: "FLUX.1 Dev",
        description: "Black Forest Labs' state-of-the-art text-to-image model",
        format: "safetensors",
        downloadUrl:
          "https://huggingface.co/black-forest-labs/FLUX.1-dev/resolve/main/flux1-dev.safetensors",
        sizeBytes: 23_800_000_000,
        vramEstimateMb: 24_000,
        tags: ["flux", "state-of-the-art"],
        category: "image",
      },
      {
        id: "anything-v5",
        name: "Anything V5",
        description: "High-quality anime-style generation model",
        format: "safetensors",
        downloadUrl:
          "https://huggingface.co/stablediffusionapi/anything-v5/resolve/main/anything-v5.safetensors",
        sizeBytes: 2_130_000_000,
        vramEstimateMb: 4_000,
        tags: ["anime", "sd1.5"],
        category: "image",
      },
      {
        id: "wan-21-i2v",
        name: "WAN 2.1 Image-to-Video",
        description:
          "High-quality image-to-video generation for local inference",
        format: "gguf",
        downloadUrl:
          "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/wan2.1_i2v_480p_14B.gguf",
        sizeBytes: 8_500_000_000,
        vramEstimateMb: 10_000,
        tags: ["video", "i2v"],
        category: "video",
      },
    ];
    return { models };
  },

  downloadModel: async ({ modelId, url }: { modelId: string; url: string }) => {
    // In a real implementation, this would stream the download to ~/.stoira/models/
    console.log(`Download requested: ${modelId} from ${url}`);
    return { success: true };
  },

  getVramInfo: async () => {
    // Try to get real VRAM info via nvidia-smi
    try {
      const proc = Bun.spawn(
        [
          "nvidia-smi",
          "--query-gpu=memory.total,memory.used,memory.free",
          "--format=csv,noheader,nounits",
        ],
        {
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      const output = await new Response(proc.stdout).text();
      const [total, used, free] = output
        .trim()
        .split(",")
        .map((s) => parseInt(s.trim(), 10));
      if (!isNaN(total) && !isNaN(used) && !isNaN(free)) {
        return { totalMb: total, usedMb: used, freeMb: free };
      }
    } catch {}

    // Fallback: estimate based on system info
    return { totalMb: 8192, usedMb: 2048, freeMb: 6144 };
  },

  benchmarkModel: async ({ modelId }: { modelId: string }) => {
    // Simulated benchmark
    const baseLatency = 150;
    const jitter = Math.random() * 100;
    return { latencyMs: Math.round(baseLatency + jitter) };
  },

  // --- Batch Mode ---
  submitBatch: async ({
    jobs,
    concurrency,
  }: {
    jobs: { idea: string; style: FilmStyle }[];
    concurrency: number;
  }) => {
    const batchId = `batch-${++batchCounter}`;
    const batchJobs: BatchJob[] = jobs.map(
      (j: { idea: string; style: FilmStyle }, i: number) => ({
        id: `${batchId}-job-${i}`,
        idea: j.idea,
        style: j.style,
        status: "pending" as const,
        progress: 0,
        createdAt: new Date().toISOString(),
      }),
    );

    const batchState: BatchState = {
      jobs: batchJobs,
      isRunning: true,
      currentIndex: 0,
      concurrency,
    };
    batchStore.set(batchId, batchState);

    // Process jobs sequentially (simplified; real impl would use concurrency)
    const processBatch = async () => {
      for (let i = 0; i < batchJobs.length; i++) {
        const job = batchJobs[i];
        job.status = "running";
        rpc.send("onBatchProgress", {
          jobId: job.id,
          status: "running",
          progress: 0,
        });

        try {
          // Submit idea via MCP
          const { workflowId } = await mcp.generateScreenplay(
            job.idea,
            job.style,
            currentSettings,
          );
          job.workflowId = workflowId;
          job.progress = 30;
          rpc.send("onBatchProgress", {
            jobId: job.id,
            status: "running",
            progress: 30,
          });

          // Run pipeline
          const result = await mcp.runFullPipeline(
            job.idea,
            job.style,
            currentSettings,
            workflowId,
          );

          const videos = result.scene_videos ?? [];
          const mergedUrl = result.merged_video_url;
          job.videoUrl =
            mergedUrl ?? videos.find((v: any) => v.video_url)?.video_url;
          job.status = "complete";
          job.progress = 100;
          rpc.send("onBatchProgress", {
            jobId: job.id,
            status: "complete",
            progress: 100,
          });
        } catch (err: any) {
          job.status = "failed";
          job.error = err.message ?? "Unknown error";
          rpc.send("onBatchProgress", {
            jobId: job.id,
            status: "failed",
            progress: 0,
          });
        }

        batchState.currentIndex = i + 1;
      }

      batchState.isRunning = false;
    };

    processBatch();
    return { batchId };
  },

  getBatchStatus: async ({ batchId }: { batchId: string }) => {
    const batch = batchStore.get(batchId);
    if (!batch) throw new Error("Batch not found");
    return batch;
  },

  cancelBatch: async ({ batchId }: { batchId: string }) => {
    const batch = batchStore.get(batchId);
    if (batch) {
      batch.isRunning = false;
      for (const job of batch.jobs) {
        if (job.status === "pending" || job.status === "running") {
          job.status = "failed";
          job.error = "Cancelled";
        }
      }
    }
    return { success: true };
  },

  exportBatchResults: async ({
    batchId,
    format,
  }: {
    batchId: string;
    format: "zip" | "individual";
  }) => {
    const batch = batchStore.get(batchId);
    if (!batch) throw new Error("Batch not found");

    const outputDir = `${process.env.HOME}/.stoira/exports/${batchId}`;
    try {
      const { mkdirSync, writeFileSync } = await import("fs");
      mkdirSync(outputDir, { recursive: true });

      // Write summary JSON
      writeFileSync(
        `${outputDir}/summary.json`,
        JSON.stringify(batch.jobs, null, 2),
      );
    } catch {}

    return { path: outputDir };
  },
});

// Create window — pass the pre-wired RPC so BrowserView connects the transport
const win = new BrowserWindow({
  title: "OpenCorn — AI Film Studio",
  url: "views://main/index.html",
  rpc,
});

// Forward ComfyUI connection updates to renderer
comfy.onConnectionChange((connection) => {
  try {
    rpc.send("onComfyUIUpdate", { connection });
  } catch {}
});

// Connect MCP on startup
mcp.connect().then((ok) => {
  console.log(`MCP ${ok ? "connected" : "disconnected — will retry on use"}`);
  if (ok) {
    mcp.listTools().then((tools) => {
      console.log("Available MCP tools:", tools.join(", "));
    });
  }
});

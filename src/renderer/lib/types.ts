/*  ──────────────────────────────────────────────────────────────────────
 *  Branching canvas types
 *  Ported for OpenCorn (Electrobun + React 19, inline CSS)
 *  ────────────────────────────────────────────────────────────────────── */

export type NodeStatus =
  | "current"
  | "canon"
  | "visited"
  | "unvisited"
  | "generating";

export type NodeMood =
  | "neutral"
  | "hopeful"
  | "tense"
  | "danger"
  | "climax"
  | "quiet"
  | "discovery";

export type NodeTone = "canon" | "divergent" | "what-if";
export type NodeKind = "beat" | "writers-room-stage";
export type NodeVariant = "checkpoint" | "compact" | "stage";
export type StaleState = "fresh" | "stale" | "rewritten" | "unresolved";
export type Decider = "human" | "agent";

export type AgentId =
  | "brainstorm"
  | "character"
  | "critic"
  | "writer"
  | "judge"
  | "director"
  | "writer-assist"
  | "registry-lookup"
  | "character-sheet"
  | "copyright-detector";

export type IndustryMode = import("../../shared/types").IndustryMode;

export interface StoryNode {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  depth: number;
  title: string;
  summary: string;
  body?: string;
  imagePrompt: string;
  imageUrl: string;
  mood: NodeMood;
  tone: NodeTone;
  kind?: NodeKind;
  label?: string;
  question?: string;
  rawBrainstorm?: string;
  renderedImagePrompt?: string;
  customPrompt?: string;
  cameraAngle?: import("../../shared/types").CameraAngle;
  lightingMood?: import("../../shared/types").LightingMood;
  characterRefUrl?: string;
  status: NodeStatus;
  decidedBy: Decider;
  decidedByAgent?: string;
  inserted?: boolean;
  staleState: StaleState;
  originalBody?: string;
  originalTitle?: string;
  originalSummary?: string;
  originalImagePrompt?: string;
  originalImageUrl?: string;
  insertCauseId?: string;
  x: number;
  y: number;
}

export interface AgentEvent {
  id: string;
  agent: AgentId;
  model: string;
  label: string;
  text: string;
  status: "thinking" | "streaming" | "done" | "error";
  startedAt: number;
}

export interface BranchSuggestion {
  title: string;
  summary: string;
  body: string;
  imagePrompt: string;
  mood: NodeMood;
  tone: NodeTone;
  kind?: NodeKind;
  label?: string;
}

export interface RenderJob {
  id: string;
  status: "pending" | "running" | "done" | "error";
  stage?: string;
  url?: string;
  error?: string;
  startedAt: number;
}

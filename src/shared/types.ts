export type FilmStyle =
  | "anime"
  | "noir"
  | "cyberpunk"
  | "watercolor"
  | "realistic"
  | "stop-motion";

export type PipelineStage =
  | "idle"
  | "generating_screenplay"
  | "generating_keyframes"
  | "generating_video"
  | "processing_audio"
  | "stitching"
  | "complete";

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

// RPC contract: Bun-side handlers (callable from renderer)
export interface BunRPC {
  requests: {
    submitIdea: (args: { idea: string; style: FilmStyle }) => {
      workflowId: string;
    };
    getStoryboard: (args: { workflowId: string }) => Storyboard;
    pollStatus: (args: { workflowId: string }) => PipelineStatus;
    getVideo: (args: { workflowId: string }) => { videoUrl: string };
  };
  messages: {};
}

// RPC contract: Webview-side handlers (callable from Bun)
export interface WebviewRPC {
  requests: {};
  messages: {
    onPipelineUpdate: (args: { status: PipelineStatus }) => void;
    onStoryboardReady: (args: { storyboard: Storyboard }) => void;
    onVideoReady: (args: { videoUrl: string }) => void;
  };
}

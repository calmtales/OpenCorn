import { useState, useCallback, useRef, useEffect } from "react";
import type {
  FilmStyle,
  PipelineStage,
  PipelineStatus,
  Storyboard,
  AppSettings,
  Toast,
} from "../../shared/types";
import { DEFAULT_SETTINGS } from "../../shared/types";

interface PipelineState {
  stage: PipelineStage;
  progress: number;
  workflowId: string | null;
  storyboard: Storyboard | null;
  videoUrl: string | null;
  error: string | null;
  settings: AppSettings;
}

const INITIAL: PipelineState = {
  stage: "idle",
  progress: 0,
  workflowId: null,
  storyboard: null,
  videoUrl: null,
  error: null,
  settings: { ...DEFAULT_SETTINGS },
};

function getBunRpc() {
  return (window as any).__electrobun_rpc;
}

export function useFilmPipeline() {
  const [state, setState] = useState<PipelineState>(INITIAL);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Load saved settings
  useEffect(() => {
    const rpc = getBunRpc();
    rpc?.request
      ?.getSettings?.()
      .then((settings: AppSettings) => {
        if (settings) setState((prev) => ({ ...prev, settings }));
      })
      .catch(() => {});
  }, []);

  // Listen for push events from Bun side
  useEffect(() => {
    const onPipeline = (e: CustomEvent) => {
      const status = e.detail as PipelineStatus;
      setState((prev) => ({
        ...prev,
        stage: status.stage,
        progress: status.progress,
        error: status.error ?? null,
      }));

      // Fire toasts for stage transitions
      const stageMessages: Record<string, string> = {
        generating_screenplay: "Writing your screenplay...",
        generating_keyframes: "Rendering scene keyframes...",
        generating_video: "Generating video clips...",
        stitching: "Stitching final render...",
        complete: "Film complete!",
      };
      const msg = stageMessages[status.stage];
      if (msg) {
        window.dispatchEvent(
          new CustomEvent("toast", {
            detail: {
              id: "",
              type: status.stage === "complete" ? "success" : "info",
              message: msg,
            } as Toast,
          })
        );
      }

      if (status.error) {
        window.dispatchEvent(
          new CustomEvent("toast", {
            detail: {
              id: "",
              type: "error",
              message: status.error,
              duration: 6000,
            } as Toast,
          })
        );
      }
    };

    const onStoryboard = (e: CustomEvent) => {
      setState((prev) => ({
        ...prev,
        storyboard: e.detail as Storyboard,
        stage: "generating_keyframes",
        progress: 30,
      }));
      window.dispatchEvent(
        new CustomEvent("toast", {
          detail: { id: "", type: "success", message: "Storyboard ready!" } as Toast,
        })
      );
    };

    const onVideo = (e: CustomEvent) => {
      setState((prev) => ({
        ...prev,
        videoUrl: e.detail as string,
        stage: "complete",
        progress: 100,
      }));
      if (pollRef.current) clearInterval(pollRef.current);
    };

    window.addEventListener("pipeline-update", onPipeline as EventListener);
    window.addEventListener("storyboard-ready", onStoryboard as EventListener);
    window.addEventListener("video-ready", onVideo as EventListener);

    return () => {
      window.removeEventListener(
        "pipeline-update",
        onPipeline as EventListener
      );
      window.removeEventListener(
        "storyboard-ready",
        onStoryboard as EventListener
      );
      window.removeEventListener("video-ready", onVideo as EventListener);
    };
  }, []);

  const startPolling = useCallback((workflowId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const rpc = getBunRpc();
        const status: PipelineStatus = await rpc.request.pollStatus({
          workflowId,
        });

        setState((prev) => ({
          ...prev,
          stage: status.stage,
          progress: status.progress,
          error: status.error ?? null,
        }));

        if (status.stage === "complete" || status.error) {
          if (pollRef.current) clearInterval(pollRef.current);
        }

        // Fetch storyboard once screenplay is done
        if (
          status.stage === "generating_keyframes" ||
          status.stage === "generating_video"
        ) {
          try {
            const sb = await rpc.request.getStoryboard({ workflowId });
            setState((prev) => ({ ...prev, storyboard: sb }));
          } catch {
            // storyboard not ready yet
          }
        }

        // Fetch video once complete
        if (status.stage === "complete") {
          try {
            const { videoUrl } = await rpc.request.getVideo({ workflowId });
            setState((prev) => ({ ...prev, videoUrl }));
          } catch {
            // video not ready
          }
        }
      } catch {
        // RPC failed — don't crash, just retry next tick
      }
    }, 2000);
  }, []);

  const submitIdea = useCallback(
    async (idea: string, style: FilmStyle) => {
      setState((prev) => ({
        ...prev,
        ...INITIAL,
        settings: prev.settings,
        stage: "generating_screenplay",
        progress: 5,
      }));

      window.dispatchEvent(
        new CustomEvent("toast", {
          detail: { id: "", type: "info", message: "Starting film generation..." } as Toast,
        })
      );

      const rpc = getBunRpc();
      const { workflowId } = await rpc.request.submitIdea({
        idea,
        style,
        settings: state.settings,
      });

      setState((prev) => ({ ...prev, workflowId }));
      startPolling(workflowId);

      return { workflowId };
    },
    [startPolling, state.settings]
  );

  const resumeWorkflow = useCallback(
    async (workflowId: string) => {
      const rpc = getBunRpc();

      // Fetch existing storyboard
      try {
        const sb = await rpc.request.getStoryboard({ workflowId });
        setState((prev) => ({
          ...prev,
          storyboard: sb,
          workflowId,
          stage: "generating_keyframes",
          progress: 30,
        }));
      } catch {
        setState((prev) => ({ ...prev, workflowId }));
      }

      // Try to get video
      try {
        const { videoUrl } = await rpc.request.getVideo({ workflowId });
        setState((prev) => ({
          ...prev,
          videoUrl,
          stage: "complete",
          progress: 100,
        }));
      } catch {
        // Not ready, start polling
        startPolling(workflowId);
      }

      window.dispatchEvent(
        new CustomEvent("toast", {
          detail: { id: "", type: "info", message: `Resumed workflow ${workflowId.slice(0, 8)}` } as Toast,
        })
      );
    },
    [startPolling]
  );

  const updateScene = useCallback(
    (sceneId: string, updates: Partial<any>) => {
      setState((prev) => {
        if (!prev.storyboard) return prev;
        const scenes = prev.storyboard.scenes.map((s) =>
          s.id === sceneId ? { ...s, ...updates } : s
        );
        return {
          ...prev,
          storyboard: { ...prev.storyboard, scenes },
        };
      });

      // Persist to backend
      if (state.workflowId) {
        const rpc = getBunRpc();
        rpc?.request
          ?.updateScene?.({ workflowId: state.workflowId, sceneId, updates })
          .catch(() => {});
      }
    },
    [state.workflowId]
  );

  const updateSettings = useCallback((settings: AppSettings) => {
    setState((prev) => ({ ...prev, settings }));
  }, []);

  const reset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setState((prev) => ({ ...INITIAL, settings: prev.settings }));
  }, []);

  return {
    stage: state.stage,
    progress: state.progress,
    workflowId: state.workflowId,
    storyboard: state.storyboard,
    videoUrl: state.videoUrl,
    error: state.error,
    settings: state.settings,
    submitIdea,
    resumeWorkflow,
    updateScene,
    updateSettings,
    reset,
  };
}

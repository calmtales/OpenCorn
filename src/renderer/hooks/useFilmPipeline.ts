import { useState, useCallback, useRef, useEffect } from "react";
import type {
  FilmStyle,
  IndustryMode,
  PipelineStage,
  PipelineStatus,
  ProductionLayer,
  Storyboard,
  AppSettings,
  Toast,
  WorkflowResumePayload,
} from "../../shared/types";
import { DEFAULT_SETTINGS } from "../../shared/types";

interface PipelineState {
  stage: PipelineStage;
  progress: number;
  pendingStage?: PipelineStatus["pendingStage"];
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
  const lastStageRef = useRef<PipelineStage>("idle");

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

  // NOTE: No local simulated progress estimator.
  // All progress comes from real MCP pipeline events (onPipelineUpdate).
  // The bun-side poller pushes checkpoint-derived progress every 2.5s,
  // so the UI always reflects actual server state — no more "22% stuck" bug.

  // Listen for push events from Bun side
  useEffect(() => {
    const onPipeline = (e: CustomEvent) => {
      const status = e.detail as PipelineStatus;
      setState((prev) => ({
        ...prev,
        stage: status.stage,
        progress: status.progress,
        pendingStage: status.pendingStage,
        error: status.error ?? null,
      }));

      // Fire toasts for stage transitions (only on first entry to stage)
      const stageMessages: Record<string, string> = {
        generating_screenplay: "Writing your screenplay...",
        generating_keyframes: "Rendering scene keyframes...",
        generating_video: "Generating video clips...",
        waiting_approval: "Pipeline paused: waiting for approval.",
        stitching: "Stitching final render...",
        complete: "Film complete!",
      };

      const isStageChange = status.stage !== lastStageRef.current;
      lastStageRef.current = status.stage;

      const msg = isStageChange ? stageMessages[status.stage] : undefined;
      if (msg) {
        window.dispatchEvent(
          new CustomEvent("toast", {
            detail: {
              id: "",
              type: status.stage === "complete" ? "success" : "info",
              message: msg,
            } as Toast,
          }),
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
          }),
        );
      }
    };

    const onStoryboard = (e: CustomEvent) => {
      setState((prev) => ({
        ...prev,
        storyboard: e.detail as Storyboard,
        // Don't override stage/progress here — let onPipelineUpdate drive it
      }));
      window.dispatchEvent(
        new CustomEvent("toast", {
          detail: {
            id: "",
            type: "success",
            message: "Storyboard ready!",
          } as Toast,
        }),
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
        onPipeline as EventListener,
      );
      window.removeEventListener(
        "storyboard-ready",
        onStoryboard as EventListener,
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
          pendingStage: status.pendingStage,
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
    async (
      idea: string,
      style: FilmStyle,
      industryMode: IndustryMode = "filmmaking",
      productionLayer: ProductionLayer = "storyboard-previs",
    ) => {
      setState((prev) => ({
        ...prev,
        ...INITIAL,
        settings: prev.settings,
        stage: "generating_screenplay",
        progress: 8,
      }));

      window.dispatchEvent(
        new CustomEvent("toast", {
          detail: {
            id: "",
            type: "info",
            message: "Starting film generation...",
          } as Toast,
        }),
      );

      const rpc = getBunRpc();
      const { workflowId, storyboard } = await rpc.request.submitIdea({
        idea,
        style,
        settings: state.settings,
        industryMode,
        productionLayer,
      });

      setState((prev) => ({
        ...prev,
        workflowId,
        ...(storyboard ? { storyboard } : {}),
        ...(state.settings.workflowMode === "approval" && storyboard
          ? {
              stage: "waiting_approval" as PipelineStage,
              progress: 25,
              pendingStage: "keyframes" as const,
            }
          : {}),
      }));

      if (state.settings.workflowMode !== "approval" || !storyboard) {
        startPolling(workflowId);
      }

      return { workflowId };
    },
    [startPolling, state.settings],
  );

  const approvePipelineStage = useCallback(async (): Promise<boolean> => {
    if (!state.workflowId) return false;

    const rpc = getBunRpc();
    const { started } = await rpc.request.approvePipelineStage({
      workflowId: state.workflowId,
    });

    if (started) {
      setState((prev) => ({
        ...prev,
        stage: "generating_keyframes",
        progress: Math.max(prev.progress, 25),
        pendingStage: undefined,
        error: null,
      }));
      startPolling(state.workflowId);
    }

    return started;
  }, [startPolling, state.workflowId]);

  const resumeWorkflow = useCallback(
    async (workflowId: string): Promise<WorkflowResumePayload> => {
      const rpc = getBunRpc();
      let resolvedStoryboard: Storyboard | null = null;
      let resolvedVideoUrl: string | null = null;
      let pendingApprovalStage: string | undefined;
      let resolvedCreativeRoom: WorkflowResumePayload["creativeRoom"];
      let resolvedWritersRoomPack: WorkflowResumePayload["writersRoomPack"];
      let resumedIndustryMode: WorkflowResumePayload["industryMode"];

      try {
        const resumed = await rpc.request.resumeWorkflow({ workflowId });
        resolvedStoryboard = resumed.storyboard ?? null;
        resolvedVideoUrl = resumed.videoUrl ?? null;
        resolvedCreativeRoom = resumed.creativeRoom;
        resolvedWritersRoomPack = resumed.writersRoomPack;
        resumedIndustryMode = resumed.industryMode;
      } catch {
        // Fall back to the older direct-fetch path below.
      }

      try {
        const approval = await rpc.request.getApprovalState({ workflowId });
        pendingApprovalStage = approval.pendingStage;
      } catch {
        // Approval state is optional for older backends.
      }

      // Fetch existing storyboard if the backend did not provide one.
      if (
        !resolvedStoryboard &&
        !resolvedCreativeRoom &&
        !resolvedWritersRoomPack
      ) {
        try {
          const sb = await rpc.request.getStoryboard({ workflowId });
          resolvedStoryboard = sb;
        } catch {
          // no storyboard available yet
        }
      }

      const authoringOnlyWorkflow =
        !resolvedStoryboard &&
        !!(
          resolvedCreativeRoom ||
          resolvedWritersRoomPack ||
          (resumedIndustryMode && resumedIndustryMode !== "filmmaking")
        );

      if (authoringOnlyWorkflow) {
        pendingApprovalStage = undefined;
        if (pollRef.current) clearInterval(pollRef.current);
      }

      if (resolvedStoryboard) {
        setState((prev) => ({
          ...prev,
          storyboard: resolvedStoryboard,
          workflowId,
          stage: resolvedVideoUrl
            ? "complete"
            : pendingApprovalStage
              ? "waiting_approval"
              : "generating_keyframes",
          progress: resolvedVideoUrl ? 100 : pendingApprovalStage ? 25 : 30,
          pendingStage: pendingApprovalStage as PipelineStatus["pendingStage"],
          videoUrl: resolvedVideoUrl,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          workflowId,
          stage: authoringOnlyWorkflow ? "idle" : prev.stage,
          progress: authoringOnlyWorkflow ? 0 : prev.progress,
          pendingStage: authoringOnlyWorkflow ? undefined : prev.pendingStage,
          videoUrl: resolvedVideoUrl,
        }));
      }

      // Try to get video if the backend did not already provide it.
      if (!resolvedVideoUrl && !authoringOnlyWorkflow) {
        if (!pendingApprovalStage) {
          try {
            const { videoUrl } = await rpc.request.getVideo({ workflowId });
            resolvedVideoUrl = videoUrl;
            setState((prev) => ({
              ...prev,
              videoUrl,
              stage: "complete",
              progress: 100,
            }));
          } catch {
            // Not ready, start polling.
            startPolling(workflowId);
          }
        }
      }

      window.dispatchEvent(
        new CustomEvent("toast", {
          detail: {
            id: "",
            type: "info",
            message: `Resumed workflow ${workflowId.slice(0, 8)}`,
          } as Toast,
        }),
      );

      return {
        workflowId,
        ...(resolvedStoryboard ? { storyboard: resolvedStoryboard } : {}),
        ...(resolvedVideoUrl ? { videoUrl: resolvedVideoUrl } : {}),
        ...(resolvedCreativeRoom ? { creativeRoom: resolvedCreativeRoom } : {}),
        ...(resolvedWritersRoomPack
          ? { writersRoomPack: resolvedWritersRoomPack }
          : {}),
        ...(resumedIndustryMode ? { industryMode: resumedIndustryMode } : {}),
      };
    },
    [startPolling],
  );

  const updateScene = useCallback(
    (sceneId: string, updates: Partial<any>) => {
      setState((prev) => {
        if (!prev.storyboard) return prev;
        const scenes = prev.storyboard.scenes.map((s) =>
          s.id === sceneId ? { ...s, ...updates } : s,
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
    [state.workflowId],
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
    pendingStage: state.pendingStage,
    workflowId: state.workflowId,
    storyboard: state.storyboard,
    videoUrl: state.videoUrl,
    error: state.error,
    settings: state.settings,
    submitIdea,
    resumeWorkflow,
    approvePipelineStage,
    updateScene,
    updateSettings,
    reset,
  };
}

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  FilmStyle,
  PipelineStage,
  PipelineStatus,
  Storyboard,
} from "../../shared/types";

interface PipelineState {
  stage: PipelineStage;
  progress: number;
  workflowId: string | null;
  storyboard: Storyboard | null;
  videoUrl: string | null;
  error: string | null;
}

const INITIAL: PipelineState = {
  stage: "idle",
  progress: 0,
  workflowId: null,
  storyboard: null,
  videoUrl: null,
  error: null,
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
    };
    const onStoryboard = (e: CustomEvent) => {
      setState((prev) => ({
        ...prev,
        storyboard: e.detail as Storyboard,
        stage: "generating_keyframes",
        progress: 30,
      }));
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
      } catch (err) {
        // RPC failed — don't crash, just retry next tick
      }
    }, 2000);
  }, []);

  const submitIdea = useCallback(
    async (idea: string, style: FilmStyle) => {
      setState({
        ...INITIAL,
        stage: "generating_screenplay",
        progress: 5,
      });

      const rpc = getBunRpc();
      const { workflowId } = await rpc.request.submitIdea({ idea, style });

      setState((prev) => ({ ...prev, workflowId }));
      startPolling(workflowId);

      return { workflowId };
    },
    [startPolling]
  );

  const reset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setState(INITIAL);
  }, []);

  return {
    stage: state.stage,
    progress: state.progress,
    workflowId: state.workflowId,
    storyboard: state.storyboard,
    videoUrl: state.videoUrl,
    error: state.error,
    submitIdea,
    reset,
  };
}

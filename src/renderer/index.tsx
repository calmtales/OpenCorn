import { Electroview } from "electrobun/view";
import { createRoot } from "react-dom/client";
import type { BunRPC, WebviewRPC } from "../shared/types";
import type { ElectrobunRPCSchema } from "electrobun/view";
import App from "./App";

// Combined schema satisfying ElectrobunRPCSchema
type AppRPCSchema = { bun: BunRPC; webview: WebviewRPC } & ElectrobunRPCSchema;

// Set up typed RPC with Bun side
const rpc = Electroview.defineRPC<AppRPCSchema>({
  handlers: {
    requests: {},
    messages: {
      onPipelineUpdate: ({ status }) => {
        window.dispatchEvent(
          new CustomEvent("pipeline-update", { detail: status })
        );
      },
      onStoryboardReady: ({ storyboard }) => {
        window.dispatchEvent(
          new CustomEvent("storyboard-ready", { detail: storyboard })
        );
      },
      onVideoReady: ({ videoUrl }) => {
        window.dispatchEvent(
          new CustomEvent("video-ready", { detail: videoUrl })
        );
      },
      onToast: ({ toast }) => {
        window.dispatchEvent(new CustomEvent("toast", { detail: toast }));
      },
      onComfyUIUpdate: ({ connection }) => {
        window.dispatchEvent(
          new CustomEvent("comfyui-update", { detail: { connection } })
        );
      },
      onBatchProgress: ({ jobId, status, progress }) => {
        window.dispatchEvent(
          new CustomEvent("batch-progress", {
            detail: { jobId, status, progress },
          })
        );
      },
    },
  },
});

const electroview = new Electroview({ rpc });

// Expose Bun RPC caller globally for hooks
(window as any).__electrobun_rpc = electroview.rpc;

// Mount React
const root = createRoot(document.getElementById("root")!);
root.render(<App />);

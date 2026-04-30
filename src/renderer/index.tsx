import { Electroview } from "electrobun/view";
import { createRoot } from "react-dom/client";
import type { BunRPC, WebviewRPC } from "../shared/types";
import App from "./App";

// Set up typed RPC with Bun side
const rpc = Electroview.defineRPC<WebviewRPC>({
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
    },
  },
});

const electroview = new Electroview({ rpc });

// Expose Bun RPC caller globally for hooks
(window as any).__electrobun_rpc = electroview.rpc;

// Mount React
const root = createRoot(document.getElementById("root")!);
root.render(<App />);

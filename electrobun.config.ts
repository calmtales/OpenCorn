import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "OpenCorn",
    identifier: "dev.opencorn.app",
    version: "0.4.0",
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  build: {
    bun: {
      entrypoint: "src/main/index.ts",
    },
    views: {
      main: {
        entrypoint: "src/renderer/index.tsx",
        staticAssets: ["index.html"],
      },
    },
  },
} satisfies ElectrobunConfig;

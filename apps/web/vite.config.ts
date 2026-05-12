import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 6500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@mlc-ai/web-llm")) return "webllm-runtime";
          if (id.includes("@webcontainer/api")) return "webcontainer-runtime";
          if (id.includes("monaco-editor")) return "monaco-editor";
        },
      },
    },
  },
  plugins: [react()],
  preview: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
    port: 5173,
  },
  test: {
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
  },
});

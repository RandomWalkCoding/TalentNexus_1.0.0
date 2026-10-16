import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, ".", "");

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": environment.API_PROXY_TARGET || "http://127.0.0.1:3000"
      }
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      testTimeout: 15000,
      maxWorkers: 1
    }
  };
});

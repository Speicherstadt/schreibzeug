/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { enginePlugin } from "./engine-plugin";
import { ocrPlugin } from "./ocr-plugin";

/** The Schreibzeug server the dev server forwards /api to (apps/server, `bun run server`). */
const apiUrl = process.env.SCHREIBZEUG_API_URL ?? "http://localhost:3000";

/** The version Bump version raises (.github/workflows/bump.yml): the root package.json, not this one (0.0.0). */
const appVersion: string = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf8"),
).version;

export default defineConfig(({ mode }) => ({
  define: { "import.meta.env.APP_VERSION": JSON.stringify(appVersion) },
  // The demo (src/demo) is served from GitHub Pages next to the docs; DEMO_BASE=/ serves it at the root.
  base: mode === "demo" ? (process.env.DEMO_BASE ?? "/demo/") : "/",
  plugins: [
    react(),
    tailwindcss(),
    // The interface texts (messages/de.json, messages/en.json) as functions in src/paraglide; the
    // options are in project.inlang/paraglide.config.js.
    paraglideVitePlugin({
      project: resolve(import.meta.dirname, "project.inlang"),
      outdir: resolve(import.meta.dirname, "src/paraglide"),
      // Paraglide 2's default: one module per locale in the dev server and tests (a few requests),
      // one per message in production builds (tree shaking). v3 would serve virtual modules only Vite
      // can resolve.
      outputStructure: process.env.NODE_ENV === "production" ? "message-modules" : "locale-modules",
    }),
    enginePlugin(resolve(import.meta.dirname, "../../engine/dist")),
    ocrPlugin(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: apiUrl, ws: true }, "/mcp": { target: apiUrl } },
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: { "/api": { target: apiUrl, ws: true }, "/mcp": { target: apiUrl } },
  },
  build: { outDir: mode === "demo" ? "dist-demo" : "dist" },
  test: {
    name: "web",
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}", "*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
}));

import path from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import tanstackRouter from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.join(__dirname, "src"),
    },
  },
  build: {
    emptyOutDir: true,
    outDir: path.join(__dirname, "../server/BlitzTask.Backend/wwwroot"),
  },
  server: {
    proxy: {
      "/api": "http://localhost:5121",
    },
  },
});

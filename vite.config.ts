import {defineConfig} from "vite";
import symfonyPlugin from "vite-plugin-symfony";
import process from "node:process";
import path from "node:path";
import react from '@vitejs/plugin-react';
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    symfonyPlugin(),
    react(),
    tailwindcss()
  ],
  build: {
    rollupOptions: {
      input: {
        app: "./assets/index.tsx"
      },
    }
  },
  server: {
    host: "0.0.0.0",
    cors: {
      origin: process.env.SITE_NAME,
      credentials: true
    },
    hmr: {
      host: new URL(process.env.SITE_NAME!).hostname,
    },
    watch: {
      ignored: ["**/node_modules/**", "**/vendor/**", "**/.git/**", "/src/**"]
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./assets"),
    },
  },
});

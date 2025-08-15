import tailwindcss from "@tailwindcss/vite";
import react from '@vitejs/plugin-react';
import path from "node:path";
import {defineConfig} from "vite";
import symfonyPlugin from "vite-plugin-symfony";

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
    cors: {
      origin: "*",
    },
    watch: {
      ignored: [
        "**/node_modules/**",
        "**/vendor/**",
        "**/.git/**",
        "**/src/**",          // Ignore Symfony source code completely (including controllers)
        "**/docker/**",       // Ignore docker files
        "**/config/**",       // Ignore config files (and services)
        "**/var/**"
      ]
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./assets"),
    },
  },
});

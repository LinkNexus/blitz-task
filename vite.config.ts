import {defineConfig} from "vite";
import symfonyPlugin from "vite-plugin-symfony";
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
      origin: "*",
    },
    watch: {
      ignored: [
        "**/node_modules/**",
        "**/vendor/**",
        "**/.git/**",
        "**/src/**",          // Ignore Symfony source code completely (including controllers)
        "**/docker/**",       // Ignore docker files
        "**/templates/**",    // Ignore Symfony templates
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

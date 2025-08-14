import tailwindcss from "@tailwindcss/vite";
import react from '@vitejs/plugin-react';
import path from "node:path";
import process from "node:process";
import {defineConfig} from "vite";
import symfonyPlugin from "vite-plugin-symfony";

const sitename = process.env.SITE_NAME || "localhost";

export default defineConfig({
  plugins: [
    symfonyPlugin({
      viteDevServerHostname: sitename
    }),
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
    port: 5173,
    cors: {
      origin: "*",
    },
    allowedHosts: [sitename],
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

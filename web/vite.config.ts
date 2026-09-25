import path from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import tanstackRouter from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Named here and in `use-offline.ts`, because the app has to be able to empty it on logout:
 * a cached board belongs to whoever was signed in when it was fetched, and on a shared device
 * the next person must not be served it.
 */
const API_CACHE = "blitz-api-reads";

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
    VitePWA({
      // Applied on the next load rather than prompting. This is a self-hosted personal tool;
      // a dialog asking permission to install an update nobody chose to defer is friction.
      registerType: "autoUpdate",
      injectRegister: "auto",

      // Off in dev, which is the default and worth keeping: a service worker caching the shell
      // while you are editing it turns every change into a guessing game.
      devOptions: { enabled: false },

      includeAssets: [
        "favicon.ico",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
      ],

      manifest: {
        name: "Blitz Task",
        short_name: "Blitz Task",
        description:
          "A self-hosted task and project manager — board, table and calendar in one place.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        // Both taken from the app's own theme tokens (`--primary`, `--background`) rather than
        // picked, so an installed window does not frame the app in a colour it never uses.
        theme_color: "#9b2c2c",
        background_color: "#faf7f5",
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },

      workbox: {
        // The shell only. Nothing under /api is cached at any point — offline *reads* of live
        // data and queued mutations are L45's other half, and a cached API response would be
        // stale data wearing a fresh timestamp.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],

        navigateFallback: "/index.html",

        // The one setting here that is load-bearing. Without it a navigation-mode request to
        // /api that misses the network is answered with index.html, and the typed client hands
        // a component an HTML *string* where it expected an array — the crash surfacing as
        // `x.map is not a function` somewhere far from the cause. That is precisely the bug
        // `app.MapFallback("/api/{**path}", ...)` exists to prevent on the server, and a
        // service worker is a second place it can be reintroduced.
        navigateFallbackDenylist: [/^\/api\//, /^\/hub\//],

        // The push and notificationclick handlers (L32.5), pulled in rather than replacing the
        // generated worker: `injectManifest` would mean rewriting the routing above by hand,
        // including the denylist, to add two event listeners.
        importScripts: ["/push-sw.js"],

        runtimeCaching: [
          {
            // Reads, cached so a board opens without a network (L45's second half).
            //
            // `NetworkFirst`, never cache-first: a live answer must always win, and the cache
            // only speaks when the network cannot. The cache is a fallback for being offline,
            // not a speed-up — serving a cached board to someone who is online would show them
            // a project as it was, with no sign that it is stale.
            //
            // This does **not** weaken `navigateFallbackDenylist` above. That governs
            // *navigations*; this governs `fetch`. An offline navigation to /api still has to
            // end in a network error rather than index.html.
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith("/api/") &&
              request.method === "GET" &&
              // Never the antiforgery token: a cached one is a token for a session that may be
              // gone, and every write would then fail in a way that looks like a server bug.
              !url.pathname.startsWith("/api/csrf-token"),
            handler: "NetworkFirst",
            options: {
              cacheName: API_CACHE,
              // Long enough to prefer the network on a slow connection, short enough that a
              // dead one does not leave the app hanging before it falls back.
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
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

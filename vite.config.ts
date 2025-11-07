import { defineConfig } from "vite";
import symfonyPlugin from "vite-plugin-symfony";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [react(), symfonyPlugin(), tailwindcss()],
	build: {
		rollupOptions: {
			input: {
				app: "./assets/index.tsx",
			},
		},
	},
	server: {
		cors: true,
		hmr: {
			host: "127.0.0.1",
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "assets"),
		},
	},
});

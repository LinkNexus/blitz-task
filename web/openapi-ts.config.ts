import path from "node:path";
import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: path.join(
    __dirname,
    "../server/BlitzTask.Backend/BlitzTask.Backend.json",
  ),
  output: path.join(__dirname, "src/api"),
  plugins: [
    "@hey-api/typescript",
    "@hey-api/sdk",
    {
      name: "@hey-api/client-fetch",
      runtimeConfigPath: path.join(__dirname, "src/hey-api.ts"),
    },
    "@tanstack/react-query",
  ],
});

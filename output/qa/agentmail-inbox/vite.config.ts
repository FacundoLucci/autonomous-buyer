import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { resolve } from "node:path";
const root = resolve("output/qa/agentmail-inbox");
export default defineConfig({ root, plugins: [tailwind(), react()], resolve: { alias: { "convex/react": resolve(root, "mock.ts"), "@": resolve("src") }, dedupe: ["react", "react-dom"] }, server: { port: 4317, host: "127.0.0.1", fs: { allow: [resolve(".")] } } });

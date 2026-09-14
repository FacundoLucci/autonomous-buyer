import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(here, "../..");
export default defineConfig({
  root: here,
  base: "./",
  publicDir: false,
  plugins: [tailwind(), react()],
  resolve: {
    alias: {
      "@": path.join(repository, "src"),
      react: path.join(repository, "node_modules/react"),
      "react-dom": path.join(repository, "node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: path.join(repository, "assets/storyboard/you-handle-today-footage/mobile-app/site"),
    emptyOutDir: true,
    rollupOptions: {
      input: { index: path.join(here, "index.html"), app: path.join(here, "app.html") },
    },
  },
});

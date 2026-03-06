import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  base: "/tetris/",
  root: ".",
  build: {
    outDir: "dist",
    target: "es2020",
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  define: {
    __WS_URL__: JSON.stringify(process.env.VITE_WS_URL ?? ""),
  },
});
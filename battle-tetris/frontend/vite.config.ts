import { defineConfig, loadEnv } from "vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
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
      __WS_URL__: JSON.stringify(env.VITE_WS_URL ?? ""),
    },
  };
});
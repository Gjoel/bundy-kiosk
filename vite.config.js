// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * We serve on https://<user>.github.io/Bundy-kiosk/
 * - base MUST match the repo (case-sensitive)
 * - assets are flattened to root (no /assets/)
 * - file names are forced to index-<hash>.{js,css} to match requests
 */
export default defineConfig({
  plugins: [react()],
  base: "/Bundy-kiosk/",
  build: {
    outDir: "dist",
    assetsDir: "",
    rollupOptions: {
      output: {
        // main entry (your app)
        entryFileNames: "index-[hash].js",
        // code-split chunks (if any)
        chunkFileNames: "chunk-[hash].js",
        // css and other assets
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || "";
          const ext = name.split(".").pop();
          if (ext === "css") return "index-[hash].css";
          return "[name]-[hash][extname]";
        },
      },
    },
  },
});

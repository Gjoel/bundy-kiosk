// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/Bundy-kiosk/",
  build: {
    outDir: "dist",
    assetsDir: "",
    rollupOptions: {
      output: {
        entryFileNames: "index-[hash].js",
        chunkFileNames: "chunk-[hash].js",
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

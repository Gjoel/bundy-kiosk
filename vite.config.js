// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // MUST match your repo name & case exactly:
  base: "/Bundy-kiosk/",
  build: {
    outDir: "dist",
    // Flatten asset files so the URLs like /Bundy-kiosk/index-xxxxx.js resolve
    assetsDir: "",
  },
});

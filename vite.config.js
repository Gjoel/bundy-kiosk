// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: base must match your repo name & case exactly.
export default defineConfig({
  plugins: [react()],
  base: "/Bundy-kiosk/",
  build: {
    outDir: "dist",
    // Flatten asset files so GitHub Pages can load /Bundy-kiosk/index-*.js|css
    assetsDir: "",
  },
});

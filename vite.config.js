// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: base must match the repo name & case exactly.
export default defineConfig({
  plugins: [react()],
  base: "/Bundy-kiosk/",
  build: {
    outDir: "dist",
    // use Vite defaults so built files live under /assets/
    // (no assetsDir override, no custom rollupOptions)
  },
});

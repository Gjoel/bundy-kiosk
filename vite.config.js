// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/bundy-kiosk/",   // <-- EXACTLY your repo path, lower-case if you renamed
  build: { outDir: "dist" }
});

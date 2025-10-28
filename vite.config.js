// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/bundy-kiosk/",   // repo path in all-lowercase
  build: { outDir: "dist" }
});

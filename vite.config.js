// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/Bundy-kiosk/",   // exact repo name & case
  build: {
    outDir: "dist",        // let Vite use default /assets/* output
  },
});

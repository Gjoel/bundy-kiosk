import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/bundy-kiosk/',   // must match your repo name EXACTLY + trailing slash
  plugins: [react()],
})

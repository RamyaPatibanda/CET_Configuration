import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use a relative base so the same build can be hosted at any IIS application path.
  base: "./",
})

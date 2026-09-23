import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The application can be hosted under any IIS virtual application path.
  base: "/cet-configuration/",
})

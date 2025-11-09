import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': 'https://smarthack-backend.onrender.com:8000',
      '/auth': 'https://smarthack-backend.onrender.com:8000',
      '/spaces': 'https://smarthack-backend.onrender.com:8000'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})

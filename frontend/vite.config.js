import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': 'https://smarthack-backend.onrender.com',
      '/auth': 'https://smarthack-backend.onrender.com',
      '/spaces': 'https://smarthack-backend.onrender.com'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})

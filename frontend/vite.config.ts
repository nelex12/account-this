import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // <-- ДОБАВЬ ЭТУ СТРОКУ (слушать 0.0.0.0 вместо localhost)
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
})
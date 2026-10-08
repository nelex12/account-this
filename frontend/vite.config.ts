import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Account This!',
        short_name: 'AT!',
        theme_color: '#ffa500',
        display: 'standalone',
        icons: []
      }
    })
  ],
  server: {
    host: true, // <-- ДОБАВЬ ЭТУ СТРОКУ (слушать 0.0.0.0 вместо localhost)
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
})
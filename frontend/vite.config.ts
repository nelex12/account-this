import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // wasm = QR decoder fallback (zxing); precached so the scanner works offline
        globPatterns: ['**/*.{js,css,html,svg,ico,png,woff,woff2,wasm}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Offline start: any page address (/overview, /scan ...) opens the cached app shell.
        // The API is never answered from the shell, and nothing from /api is cached: requests go to the network.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: true
      },
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
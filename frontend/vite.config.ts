import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt": a new version waits until the user taps "Обновить" (see src/shared/pwa/PwaStatus.tsx).
      // An automatic reload could interrupt a scan or a QR on screen.
      registerType: 'prompt',
      // registration is done by the app (virtual:pwa-register/react), not by an injected script
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
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
        enabled: true,
      },
      // The only manifest of the app (generated as /manifest.webmanifest and linked from index.html)
      manifest: {
        id: '/',
        name: 'Account This!',
        short_name: 'AT!',
        description: 'Учёт выдачи и возврата инструмента по QR-кодам, работает без интернета',
        lang: 'ru',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F2F2F2',
        theme_color: '#FFA500',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    host: true, // <-- ДОБАВЬ ЭТУ СТРОКУ (слушать 0.0.0.0 вместо localhost)
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
})
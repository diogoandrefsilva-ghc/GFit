import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// A app é servida em https://<user>.github.io/GFit/
const BASE = '/GFit/'

export default defineConfig({
  base: BASE,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        // O supabase-js é a maior fatia e quase nunca muda: em chunk próprio
        // sobrevive aos deploys no cache do browser.
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${BASE}index.html`,
        runtimeCaching: [
          {
            // A biblioteca de exercícios e a base de alimentos quase não mudam.
            urlPattern: /\/rest\/v1\/(exercises|foods|muscles)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'gfit-bibliotecas',
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      manifest: {
        name: 'GFit — treino e acompanhamento',
        short_name: 'GFit',
        description:
          'Treinos, medidas, dieta e feedback semanal entre treinador e aluno.',
        lang: 'pt-PT',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F1EC',
        theme_color: '#16150F',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})

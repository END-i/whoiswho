import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { audioIdsPlugin } from './scripts/vite-audio-plugin.mjs';

export default defineConfig({
  plugins: [
    svelte(),
    audioIdsPlugin(new URL('./public/audio', import.meta.url).pathname, undefined, process.env.E2E_AUDIO_IDS),
    VitePWA({
      registerType: 'autoUpdate', // нова версія підхоплюється після перезапуску; збережена гра в localStorage не губиться
      injectRegister: false,      // реєструємо самі в main.js
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg', 'fonts/OFL.txt'],
      manifest: {
        name: 'Хто є хто — сімейна гра',
        short_name: 'Хто є хто',
        description: 'Сімейна гра-розмова: передавайте телефон по колу й дізнавайтеся одне про одного більше.',
        lang: 'uk',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFF5EA',
        theme_color: '#FF7A1A',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // уся гра — наперед; озвучка — окремо (може важити мегабайти, качається у фоні)
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,txt}'],
        globIgnores: ['audio/**'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.startsWith('/audio/') && url.pathname.endsWith('.mp3'),
          handler: 'CacheFirst',
          options: { cacheName: 'whoiswho-audio', rangeRequests: true, cacheableResponse: { statuses: [0, 200] } },
        }],
      },
    }),
  ],
});

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { audioIdsPlugin } from './scripts/vite-audio-plugin.mjs';

// Версія для екрана «Про гру»: номер з package.json, дата збірки, коміт (Cloudflare Pages дає CF_PAGES_COMMIT_SHA)
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const commit = (() => {
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; }
})();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __COMMIT__: JSON.stringify(commit),
  },
  plugins: [
    svelte(),
    audioIdsPlugin(new URL('./public/audio', import.meta.url).pathname, undefined, process.env.E2E_AUDIO_IDS),
    VitePWA({
      registerType: 'prompt', // нова версія — повідомлення «Оновити»; збережена гра в localStorage не губиться
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

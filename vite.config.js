import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { audioIdsPlugin } from './scripts/vite-audio-plugin.mjs';

export default defineConfig({
  plugins: [svelte(), audioIdsPlugin(new URL('./public/audio', import.meta.url).pathname)],
});

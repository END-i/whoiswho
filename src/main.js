import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';
import { loadRuFiles } from './ru-packs.js';

// мова вже російська — спершу підвантажуємо російські питання, щоб не блимнули українські
let preloadedRu = null;
try { if (JSON.parse(localStorage.getItem('whoiswho.v2'))?.settings?.lang === 'ru') preloadedRu = await loadRuFiles(); } catch { /* без збереження — українська */ }
mount(App, { target: document.getElementById('app'), props: { preloadedRu } });

// Офлайн-режим: service worker кешує гру. Коли на сервері нова версія — App показує «Оновити».
if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => window.dispatchEvent(new CustomEvent('whoiswho:update')),
    onRegisteredSW: (_url, reg) => { window.__checkUpdate = () => reg?.update(); },
  });
  window.__applyUpdate = () => updateSW(true); // нова версія й перезавантаження; гра збережена в localStorage
}

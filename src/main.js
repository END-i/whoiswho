import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';

mount(App, { target: document.getElementById('app') });

// Офлайн-режим: service worker кешує гру. Коли на сервері нова версія — App показує «Оновити».
if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => window.dispatchEvent(new CustomEvent('whoiswho:update')),
    onRegisteredSW: (_url, reg) => { window.__checkUpdate = () => reg?.update(); },
  });
  window.__applyUpdate = () => updateSW(true); // нова версія й перезавантаження; гра збережена в localStorage
}

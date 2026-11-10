import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';

mount(App, { target: document.getElementById('app') });

// Офлайн-режим: service worker кешує гру. autoUpdate — нова версія підхоплюється після перезапуску.
if ('serviceWorker' in navigator) registerSW({ immediate: true });

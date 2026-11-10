import { defineConfig, devices } from '@playwright/test';

// e2e — те, що не покрити юніт-тестами: екрани, canvas для фото, localStorage, перезавантаження.
// Два рушії: Chromium (як Android) і WebKit (як Safari на iPhone).
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  workers: 2, // Chromium і WebKit разом на одній машині — більше процесів дає тайм-аути через навантаження
  timeout: 45000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  // reducedMotion: гра пропускає анімацію перевороту карти — тести швидші й стабільніші.
  // Окремий тест у layout.spec.js перевіряє гру з анімаціями.
  use: { baseURL: 'http://localhost:5199', trace: 'retain-on-failure', contextOptions: { reducedMotion: 'reduce' } },
  // Зібрана гра, як на хостингу (dev-сервер іноді сам перезавантажує сторінку, коли оптимізує залежності).
  webServer: { command: 'npm run build && npx vite preview --port 5199 --strictPort', url: 'http://localhost:5199', reuseExistingServer: false },
  projects: [
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
  ],
});

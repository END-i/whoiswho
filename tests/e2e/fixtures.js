// Shared Playwright fixture: every test page is silent.
// WebKit plays <audio> through the speakers even in headless mode,
// so without this the game's sounds and voice play on the developer's machine during e2e runs.
import { test as base, expect } from '@playwright/test';

function mute() {
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) { this.muted = true; return play.apply(this, args); };
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(mute);
    await use(page);
  },
});
export { expect };

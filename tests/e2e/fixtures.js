// Shared Playwright fixture: every test page is silent.
// WebKit plays Web Audio and <audio> through the speakers even in headless mode,
// so without this the game's sound effects beep on the developer's machine during e2e runs.
import { test as base, expect } from '@playwright/test';

function mute() {
  // Web Audio: `destination` returns a zero-gain node in front of the real output.
  const proto = window.BaseAudioContext?.prototype;
  const real = proto && Object.getOwnPropertyDescriptor(proto, 'destination');
  if (real) {
    const silent = new WeakMap();
    Object.defineProperty(proto, 'destination', {
      configurable: true,
      get() {
        if (!silent.has(this)) {
          const g = this.createGain();
          g.gain.value = 0;
          g.connect(real.get.call(this));
          silent.set(this, g);
        }
        return silent.get(this);
      },
    });
  }
  // <audio>: muted before playing.
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

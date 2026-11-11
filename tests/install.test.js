import { test } from 'node:test';
import assert from 'node:assert/strict';
import { platform, isStandalone } from '../src/lib/install.js';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1',
  iphoneGoogleApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/330.0 Mobile/15E148 Safari/604.1',
  ipadOS: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
};

test('platform: iPhone Safari, iPhone в іншому браузері, iPad, Android, комп\'ютер, уже встановлено', () => {
  assert.equal(platform(UA.iphoneSafari), 'ios-safari');
  assert.equal(platform(UA.iphoneChrome), 'ios-other');
  assert.equal(platform(UA.iphoneGoogleApp), 'ios-other');
  assert.equal(platform(UA.ipadOS, { maxTouchPoints: 5 }), 'ios-safari');
  assert.equal(platform(UA.ipadOS), 'desktop', 'справжній Mac без сенсорного екрана');
  assert.equal(platform(UA.android), 'android');
  assert.equal(platform(UA.mac), 'desktop');
  assert.equal(platform(UA.android, { standalone: true }), 'installed');
  assert.equal(platform(), 'desktop');
});

test('isStandalone: display-mode або navigator.standalone (iOS)', () => {
  assert.equal(isStandalone({ matchMedia: () => ({ matches: true }), navigator: {} }), true);
  assert.equal(isStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } }), true);
  assert.equal(isStandalone({ matchMedia: () => ({ matches: false }), navigator: {} }), false);
  assert.equal(isStandalone({ matchMedia: undefined, navigator: undefined }), false);
  assert.equal(isStandalone(), false);
});

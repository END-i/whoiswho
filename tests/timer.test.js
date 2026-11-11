import { test } from 'node:test';
import assert from 'node:assert/strict';
import { secondsLeft, timerSound, clock, TIMER_SECONDS, TICK_FROM } from '../src/lib/timer.js';

test('secondsLeft: 30 с від старту, ціле число вгору, не менше нуля', () => {
  assert.equal(TIMER_SECONDS, 30);
  assert.equal(secondsLeft(1000, 1000), 30);
  assert.equal(secondsLeft(1000, 1500), 30);
  assert.equal(secondsLeft(1000, 2000), 29);
  assert.equal(secondsLeft(0, 30000), 0);
  assert.equal(secondsLeft(0, 99999), 0);
  assert.equal(secondsLeft(0, 4000, 10), 6);
});

test('timerSound: тикає в останні 5 с, наприкінці — сигнал, на тій самій секунді — нічого', () => {
  assert.equal(TICK_FROM, 5);
  assert.equal(timerSound(7, 6), null);
  assert.equal(timerSound(6, 5), 'tick');
  assert.equal(timerSound(2, 1), 'tick');
  assert.equal(timerSound(1, 0), 'end');
  assert.equal(timerSound(3, 3), null);
});

test('clock: хвилини й секунди', () => {
  assert.equal(clock(30), '0:30'); assert.equal(clock(5), '0:05'); assert.equal(clock(65), '1:05');
});

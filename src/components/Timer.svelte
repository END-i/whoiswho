<script>
  // Таймер для «Покажи!» і викликів: тап — 30 с пішли, ще тап — стоп. Останні 5 с тикає, наприкінці — сигнал.
  import { onDestroy } from 'svelte';
  import { secondsLeft, timerSound, clock, TIMER_SECONDS } from '../lib/timer.js';
  import { playSfx } from '../lib/sfx.js';
  import { t } from '../lib/lang.svelte.js';

  let { sounds = true } = $props();
  let started = $state(null);
  let left = $state(TIMER_SECONDS);
  let done = $state(false);
  let iv;

  function step() {
    const l = secondsLeft(started, performance.now());
    const snd = timerSound(left, l);
    left = l;
    if (snd) playSfx(snd, { enabled: sounds });
    if (!l) { clearInterval(iv); started = null; done = true; }
  }
  function toggle() {
    clearInterval(iv);
    if (started !== null) { started = null; left = TIMER_SECONDS; return; }
    started = performance.now(); left = TIMER_SECONDS; done = false;
    iv = setInterval(step, 200);
  }
  onDestroy(() => clearInterval(iv));
  const label = $derived(started !== null ? t('timer.running', { t: clock(left) }) : done ? t('timer.done') : t('timer.start', { n: TIMER_SECONDS }));
</script>

<button class="timer" class:run={started !== null} class:done class:hurry={started !== null && left <= 5} onclick={toggle}>{label}</button>

<style>
  .timer {
    width: 100%; min-height: 48px; margin: 0 0 4px; border-radius: 14px; border: 2px solid var(--line); background: var(--card);
    font-weight: 900; font-size: 17px; color: var(--ink); font-variant-numeric: tabular-nums;
  }
  .timer.run { border-color: var(--c1, var(--accent)); background: color-mix(in srgb, var(--c1, var(--accent)) 12%, var(--card)); }
  .timer.hurry { border-color: var(--no); color: var(--no); animation: beat .5s ease-in-out infinite alternate; }
  .timer.done { border-color: var(--no); }
  @keyframes beat { to { transform: scale(1.03); } }
  @media (prefers-reduced-motion: reduce) { .timer.hurry { animation: none; } }
</style>

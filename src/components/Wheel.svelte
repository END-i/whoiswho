<script>
  import { onDestroy } from 'svelte';
  import { pickSpin, sectorAt, spinTarget } from '../lib/wheel.js';
  import { playSfx } from '../lib/sfx.js';
  import { t } from '../lib/lang.svelte.js';

  // items — категорії, де ще є карти: { id, emoji, title, color }
  let { items, sounds = true, onland } = $props();

  let angle = $state(0);
  let ms = $state(0);
  let ease = $state('linear');
  let spinning = $state(false);
  let landed = $state(null);
  let wheel;
  let timers = [];
  let frame = 0;

  const step = $derived(360 / items.length);
  const conic = $derived(items.map((c, i) => `${c.color} ${i * step}deg ${(i + 1) * step}deg`).join(', '));

  /** Справжній кут колеса посеред анімації (з матриці transform). */
  function currentAngle() {
    const m = getComputedStyle(wheel).transform.match(/matrix\(([^,]+),\s*([^,]+)/);
    return m ? (Math.atan2(Number(m[2]), Number(m[1])) * 180) / Math.PI : 0;
  }
  // клацання щоразу, як під стрілкою новий сектор
  function track(last) {
    if (!spinning) return;
    const now = sectorAt(currentAngle(), items.length);
    if (now !== last) playSfx('click', { enabled: sounds });
    frame = requestAnimationFrame(() => track(now));
  }

  function spin() {
    if (spinning || !items.length) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const style = pickSpin();
    const i = Math.min(items.length - 1, Math.floor(Math.random() * items.length));
    spinning = true; landed = null;
    ms = reduce ? 0 : style.ms; ease = style.ease;
    angle = spinTarget(angle, i, items.length, style);
    if (!reduce && sounds) frame = requestAnimationFrame(() => track(sectorAt(currentAngle(), items.length)));
    timers.push(setTimeout(() => {
      spinning = false; cancelAnimationFrame(frame);
      landed = items[i];
      // мить, щоб побачити, де зупинилось, — і відкривається картка
      // якщо картка чомусь не відкрилась (екран лишився), колесо знову можна крутити
      timers.push(setTimeout(() => { onland(items[i].id); landed = null; }, reduce ? 250 : 800));
    }, ms));
  }

  onDestroy(() => { timers.forEach(clearTimeout); cancelAnimationFrame(frame); });
</script>

<div class="wrap">
  <div class="pin" aria-hidden="true"></div>
  <button class="wheel" bind:this={wheel} onclick={spin} disabled={spinning || !!landed}
    aria-label={t('wheel.label', { list: items.map((c) => c.title).join(', ') })}
    style="background: conic-gradient({conic}); transform: rotate({angle}deg); transition: transform {ms}ms {ease}" data-angle={angle}>
    {#each items as c, i (c.id)}
      <span class="lbl" style="transform: rotate({i * step + step / 2}deg)" aria-hidden="true"><span>{c.emoji}</span></span>
    {/each}
  </button>
  <span class="hub" aria-hidden="true">🎯</span>
</div>

<p class="landed" aria-live="polite">{landed ? t('wheel.landed', { title: `${landed.emoji} ${landed.title}` }) : ' '}</p>
<button class="chunky go" onclick={spin} disabled={spinning || !!landed}>{spinning ? t('wheel.spinning') : t('wheel.spin')}</button>

<style>
  .wrap { position: relative; width: min(300px, 80vw); aspect-ratio: 1; margin: 18px auto 6px; }
  .wheel {
    position: absolute; inset: 0; padding: 0; border-radius: 50%; border: 8px solid #fff;
    box-shadow: 0 8px 0 rgba(0, 0, 0, .12), 0 16px 30px rgba(0, 0, 0, .15), inset 0 0 0 2px rgba(0, 0, 0, .06);
  }
  .wheel:disabled { cursor: default; }
  .lbl { position: absolute; inset: 0; pointer-events: none; }
  .lbl span { position: absolute; top: 7%; left: 50%; translate: -50% 0; font-size: clamp(20px, 7.5vw, 28px); line-height: 1; filter: drop-shadow(0 2px 0 rgba(0, 0, 0, .15)); }
  .pin {
    position: absolute; left: 50%; top: -14px; translate: -50% 0; z-index: 2; width: 0; height: 0;
    border-left: 16px solid transparent; border-right: 16px solid transparent; border-top: 30px solid var(--ink);
    filter: drop-shadow(0 3px 0 rgba(0, 0, 0, .2));
  }
  .hub {
    position: absolute; left: 50%; top: 50%; translate: -50% -50%; width: 22%; aspect-ratio: 1; border-radius: 50%; pointer-events: none;
    background: #fff; display: grid; place-items: center; font-size: clamp(20px, 7vw, 28px); box-shadow: 0 4px 0 rgba(0, 0, 0, .12);
  }
  .landed { margin: 10px 0 12px; text-align: center; font-weight: 900; font-size: 22px; min-height: 30px; }
  .go { display: block; width: 100%; }
</style>

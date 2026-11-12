<script>
  import { remaining, total } from '../lib/state.js';
  import { categoryColor } from '../lib/theme.js';
  import { t } from '../lib/lang.svelte.js';
  import Wheel from '../components/Wheel.svelte';

  // mode: 'tiles' — плитки, 'wheel' — колесо; onrandom — «🎲 Випадкове», onwheel(id) — колесо зупинилось
  let { categories, game, mode = 'tiles', sounds = true, onpick, onrandom, onwheel, onmode } = $props();
  // Категорії без питань після фільтра аудиторії не показуємо.
  const visible = $derived(categories.filter((c) => total(game, c.id)));
  // на колесі — лише ті, де ще є карти
  const wheelItems = $derived(visible.filter((c) => remaining(game, c.id)).map((c) => ({ id: c.id, emoji: c.emoji, title: c.title, color: categoryColor(c.id, categories.indexOf(c))[0] })));
</script>

<div class="head">
  <h1 class="lead">{mode === 'wheel' ? t('wheel.title') : t('cats.title')}</h1>
  <div class="seg" role="radiogroup" aria-label={t('cats.mode')}>
    {#each ['tiles', 'wheel'] as m}
      <button role="radio" aria-checked={mode === m} class:on={mode === m} onclick={() => onmode(m)} aria-label={t(`cats.${m}`)} title={t(`cats.${m}`)}>
        {t(`cats.${m}`).split(' ')[0]}
      </button>
    {/each}
  </div>
</div>

{#if mode === 'wheel'}
  <Wheel items={wheelItems} {sounds} onland={onwheel} />
{:else}
  <div class="grid">
    {#each visible as c, k (c.id)}
      {@const left = remaining(game, c.id)}
      {@const all = total(game, c.id)}
      {@const [c1, c2, ink] = categoryColor(c.id, categories.indexOf(c))}
      <button class="cat" class:done={!left} disabled={!left} onclick={() => onpick(c.id)}
        style="--c1:{c1}; --c2:{c2}; --t:{ink}; animation-delay:{k * 35}ms" aria-label="{c.title}. {left ? t('cats.left', { n: left }) : t('cats.doneLabel')}">
        <span class="row" aria-hidden="true"><span class="emoji">{c.emoji}</span><span class="left">{left || '✓'}</span></span>
        <span class="title">{c.title}</span>
        <span class="meter" aria-hidden="true"><i style="width:{(left / all) * 100}%"></i></span>
      </button>
    {/each}
  </div>
  <button class="chunky random" onclick={onrandom} disabled={!wheelItems.length}>{t('cats.random')}</button>
{/if}

<style>
  .head { display: flex; align-items: center; gap: 10px; margin: 0 0 12px 4px; }
  .lead { flex: 1; margin: 0; font-size: 24px; font-weight: 900; line-height: 1.1; }
  .seg { flex: none; display: flex; background: var(--soft); border-radius: 14px; padding: 4px; gap: 4px; }
  .seg button { border: none; background: none; min-width: 48px; min-height: 40px; border-radius: 11px; font-size: 22px; line-height: 1; opacity: .55; }
  .seg button.on { background: var(--card); box-shadow: 0 3px 0 var(--line); opacity: 1; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .cat {
    position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; text-align: left; min-width: 0;
    border: none; border-radius: 22px; padding: 9px 9px 10px; min-height: 100px; color: var(--t);
    background:
      radial-gradient(circle at 110% -10%, rgba(255, 255, 255, .35) 0 40px, transparent 41px),
      radial-gradient(circle at -20% 120%, rgba(0, 0, 0, .12) 0 50px, transparent 51px),
      linear-gradient(160deg, var(--c1), var(--c2));
    box-shadow: 0 5px 0 color-mix(in srgb, var(--c2) 70%, #000), 0 10px 20px color-mix(in srgb, var(--c2) 30%, transparent);
    animation: rise .4s cubic-bezier(.2, 1.4, .4, 1) both; transition: transform .08s;
  }
  .cat:active:not(:disabled) { transform: translateY(4px) scale(.97); }
  @keyframes rise { from { transform: translateY(16px) scale(.94); opacity: 0; } }
  .emoji {
    font-size: 20px; line-height: 1; width: 34px; height: 34px; display: grid; place-items: center;
    background: rgba(255, 255, 255, .95); border-radius: 12px; box-shadow: 0 3px 0 rgba(0, 0, 0, .12);
  }
  .row { display: flex; align-items: flex-start; justify-content: space-between; width: 100%; margin-bottom: 2px; }
  .title { flex: 1; font-weight: 900; font-size: 14.5px; line-height: 1.12; overflow-wrap: break-word; hyphens: auto; }
  .meter { width: 100%; height: 6px; background: rgba(0, 0, 0, .18); border-radius: 6px; overflow: hidden; margin-top: 4px; }
  .meter i { display: block; height: 100%; background: #fff; border-radius: 6px; box-shadow: 0 1px 2px rgba(0, 0, 0, .15); }
  .left { font-size: 13px; font-weight: 900; padding: 2px 7px; border-radius: 10px; background: rgba(255, 255, 255, .28); }
  .done { filter: grayscale(.85); opacity: .55; box-shadow: none; }
  .random { display: block; width: 100%; margin-top: 14px; }
  @media (max-width: 350px) { .grid { grid-template-columns: repeat(2, 1fr); } }
</style>

<script>
  import { remaining, total } from '../lib/state.js';
  import { categoryColor } from '../lib/theme.js';

  let { categories, game, onpick } = $props();
  // Категорії без питань після фільтра аудиторії не показуємо.
  const visible = $derived(categories.filter((c) => total(game, c.id)));
</script>

<h1 class="lead">Вибери категорію</h1>

{#if game.restarted?.length}
  {@const names = categories.filter((c) => game.restarted.includes(c.id)).map((c) => `«${c.title}»`)}
  <p class="again" role="status">🔁 {names.join(', ')}: усі питання вже були в минулих іграх — граємо їх по колу знову.</p>
{/if}

<div class="grid">
  {#each visible as c, k (c.id)}
    {@const left = remaining(game, c.id)}
    {@const all = total(game, c.id)}
    {@const [c1, c2, t] = categoryColor(c.id, categories.indexOf(c))}
    <button class="cat" class:done={!left} disabled={!left} onclick={() => onpick(c.id)}
      style="--c1:{c1}; --c2:{c2}; --t:{t}; animation-delay:{k * 40}ms" aria-label="{c.title}. {left ? `Залишилось ${left}` : 'Пройдено'}">
      <span class="emoji" aria-hidden="true">{c.emoji}</span>
      <span class="title">{c.title}</span>
      <span class="desc">{c.description}</span>
      <span class="meter" aria-hidden="true"><i style="width:{(left / all) * 100}%"></i></span>
      <span class="left">{left ? `${left} з ${all}` : 'пройдено ✓'}</span>
    </button>
  {/each}
</div>

<style>
  .lead { margin: 0 0 12px 4px; font-size: 24px; font-weight: 900; }
  .again { margin: 0 0 12px; padding: 10px 14px; border-radius: 16px; background: var(--card); border: 2px solid var(--line); font-weight: 800; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .cat {
    position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left;
    border: none; border-radius: 26px; padding: 14px 14px 12px; min-height: 176px; color: var(--t);
    background:
      radial-gradient(circle at 110% -10%, rgba(255, 255, 255, .35) 0 60px, transparent 61px),
      radial-gradient(circle at -20% 120%, rgba(0, 0, 0, .12) 0 70px, transparent 71px),
      linear-gradient(160deg, var(--c1), var(--c2));
    box-shadow: 0 6px 0 color-mix(in srgb, var(--c2) 70%, #000), 0 12px 24px color-mix(in srgb, var(--c2) 35%, transparent);
    animation: rise .4s cubic-bezier(.2, 1.4, .4, 1) both; transition: transform .08s;
  }
  .cat:active:not(:disabled) { transform: translateY(4px) scale(.98); }
  @keyframes rise { from { transform: translateY(16px) scale(.94); opacity: 0; } }
  .emoji {
    font-size: 30px; line-height: 1; width: 54px; height: 54px; display: grid; place-items: center;
    background: rgba(255, 255, 255, .95); border-radius: 18px; box-shadow: 0 4px 0 rgba(0, 0, 0, .12); margin-bottom: 6px;
  }
  .title { font-weight: 900; font-size: 19px; line-height: 1.15; }
  .desc { font-size: 13px; line-height: 1.3; flex: 1; font-weight: 700; }
  .meter { width: 100%; height: 8px; background: rgba(0, 0, 0, .18); border-radius: 6px; overflow: hidden; margin-top: 6px; }
  .meter i { display: block; height: 100%; background: #fff; border-radius: 6px; box-shadow: 0 1px 2px rgba(0, 0, 0, .15); }
  .left { font-size: 13px; font-weight: 900; }
  .done { filter: grayscale(.85); opacity: .55; box-shadow: none; }
  @media (max-width: 340px) { .grid { grid-template-columns: 1fr; } .cat { min-height: 0; } }
</style>

<script>
  import { isUsed, questionAt, remaining, total } from '../lib/state.js';
  import { categoryColor } from '../lib/theme.js';
  import QuestionCard from '../components/QuestionCard.svelte';

  // selected піднято в App: відкрита картка переживає перезавантаження сторінки
  let { category, index = 0, game, players, byId, scoringCategories, sound, selected = $bindable(), onfinish } = $props();

  const all = $derived(total(game, category.id));
  const numbers = $derived(Array.from({ length: all }, (_, k) => k + 1));
  const question = $derived(selected ? byId.get(questionAt(game, category.id, selected)) : null);
  const [c1, c2] = $derived(categoryColor(category.id, index));
  let flipping = $state(null);

  function choose(num) {
    if (flipping || selected) return;
    flipping = num;
    // коротка анімація перевороту карти, потім відкривається велика картка
    setTimeout(() => { selected = num; flipping = null; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420);
  }
</script>

<header style="--c1:{c1}; --c2:{c2}">
  <span class="emoji" aria-hidden="true">{category.emoji}</span>
  <div>
    <h1>{category.title}</h1>
    <p>Тягни будь-яку карту · залишилось <b>{remaining(game, category.id)}</b> з {all}</p>
  </div>
</header>

<div class="deck" role="group" aria-label="Карти категорії «{category.title}»" style="--c1:{c1}; --c2:{c2}">
  {#each numbers as n}
    {@const used = isUsed(game, category.id, n)}
    <button class="card" class:used class:flip={flipping === n} disabled={used || !!flipping}
      aria-label={used ? `Карта ${n}, вже була` : `Карта ${n}`} onclick={() => choose(n)} style="animation-delay:{(n % 10) * 25}ms">
      <span class="inner">
        <span class="back"><span class="num">{n}</span></span>
        <span class="face">{used ? '✓' : '?'}</span>
      </span>
    </button>
  {/each}
</div>

{#if question}
  {#key selected}
    <QuestionCard {question} {category} colors={[c1, c2]} number={selected} {game} {players} {sound}
      scoring={game.scoring && scoringCategories.includes(category.id)}
      onfinish={(outcome, answerer) => onfinish(selected, outcome, answerer)} />
  {/key}
{/if}

<style>
  header {
    display: flex; gap: 14px; align-items: center; margin-bottom: 14px; padding: 14px; border-radius: 24px; color: #fff;
    background: radial-gradient(circle at 100% 0, rgba(255, 255, 255, .3) 0 50px, transparent 51px), linear-gradient(150deg, var(--c1), var(--c2));
    box-shadow: 0 5px 0 color-mix(in srgb, var(--c2) 70%, #000);
  }
  .emoji { font-size: 32px; width: 58px; height: 58px; flex: none; display: grid; place-items: center; background: #fff; border-radius: 18px; box-shadow: 0 4px 0 rgba(0, 0, 0, .12); }
  h1 { font-size: 24px; margin: 0; font-weight: 900; line-height: 1.1; }
  header p { margin: 3px 0 0; font-size: 14px; opacity: .95; }
  .deck { display: grid; grid-template-columns: repeat(5, 1fr); gap: 9px; perspective: 900px; }
  .card { aspect-ratio: 3 / 4; padding: 0; border: none; background: none; animation: deal .35s cubic-bezier(.2, 1.4, .4, 1) both; }
  @keyframes deal { from { transform: translateY(-14px) rotate(-6deg); opacity: 0; } }
  .inner { position: relative; display: block; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform .42s cubic-bezier(.3, 1.3, .5, 1); }
  .back, .face { position: absolute; inset: 0; border-radius: 14px; backface-visibility: hidden; display: grid; place-items: center; }
  .back {
    background:
      repeating-linear-gradient(45deg, rgba(255, 255, 255, .16) 0 6px, transparent 6px 12px),
      linear-gradient(160deg, var(--c1), var(--c2));
    box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .55), 0 4px 0 color-mix(in srgb, var(--c2) 70%, #000);
  }
  .num {
    min-width: 34px; height: 34px; padding: 0 4px; border-radius: 12px; background: #fff; color: var(--c2);
    font-weight: 900; font-size: 18px; display: grid; place-items: center; box-shadow: 0 2px 0 rgba(0, 0, 0, .15);
  }
  .face { transform: rotateY(180deg); background: var(--card); color: var(--c2); font-size: 26px; font-weight: 900; box-shadow: inset 0 0 0 3px var(--c1); }
  .card:active:not(:disabled) .inner { transform: translateY(3px); }
  .card.flip .inner { transform: rotateY(180deg) scale(1.12); }
  .card.used .inner { transform: rotateY(180deg); }
  .card.used .face { opacity: .45; box-shadow: inset 0 0 0 2px var(--line); color: var(--dim); }
  @media (max-width: 340px) { .deck { gap: 6px; } .num { min-width: 28px; height: 28px; font-size: 15px; } }
</style>

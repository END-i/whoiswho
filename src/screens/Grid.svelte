<script>
  import { isUsed, questionAt, remaining, total } from '../lib/state.js';
  import { categoryColor } from '../lib/theme.js';
  import { t } from '../lib/lang.svelte.js';
  import QuestionCard from '../components/QuestionCard.svelte';
  import { preloadQuestion, questionAudio } from '../lib/speech.js';
  import { untrack } from 'svelte';

  // selected піднято в App: відкрита картка переживає перезавантаження сторінки
  let { category, index = 0, game, players, byId, scoringCategories, sound, roleNames = {}, favorites = [], onlike = () => {}, selected = $bindable(), pending = $bindable(null), onfinish } = $props();

  const all = $derived(total(game, category.id));
  const numbers = $derived(Array.from({ length: all }, (_, k) => k + 1));
  const question = $derived(selected ? byId.get(questionAt(game, category.id, selected)) : null);
  const [c1, c2, ink] = $derived(categoryColor(category.id, index));
  let flipping = $state(null);

  function choose(num) {
    if (flipping || selected) return;
    flipping = num;
    // озвучку питання починаємо качати вже зараз — поки карта перевертається (лише якщо картка читатиме сама)
    if (sound?.auto) preloadQuestion(questionAt(game, category.id, num), { ...sound, base: import.meta.env.BASE_URL, makeAudio: (url) => questionAudio(url) });
    // коротка анімація перевороту карти, потім відкривається велика картка
    setTimeout(() => { selected = num; flipping = null; }, reduced() ? 0 : 420);
  }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // «🎲 Випадкове» чи колесо: карту вибрала гра — показуємо її в сітці й перевертаємо сама
  let deckEl;
  $effect(() => {
    if (!pending) return;
    const num = pending;
    pending = null;
    untrack(() => {
      deckEl?.querySelector(`[data-n="${num}"]`)?.scrollIntoView?.({ block: 'center', behavior: reduced() ? 'instant' : 'smooth' });
      setTimeout(() => choose(num), reduced() ? 0 : 450);
    });
  });
  // трохи нахилені, як справжній стос; нахил сталий для номера
  const tilt = (n) => (((n * 7919) % 7) - 3) * 0.9;
</script>

<header style="--c1:{c1}; --c2:{c2}; --t:{ink}">
  <span class="emoji" aria-hidden="true">{category.emoji}</span>
  <div>
    <h1>{category.title}</h1>
    {#if category.description}<p class="about">{category.description}</p>{/if}
    <p class="count">{t('grid.pick')} <b>{remaining(game, category.id)}</b> {t('grid.of', { n: all })}</p>
  </div>
</header>

<div class="deck" bind:this={deckEl} role="group" aria-label={t('grid.deck', { title: category.title })} style="--c1:{c1}; --c2:{c2}">
  {#each numbers as n}
    {@const used = isUsed(game, category.id, n)}
    <button class="card" class:used class:flip={flipping === n} disabled={used || !!flipping}
      aria-label={used ? t('grid.cardUsed', { n }) : t('grid.card', { n })} onclick={() => choose(n)} data-n={n} style="--r:{tilt(n)}deg; animation-delay:{(n % 10) * 25}ms">
      <span class="inner">
        <span class="back"><span class="mark" aria-hidden="true">{category.emoji}</span><span class="num">{n}</span></span>
        <span class="face">{used ? '✓' : '?'}</span>
      </span>
    </button>
  {/each}
</div>

{#if question}
  {#key selected}
    <QuestionCard {question} {category} colors={[c1, c2, ink]} number={selected} {game} {players} {sound} {roleNames}
      liked={favorites.includes(question.id)} onlike={() => onlike(question.id)}
      scoring={game.scoring && scoringCategories.includes(category.id)}
      onfinish={(outcome, answerer, points) => onfinish(selected, outcome, answerer, points)} />
  {/key}
{/if}

<style>
  header {
    display: flex; gap: 14px; align-items: center; margin-bottom: 16px; padding: 14px; border-radius: 24px; color: var(--t);
    background: radial-gradient(circle at 100% 0, rgba(255, 255, 255, .3) 0 50px, transparent 51px), linear-gradient(150deg, var(--c1), var(--c2));
    box-shadow: 0 5px 0 color-mix(in srgb, var(--c2) 70%, #000);
  }
  .emoji { font-size: 32px; width: 58px; height: 58px; flex: none; display: grid; place-items: center; background: #fff; border-radius: 18px; box-shadow: 0 4px 0 rgba(0, 0, 0, .12); }
  h1 { font-size: 24px; margin: 0; font-weight: 900; line-height: 1.1; }
  header p { margin: 3px 0 0; font-size: 14px; }
  header .about { font-weight: 800; line-height: 1.25; }
  .deck { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px 9px; perspective: 900px; padding: 2px; }
  .card { aspect-ratio: 3 / 4; padding: 0; border: none; background: none; transform: rotate(var(--r)); animation: deal .4s cubic-bezier(.2, 1.4, .4, 1) both; }
  @keyframes deal { from { transform: translateY(-18px) rotate(calc(var(--r) * -4)); opacity: 0; } }
  .inner { position: relative; display: block; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform .42s cubic-bezier(.3, 1.3, .5, 1); }
  .back, .face { position: absolute; inset: 0; border-radius: 14px; backface-visibility: hidden; display: grid; place-items: center; overflow: hidden; }
  .back {
    background:
      radial-gradient(circle at 50% 50%, rgba(255, 255, 255, .22) 0 38%, transparent 39%),
      repeating-linear-gradient(45deg, rgba(255, 255, 255, .13) 0 5px, transparent 5px 10px),
      linear-gradient(160deg, var(--c1), var(--c2));
    box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .6), inset 0 0 0 5px color-mix(in srgb, var(--c2) 60%, transparent), 0 4px 0 color-mix(in srgb, var(--c2) 70%, #000);
  }
  .mark { font-size: clamp(20px, 6.5vw, 30px); line-height: 1; filter: drop-shadow(0 2px 0 rgba(0, 0, 0, .15)); }
  .num {
    position: absolute; left: 5px; top: 5px; min-width: 24px; height: 22px; padding: 0 4px; border-radius: 8px; background: #fff; color: #2D1B3D;
    font-weight: 900; font-size: 14px; display: grid; place-items: center; box-shadow: 0 2px 0 rgba(0, 0, 0, .15);
  }
  .face { transform: rotateY(180deg); background: var(--card); color: var(--c2); font-size: 26px; font-weight: 900; box-shadow: inset 0 0 0 3px var(--c1); }
  .card:active:not(:disabled) .inner { transform: translateY(3px); }
  .card.flip { z-index: 2; }
  .card.flip .inner { transform: rotateY(180deg) scale(1.15); }
  .card.used { transform: none; }
  .card.used .inner { transform: rotateY(180deg) scale(.9); }
  .card.used .face { opacity: .4; box-shadow: inset 0 0 0 2px var(--line); color: var(--dim); font-size: 20px; }
  @media (max-width: 340px) { .deck { gap: 7px 6px; } .num { min-width: 20px; height: 19px; font-size: 12px; } }
</style>

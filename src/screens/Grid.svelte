<script>
  import { isUsed, questionAt, remaining } from '../lib/state.js';
  import QuestionCard from '../components/QuestionCard.svelte';

  // selected піднято в App, щоб верхня панель могла блокувати «назад», поки картка відкрита
  let { category, game, players, byId, scoringCategories, selected = $bindable(), onfinish } = $props();

  const total = $derived(game.deck[category.id]?.length || 0);
  const numbers = $derived(Array.from({ length: total }, (_, k) => k + 1));
  const question = $derived(selected ? byId.get(questionAt(game, category.id, selected)) : null);

  function choose(num) {
    selected = num;
    requestAnimationFrame(() => document.getElementById('card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  function finish(outcome, answerer) {
    onfinish(selected, outcome, answerer);
    selected = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
</script>

<h1><span aria-hidden="true">{category.emoji}</span> {category.title}</h1>
<p class="sub">Вибери будь-який номер · залишилось {remaining(game, category.id)} з {total}</p>

<div class="numbers" role="group" aria-label="Номери карток">
  {#each numbers as n}
    {@const used = isUsed(game, category.id, n)}
    <button class="num" class:used class:sel={selected === n} disabled={used || (selected && selected !== n)}
      aria-label={used ? `Картка ${n}, вже була` : `Картка ${n}`} onclick={() => choose(n)}>{n}</button>
  {/each}
</div>

{#if question}
  <div id="card">
    {#key selected}
      <QuestionCard {question} {game} {players} scoring={game.scoring && scoringCategories.includes(category.id)} onfinish={finish} />
    {/key}
  </div>
{/if}

<style>
  h1 { font-size: 22px; margin: 0; }
  .sub { margin: 2px 0 12px; color: var(--dim); font-size: 14px; }
  .numbers { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .num { aspect-ratio: 1; min-height: 48px; border-radius: 14px; border: 2px solid var(--line); background: var(--card); font-size: 20px; font-weight: 800; }
  .num:active { transform: scale(.95); }
  .num.sel { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
  .num.used { background: var(--used); color: var(--dim); text-decoration: line-through; opacity: .55; }
  .num:disabled:not(.used):not(.sel) { opacity: .45; }
  #card { margin-top: 16px; scroll-margin-top: 12px; }
</style>

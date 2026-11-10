<script>
  import { isUsed, questionAt, remaining } from '../lib/state.js';
  import QuestionCard from '../components/QuestionCard.svelte';

  let { category, game, byId, scoringCategories, onback, onfinish } = $props();
  let selected = $state(null);

  const total = $derived(game.deck[category.id]?.length || 0);
  const numbers = $derived(Array.from({ length: total }, (_, k) => k + 1));
  const question = $derived(selected ? byId.get(questionAt(game, category.id, selected)) : null);

  function choose(num) {
    selected = num;
    // Прокрутити до картки, щоб на телефоні її було видно одразу.
    requestAnimationFrame(() => document.getElementById('card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  function finish(outcome) {
    onfinish(selected, outcome);
    selected = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
</script>

<header>
  <button class="back" onclick={onback} disabled={!!selected} aria-label="До категорій">←</button>
  <div>
    <h1><span aria-hidden="true">{category.emoji}</span> {category.title}</h1>
    <p>Хід: <b>{game.players[game.turn]}</b> · залишилось {remaining(game, category.id)} з {total}</p>
  </div>
</header>

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
      <QuestionCard {question} {game} scoring={game.scoring && scoringCategories.includes(category.id)}
        onfinish={finish} />
    {/key}
  </div>
{/if}

<style>
  header { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; }
  .back:disabled { opacity: .35; }
  .back { width: 48px; height: 48px; flex: none; border-radius: 14px; border: 2px solid var(--line); background: var(--card); font-size: 22px; }
  h1 { font-size: 22px; margin: 0; }
  header p { margin: 2px 0 0; color: var(--dim); font-size: 14px; }
  header b { color: var(--ink); }
  .numbers { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .num {
    aspect-ratio: 1; min-height: 48px; border-radius: 14px; border: 2px solid var(--line);
    background: var(--card); font-size: 20px; font-weight: 800;
  }
  .num:active { transform: scale(.95); }
  .num.sel { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
  .num.used { background: var(--used); color: var(--dim); text-decoration: line-through; opacity: .55; }
  .num:disabled:not(.used):not(.sel) { opacity: .45; }
  #card { margin-top: 16px; scroll-margin-top: 12px; }
</style>

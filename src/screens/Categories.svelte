<script>
  import { remaining } from '../lib/state.js';

  let { title, categories, game, onpick } = $props();
  // Категорії без питань після фільтра аудиторії не показуємо.
  const visible = $derived(categories.filter((c) => game.deck[c.id]?.length));
</script>

<header>
  <h1>{title}</h1>
  <p class="turn">Хід: <b>{game.players[game.turn]}</b> — вибирай категорію</p>
</header>

<div class="grid">
  {#each visible as c (c.id)}
    {@const left = remaining(game, c.id)}
    <button class="cat" class:done={!left} disabled={!left} onclick={() => onpick(c.id)}>
      <span class="emoji" aria-hidden="true">{c.emoji}</span>
      <span class="title">{c.title}</span>
      <span class="desc">{c.description}</span>
      <span class="left">{left ? `залишилось ${left}` : 'пройдено ✓'}</span>
    </button>
  {/each}
</div>

<style>
  header { margin-bottom: 14px; }
  h1 { font-size: 28px; margin: 0; }
  .turn { margin: 4px 0 0; color: var(--dim); }
  .turn b { color: var(--ink); }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .cat {
    display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left;
    background: var(--card); border: 2px solid var(--line); border-radius: var(--radius);
    padding: 14px 12px; min-height: 150px;
    transition: transform .1s;
  }
  .cat:active { transform: scale(.97); }
  .emoji { font-size: 34px; line-height: 1; }
  .title { font-weight: 800; font-size: 17px; line-height: 1.2; }
  .desc { font-size: 13px; color: var(--dim); line-height: 1.3; flex: 1; }
  .left { font-size: 12px; font-weight: 700; color: var(--accent); background: var(--soft); padding: 3px 8px; border-radius: 10px; }
  .done { opacity: .5; }
  .done .left { color: var(--dim); }
  @media (max-width: 340px) { .grid { grid-template-columns: 1fr; } .cat { min-height: 0; } }
</style>

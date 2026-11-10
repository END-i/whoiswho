<script>
  import raw from './data/questions.json';
  import { load, byAudience } from './lib/questions.js';
  import { newGame, finishCard } from './lib/state.js';
  import Categories from './screens/Categories.svelte';
  import Grid from './screens/Grid.svelte';

  let data = null;
  let errors = [];
  try { data = load(raw); } catch (e) { errors = e.errors || [e.message]; }

  // Прототип: гравці поки що фіксовані, екран налаштувань з'явиться на кроці 4.
  const DEMO_PLAYERS = ['Оля', 'Тарас', 'Мама', 'Тато'];
  const byId = new Map(data ? data.questions.map((q) => [q.id, q]) : []);

  let game = $state(data ? newGame({ players: DEMO_PLAYERS, questions: byAudience(data.questions, 'family') }) : null);
  let catId = $state(null);
  const category = $derived(data?.categories.find((c) => c.id === catId));
</script>

<main>
  {#if errors.length}
    <section class="errors">
      <h1>Помилка у questions.json</h1>
      <ul>{#each errors as e}<li>{e}</li>{/each}</ul>
    </section>
  {:else if category}
    <Grid {category} {game} {byId} scoringCategories={data.meta.scoringCategories}
      onback={() => (catId = null)}
      onfinish={(num, outcome) => (game = finishCard(game, catId, num, outcome))} />
  {:else}
    <Categories title={data.meta.title} categories={data.categories} {game} onpick={(id) => (catId = id)} />
    <label class="proto">
      <input type="checkbox" bind:checked={game.scoring} /> Прототип: режим з балами (на кроці 4 — у налаштуваннях)
    </label>
  {/if}
</main>

<style>
  :global(:root) {
    --bg: #fff8ef; --card: #ffffff; --ink: #3b2a1e; --dim: #8a7565; --line: #f0dcc6;
    --accent: #ff8a3d; --accent-ink: #fff; --soft: #ffe9d4; --ok: #3fae6a; --no: #e25b5b; --used: #efe4d8;
    --radius: 18px;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --bg: #1d1714; --card: #2a211c; --ink: #f7ece2; --dim: #b39f90; --line: #3d3029;
      --accent: #ff9a52; --accent-ink: #1d1714; --soft: #3a2a20; --used: #241d19;
      color-scheme: dark;
    }
  }
  :global(*) { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  :global(body) {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 17px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  :global(button) { font: inherit; color: inherit; cursor: pointer; touch-action: manipulation; }
  main {
    max-width: 560px; margin: 0 auto;
    padding: calc(env(safe-area-inset-top, 0px) + 14px) 14px calc(env(safe-area-inset-bottom, 0px) + 24px);
  }
  .proto { display: flex; gap: 8px; align-items: center; margin-top: 18px; font-size: 13px; color: var(--dim); }
  .errors { background: var(--card); border: 2px solid var(--no); border-radius: var(--radius); padding: 16px; }
  .errors h1 { font-size: 20px; margin: 0 0 8px; }
</style>

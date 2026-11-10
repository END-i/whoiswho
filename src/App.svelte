<script>
  import raw from './data/questions.json';
  import { load, byAudience } from './lib/questions.js';
  import { newGame, finishCard, remaining } from './lib/state.js';
  import Setup from './screens/Setup.svelte';
  import Rules from './screens/Rules.svelte';
  import Categories from './screens/Categories.svelte';
  import Grid from './screens/Grid.svelte';
  import Summary from './screens/Summary.svelte';
  import TopBar from './components/TopBar.svelte';
  import Sheet from './components/Sheet.svelte';
  import Avatar from './components/Avatar.svelte';

  // Питання читаються один раз під час старту; реактивність тут не потрібна.
  const { data, errors } = (() => {
    try { return { data: load(raw), errors: [] }; }
    catch (e) { return { data: null, errors: e.errors || [e.message] }; }
  })();
  const byId = new Map(data ? data.questions.map((q) => [q.id, q]) : []);

  // Прототип: стан живе в пам'яті. Збереження в localStorage — крок 3, фото в IndexedDB — крок 6.
  let players = $state(['Оля', 'Тарас', 'Мама', 'Тато'].map((name) => ({ name, photo: null, template: null })));
  let settings = $state({ audience: 'family', scoring: false });
  let game = $state(null);
  let screen = $state('setup');          // setup | rules | categories | grid | summary
  let rulesSeen = $state(false);
  let rulesFrom = $state(null);           // куди повернутися з правил, відкритих із меню
  let catId = $state(null);
  let selected = $state(null);
  let sheet = $state(null);               // null | 'menu' | 'scores'
  let toast = $state(null);
  let toastTimer;
  const category = $derived(data?.categories.find((c) => c.id === catId));

  function start() {
    if (!game) {
      game = newGame({
        players: players.map((p) => p.name.trim()), audience: settings.audience, scoring: settings.scoring,
        questions: byAudience(data.questions, settings.audience),
      });
      screen = rulesSeen ? 'categories' : 'rules';
    } else {
      game = { ...game, players: players.map((p) => p.name.trim()), scoring: settings.scoring };
      screen = catId ? 'grid' : 'categories';
    }
  }
  function finish(num, outcome, answerer) {
    game = finishCard(game, catId, num, outcome, answerer);
    if (outcome === 'correct') {
      toast = `+1 бал — ${players[answerer].name}`;
      clearTimeout(toastTimer); toastTimer = setTimeout(() => (toast = null), 1800);
    }
    if (!remaining(game, catId)) catId = null, screen = 'categories';
    if (data.categories.every((c) => !remaining(game, c.id))) screen = 'summary';
  }
  function newGameAsk() {
    if (game && !confirm('Почати нову гру? Поточні бали й використані картки скинуться.')) return;
    game = null; catId = null; selected = null; sheet = null; screen = 'setup';
  }
  function endAsk() {
    sheet = null;
    if (confirm('Завершити гру й подивитися підсумок?')) { selected = null; screen = 'summary'; }
  }
  const go = (s) => { sheet = null; screen = s; };
</script>

<main>
  {#if errors.length}
    <section class="errors">
      <h1>Помилка у questions.json</h1>
      <ul>{#each errors as e}<li>{e}</li>{/each}</ul>
    </section>
  {:else if screen === 'setup'}
    <Setup bind:players bind:settings inGame={!!game} onstart={start} />
  {:else if screen === 'rules'}
    <Rules rules={data.meta.rules} again={!!rulesFrom}
      onok={() => { rulesSeen = true; screen = rulesFrom || 'categories'; rulesFrom = null; }} />
  {:else if screen === 'summary'}
    <Summary {game} {players} onnew={newGameAsk}
      onback={data.categories.some((c) => remaining(game, c.id)) ? () => (screen = catId ? 'grid' : 'categories') : null} />
  {:else}
    <TopBar {players} {game} onmenu={() => (sheet = 'menu')} onscores={() => (sheet = 'scores')}
      back={screen === 'grid' ? { onclick: () => { catId = null; screen = 'categories'; }, disabled: !!selected } : null} />
    {#if screen === 'grid' && category}
      <Grid {category} {game} {players} {byId} scoringCategories={data.meta.scoringCategories} bind:selected onfinish={finish} />
    {:else}
      <Categories categories={data.categories} {game} onpick={(id) => { catId = id; screen = 'grid'; }} />
    {/if}
  {/if}
</main>

{#if toast}<div class="toast" role="status">🎉 {toast}</div>{/if}

{#if sheet === 'menu'}
  <Sheet title="Меню" onclose={() => (sheet = null)}>
    <nav class="menu">
      <button onclick={() => { rulesFrom = screen; go('rules'); }}>📜 Правила</button>
      <button onclick={() => go('setup')} disabled={!!selected}>👥 Гравці й налаштування</button>
      <button onclick={endAsk}>🏁 Завершити гру</button>
      <button class="danger" onclick={newGameAsk}>🔄 Нова гра</button>
    </nav>
    {#if selected}<p class="note">Спершу закрий відкриту картку.</p>{/if}
  </Sheet>
{:else if sheet === 'scores'}
  <Sheet title="Бали" onclose={() => (sheet = null)}>
    <ol class="scores">
      {#each players.map((p, i) => ({ p, s: game.scores[i] })).sort((a, b) => b.s - a.s) as row}
        <li><Avatar player={row.p} size={36} /><span>{row.p.name}</span><b>{row.s}</b></li>
      {/each}
    </ol>
  </Sheet>
{/if}

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
  :global(button:disabled) { cursor: default; }
  main {
    max-width: 560px; margin: 0 auto;
    padding: calc(env(safe-area-inset-top, 0px) + 14px) 14px calc(env(safe-area-inset-bottom, 0px) + 24px);
  }
  .toast { position: fixed; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 14px); transform: translateX(-50%); z-index: 20; background: var(--ok); color: #fff; font-weight: 800; padding: 10px 18px; border-radius: 20px; box-shadow: 0 6px 20px rgba(0,0,0,.2); animation: drop .3s ease-out; white-space: nowrap; }
  @keyframes drop { from { transform: translate(-50%, -30px); opacity: 0; } }
  .menu { display: flex; flex-direction: column; gap: 8px; }
  .menu button { min-height: 56px; border-radius: 16px; border: 2px solid var(--line); background: var(--card); font-weight: 700; font-size: 17px; text-align: left; padding: 0 16px; }
  .menu button:disabled { opacity: .45; }
  .menu .danger { color: var(--no); }
  .note { font-size: 13px; color: var(--dim); margin: 10px 0 0; }
  .scores { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .scores li { display: flex; align-items: center; gap: 10px; background: var(--card); border-radius: 14px; padding: 8px 12px; }
  .scores span { flex: 1; font-weight: 700; }
  .scores b { font-size: 20px; }
  .errors { background: var(--card); border: 2px solid var(--no); border-radius: var(--radius); padding: 16px; }
  .errors h1 { font-size: 20px; margin: 0 0 8px; }
</style>

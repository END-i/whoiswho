<script>
  import Avatar from './Avatar.svelte';
  import { roles } from '../lib/state.js';

  let { question, game, players, scoring, onfinish } = $props();

  const n = $derived(players.length);
  const i = $derived(game.turn);
  const base = $derived(roles(question, i, n));
  let picked = $state({ answerer: null, about: null });
  const answerer = $derived(base.answerer ?? picked.answerer);
  const about = $derived(question.about === 'answerer' ? answerer : (base.about ?? picked.about));
  // Що ще треба вибрати, перш ніж показати питання
  const need = $derived(question.type === 'who' ? null
    : answerer === null ? 'answerer' : about === null ? 'about' : null);
  const isGuess = $derived(question.type === 'guess' && answerer !== about);
  const showAbout = $derived(question.type !== 'who' && about !== null && about !== answerer);

  const oddOpposite = $derived(n % 2 === 1);
  function roleText(role) {
    switch (role) {
      case 'self': return 'той, чия черга';
      case 'left': return 'гравець ліворуч';
      case 'right': return 'гравець праворуч';
      case 'opposite': return oddOpposite ? 'навпроти нікого, тож гравець ліворуч' : 'гравець навпроти';
      case 'pick': return 'на твій вибір';
    }
  }
  const TYPE = { open: 'Розкажи', choice: 'Вибери', activity: 'Покажи', guess: 'Вгадай', who: 'Хто з нас?' };
</script>

<article class="card">
  <div class="top">
    <span class="badge">{TYPE[question.type]}</span>
    {#if scoring && isGuess}<span class="badge pts">+1 бал</span>{/if}
    <button class="listen" disabled title="Озвучка з'явиться на кроці 8">🔊 Прослухати</button>
  </div>

  {#if question.type === 'who'}
    <p class="all">👆 Усі разом: на рахунок «три» покажіть пальцем!</p>
  {:else if !need}
    <div class="people">
      <div class="who">
        <Avatar player={players[answerer]} size={40} />
        <span><small>Відповідає</small><b>{players[answerer].name}</b><em>{roleText(question.answerer)}</em></span>
      </div>
      {#if showAbout}
        <div class="who">
          <Avatar player={players[about]} size={40} />
          <span><small>Про кого</small><b>{players[about].name}</b><em>{roleText(question.about === 'answerer' ? question.answerer : question.about)}</em></span>
        </div>
      {/if}
    </div>
  {/if}

  {#if need}
    <p class="ask">{need === 'answerer' ? 'Хто відповідатиме?' : 'Про кого буде питання?'}</p>
    <div class="chips">
      {#each players as p, k}
        {#if k !== i && !(need === 'about' && k === answerer)}
          <button class="chip" onclick={() => (picked = { ...picked, [need]: k })}><Avatar player={p} size={32} />{p.name}</button>
        {/if}
      {/each}
    </div>
  {:else}
    <p class="q">{question.text}</p>

    {#if question.tip}
      <details class="tip"><summary>Підказка для дорослих</summary><p>{question.tip}</p></details>
    {/if}

    {#if scoring && isGuess}
      <p class="check">Перевіряє: <b>{players[about].name}</b></p>
    {/if}
    <div class="actions">
      {#if scoring && isGuess}
        <button class="btn ok" onclick={() => onfinish('correct', answerer)}>✅ Правильно</button>
        <button class="btn no" onclick={() => onfinish('wrong', answerer)}>❌ Неправильно</button>
      {:else}
        <button class="btn ok wide" onclick={() => onfinish('answered', answerer)}>{question.type === 'activity' ? 'Готово!' : question.type === 'who' ? 'Показали!' : 'Відповів(ла)'}</button>
      {/if}
      <button class="btn skip" onclick={() => onfinish('skipped', answerer)}>Пропустити</button>
    </div>
  {/if}
</article>

<style>
  .card {
    background: var(--card); border: 2px solid var(--accent); border-radius: 22px; padding: 16px;
    box-shadow: 0 8px 24px rgba(255, 138, 61, .18); animation: pop .25s ease-out;
  }
  @keyframes pop { from { transform: scale(.94); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .card { animation: none; } }
  .top { display: flex; gap: 6px; align-items: center; margin-bottom: 12px; }
  .badge { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; background: var(--soft); color: var(--accent); padding: 4px 9px; border-radius: 10px; }
  .badge.pts { background: var(--ok); color: #fff; }
  .listen { margin-left: auto; border: 2px solid var(--line); background: var(--card); border-radius: 12px; min-height: 36px; padding: 0 10px; font-size: 13px; font-weight: 700; }
  .listen:disabled { opacity: .45; }
  .people { display: flex; flex-direction: column; gap: 8px; margin-bottom: 4px; }
  .who { display: flex; gap: 10px; align-items: center; }
  .who span { display: flex; flex-direction: column; line-height: 1.15; }
  .who small { font-size: 12px; color: var(--dim); }
  .who b { font-size: 17px; }
  .who em { font-style: normal; font-size: 13px; color: var(--accent); font-weight: 700; }
  .all { font-weight: 700; margin: 0 0 4px; }
  .ask { font-weight: 800; font-size: 18px; margin: 4px 0 10px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 0 14px 0 8px; border-radius: 16px; border: 2px solid var(--line); background: var(--soft); font-weight: 700; }
  .q { font-size: clamp(22px, 6vw, 28px); font-weight: 700; line-height: 1.3; margin: 12px 0 14px; }
  .tip { background: var(--soft); border-radius: 14px; padding: 10px 12px; margin-bottom: 14px; font-size: 15px; }
  .tip summary { font-weight: 700; cursor: pointer; min-height: 28px; }
  .tip p { margin: 8px 0 0; }
  .check { font-weight: 700; margin: 0 0 8px; color: var(--dim); }
  .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .btn { min-height: 54px; border-radius: 16px; border: none; font-weight: 800; font-size: 17px; }
  .btn.ok { background: var(--ok); color: #fff; }
  .btn.no { background: var(--no); color: #fff; }
  .btn.wide, .btn.skip { grid-column: 1 / -1; }
  .btn.skip { background: var(--used); color: var(--ink); }
</style>

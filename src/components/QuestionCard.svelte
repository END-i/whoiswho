<script>
  import { roles, fillText } from '../lib/state.js';

  let { question, game, scoring, onfinish } = $props();

  const n = $derived(game.players.length);
  const i = $derived(game.turn);
  const base = $derived(roles(question, i, n));
  // Вибір для pick (null — ще не вибрали)
  let picked = $state({ answerer: null, about: null });
  const answerer = $derived(base.answerer ?? picked.answerer);
  const about = $derived(question.about === 'answerer' ? answerer : (base.about ?? picked.about));
  const need = $derived(question.type === 'who' ? null
    : answerer === null ? 'answerer' : about === null ? 'about' : null);
  const name = (k) => (k === null || k === undefined ? null : game.players[k]);
  const text = $derived(fillText(question.text, { about: name(about), answerer: name(answerer) }));
  const guess = $derived(question.type === 'guess' && answerer !== about);

  const ROLE = { self: 'ти', left: 'сусід ліворуч', right: 'сусід праворуч', pick: 'на твій вибір' };
  const roleLabel = (r) => r === 'opposite' ? (n % 2 ? 'наступний (навпроти нікого)' : 'той, хто навпроти') : ROLE[r];
  const TYPE = { open: 'Розкажи', choice: 'Вибери', activity: 'Покажи', guess: 'Вгадай', who: 'Хто з нас?' };

  function pick(k) {
    picked = { ...picked, [need]: k };
  }
</script>

<article class="card">
  <div class="badges">
    <span class="badge">{TYPE[question.type]}</span>
    {#if scoring && guess}<span class="badge pts">+1 бал</span>{/if}
  </div>

  {#if question.type === 'who'}
    <p class="roles">Усі разом: на рахунок «три» покажіть пальцем!</p>
  {:else}
    <p class="roles">
      Відповідає: <b>{name(answerer) ?? '…'}</b> <small>({roleLabel(question.answerer)})</small>
      {#if question.about !== 'answerer' && about !== answerer}
        <br />Про кого: <b>{name(about) ?? '…'}</b> <small>({question.about === 'self' ? 'той, чия черга' : roleLabel(question.about)})</small>
      {/if}
    </p>
  {/if}

  {#if need}
    <div class="pick">
      <p>{need === 'answerer' ? 'Хто відповідає?' : 'Про кого питання?'}</p>
      <div class="chips">
        {#each game.players as p, k}
          {#if k !== i && !(need === 'about' && k === answerer)}
            <button class="chip" onclick={() => pick(k)}>{p}</button>
          {/if}
        {/each}
      </div>
    </div>
  {:else}
    <p class="q">{text}</p>

    {#if question.tip}
      <details class="tip"><summary>Підказка для дорослих</summary><p>{question.tip}</p></details>
    {/if}

    <div class="actions">
      {#if scoring && guess}
        <button class="btn ok" onclick={() => onfinish('correct')}>✅ Правильно</button>
        <button class="btn no" onclick={() => onfinish('wrong')}>❌ Неправильно</button>
      {:else}
        <button class="btn ok" onclick={() => onfinish('answered')}>{question.type === 'activity' ? 'Готово!' : 'Відповів(ла)'}</button>
      {/if}
      <button class="btn skip" onclick={() => onfinish('skipped')}>Пропустити</button>
    </div>
  {/if}
</article>

<style>
  .card {
    background: var(--card); border: 2px solid var(--accent); border-radius: 22px; padding: 18px 16px;
    box-shadow: 0 8px 24px rgba(255, 138, 61, .18);
    animation: pop .25s ease-out;
  }
  @keyframes pop { from { transform: scale(.94); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .card { animation: none; } }
  .badges { display: flex; gap: 6px; margin-bottom: 10px; }
  .badge { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; background: var(--soft); color: var(--accent); padding: 4px 9px; border-radius: 10px; }
  .badge.pts { background: var(--ok); color: #fff; }
  .roles { margin: 0 0 10px; font-size: 15px; color: var(--dim); line-height: 1.5; }
  .roles b { color: var(--ink); font-size: 17px; }
  .q { font-size: clamp(22px, 6vw, 28px); font-weight: 700; line-height: 1.3; margin: 6px 0 14px; }
  .pick p { font-weight: 700; margin: 6px 0 8px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { min-height: 48px; padding: 0 16px; border-radius: 14px; border: 2px solid var(--line); background: var(--soft); font-weight: 700; }
  .tip { background: var(--soft); border-radius: 14px; padding: 10px 12px; margin-bottom: 14px; font-size: 15px; }
  .tip summary { font-weight: 700; cursor: pointer; min-height: 28px; }
  .tip p { margin: 8px 0 0; }
  .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .btn { min-height: 54px; border-radius: 16px; border: none; font-weight: 800; font-size: 17px; }
  .btn.ok { background: var(--ok); color: #fff; }
  .btn.no { background: var(--no); color: #fff; }
  .btn.skip { background: var(--used); color: var(--ink); grid-column: 1 / -1; }
  .actions:not(:has(.no)) .ok { grid-column: 1 / -1; }
</style>

<script>
  import Avatar from '../components/Avatar.svelte';

  let { game, players, onnew, onback } = $props();
  const table = $derived(players.map((p, i) => ({ p, score: game.scores[i] || 0 })).sort((a, b) => b.score - a.score));
  const total = $derived(game.stats.answered + game.stats.skipped);
</script>

<h1>🎉 Підсумок</h1>

<div class="stats">
  <div><b>{game.stats.answered}</b><span>відповіли</span></div>
  <div><b>{game.stats.skipped}</b><span>пропустили</span></div>
  <div><b>{total}</b><span>карток усього</span></div>
</div>

{#if game.scoring}
  <h2>Бали</h2>
  <ol class="table">
    {#each table as row, k}
      <li class:top={k === 0 && row.score > 0}>
        <span class="place">{k + 1}</span><Avatar player={row.p} size={40} />
        <span class="name">{row.p.name}</span><b>{row.score}</b>
      </li>
    {/each}
  </ol>
{:else}
  <p class="msg">Тут немає переможців: ви просто дізналися одне про одного трохи більше. 💛</p>
{/if}

<div class="btns">
  {#if onback}<button class="ghost" onclick={onback}>Продовжити гру</button>{/if}
  <button class="main" onclick={onnew}>Нова гра</button>
</div>

<style>
  h1 { font-size: 28px; margin: 0 0 14px; }
  h2 { font-size: 18px; margin: 18px 0 8px; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .stats div { background: var(--card); border: 2px solid var(--line); border-radius: 16px; padding: 12px 6px; text-align: center; }
  .stats b { display: block; font-size: 28px; }
  .stats span { font-size: 12px; color: var(--dim); }
  .table { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .table li { display: flex; align-items: center; gap: 10px; background: var(--card); border: 2px solid var(--line); border-radius: 14px; padding: 8px 12px; }
  .table li.top { border-color: #ffc83d; background: var(--soft); }
  .place { width: 20px; font-weight: 800; color: var(--dim); }
  .name { flex: 1; font-weight: 700; }
  .table b { font-size: 22px; }
  .msg { background: var(--card); border-radius: 16px; padding: 16px; margin: 16px 0; font-size: 17px; }
  .btns { display: flex; gap: 8px; margin-top: 20px; }
  .btns button { flex: 1; min-height: 56px; border-radius: 16px; font-weight: 800; font-size: 17px; }
  .main { border: none; background: var(--accent); color: var(--accent-ink); }
  .ghost { border: 2px solid var(--line); background: var(--card); }
</style>

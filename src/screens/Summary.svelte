<script>
  import Avatar from '../components/Avatar.svelte';
  import Confetti from '../components/Confetti.svelte';

  let { game, players, names = {}, onnew, onback } = $props();
  // Таблиця: поточні гравці + ті, кого прибрали посеред гри (з позначкою)
  const rows = $derived([
    ...players.filter((p) => game.order.includes(p.id)).map((p) => ({ p, gone: false })),
    ...Object.keys(game.gone).map((id) => ({ p: { id, name: game.gone[id] || names[id] || 'Гравець' }, gone: true })),
  ].map((r) => ({ ...r, score: game.scores[r.p.id] || 0 })).sort((a, b) => b.score - a.score));
  const podium = $derived(rows.slice(0, 3));
  const total = $derived(game.stats.answered + game.stats.skipped);
</script>

<Confetti />
<header>
  <span class="big" aria-hidden="true">🎉</span>
  <h1>Гра завершена!</h1>
</header>

<div class="stats">
  <div style="--c:#2FB86A"><b>{game.stats.answered}</b><span>відповіли</span></div>
  <div style="--c:#8B6CFF"><b>{game.stats.skipped}</b><span>пропустили</span></div>
  <div style="--c:#FF7A1A"><b>{total}</b><span>карток</span></div>
</div>

{#if game.scoring}
  <div class="podium" aria-label="П'єдестал">
    {#each [1, 0, 2] as k}
      {#if podium[k]}
        <div class="step s{k + 1}">
          <Avatar player={podium[k].p} size={k === 0 ? 72 : 56} ring={k === 0} />
          <b>{podium[k].p.name}</b>
          <div class="block"><span>{k === 0 ? '🥇' : k === 1 ? '🥈' : '🥉'}</span><strong>{podium[k].score}</strong></div>
        </div>
      {/if}
    {/each}
  </div>
  <ol class="table">
    {#each rows as row, k}
      <li class:gone={row.gone}>
        <span class="place">{k + 1}</span><Avatar player={row.p} size={40} />
        <span class="name">{row.p.name}{#if row.gone} <small>(вийшов з гри)</small>{/if}</span><b>{row.score}</b>
      </li>
    {/each}
  </ol>
{:else}
  <p class="msg">Тут немає переможців: ви просто дізналися одне про одного трохи більше. 💛</p>
{/if}

<div class="btns">
  {#if onback}<button class="chunky light" onclick={onback}>Продовжити</button>{/if}
  <button class="chunky" onclick={onnew}>🎲 Нова гра</button>
</div>

<style>
  header { text-align: center; margin: 8px 0 14px; }
  .big { font-size: 52px; display: inline-block; animation: pop .6s cubic-bezier(.2, 1.8, .4, 1); }
  @keyframes pop { from { transform: scale(.2) rotate(-30deg); } }
  h1 { font-size: 30px; margin: 0; font-weight: 1000; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .stats div { background: var(--card); border-radius: 20px; padding: 12px 6px; text-align: center; border: 2px solid var(--line); box-shadow: 0 4px 0 var(--line); }
  .stats b { display: block; font-size: 32px; font-weight: 1000; color: var(--c); }
  .stats span { font-size: 13px; color: var(--dim); font-weight: 800; }
  .podium { display: flex; justify-content: center; align-items: flex-end; gap: 10px; margin: 22px 0 14px; }
  .step { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 30%; max-width: 130px; animation: up .5s cubic-bezier(.2, 1.4, .4, 1) both; }
  .step b { font-weight: 900; font-size: 15px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .block { width: 100%; border-radius: 16px 16px 6px 6px; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; }
  .block span { font-size: 22px; }
  .block strong { font-size: 24px; font-weight: 1000; }
  .s1 .block { height: 110px; background: linear-gradient(#FFC23D, #F08C00); box-shadow: 0 5px 0 #b86a00; }
  .s2 .block { height: 82px; background: linear-gradient(#B9C3D0, #8592A3); box-shadow: 0 5px 0 #5f6b7a; animation-delay: .1s; }
  .s3 .block { height: 64px; background: linear-gradient(#E3A06B, #B86B33); box-shadow: 0 5px 0 #8a4a1e; animation-delay: .2s; }
  @keyframes up { from { transform: translateY(30px); opacity: 0; } }
  .table { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .table li { display: flex; align-items: center; gap: 12px; background: var(--card); border: 2px solid var(--line); border-radius: 18px; padding: 8px 14px; }
  .table li.gone { opacity: .6; }
  .place { width: 20px; font-weight: 900; color: var(--dim); }
  .name { flex: 1; font-weight: 800; }
  .name small { color: var(--dim); font-weight: 700; }
  .table b { font-size: 24px; font-weight: 1000; }
  .msg { background: var(--card); border-radius: 20px; padding: 18px; margin: 16px 0; font-size: 18px; font-weight: 800; text-align: center; border: 2px solid var(--line); }
  .btns { display: flex; gap: 10px; margin-top: 22px; }
  .btns button { flex: 1; }
</style>

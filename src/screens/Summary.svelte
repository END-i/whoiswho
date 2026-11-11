<script>
  import Avatar from '../components/Avatar.svelte';
  import Confetti from '../components/Confetti.svelte';
  import { rank, winners, podium } from '../lib/ranking.js';
  import { t } from '../lib/lang.svelte.js';

  let { game, players, names = {}, onnew, onhistory } = $props();
  // Поточні гравці + ті, кого прибрали посеред гри (з позначкою)
  const ranked = $derived(rank([
    ...players.filter((p) => game.order.includes(p.id)).map((p) => ({ id: p.id, p, gone: false, score: game.scores[p.id] || 0 })),
    ...Object.keys(game.gone || {}).map((id) => ({ id, p: { id, name: game.gone[id] || names[id] || t('summary.player') }, gone: true, score: game.scores[id] || 0 })),
  ]));
  const won = $derived(winners(ranked));
  const steps = $derived(podium(ranked));
  const total = $derived(game.stats.answered + game.stats.skipped);
  const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };
  // п'єдестал: друге місце ліворуч, перше в центрі, третє праворуч
  const order = $derived([steps.find((g) => g.place === 2), steps.find((g) => g.place === 1), steps.find((g) => g.place === 3)].filter(Boolean));
</script>

{#if won.length}<Confetti />{/if}
<header>
  <span class="big" aria-hidden="true">{won.length ? '🎉' : '🤝'}</span>
  <h1>{t('summary.title')}</h1>
  {#if game.scoring && won.length > 1}<p class="sub">{t('summary.tie', { names: won.map((w) => w.p.name).join(', ') })}</p>{/if}
</header>

<div class="stats">
  <div style="--c:#2AA660"><b>{game.stats.answered}</b><span>{t('summary.answered')}</span></div>
  <div style="--c:#795EDD"><b>{game.stats.skipped}</b><span>{t('summary.skipped')}</span></div>
  <div style="--c:#E66E18"><b>{total}</b><span>{t('summary.cards', { n: total })}</span></div>
</div>

{#if game.scoring}
  {#if steps.length}
    <div class="podium" aria-label={t('summary.podium')}>
      {#each order as g (g.place)}
        <div class="step s{g.place}">
          <div class="faces">{#each g.players as e (e.id)}<Avatar player={e.p} size={g.place === 1 ? 64 : 50} ring={g.place === 1} />{/each}</div>
          <b>{g.players.map((e) => e.p.name).join(', ')}</b>
          <div class="block"><span>{MEDAL[g.place]}</span><strong>{g.players[0].score}</strong></div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="msg">{t('summary.zero')}</p>
  {/if}
  <ol class="table">
    {#each ranked as row (row.id)}
      <li class:gone={row.gone}>
        <span class="place">{row.place}</span><Avatar player={row.p} size={40} />
        <span class="name">{row.p.name}{#if row.gone} <small>{t('summary.gone')}</small>{/if}</span><b>{row.score}</b>
      </li>
    {/each}
  </ol>
{:else}
  <p class="msg">{t('summary.noScoring')}</p>
{/if}

<div class="btns">
  <button class="chunky light" onclick={onhistory}>{t('summary.history')}</button>
  <button class="chunky" onclick={onnew}>{t('summary.new')}</button>
</div>

<style>
  header { text-align: center; margin: 8px 0 14px; }
  .big { font-size: 52px; display: inline-block; animation: pop .6s cubic-bezier(.2, 1.8, .4, 1); }
  @keyframes pop { from { transform: scale(.2) rotate(-30deg); } }
  h1 { font-size: 30px; margin: 0; font-weight: 1000; }
  .sub { margin: 6px 0 0; font-weight: 800; color: var(--dim); }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .stats div { background: var(--card); border-radius: 20px; padding: 12px 6px; text-align: center; border: 2px solid var(--line); box-shadow: 0 4px 0 var(--line); }
  .stats b { display: block; font-size: 32px; font-weight: 1000; color: var(--c); }
  .stats span { font-size: 13px; color: var(--dim); font-weight: 800; }
  .podium { display: flex; justify-content: center; align-items: flex-end; gap: 10px; margin: 22px 0 14px; }
  .step { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; max-width: 150px; animation: up .5s cubic-bezier(.2, 1.4, .4, 1) both; }
  .faces { display: flex; justify-content: center; flex-wrap: wrap; gap: 2px; }
  .step b { font-weight: 900; font-size: 14px; max-width: 100%; text-align: center; overflow-wrap: anywhere; }
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

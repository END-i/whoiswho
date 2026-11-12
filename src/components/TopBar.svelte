<script>
  import { t } from '../lib/lang.svelte.js';
  import Avatar from './Avatar.svelte';

  // big — на екрані категорій: телефон щойно передали, тож чий хід — крупно
  let { players, game, onmenu, onscores, back = null, big = false } = $props();
  const p = $derived(players[game.turn]);
</script>

<div class="bar" class:big>
  {#if back}<button class="icon" onclick={back} aria-label={t('top.back')}>←</button>{/if}
  <div class="turn">
    {#key p?.id}
      <span class="pop"><Avatar player={p} size={big ? 64 : 46} ring /></span>
    {/key}
    <span class="txt"><small>{t('top.turn')}</small><b>{p?.name}</b></span>
  </div>
  {#if game.scoring}<button class="icon scores" onclick={onscores} aria-label={t('menu.scores')}>🏆</button>{/if}
  <button class="icon" onclick={onmenu} aria-label={t('menu.title')}>☰</button>
</div>

{#if game.scoring}
  <button class="board" onclick={onscores} aria-label={t('top.board', { list: players.map((x) => `${x.name} ${game.scores[x.id] || 0}`).join(', ') })}>
    {#each players as x, k (x.id)}
      <span class="pl" class:now={k === game.turn}>
        <Avatar player={x} size={30} />
        {#key game.scores[x.id]}<b class="pts">{game.scores[x.id] || 0}</b>{/key}
      </span>
    {/each}
  </button>
{/if}

<style>
  .bar {
    display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding: 8px;
    background: var(--card); border-radius: 24px; box-shadow: var(--shadow); border: 2px solid var(--line);
  }
  .turn { flex: 1; display: flex; align-items: center; gap: 12px; min-width: 0; padding-left: 4px; }
  .pop { display: inline-flex; animation: pop .45s cubic-bezier(.2, 1.8, .4, 1); }
  @keyframes pop { from { transform: scale(.4) rotate(-20deg); } }
  .txt { display: flex; flex-direction: column; line-height: 1.05; min-width: 0; }
  small { font-size: 12px; color: var(--dim); font-weight: 800; text-transform: uppercase; letter-spacing: .06em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  b { font-size: 22px; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .icon {
    width: 48px; height: 48px; flex: none; border-radius: 16px; border: none; background: var(--soft);
    font-size: 21px; font-weight: 900; box-shadow: 0 3px 0 var(--line);
  }
  /* вузький екран: таблиця балів під панеллю й так відкриває бали — 🏆 ховаємо, щоб ім'я вміщалося */
  @media (max-width: 360px) {
    .icon.scores { display: none; }
    .turn { gap: 8px; }
    small { font-size: 11px; letter-spacing: .03em; }
  }
  .big .turn { gap: 16px; padding: 4px 0 4px 6px; }
  .big b { font-size: 30px; }
  @media (min-width: 361px) { .big small { font-size: 13px; } }
  @media (max-width: 360px) { .big b { font-size: 24px; } }
  .icon:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--line); }
  .board {
    display: flex; gap: 6px; width: 100%; overflow-x: auto; margin: -6px 0 14px; padding: 6px 8px;
    border: 2px solid var(--line); border-radius: 18px; background: var(--card); box-shadow: 0 3px 0 var(--line);
    scrollbar-width: none;
  }
  .pl { display: flex; align-items: center; gap: 5px; padding: 3px 8px 3px 3px; border-radius: 14px; flex: none; }
  .pl.now { background: var(--soft); box-shadow: inset 0 0 0 2px var(--accent); }
  .pts { font-size: 17px; font-weight: 900; min-width: 14px; animation: bump .5s cubic-bezier(.2, 1.8, .4, 1); }
  @keyframes bump { from { transform: scale(1.8); color: var(--ok); } }
</style>

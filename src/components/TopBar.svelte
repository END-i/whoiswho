<script>
  import Avatar from './Avatar.svelte';

  let { players, game, onmenu, onscores, back = null } = $props();
  const p = $derived(players[game.turn]);
</script>

<div class="bar">
  {#if back}<button class="icon" onclick={back} aria-label="До категорій">←</button>{/if}
  <div class="turn">
    {#key p?.id}
      <span class="pop"><Avatar player={p} size={46} ring /></span>
    {/key}
    <span class="txt"><small>Зараз хід</small><b>{p?.name}</b></span>
  </div>
  {#if game.scoring}<button class="icon" onclick={onscores} aria-label="Бали">🏆</button>{/if}
  <button class="icon" onclick={onmenu} aria-label="Меню">☰</button>
</div>

<style>
  .bar {
    display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding: 8px;
    background: var(--card); border-radius: 24px; box-shadow: var(--shadow); border: 2px solid var(--line);
  }
  .turn { flex: 1; display: flex; align-items: center; gap: 12px; min-width: 0; padding-left: 4px; }
  .pop { display: inline-flex; animation: pop .45s cubic-bezier(.2, 1.8, .4, 1); }
  @keyframes pop { from { transform: scale(.4) rotate(-20deg); } }
  .txt { display: flex; flex-direction: column; line-height: 1.05; min-width: 0; }
  small { font-size: 12px; color: var(--dim); font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
  b { font-size: 22px; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .icon {
    width: 48px; height: 48px; flex: none; border-radius: 16px; border: none; background: var(--soft);
    font-size: 21px; font-weight: 900; box-shadow: 0 3px 0 var(--line);
  }
  .icon:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--line); }
</style>

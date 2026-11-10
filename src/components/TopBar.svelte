<script>
  import Avatar from './Avatar.svelte';

  let { players, game, onmenu, onscores, back = null } = $props();
  const p = $derived(players[game.turn]);
</script>

<div class="bar">
  {#if back}
    <button class="icon" onclick={back.onclick} disabled={back.disabled} aria-label="До категорій">←</button>
  {/if}
  <div class="turn">
    <Avatar player={p} size={42} ring />
    <span><small>Зараз хід</small><b>{p.name}</b></span>
  </div>
  {#if game.scoring}
    <button class="pill" onclick={onscores} >🏆 Бали</button>
  {/if}
  <button class="icon" onclick={onmenu} aria-label="Меню">☰</button>
</div>

<style>
  .bar { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
  .turn { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; }
  .turn span { display: flex; flex-direction: column; line-height: 1.1; min-width: 0; }
  small { font-size: 12px; color: var(--dim); }
  b { font-size: 19px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .icon { width: 48px; height: 48px; flex: none; border-radius: 14px; border: 2px solid var(--line); background: var(--card); font-size: 20px; }
  .icon:disabled { opacity: .35; }
  .pill { height: 40px; padding: 0 12px; border-radius: 20px; border: 2px solid var(--line); background: var(--card); font-weight: 800; }
</style>

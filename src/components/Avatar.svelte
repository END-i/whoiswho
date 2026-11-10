<script>
  import { templateById } from '../lib/templates.js';

  let { player, size = 44, ring = false } = $props();
  const tpl = $derived(player?.template ? templateById(player.template) : null);
  // Стабільний теплий колір для кружечка без фото
  const COLORS = ['#ff8a3d', '#3fae6a', '#3b82f6', '#e5484d', '#a855f7', '#f2b705', '#14b8a6', '#ec4899'];
  const color = $derived(COLORS[[...(player?.name || '?')].reduce((s, c) => s + c.codePointAt(0), 0) % COLORS.length]);
</script>

<span class="av" class:ring style="--s:{size}px; --c:{color}" aria-hidden="true">
  {#if player?.photo}
    <img src={player.photo} alt="" />
  {:else}
    <span class="letter">{(player?.name || '?').trim().charAt(0).toUpperCase() || '?'}</span>
  {/if}
  {#if tpl}
    <svg viewBox="0 0 100 100">{@html tpl.svg}</svg>
  {/if}
</span>

<style>
  .av { position: relative; display: inline-block; width: var(--s); height: var(--s); flex: none; }
  img, .letter { width: 100%; height: 100%; border-radius: 50%; display: block; object-fit: cover; }
  .letter { background: var(--c); color: #fff; font-weight: 800; font-size: calc(var(--s) * .45); display: grid; place-items: center; }
  .ring img, .ring .letter { box-shadow: 0 0 0 3px var(--accent); }
  svg { position: absolute; inset: -8%; width: 116%; height: 116%; overflow: visible; pointer-events: none; }
</style>

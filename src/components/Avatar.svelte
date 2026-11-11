<script>
  import { templateById, tplTransform } from '../lib/templates.js';
  import { playerColor, initial } from '../lib/theme.js';

  let { player, size = 44, ring = false } = $props();
  const tpl = $derived(player?.template ? templateById(player.template) : null);
</script>

<span class="av" class:ring style="--s:{size}px; --c:{player?.color || playerColor(player?.id)}" aria-hidden="true">
  {#if player?.photo}
    <img src={player.photo} alt="" />
  {:else}
    <span class="letter">{initial(player?.name)}</span>
  {/if}
  {#if tpl}<svg viewBox="0 0 100 100" style="transform:{tplTransform(player.tplPos)}">{@html tpl.svg}</svg>{/if}
</span>

<style>
  .av { position: relative; display: inline-block; width: var(--s); height: var(--s); flex: none; }
  img, .letter { width: 100%; height: 100%; border-radius: 50%; display: block; object-fit: cover; box-shadow: 0 0 0 calc(var(--s) * .05) #fff, 0 3px 8px rgba(0, 0, 0, .15); }
  .letter {
    background: radial-gradient(circle at 30% 25%, rgba(255, 255, 255, .35), transparent 50%), var(--c);
    color: #fff; font-weight: 900; font-size: calc(var(--s) * .46); display: grid; place-items: center; text-shadow: 0 1px 0 rgba(0, 0, 0, .2);
  }
  .ring img, .ring .letter { box-shadow: 0 0 0 3px #fff, 0 0 0 6px var(--c), 0 4px 12px rgba(0, 0, 0, .2); }
  svg { position: absolute; inset: -8%; width: 116%; height: 116%; overflow: visible; pointer-events: none; }
</style>

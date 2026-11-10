<script>
  // Короткий вибух конфеті поверх екрана; зникає сам через ~1.6 с.
  const COLORS = ['#FF7A1A', '#8B6CFF', '#36D1C4', '#FFC23D', '#FF7BA6', '#7DCE45'];
  const bits = Array.from({ length: 36 }, (_, k) => ({
    x: Math.random() * 100, d: Math.random() * 0.35, r: Math.random() * 720 - 360,
    c: COLORS[k % COLORS.length], w: 6 + Math.random() * 6, round: k % 3 === 0,
  }));
  let alive = $state(true);
  setTimeout(() => (alive = false), 1800);
</script>

{#if alive}
  <div class="wrap" aria-hidden="true">
    {#each bits as b}
      <i style="left:{b.x}%; background:{b.c}; width:{b.w}px; height:{b.round ? b.w : b.w * 1.8}px; border-radius:{b.round ? '50%' : '2px'}; animation-delay:{b.d}s; --r:{b.r}deg"></i>
    {/each}
  </div>
{/if}

<style>
  .wrap { position: fixed; inset: 0; pointer-events: none; z-index: 39; overflow: hidden; }
  i { position: absolute; top: -20px; animation: fall 1.4s cubic-bezier(.3, .6, .6, 1) forwards; }
  @keyframes fall { to { transform: translateY(105vh) rotate(var(--r)); opacity: .2; } }
</style>

<script>
  let { title, onclose, children } = $props();
</script>

<div class="bg" onclick={onclose} role="presentation"></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
  <header>
    <h2>{title}</h2>
    <button class="x" onclick={onclose} aria-label="Закрити">✕</button>
  </header>
  {@render children()}
</div>

<style>
  .bg { position: fixed; inset: 0; background: rgba(30, 18, 10, .45); z-index: 10; animation: fade .2s; }
  .sheet {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 11; max-width: 560px; margin: 0 auto;
    max-height: 88vh; overflow-y: auto; background: var(--bg); border-radius: 24px 24px 0 0;
    padding: 16px 16px calc(env(safe-area-inset-bottom, 0px) + 18px); animation: up .25s ease-out;
  }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  h2 { margin: 0; font-size: 20px; }
  .x { width: 44px; height: 44px; border-radius: 12px; border: 2px solid var(--line); background: var(--card); font-size: 18px; }
  @keyframes up { from { transform: translateY(100%); } }
  @keyframes fade { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .sheet, .bg { animation: none; } }
</style>

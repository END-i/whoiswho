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
  .bg { position: fixed; inset: 0; background: rgba(26, 14, 36, .5); backdrop-filter: blur(3px); z-index: 10; animation: fade .2s; }
  .sheet {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 11; max-width: 560px; margin: 0 auto;
    max-height: 88vh; overflow-y: auto; background: var(--bg); border-radius: 30px 30px 0 0; box-shadow: 0 -10px 40px rgba(0, 0, 0, .25);
    padding: 10px 16px calc(env(safe-area-inset-bottom, 0px) + 20px); animation: up .3s cubic-bezier(.2, 1.2, .4, 1);
  }
  .sheet::before { content: ''; display: block; width: 44px; height: 5px; border-radius: 3px; background: var(--line); margin: 0 auto 10px; }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  h2 { margin: 0; font-size: 22px; font-weight: 900; }
  .x { width: 44px; height: 44px; border-radius: 14px; border: none; background: var(--card); font-size: 18px; font-weight: 900; box-shadow: 0 3px 0 var(--line); }
  @keyframes up { from { transform: translateY(100%); } }
  @keyframes fade { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .sheet, .bg { animation: none; } }
</style>

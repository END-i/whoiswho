<script>
  let { rules, onok, again = false } = $props();
</script>

<h1>📜 Як грати</h1>
<ol>
  {#each rules as r}<li>{r}</li>{/each}
</ol>
<button class="ok" onclick={onok}>{again ? 'Назад до гри' : 'Зрозуміло, граємо!'}</button>

<style>
  h1 { font-size: 26px; margin: 0 0 12px; }
  ol { margin: 0 0 20px; padding: 0; list-style: none; counter-reset: r; display: flex; flex-direction: column; gap: 10px; }
  li { counter-increment: r; display: flex; gap: 12px; background: var(--card); border: 2px solid var(--line); border-radius: 16px; padding: 12px 14px; font-size: 16px; }
  li::before { content: counter(r); flex: none; width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: var(--accent-ink); font-weight: 800; display: grid; place-items: center; font-size: 14px; }
  .ok { width: 100%; min-height: 58px; border-radius: 18px; border: none; background: var(--accent); color: var(--accent-ink); font-weight: 800; font-size: 19px; }
</style>

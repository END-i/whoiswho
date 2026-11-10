<script>
  let { rules, onok, again = false } = $props();
  const ICONS = ['🪑', '🃏', '🎯', '📣', '✅', '👆', '⏭️', '💛', '✨', '🎲'];
</script>

<header>
  <span class="big" aria-hidden="true">📜</span>
  <h1>Як грати</h1>
</header>
<ol>
  {#each rules as r, k}
    <li style="animation-delay:{k * 60}ms"><span class="ic" aria-hidden="true">{ICONS[k % ICONS.length]}</span><span>{r}</span></li>
  {/each}
</ol>
<button class="chunky ok" onclick={onok}>{again ? '← Назад до гри' : '🎲 Зрозуміло, граємо!'}</button>

<style>
  header { text-align: center; margin: 8px 0 14px; }
  .big { font-size: 46px; display: inline-block; animation: wob 2s ease-in-out infinite; }
  @keyframes wob { 50% { transform: rotate(-8deg) scale(1.05); } }
  h1 { font-size: 30px; margin: 0; font-weight: 1000; }
  ol { margin: 0 0 20px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
  li {
    display: flex; gap: 12px; align-items: center; background: var(--card); border: 2px solid var(--line); border-radius: 20px;
    padding: 12px 14px; font-size: 16px; font-weight: 700; box-shadow: 0 3px 0 var(--line); animation: rise .35s cubic-bezier(.2, 1.4, .4, 1) both;
  }
  @keyframes rise { from { transform: translateX(-12px); opacity: 0; } }
  .ic { flex: none; width: 44px; height: 44px; border-radius: 14px; background: var(--soft); display: grid; place-items: center; font-size: 22px; }
  .chunky { width: 100%; --c: var(--ok); --c2: var(--ok2); font-size: 20px; min-height: 62px; }
</style>

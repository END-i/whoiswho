<script>
  let { rules, onok, again = false } = $props();
  // Схема: кожне правило — крок з великою іконкою. Іконки — за порядком кроків у meta.rules.
  const ICONS = ['🔄', '🃏', '👀', '⭐', '💬', '🎲'];
</script>

<header>
  <h1>Як грати</h1>
  <p>Коротко, у {rules.length} кроках</p>
</header>

<ol class="flow">
  {#each rules as r, k}
    <li style="animation-delay:{k * 70}ms">
      <span class="ic" aria-hidden="true">{ICONS[k % ICONS.length]}<i>{k + 1}</i></span>
      <span class="txt">{r}</span>
    </li>
  {/each}
</ol>
<button class="chunky ok" onclick={onok}>{again ? '← Назад до гри' : '🎲 Граємо!'}</button>

<style>
  header { text-align: center; margin: 4px 0 12px; }
  h1 { font-size: 30px; margin: 0; font-weight: 1000; }
  header p { margin: 2px 0 0; color: var(--dim); font-weight: 800; }
  .flow { list-style: none; margin: 0 0 18px; padding: 0; display: flex; flex-direction: column; gap: 14px; position: relative; }
  /* лінія-потік між кроками */
  .flow::before { content: ''; position: absolute; left: 31px; top: 30px; bottom: 30px; border-left: 3px dashed var(--line); }
  li {
    position: relative; display: flex; gap: 14px; align-items: center; animation: rise .35s cubic-bezier(.2, 1.4, .4, 1) both;
  }
  @keyframes rise { from { transform: translateX(-12px); opacity: 0; } }
  .ic {
    position: relative; flex: none; width: 64px; height: 64px; border-radius: 22px; background: var(--card);
    display: grid; place-items: center; font-size: 32px; box-shadow: 0 4px 0 var(--line), var(--shadow); border: 2px solid var(--line);
  }
  .ic i {
    position: absolute; top: -8px; right: -8px; width: 26px; height: 26px; border-radius: 50%; background: var(--accent); color: #fff;
    font-style: normal; font-size: 14px; font-weight: 900; display: grid; place-items: center; box-shadow: 0 2px 0 var(--accent2);
  }
  .txt { font-size: 18px; font-weight: 800; line-height: 1.3; }
  .chunky { width: 100%; --c: var(--ok); --c2: var(--ok2); font-size: 21px; min-height: 62px; }
</style>

<script>
  import { t } from '../lib/lang.svelte.js';
  // Варіант C (власник 23.11): одне речення набору; пояснення — у ⓘ на картці, а не тут.
  let { rules, onok, again = false } = $props();
</script>

<div class="wrap">
  <div class="icons" aria-hidden="true"><span>📱</span><span>🃏</span><span>💬</span></div>
  <h1>{t('rules.title')}</h1>
  {#each rules as r}<p class="lead">{r}</p>{/each}
  <p class="hint">{t('rules.hint')}</p>
</div>
<button class="chunky ok" onclick={onok}>{again ? t('rules.back') : t('rules.play')}</button>

<style>
  .wrap { min-height: 52vh; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 12px; text-align: center; margin: 8px 0 22px; }
  .icons { display: flex; gap: 8px; margin-bottom: 6px; }
  .icons span {
    width: 64px; height: 64px; border-radius: 20px; background: var(--card); display: grid; place-items: center; font-size: 32px;
    box-shadow: 0 4px 0 var(--line), var(--shadow); animation: rise .35s cubic-bezier(.2, 1.4, .4, 1) both;
  }
  .icons span:nth-child(2) { animation-delay: 70ms; }
  .icons span:nth-child(3) { animation-delay: 140ms; }
  @keyframes rise { from { transform: translateY(10px); opacity: 0; } }
  h1 { font-size: 30px; margin: 0; font-weight: 1000; }
  .lead { margin: 0; font-size: 22px; font-weight: 900; line-height: 1.3; max-width: 26ch; }
  .hint { margin: 0; font-size: 17px; font-weight: 800; color: var(--dim); }
  .chunky { width: 100%; --c: var(--ok); --c2: var(--ok2); font-size: 21px; min-height: 62px; }
</style>

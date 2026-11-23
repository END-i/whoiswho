<script>
  import { t } from '../lib/lang.svelte.js';

  // Кнопка ⓘ з підказкою під рядком налаштування (відгук 19.11: підписи під перемикачами — в ⓘ).
  // id — id підказки: перемикач посилається на неї через aria-describedby, тож екранний читач
  // чує пояснення й без відкривання. what — назва налаштування для підпису кнопки.
  let { id, text, what } = $props();
  let open = $state(false);
  let root = $state();
  let btn = $state();

  // дотик поза ⓘ і підказкою — закрити
  function outside(e) { if (open && !root.contains(e.target)) open = false; }
  function key(e) { if (open && e.key === 'Escape') { open = false; btn.focus(); } }
</script>

<svelte:document onpointerdown={outside} onkeydown={key} />

<span class="info" bind:this={root}>
  <button bind:this={btn} type="button" class="i" class:on={open} aria-label={t('common.info', { what })} aria-expanded={open} aria-controls={id} onclick={() => (open = !open)}>i</button>
  <span {id} class="tip" hidden={!open}>{text}</span>
</span>

<style>
  .info { flex: none; }
  .i { width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--dim); background: none; color: var(--dim);
    font: 900 italic 14px/1 Georgia, serif; display: grid; place-items: center; padding: 0; position: relative; }
  /* дотик більший за кружечок */
  .i::before { content: ''; position: absolute; inset: -9px; }
  .i.on { border-color: var(--accent); background: var(--accent); color: #fff; }
  /* підказка — на всю ширину рядка (рядок має position: relative) */
  .tip { position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 5; padding: 10px 12px; border-radius: 14px;
    background: var(--ink); color: var(--card); font-size: 14px; font-weight: 700; line-height: 1.35; box-shadow: var(--shadow); }
  .tip[hidden] { display: none; }
</style>

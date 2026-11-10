<script>
  import Avatar from './Avatar.svelte';
  import { TEMPLATES, clampTpl, dragTpl, TPL_DEFAULT } from '../lib/templates.js';
  import { squarePhoto } from '../lib/photos.js';

  let { player = $bindable() } = $props();
  let busy = $state(false);
  let error = $state('');
  const SIZE = 170;

  async function onfile(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    busy = true; error = '';
    try { player.photo = await squarePhoto(file); }
    catch { error = 'Не вдалося прочитати фото. Спробуй інше.'; }
    finally { busy = false; }
  }
  function choose(id) {
    player.template = id;
    player.tplPos = { ...TPL_DEFAULT };
  }
  // Перетягування шаблону пальцем по прев'ю
  let drag = null;
  function down(e) {
    if (!player.template) return;
    drag = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function move(e) {
    if (!drag) return;
    player.tplPos = dragTpl(player.tplPos, e.clientX - drag.x, e.clientY - drag.y, SIZE);
    drag = { x: e.clientX, y: e.clientY };
  }
  const up = () => (drag = null);
  const pos = $derived(clampTpl(player.tplPos));
  const groups = [['fun', 'Веселі'], ['serious', 'Серйозні']];
</script>

<div class="preview">
  <div class="stage" class:movable={!!player.template} role="img" aria-label="Прев'ю фото{player.template ? ', шаблон можна посунути пальцем' : ''}"
    onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
    <Avatar {player} size={SIZE} />
  </div>
  {#if busy}<p class="hint">Стискаю фото…</p>{/if}
  {#if error}<p class="err">{error}</p>{/if}
  {#if player.template}
    <div class="adjust">
      <label>Розмір шаблону
        <input type="range" min="0.6" max="1.6" step="0.05" value={pos.s} aria-label="Розмір шаблону"
          oninput={(e) => (player.tplPos = clampTpl({ ...pos, s: +e.currentTarget.value }))} />
      </label>
      <button class="mini" onclick={() => (player.tplPos = { ...TPL_DEFAULT })}>↺ Скинути</button>
    </div>
    <p class="hint">Тягни шаблон пальцем, щоб посунути.</p>
  {/if}
</div>

<div class="row">
  <label class="btn">📷 Камера<input type="file" accept="image/*" capture="user" onchange={onfile} /></label>
  <label class="btn">🖼️ Галерея<input type="file" accept="image/*" onchange={onfile} /></label>
  {#if player.photo}<button class="btn ghost" onclick={() => (player.photo = null)}>Прибрати фото</button>{/if}
</div>

{#each groups as [kind, title]}
  <h3>{title} шаблони</h3>
  <div class="tpls">
    {#if kind === 'fun'}
      <button class="tpl" class:on={!player.template} aria-pressed={!player.template} onclick={() => choose(null)}>
        <Avatar player={{ ...player, template: null }} size={56} /><span>Без шаблону</span>
      </button>
    {/if}
    {#each TEMPLATES.filter((t) => t.kind === kind) as t (t.id)}
      <button class="tpl" class:on={player.template === t.id} aria-pressed={player.template === t.id} onclick={() => choose(t.id)}>
        <Avatar player={{ ...player, template: t.id, tplPos: TPL_DEFAULT }} size={56} /><span>{t.name}</span>
      </button>
    {/each}
  </div>
{/each}

<p class="hint">Фото залишається тільки на цьому телефоні.</p>

<style>
  .preview { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 10px 0 8px; }
  .stage { touch-action: none; border-radius: 50%; padding: 14px; }
  .stage.movable { cursor: grab; background: repeating-conic-gradient(var(--soft) 0 25%, transparent 0 50%) 0 0 / 16px 16px; }
  .adjust { display: flex; align-items: center; gap: 10px; width: 100%; max-width: 340px; }
  .adjust label { flex: 1; font-size: 13px; font-weight: 800; color: var(--dim); display: flex; flex-direction: column; gap: 4px; }
  .adjust input { width: 100%; accent-color: var(--accent); height: 28px; }
  .mini { min-height: 40px; padding: 0 12px; border-radius: 12px; border: none; background: var(--card); font-weight: 900; box-shadow: 0 3px 0 var(--line); }
  .row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 8px; }
  .btn { display: inline-flex; align-items: center; min-height: 52px; padding: 0 18px; border-radius: 16px; border: none; background: var(--card); font-weight: 900; cursor: pointer; box-shadow: 0 4px 0 var(--line); }
  .btn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--line); }
  .btn.ghost { color: var(--no); }
  .btn input { display: none; }
  h3 { font-size: 15px; margin: 16px 0 8px; color: var(--dim); font-weight: 900; text-transform: uppercase; letter-spacing: .05em; }
  .tpls { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; }
  .tpl { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 4px 10px; border-radius: 18px; border: 3px solid transparent; background: var(--card); font-size: 12px; font-weight: 800; box-shadow: 0 3px 0 var(--line); }
  .tpl.on { border-color: var(--accent); background: var(--soft); }
  .hint { font-size: 13px; color: var(--dim); text-align: center; margin: 4px 0 0; font-weight: 700; }
  .err { color: var(--no); font-weight: 800; margin: 0; }
</style>

<script>
  import Avatar from './Avatar.svelte';
  import { TEMPLATES } from '../lib/templates.js';
  import { squarePhoto } from '../lib/photos.js';

  let { player = $bindable() } = $props();
  let busy = $state(false);
  let error = $state('');

  async function onfile(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    busy = true; error = '';
    try { player.photo = await squarePhoto(file); }
    catch { error = 'Не вдалося прочитати фото. Спробуй інше.'; }
    finally { busy = false; }
  }
  const groups = [['fun', 'Веселі'], ['serious', 'Серйозні']];
</script>

<div class="preview">
  <Avatar {player} size={150} />
  {#if busy}<p class="hint">Стискаю фото…</p>{/if}
  {#if error}<p class="err">{error}</p>{/if}
</div>

<div class="row">
  <label class="btn">📷 Камера<input type="file" accept="image/*" capture="user" onchange={onfile} /></label>
  <label class="btn">🖼️ Галерея<input type="file" accept="image/*" onchange={onfile} /></label>
  {#if player.photo}<button class="btn ghost" onclick={() => (player.photo = null)}>Прибрати</button>{/if}
</div>

{#each groups as [kind, title]}
  <h3>{title} шаблони</h3>
  <div class="tpls">
    {#if kind === 'fun'}
      <button class="tpl" class:on={!player.template} onclick={() => (player.template = null)}>
        <Avatar player={{ ...player, template: null }} size={56} /><span>Без шаблону</span>
      </button>
    {/if}
    {#each TEMPLATES.filter((t) => t.kind === kind) as t (t.id)}
      <button class="tpl" class:on={player.template === t.id} onclick={() => (player.template = t.id)}>
        <Avatar player={{ ...player, template: t.id }} size={56} /><span>{t.name}</span>
      </button>
    {/each}
  </div>
{/each}

<p class="hint">Фото залишається тільки на цьому телефоні. На кроці 6 шаблон можна буде посунути й збільшити пальцем.</p>

<style>
  .preview { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 0 8px; }
  .row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 8px; }
  .btn { display: inline-flex; align-items: center; min-height: 48px; padding: 0 16px; border-radius: 14px; border: 2px solid var(--line); background: var(--card); font-weight: 700; cursor: pointer; }
  .btn.ghost { background: transparent; }
  .btn input { display: none; }
  h3 { font-size: 15px; margin: 14px 0 8px; color: var(--dim); }
  .tpls { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; }
  .tpl { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 4px 8px; border-radius: 14px; border: 2px solid var(--line); background: var(--card); font-size: 12px; font-weight: 700; }
  .tpl.on { border-color: var(--accent); background: var(--soft); }
  .hint { font-size: 13px; color: var(--dim); text-align: center; margin: 12px 0 0; }
  .err { color: var(--no); font-weight: 700; margin: 0; }
</style>

<script>
  import Avatar from '../components/Avatar.svelte';
  import Sheet from '../components/Sheet.svelte';
  import PhotoEditor from '../components/PhotoEditor.svelte';

  // players — масив { name, photo, template }, змінюється на місці (він $state у App)
  let { players = $bindable(), settings = $bindable(), inGame, onstart } = $props();
  let photoFor = $state(null);

  const MIN = 2, MAX = 8;
  const names = $derived(players.map((p) => p.name.trim()));
  const empty = $derived(names.some((n) => !n));
  const dups = $derived(names.filter((n, i) => n && names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) !== i));
  const canStart = $derived(players.length >= MIN && !empty);

  const add = () => players.length < MAX && players.push({ name: '', photo: null, template: null });
  const remove = (i) => players.length > MIN && players.splice(i, 1);
  function move(i, d) {
    const j = i + d; if (j < 0 || j >= players.length) return;
    [players[i], players[j]] = [players[j], players[i]];
  }
</script>

<h1>{inGame ? 'Гравці й налаштування' : 'Хто грає?'}</h1>
<p class="lead">Запиши імена <b>за годинниковою стрілкою</b>, як ви сидите. Наступний у списку сидить ліворуч від попереднього.</p>

<ol class="players">
  {#each players as p, i}
    <li>
      <button class="ph" onclick={() => (photoFor = i)} aria-label="Фото для {p.name || `гравця ${i + 1}`}">
        <Avatar player={p} size={48} /><span class="cam" aria-hidden="true">📷</span>
      </button>
      <input bind:value={p.name} placeholder="Гравець {i + 1}" maxlength="16" autocomplete="off" enterkeyhint="next" />
      <div class="ord">
        <button onclick={() => move(i, -1)} disabled={i === 0} aria-label="Вище">↑</button>
        <button onclick={() => move(i, 1)} disabled={i === players.length - 1} aria-label="Нижче">↓</button>
      </div>
      <button class="del" onclick={() => remove(i)} disabled={players.length <= MIN || inGame} aria-label="Прибрати">✕</button>
    </li>
  {/each}
</ol>
{#if !inGame && players.length < MAX}<button class="add" onclick={add}>＋ Додати гравця</button>{/if}
{#if inGame}<p class="note">Під час гри можна міняти імена, фото й порядок. Додати чи прибрати гравця — на кроці 3.</p>{/if}
{#if dups.length}<p class="warn">Однакові імена: {[...new Set(dups)].join(', ')}. Можна й так, але буде легко сплутати.</p>{/if}

<section class="opts">
  <div class="opt">
    <span class="lbl">Хто грає</span>
    <div class="seg" role="radiogroup" aria-label="Аудиторія">
      <button role="radio" aria-checked={settings.audience === 'family'} class:on={settings.audience === 'family'} disabled={inGame} onclick={() => (settings.audience = 'family')}>Уся родина</button>
      <button role="radio" aria-checked={settings.audience === 'kids'} class:on={settings.audience === 'kids'} disabled={inGame} onclick={() => (settings.audience = 'kids')}>Лише діти</button>
    </div>
  </div>
  <label class="opt sw">
    <span><span class="lbl">Режим з балами</span><small>Бал за правильну відповідь у «Вгадай» і «Що про тебе знають»</small></span>
    <input type="checkbox" bind:checked={settings.scoring} />
  </label>
  <label class="opt sw off">
    <span><span class="lbl">Голос браузера</span><small>Читати питання вголос, якщо немає озвучки (крок 8)</small></span>
    <input type="checkbox" disabled />
  </label>
</section>

<button class="start" disabled={!canStart} onclick={onstart}>{inGame ? 'Повернутися до гри' : 'Почати гру'}</button>
{#if empty}<p class="hint">Заповни всі імена, щоб почати.</p>{/if}

{#if photoFor !== null}
  <Sheet title="Фото: {players[photoFor].name || `гравець ${photoFor + 1}`}" onclose={() => (photoFor = null)}>
    <PhotoEditor bind:player={players[photoFor]} />
  </Sheet>
{/if}

<style>
  h1 { font-size: 26px; margin: 0 0 4px; }
  .lead { color: var(--dim); margin: 0 0 14px; font-size: 15px; }
  .lead b { color: var(--ink); }
  .players { list-style: none; padding: 0; margin: 0 0 8px; display: flex; flex-direction: column; gap: 8px; }
  li { display: flex; align-items: center; gap: 8px; background: var(--card); border: 2px solid var(--line); border-radius: 16px; padding: 6px 6px 6px 8px; }
  .ph { position: relative; border: none; background: none; padding: 0; }
  .cam { position: absolute; right: -4px; bottom: -4px; font-size: 14px; background: var(--card); border-radius: 50%; width: 22px; height: 22px; display: grid; place-items: center; box-shadow: 0 0 0 2px var(--line); }
  input:not([type]) { flex: 1; min-width: 0; height: 48px; border: none; background: transparent; font: inherit; font-size: 18px; font-weight: 700; color: var(--ink); outline: none; }
  input::placeholder { color: var(--dim); font-weight: 500; }
  .ord { display: flex; flex-direction: column; }
  .ord button { width: 36px; height: 24px; border: none; background: none; color: var(--dim); font-size: 15px; }
  .ord button:disabled { opacity: .25; }
  .del { width: 40px; height: 40px; border-radius: 12px; border: none; background: var(--soft); color: var(--dim); }
  .del:disabled { opacity: .3; }
  .add { width: 100%; min-height: 52px; border-radius: 16px; border: 2px dashed var(--line); background: transparent; color: var(--dim); font-weight: 700; }
  .note, .hint { font-size: 13px; color: var(--dim); margin: 6px 0 0; }
  .warn { font-size: 13px; color: #b7791f; margin: 6px 0 0; }
  .opts { margin: 18px 0; display: flex; flex-direction: column; gap: 8px; }
  .opt { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--card); border: 2px solid var(--line); border-radius: 16px; padding: 12px 14px; }
  .lbl { font-weight: 700; display: block; }
  small { display: block; color: var(--dim); font-size: 13px; }
  .sw input { width: 26px; height: 26px; accent-color: var(--accent); flex: none; }
  .off { opacity: .55; }
  .seg { display: flex; background: var(--soft); border-radius: 12px; padding: 3px; }
  .seg button { border: none; background: none; padding: 9px 12px; border-radius: 10px; font-weight: 700; font-size: 14px; color: var(--dim); }
  .seg button.on { background: var(--card); color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .seg button:disabled:not(.on) { opacity: .5; }
  .start { width: 100%; min-height: 58px; border-radius: 18px; border: none; background: var(--accent); color: var(--accent-ink); font-weight: 800; font-size: 19px; }
  .start:disabled { opacity: .45; }
  @media (max-width: 360px) { .opt:first-child { flex-direction: column; align-items: stretch; } }
</style>

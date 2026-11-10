<script>
  import Avatar from '../components/Avatar.svelte';
  import Sheet from '../components/Sheet.svelte';
  import PhotoEditor from '../components/PhotoEditor.svelte';
  import { newId } from '../lib/storage.js';

  // players — масив { id, name, photo, template } ($state у App, змінюється на місці)
  let { players = $bindable(), settings = $bindable(), inGame, onstart, voiceAvailable = false, audioCount = 0, wakeLock = true, audio = null } = $props();
  let photoFor = $state(null);

  const MIN = 2, MAX = 8;
  const names = $derived(players.map((p) => p.name.trim()));
  const empty = $derived(names.some((n) => !n));
  const dups = $derived([...new Set(names.filter((n, i) => n && names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) !== i))]);
  const canStart = $derived(players.length >= MIN && !empty);

  function add() {
    if (players.length >= MAX) return;
    players.push({ id: newId(), name: '', photo: null, template: null, tplPos: { x: 0, y: 0, s: 1 } });
    requestAnimationFrame(() => document.querySelectorAll('.players input')[players.length - 1]?.focus());
  }
  function remove(i) {
    if (players.length <= MIN) return;
    const who = players[i].name.trim() || `гравця ${i + 1}`;
    if (inGame && !confirm(`Прибрати ${who} з гри? Його бали лишаться в підсумку.`)) return;
    players.splice(i, 1);
  }
  function clearPhotos() {
    if (!confirm('Видалити фото й шаблони всіх гравців? Їх буде стерто з цього телефона.')) return;
    for (const p of players) { p.photo = null; p.template = null; p.tplPos = { x: 0, y: 0, s: 1 }; }
  }
  function move(i, d) {
    const j = i + d; if (j < 0 || j >= players.length) return;
    [players[i], players[j]] = [players[j], players[i]];
  }
  // Позиції на колі: перший зверху, далі за годинниковою стрілкою
  const seats = $derived(players.map((p, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / players.length;
    return { p, x: 50 + Math.cos(a) * 38, y: 50 + Math.sin(a) * 38 };
  }));
</script>

<header class="hero">
  <div class="logo" aria-hidden="true"><span>🙋</span><span>❓</span><span>💛</span></div>
  <h1>{inGame ? 'Гравці й налаштування' : 'Хто є хто'}</h1>
  <p>{inGame ? 'Можна міняти імена, фото, порядок, додавати й прибирати гравців.' : 'Гра, щоб дізнатися одне про одного більше'}</p>
</header>

<section class="panel">
  <h2>Хто де сидить?</h2>
  <div class="circle" aria-hidden="true">
    <svg viewBox="0 0 100 100" class="ring"><circle cx="50" cy="50" r="38" /><path d="M 78 20 A 38 38 0 0 1 88 44" /><path d="M 86 38 L 88 45 L 82 42" class="head" /></svg>
    <span class="hint">телефон іде<br />за стрілкою ↻</span>
    {#each seats as s, i (s.p.id)}
      <span class="seat" style="left:{s.x}%; top:{s.y}%"><Avatar player={s.p} size={players.length > 6 ? 36 : 42} /><b>{s.p.name.trim() || i + 1}</b></span>
    {/each}
  </div>
  <p class="lead">Запиши імена <b>за годинниковою стрілкою</b>, як ви сидите. Наступний у списку сидить <b>ліворуч</b> від попереднього.</p>

  <ol class="players">
    {#each players as p, i (p.id)}
      <li>
        <span class="no">{i + 1}</span>
        <button class="ph" onclick={() => (photoFor = i)} aria-label="Фото для {p.name || `гравця ${i + 1}`}">
          <Avatar player={p} size={50} /><span class="cam" aria-hidden="true">📷</span>
        </button>
        <input bind:value={p.name} placeholder="Ім'я {i + 1}" maxlength="16" autocomplete="off" enterkeyhint="next" aria-label="Ім'я гравця {i + 1}" />
        <div class="ord">
          <button onclick={() => move(i, -1)} disabled={i === 0} aria-label="Перемістити вище">▲</button>
          <button onclick={() => move(i, 1)} disabled={i === players.length - 1} aria-label="Перемістити нижче">▼</button>
        </div>
        <button class="del" onclick={() => remove(i)} disabled={players.length <= MIN} aria-label="Прибрати гравця {i + 1}">✕</button>
      </li>
    {/each}
  </ol>
  {#if players.length < MAX}<button class="add" onclick={add}>＋ Додати гравця <small>({players.length} з {MAX})</small></button>{/if}
  {#if players.some((p) => p.photo)}
    <button class="clearph" onclick={clearPhotos}>🗑️ Видалити всі фото</button>
  {/if}
  {#if dups.length}<p class="warn">⚠️ Однакові імена: {dups.join(', ')}. Можна й так, але буде легко сплутати.</p>{/if}
</section>

<section class="panel opts">
  <div class="opt">
    <span class="lbl">Хто грає</span>
    <div class="seg" role="radiogroup" aria-label="Аудиторія">
      <button role="radio" aria-checked={settings.audience === 'family'} class:on={settings.audience === 'family'} disabled={inGame} onclick={() => (settings.audience = 'family')}>👨‍👩‍👧 Уся родина</button>
      <button role="radio" aria-checked={settings.audience === 'kids'} class:on={settings.audience === 'kids'} disabled={inGame} onclick={() => (settings.audience = 'kids')}>🧒 Лише діти</button>
    </div>
  </div>
  {#if inGame}<p class="note">Аудиторію можна змінити лише в новій грі.</p>{/if}
  <label class="opt sw">
    <span><span class="lbl">⭐ Режим з балами</span><small>Бал за правильну відповідь у «Вгадай» і «Що про тебе знають»</small></span>
    <input type="checkbox" role="switch" bind:checked={settings.scoring} />
  </label>
  <label class="opt sw" class:off={!voiceAvailable}>
    <span><span class="lbl">🔈 Голос браузера</span><small>{voiceAvailable
      ? `Читати питання вголос там, де немає записаної озвучки${audioCount ? ` (записано: ${audioCount})` : ''}`
      : 'На цьому телефоні немає українського голосу — кнопка недоступна'}</small></span>
    <input type="checkbox" role="switch" bind:checked={settings.voice} disabled={!voiceAvailable} aria-label="Голос браузера" />
  </label>
  {#if audio?.total}
    <div class="opt audio">
      <span><span class="lbl">🎧 Озвучка для офлайну</span>
        <small>{audio.done >= audio.total ? `Готово: ${audio.total} з ${audio.total}` : audio.busy ? `Завантажую… ${audio.done} з ${audio.total}` : `Завантажено ${audio.done} з ${audio.total}`}</small>
        <span class="bar" aria-hidden="true"><i style="width:{(audio.done / audio.total) * 100}%"></i></span>
      </span>
      {#if audio.done < audio.total}<button class="mini" onclick={audio.fetch} disabled={audio.busy}>Завантажити</button>
      {:else}<button class="mini danger" onclick={audio.remove}>Видалити</button>{/if}
    </div>
  {/if}
  {#if !wakeLock}<p class="note">💡 Телефон може гаснути під час гри. Вимкни автоблокування в налаштуваннях телефона на час гри.</p>{/if}
</section>

<button class="chunky start" disabled={!canStart} onclick={onstart}>{inGame ? '▶ Повернутися до гри' : '🎲 Почати гру'}</button>
{#if empty}<p class="hint2">Заповни всі імена, щоб почати.</p>{/if}

{#if photoFor !== null}
  <Sheet title="Фото: {players[photoFor].name || `гравець ${photoFor + 1}`}" onclose={() => (photoFor = null)}>
    <PhotoEditor bind:player={players[photoFor]} />
  </Sheet>
{/if}

<style>
  .hero { text-align: center; margin: 6px 0 16px; }
  .logo { display: flex; justify-content: center; gap: 6px; margin-bottom: 6px; }
  .logo span { width: 50px; height: 50px; display: grid; place-items: center; font-size: 26px; border-radius: 16px; background: var(--card); box-shadow: 0 4px 0 var(--line), var(--shadow); animation: bob 2.4s ease-in-out infinite; }
  .logo span:nth-child(2) { animation-delay: .3s; transform: rotate(6deg); }
  .logo span:nth-child(3) { animation-delay: .6s; }
  @keyframes bob { 50% { transform: translateY(-5px) rotate(-3deg); } }
  h1 { font-size: 34px; margin: 0; font-weight: 1000; letter-spacing: -.02em;
    background: linear-gradient(90deg, #FF7A1A, #E8467A 45%, #5B3DF0); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .hero p { margin: 4px 0 0; color: var(--dim); font-weight: 700; }
  .panel { background: var(--card); border: 2px solid var(--line); border-radius: 26px; padding: 16px; margin-bottom: 14px; box-shadow: var(--shadow); }
  h2 { margin: 0 0 4px; font-size: 18px; font-weight: 900; }
  .circle { position: relative; width: min(100%, 300px); aspect-ratio: 1; margin: 0 auto; }
  .ring { position: absolute; inset: 0; width: 100%; height: 100%; }
  .ring circle { fill: none; stroke: var(--line); stroke-width: 1.4; stroke-dasharray: 2 2.5; }
  .ring path { fill: none; stroke: var(--accent); stroke-width: 1.6; stroke-linecap: round; }
  .ring .head { stroke-linejoin: round; }
  .hint { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; font-size: 13px; color: var(--dim); font-weight: 800; }
  .seat { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 2px; transition: left .3s, top .3s; }
  .seat b { font-size: 12px; font-weight: 900; max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: var(--card); padding: 0 6px; border-radius: 8px; }
  .lead { color: var(--dim); margin: 6px 0 12px; font-size: 14px; font-weight: 700; text-align: center; }
  .lead b { color: var(--ink); }
  .players { list-style: none; padding: 0; margin: 0 0 10px; display: flex; flex-direction: column; gap: 8px; }
  li { display: flex; align-items: center; gap: 8px; background: var(--soft); border-radius: 18px; padding: 6px 6px 6px 8px; animation: rise .3s cubic-bezier(.2, 1.4, .4, 1); }
  @keyframes rise { from { transform: scale(.9); opacity: 0; } }
  .no { width: 22px; text-align: center; font-weight: 900; color: var(--dim); font-size: 14px; }
  .ph { position: relative; border: none; background: none; padding: 0; }
  .cam { position: absolute; right: -5px; bottom: -5px; font-size: 13px; background: var(--card); border-radius: 50%; width: 24px; height: 24px; display: grid; place-items: center; box-shadow: 0 2px 0 var(--line); }
  input:not([type]) { flex: 1; min-width: 0; height: 50px; border: none; background: var(--card); border-radius: 14px; padding: 0 12px; font: inherit; font-size: 18px; font-weight: 800; color: var(--ink); outline: none; box-shadow: inset 0 2px 0 var(--line); }
  input:not([type]):focus { box-shadow: inset 0 0 0 2px var(--accent); }
  input::placeholder { color: var(--dim); font-weight: 600; }
  .ord { display: flex; flex-direction: column; gap: 2px; }
  .ord button { width: 34px; height: 24px; border: none; border-radius: 8px; background: var(--card); color: var(--dim); font-size: 11px; }
  .ord button:disabled { opacity: .3; }
  .del { width: 40px; height: 40px; border-radius: 12px; border: none; background: var(--card); color: var(--no); font-weight: 900; }
  .del:disabled { opacity: .3; }
  .add { width: 100%; min-height: 54px; border-radius: 18px; border: 2px dashed var(--line); background: transparent; color: var(--ink); font-weight: 900; }
  .add small { color: var(--dim); font-weight: 700; }
  .clearph { width: 100%; min-height: 44px; margin-top: 8px; border: none; background: none; color: var(--no); font-weight: 800; }
  .warn { font-size: 13px; color: #b7791f; margin: 8px 0 0; font-weight: 700; }
  .opts { display: flex; flex-direction: column; gap: 10px; }
  .opt { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .lbl { font-weight: 900; display: block; }
  small { display: block; color: var(--dim); font-size: 13px; font-weight: 700; }
  .sw input { appearance: none; width: 54px; height: 32px; border-radius: 20px; background: var(--line); position: relative; flex: none; transition: background .2s; cursor: pointer; }
  .sw input::after { content: ''; position: absolute; top: 3px; left: 3px; width: 26px; height: 26px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(0, 0, 0, .2); transition: transform .2s; }
  .sw input:checked { background: var(--ok); }
  .sw input:checked::after { transform: translateX(22px); }
  .off { opacity: .5; }
  .audio > span { flex: 1; min-width: 0; }
  .bar { display: block; height: 8px; border-radius: 6px; background: var(--line); margin-top: 6px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--ok); transition: width .3s; }
  .mini { min-height: 40px; padding: 0 12px; border-radius: 12px; border: none; background: var(--soft); font-weight: 900; box-shadow: 0 3px 0 var(--line); flex: none; }
  .mini.danger { color: var(--no); }
  .seg { display: flex; background: var(--soft); border-radius: 14px; padding: 4px; gap: 4px; }
  .seg button { border: none; background: none; padding: 10px 10px; border-radius: 11px; font-weight: 900; font-size: 14px; color: var(--dim); white-space: nowrap; }
  .seg button.on { background: var(--card); color: var(--ink); box-shadow: 0 3px 0 var(--line); }
  .seg button:disabled:not(.on) { opacity: .4; }
  .note, .hint2 { font-size: 13px; color: var(--dim); margin: 0; font-weight: 700; }
  .hint2 { text-align: center; margin-top: 10px; }
  .start { width: 100%; font-size: 21px; min-height: 64px; }
  @media (max-width: 380px) { .opt:first-child { flex-direction: column; align-items: stretch; } .seg button { flex: 1; } }
</style>

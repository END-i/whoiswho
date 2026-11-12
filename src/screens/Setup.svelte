<script>
  import Avatar from '../components/Avatar.svelte';
  import Sheet from '../components/Sheet.svelte';
  import PhotoEditor from '../components/PhotoEditor.svelte';
  import { newId } from '../lib/storage.js';
  import { assignColors } from '../lib/theme.js';
  import { t } from '../lib/lang.svelte.js';
  import { LANGS, LANG_NAMES } from '../lib/i18n.js';

  // players — масив { id, name, photo, template } ($state у App, змінюється на місці)
  // packs — описи наборів (meta.pack) у порядку показу; gamePack — набір поточної гри
  let { players = $bindable(), settings = $bindable(), packs = [], gamePack = null, inGame, onstart, historyCount = 0, onhistory = () => {}, showInstall = false, oninstall = () => {}, onabout = () => {}, voiceAvailable = false, audioCount = 0, favCount = 0, audioFull = false, wakeLock = true, audio = null } = $props();
  let photoFor = $state(null);

  const MIN = 2;
  const pack = $derived(packs.find((p) => p.id === (inGame ? gamePack : settings.pack)) ?? packs[0] ?? { minPlayers: 2, maxPlayers: 8 });
  const MAX = $derived(pack.maxPlayers);
  const names = $derived(players.map((p) => p.name.trim()));
  const empty = $derived(names.some((n) => !n));
  const dups = $derived([...new Set(names.filter((n, i) => n && names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) !== i))]);
  const fits = $derived(players.length >= pack.minPlayers && players.length <= pack.maxPlayers);
  const canStart = $derived(fits && !empty);
  const limit = $derived(pack.minPlayers === pack.maxPlayers
    ? t('setup.limitExact', { n: pack.maxPlayers })
    : t('setup.limitRange', { min: pack.minPlayers, max: pack.maxPlayers }));

  const ADULT_Q = () => t('setup.adultConfirm');
  function choosePack(p) {
    if (p.id === settings.pack) return;
    if (p.adults && !confirm(ADULT_Q())) return;
    settings.pack = p.id;
  }
  // 18+ — підтвердження ще й перед кожною новою грою: телефон міг перейти до дітей
  function start() {
    if (!inGame && pack.adults && !confirm(ADULT_Q())) return;
    onstart();
  }

  function add() {
    if (players.length >= MAX) return;
    // колір — вільний серед тих, хто вже грає
    players.push(assignColors([...players, { id: newId(), name: '', photo: null, template: null, tplPos: { x: 0, y: 0, s: 1 } }]).at(-1));
    requestAnimationFrame(() => document.querySelectorAll('.players input')[players.length - 1]?.focus());
  }
  function remove(i) {
    if (players.length <= MIN) return;
    const who = players[i].name.trim() || t('setup.playerGen', { n: i + 1 });
    if (inGame && !confirm(t('setup.removeConfirm', { who }))) return;
    players.splice(i, 1);
  }
  function clearPhotos() {
    if (!confirm(t('setup.clearPhotosConfirm'))) return;
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

{#if showInstall && !inGame}<button class="installbar" onclick={oninstall}>{t('setup.installBar')} <b>→</b></button>{/if}
<header class="hero">
  <div class="logo" aria-hidden="true"><span>🙋</span><span>❓</span><span>💛</span></div>
  <h1>{inGame ? t('setup.titleInGame') : t('app.title')}</h1>
  <p>{inGame ? t('setup.subtitleInGame') : t('setup.subtitle')}</p>
</header>

<section class="panel">
  <h2>{t('setup.seats')}</h2>
  <div class="circle" aria-hidden="true">
    <svg viewBox="0 0 100 100" class="ring">
      <defs><marker id="arrowhead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="tip" /></marker></defs>
      <circle cx="50" cy="50" r="38" />
      <path class="arc" d="M 63.0 14.29 A 38 38 0 0 1 82.91 31" marker-end="url(#arrowhead)" />
    </svg>
    <span class="hint">{t('setup.arrow1')}<br />{t('setup.arrow2')}</span>
    {#each seats as s, i (s.p.id)}
      <span class="seat" style="left:{s.x}%; top:{s.y}%"><Avatar player={s.p} size={players.length > 6 ? 36 : 42} /><b>{s.p.name.trim() || i + 1}</b></span>
    {/each}
  </div>
  <p class="lead">{t('setup.lead1')} <b>{t('setup.lead2')}</b>{t('setup.lead3')} <b>{t('setup.lead4')}</b> {t('setup.lead5')}</p>

  <ol class="players">
    {#each players as p, i (p.id)}
      <li>
        <span class="no">{i + 1}</span>
        <button class="ph" onclick={() => (photoFor = i)} aria-label={t('setup.photoFor', { name: p.name || t('setup.playerGen', { n: i + 1 }) })}>
          <Avatar player={p} size={50} /><span class="cam" aria-hidden="true">📷</span>
        </button>
        <input bind:value={p.name} placeholder={t('setup.namePh', { n: i + 1 })} maxlength="16" autocomplete="off" enterkeyhint="next" aria-label={t('setup.nameLabel', { n: i + 1 })} />
        <div class="ord">
          <button onclick={() => move(i, -1)} disabled={i === 0} aria-label={t('setup.up')}>▲</button>
          <button onclick={() => move(i, 1)} disabled={i === players.length - 1} aria-label={t('setup.down')}>▼</button>
        </div>
        <button class="del" onclick={() => remove(i)} disabled={players.length <= MIN} aria-label={t('setup.removeLabel', { n: i + 1 })}>✕</button>
      </li>
    {/each}
  </ol>
  {#if players.length < MAX}<button class="add" onclick={add}>{t('setup.add')} <small>({t('common.of', { a: players.length, b: MAX })})</small></button>{/if}
  {#if players.some((p) => p.photo)}
    <button class="clearph" onclick={clearPhotos}>{t('setup.clearPhotos')}</button>
  {/if}
  {#if dups.length}<p class="warn">{t('setup.dups', { names: dups.join(', ') })}</p>{/if}
</section>

<section class="panel packs">
  <h2>{t('setup.packs')}</h2>
  <div class="packlist" role="radiogroup" aria-label={t('setup.packs')}>
    {#each packs as p (p.id)}
      <button role="radio" class="pack" class:on={pack.id === p.id} aria-checked={pack.id === p.id} disabled={inGame} onclick={() => choosePack(p)}>
        <span class="pe" aria-hidden="true">{p.emoji}</span>
        <span><b>{p.title}</b><small>{p.description}</small></span>
      </button>
    {/each}
  </div>
  {#if favCount && !inGame}
    <label class="opt sw fav">
      <span><span class="lbl">{t('setup.onlyFav', { n: favCount })}</span><small>{t('setup.onlyFavHint')}</small></span>
      <input type="checkbox" role="switch" bind:checked={settings.onlyFav} aria-label={t('setup.onlyFavLabel')} />
    </label>
  {/if}
  {#if inGame}<p class="note">{t('setup.packLocked')}</p>{/if}
</section>

<section class="panel opts">
  <div class="opt choice">
    <span class="lbl">{t('lang.label')}</span>
    <div class="seg" role="radiogroup" aria-label={t('lang.label')}>
      {#each LANGS as l}
        <button role="radio" lang={l} aria-checked={settings.lang === l} class:on={settings.lang === l} onclick={() => (settings.lang = l)}>{LANG_NAMES[l]}</button>
      {/each}
    </div>
  </div>
  <div class="opt choice">
    <span class="lbl">{t('cats.mode')}</span>
    <div class="seg" role="radiogroup" aria-label={t('cats.mode')}>
      {#each ['tiles', 'wheel'] as m}
        <button role="radio" aria-checked={settings.mode === m} class:on={settings.mode === m} onclick={() => (settings.mode = m)}>{t(`cats.${m}`)}</button>
      {/each}
    </div>
  </div>
  {#if pack.kids}
  <div class="opt choice">
    <span class="lbl">{t('setup.whoPlays')}</span>
    <div class="seg" role="radiogroup" aria-label={t('setup.audience')}>
      <button role="radio" aria-checked={settings.audience === 'family'} class:on={settings.audience === 'family'} disabled={inGame} onclick={() => (settings.audience = 'family')}>{t('setup.audFamily')}</button>
      <button role="radio" aria-checked={settings.audience === 'kids'} class:on={settings.audience === 'kids'} disabled={inGame} onclick={() => (settings.audience = 'kids')}>{t('setup.audKids')}</button>
    </div>
  </div>
  {#if inGame}<p class="note">{t('setup.audLocked')}</p>{/if}
  {/if}
  <label class="opt sw">
    <span><span class="lbl">{t('setup.scoring')}</span><small>{t('setup.scoringHint')}</small></span>
    <input type="checkbox" role="switch" bind:checked={settings.scoring} />
  </label>
  {#if !wakeLock}<p class="note">{t('setup.noWake')}</p>{/if}
</section>

<section class="panel opts">
  <h2>{t('setup.soundTitle')}</h2>
  <label class="opt sw">
    <span><span class="lbl">{t('setup.sounds')}</span><small>{t('setup.soundsHint')}</small></span>
    <input type="checkbox" role="switch" bind:checked={settings.sounds} aria-label={t('setup.soundsLabel')} />
  </label>
  <label class="opt sw">
    <span><span class="lbl">{t('setup.autoRead')}</span><small>{t('setup.autoReadHint')}</small></span>
    <input type="checkbox" role="switch" bind:checked={settings.autoRead} aria-label={t('setup.autoReadLabel')} />
  </label>
  <!-- голос браузера потрібен лише там, де немає записаної озвучки -->
  {#if !audioFull}
  <label class="opt sw" class:off={!voiceAvailable}>
    <span><span class="lbl">{t('setup.voice')}</span><small>{voiceAvailable
      ? t('setup.voiceHint') + (audioCount ? t('setup.voiceRecorded', { n: audioCount }) : '')
      : t('setup.voiceNone')}</small></span>
    <input type="checkbox" role="switch" bind:checked={settings.voice} disabled={!voiceAvailable} aria-label={t('setup.voiceLabel')} />
  </label>
  {/if}
  {#if audio?.total}
    <div class="opt audio">
      <span><span class="lbl">{t('setup.offline')}</span>
        <small>{audio.done >= audio.total ? t('setup.offlineDone', { n: audio.total }) : audio.busy ? t('setup.offlineBusy', { a: audio.done, b: audio.total })
          : audio.done ? t('setup.offlinePart', { a: audio.done, b: audio.total }) : t('setup.offlineAsk')}{#if audio.done < audio.total && audio.mb} {t('setup.offlineSize', { mb: audio.mb })}{/if}</small>
        <span class="bar" aria-hidden="true"><i style="width:{(audio.done / audio.total) * 100}%"></i></span>
      </span>
      {#if audio.done < audio.total}<button class="mini" onclick={audio.fetch} disabled={audio.busy}>{t('setup.download')}</button>
      {:else}<button class="mini danger" onclick={audio.remove}>{t('setup.delete')}</button>{/if}
    </div>
  {/if}
</section>

{#if !fits}<p class="warn" role="status">{t('setup.limit', { pack: pack.title, limit })} {players.length > pack.maxPlayers ? t('setup.tooMany') : t('setup.tooFew')}</p>{/if}
<button class="chunky start" disabled={!canStart} onclick={start}>{inGame ? t('setup.back') : t('setup.start')}</button>
{#if empty}<p class="hint2">{t('setup.fillNames')}</p>{/if}
{#if historyCount && !inGame}<button class="hist" onclick={onhistory}>{t('setup.history', { n: historyCount })}</button>{/if}
<button class="about" onclick={onabout}>{t('setup.about', { v: __APP_VERSION__ })}</button>

{#if photoFor !== null}
  <Sheet title={t('setup.photoTitle', { name: players[photoFor].name || t('setup.playerNom', { n: photoFor + 1 }) })} onclose={() => (photoFor = null)}>
    <PhotoEditor bind:player={players[photoFor]} />
  </Sheet>
{/if}

<style>
  .packlist { display: flex; flex-direction: column; gap: 8px; }
  .pack { display: flex; align-items: center; gap: 12px; text-align: left; padding: 10px 14px; border-radius: 18px; border: 3px solid transparent; background: var(--soft); color: var(--ink); }
  .pack.on { border-color: var(--accent); background: var(--card); }
  .pack:disabled:not(.on) { opacity: .5; }
  .pack .pe { font-size: 30px; }
  .pack b { display: block; font-size: 17px; font-weight: 900; }
  .pack small { display: block; color: var(--dim); font-weight: 700; font-size: 13px; }
  .installbar { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 8px; text-align: left; min-height: 48px; padding: 8px 14px; border-radius: 16px; border: 2px dashed var(--accent); background: var(--soft); font-weight: 800; margin-bottom: 8px; }
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
  .ring .arc { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: round; }
  .ring .tip { fill: var(--accent); }
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
  .about { width: 100%; min-height: 44px; margin-top: 8px; border: none; background: none; color: var(--dim); font-weight: 800; }
  .hist { width: 100%; min-height: 52px; margin-top: 12px; border-radius: 18px; border: 2px solid var(--line); background: var(--card); font-weight: 900; box-shadow: 0 3px 0 var(--line); }
  .start { width: 100%; font-size: 21px; min-height: 64px; }
  @media (max-width: 380px) { .opt.choice { flex-direction: column; align-items: stretch; } .seg button { flex: 1; } }
</style>

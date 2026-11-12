<script>
  import { loadPacks, byAudience } from './lib/questions.js';
  import { newGame, finishCard, remaining, allDone, updatePlayers, restoreGame, endGame, undoCard, POINTS, randomCard, randomNumber } from './lib/state.js';
  import { gameRecord, addRecord, cleanHistory } from './lib/history.js';
  import { loadAll, saveAll, newId } from './lib/storage.js';
  import { clampTpl, migrateTemplate } from './lib/templates.js';
  import { assignColors } from './lib/theme.js';
  import { toggleFavorite, favoriteQuestions, cleanFavorites } from './lib/favorites.js';
  import Setup from './screens/Setup.svelte';
  import Rules from './screens/Rules.svelte';
  import Categories from './screens/Categories.svelte';
  import Grid from './screens/Grid.svelte';
  import Summary from './screens/Summary.svelte';
  import History from './screens/History.svelte';
  import Install from './screens/Install.svelte';
  import About from './screens/About.svelte';
  import { platform, isStandalone } from './lib/install.js';
  import TopBar from './components/TopBar.svelte';
  import Sheet from './components/Sheet.svelte';
  import Avatar from './components/Avatar.svelte';
  import Confetti from './components/Confetti.svelte';
  import audioList from 'virtual:audio-ids';
  import { pickVoice, answerId } from './lib/speech.js';
  import { createWakeLock, supported as wakeSupported } from './lib/wakelock.js';
  import { onDestroy, untrack } from 'svelte';
  import { downloadAll, cachedCount, clearAudio, megabytes } from './lib/audiocache.js';
  import { playSfx } from './lib/sfx.js';
  import { t, setLang } from './lib/lang.svelte.js';
  import { cleanLang } from './lib/i18n.js';
  import { loadRuFiles } from './ru-packs.js';

  // Набори питань читаються один раз під час старту: кожен файл у src/data/packs — окремий набір,
  // у src/data/packs/ru — той самий набір російською (ті самі id); немає перекладу — українською.
  const byName = (files) => Object.fromEntries(Object.entries(files).map(([f, d]) => [f.split('/').pop(), d]));
  const ukFiles = byName(import.meta.glob('./data/packs/*.json', { eager: true, import: 'default' }));
  // російські — окремим шматком (src/ru-packs.js): main.js підвантажує їх до старту, якщо мова вже російська
  let { preloadedRu = null } = $props();
  // svelte-ignore state_referenced_locally — потрібне саме початкове значення, далі ruFiles живе своїм життям
  let ruFiles = $state.raw(preloadedRu);
  const LOADED = { uk: loadPacks(ukFiles) };
  const ruLoaded = $derived(ruFiles ? loadPacks({ ...ukFiles, ...ruFiles }) : null);
  const errors = $derived([...new Set([...LOADED.uk.errors, ...(ruLoaded?.errors || [])])]);
  const packOrder = LOADED.uk.order;
  const packOf = (id) => (LOADED.uk.packs[id] ? id : 'family');

  // ---------- відновлення після перезавантаження ----------
  const saved = loadAll() || {};
  const cleanPlayers = (list) => {
    const ok = Array.isArray(list) ? list.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string') : [];
    return ok.length >= 2 ? assignColors(ok.map((p) => ({ id: p.id, name: p.name, color: p.color, photo: p.photo || null, template: migrateTemplate(p.template), tplPos: clampTpl(p.tplPos) }))) : null;
  };
  const SCREENS = ['setup', 'rules', 'categories', 'grid', 'summary', 'history', 'install', 'about'];

  // Усе відновлення — звичайними змінними, один раз; далі стан живе в $state.
  const init = (() => {
    const players = cleanPlayers(saved.players) || assignColors([
      { id: newId(), name: '', photo: null, template: null, tplPos: clampTpl() },
      { id: newId(), name: '', photo: null, template: null, tplPos: clampTpl() },
    ]);
    const pack = LOADED.uk.packs[packOf(saved.game?.pack)];
    const game = pack ? restoreGame(saved.game, pack.questions.map((q) => q.id), players) : null;
    const ui = saved.ui || {};
    let screen = game && SCREENS.includes(ui.screen) ? ui.screen : 'setup';
    const catId = game && pack.categories.some((c) => c.id === ui.catId) ? ui.catId : null;
    const selected = game && catId && Number.isInteger(ui.selected) && remaining(game, catId) && !game.used[catId]?.includes(ui.selected) ? ui.selected : null;
    if (screen === 'grid' && !catId) screen = 'categories';
    if (game?.over && !['history', 'install', 'about'].includes(screen)) screen = 'summary'; // завершена гра — лише підсумок
    return { players, game, screen, catId, selected };
  })();

  let players = $state(init.players);
  let settings = $state({ lang: cleanLang(saved.settings?.lang), pack: packOf(saved.settings?.pack), audience: saved.settings?.audience === 'kids' ? 'kids' : 'family', scoring: saved.settings?.scoring ?? true, voice: !!saved.settings?.voice, sounds: saved.settings?.sounds ?? true, autoRead: saved.settings?.autoRead !== false, offline: saved.settings?.offline === true, onlyFav: saved.settings?.onlyFav === true, mode: saved.settings?.mode === 'wheel' ? 'wheel' : 'tiles' });
  // набори, правила яких уже показували (раніше — просто true для сімейного)
  setLang(cleanLang(saved.settings?.lang));
  $effect(() => setLang(settings.lang));
  // набори мовою інтерфейсу; id і порядок однакові для всіх мов
  // поки російські вантажаться (мить після перемикання) — українські
  const packs = $derived((settings.lang === 'ru' && ruLoaded ? ruLoaded : LOADED.uk).packs);
  $effect(() => { if (settings.lang === 'ru' && !ruFiles) loadRuFiles().then((f) => (ruFiles = f)); });
  let rulesSeen = $state(saved.rulesSeen === true ? ['family'] : Array.isArray(saved.rulesSeen) ? saved.rulesSeen : []);
  let lastDeck = $state(saved.lastDeck || null); // колода минулої гри — щоб номери не повторювались
  let names = $state(saved.names || {});          // id → ім'я всіх, хто будь-коли грав
  let game = $state(init.game);
  let screen = $state(init.screen);
  let catId = $state(init.catId);
  let selected = $state(init.selected);
  let pending = $state(null); // карта, яку вибрала гра («🎲» чи колесо): сітка перевертає її сама
  let history = $state(cleanHistory(saved.history));
  let favorites = $state(cleanFavorites(saved.favorites)); // ❤️ на картках
  // набір поточної гри, а без гри — вибраний у налаштуваннях
  const data = $derived(packs[game?.pack ?? settings.pack] ?? null);
  const byId = $derived(new Map(data ? data.questions.map((q) => [q.id, q]) : []));
  let historyFrom = $state('setup');
  // ---------- встановлення ----------
  const installKind = platform(navigator.userAgent, { standalone: isStandalone(), maxTouchPoints: navigator.maxTouchPoints || 0 });
  let installPrompt = $state(null); // подія Android «можна встановити»
  let installFrom = $state('setup');
  const onBeforeInstall = (e) => { e.preventDefault(); installPrompt = e; };
  window.addEventListener('beforeinstallprompt', onBeforeInstall);
  async function installNow() {
    const e = installPrompt; if (!e) return;
    installPrompt = null;
    await e.prompt();
    await e.userChoice?.catch?.(() => {});
  }
  function openInstall() { installFrom = screen; sheet = null; screen = 'install'; }
  // ---------- нова версія ----------
  let updateReady = $state(false);
  const onUpdate = () => (updateReady = true);
  window.addEventListener('whoiswho:update', onUpdate);
  let aboutFrom = $state('setup');
  function openAbout() { aboutFrom = screen; sheet = null; screen = 'about'; }
  let rulesFrom = $state(null);
  let sheet = $state(null); // null | 'menu' | 'scores'
  let toast = $state(null);
  let party = $state(0);    // лічильник для конфеті
  let toastTimer;
  const UNDO_MS = 5000; // стільки секунд можна скасувати останню відповідь
  const category = $derived(data?.categories.find((c) => c.id === catId));

  // ---------- озвучка ----------
  // id питань із записаною озвучкою — окремо для кожної мови
  const audioByLang = { uk: new Set(audioList.uk || []), ru: new Set(audioList.ru || []) };
  const audioIds = $derived(audioByLang[settings.lang]);
  const synth = globalThis.speechSynthesis;
  let voices = $state.raw([]);
  const loadVoices = () => (voices = synth?.getVoices?.() || []);
  loadVoices();
  synth?.addEventListener?.('voiceschanged', loadVoices);
  const voice = $derived(pickVoice(voices, settings.lang));
  const sound = $derived({ ids: audioIds, start: audioList.start?.[settings.lang] || {}, voiceOn: settings.voice, voice, lang: settings.lang, auto: settings.autoRead, sfx: settings.sounds });
  // Озвучка для офлайну: у фоні під час першого запуску, далі — лише нове;
  // лише мовою інтерфейсу й лише для вибраного набору (усі набори — десятки мегабайтів)
  // усі записи набору: питання й відповіді «Цікавих фактів»
  const packAudioIds = (pack) => pack.questions.flatMap((q) => (q.answer ? [q.id, answerId(q.id)] : [q.id]));
  const offlineIds = () => {
    const ids = audioByLang[settings.lang], pack = packs[game?.pack ?? settings.pack];
    return pack ? packAudioIds(pack).filter((id) => ids.has(id)) : [];
  };
  const offlineKey = () => `${settings.lang}|${game?.pack ?? settings.pack}`;
  // записано все для вибраного набору й мови — голос браузера не потрібен; і скільки мегабайтів качати
  const audioFull = $derived.by(() => { settings.lang; game?.pack; const p = packs[game?.pack ?? settings.pack]; return !!p && offlineIds().length === packAudioIds(p).length; });
  const audioMb = $derived.by(() => { settings.lang; game?.pack; settings.pack; return megabytes(offlineIds(), audioList.size?.[settings.lang]); });
  let audioTotal = $state(0);
  let audioDone = $state(0);
  let audioBusy = $state(false);
  const cacheDeps = { caches: globalThis.caches, fetch: globalThis.fetch?.bind(globalThis), base: import.meta.env.BASE_URL };
  async function fetchAudio() {
    const lang = settings.lang, key = offlineKey(), ids = offlineIds();
    if (audioBusy || !ids.length || !cacheDeps.caches) return;
    settings.offline = true; // згода дана — далі докачується саме (нові набори, мова)
    audioBusy = true;
    const r = await downloadAll(ids, { ...cacheDeps, lang, onProgress: (d) => { if (offlineKey() === key) audioDone = d; } });
    audioBusy = false;
    if (offlineKey() === key) audioDone = r.done; else syncAudio(); // мову чи набір змінили під час завантаження
  }
  async function removeAudio() {
    if (!confirm(t('app.removeAudio'))) return;
    await clearAudio(cacheDeps); audioDone = 0; settings.offline = false;
  }
  function syncAudio() {
    const lang = settings.lang, key = offlineKey(), ids = offlineIds();
    audioDone = 0; audioTotal = ids.length;
    if (!ids.length || !cacheDeps.caches) return;
    cachedCount(ids, { ...cacheDeps, lang }).then((n) => {
      if (offlineKey() !== key) return;
      audioDone = n;
      // качаємо самі лише після згоди (кнопка «Завантажити»); хто вже качав раніше — згоду дав
      if (n) settings.offline = true;
      if (settings.offline && n < ids.length && navigator.onLine !== false) fetchAudio();
    });
  }
  $effect(() => { settings.lang; settings.pack; game?.pack; untrack(syncAudio); });

  // ---------- екран не гасне під час гри ----------
  const wake = createWakeLock();
  $effect(() => { wake.set(screen === 'categories' || screen === 'grid'); });
  onDestroy(() => { wake.dispose(); synth?.removeEventListener?.('voiceschanged', loadVoices); window.removeEventListener('beforeinstallprompt', onBeforeInstall); window.removeEventListener('whoiswho:update', onUpdate); });
  const orderPlayers = $derived(game ? game.order.map((id) => players.find((p) => p.id === id)).filter(Boolean) : players);

  $effect(() => {
    saveAll({
      players: $state.snapshot(players), settings: $state.snapshot(settings), rulesSeen, lastDeck,
      names: $state.snapshot(names), game: $state.snapshot(game), history: $state.snapshot(history), favorites: $state.snapshot(favorites), ui: { screen, catId, selected },
    });
  });

  // Новий екран (чи інша категорія) завжди відкривається згори
  let lastView = `${init.screen}|${init.catId}`;
  $effect(() => {
    const view = `${screen}|${catId}`;
    if (view !== lastView) { lastView = view; window.scrollTo({ top: 0, behavior: 'instant' }); }
  });

  // ---------- дії ----------
  // питання нової гри: усі з набору або лише ❤️ улюблені (якщо їх немає — усі)
  function gameQuestions(pack, audience) {
    const all = byAudience(packs[pack].questions, audience);
    const fav = settings.onlyFav ? favoriteQuestions(all, favorites) : [];
    return fav.length ? fav : all;
  }
  const favCount = $derived(favoriteQuestions(packs[settings.pack]?.questions || [], favorites).length);
  const like = (id) => (favorites = toggleFavorite(favorites, id));
  function start() {
    for (const p of players) names[p.id] = p.name.trim();
    if (!game) {
      const pack = settings.pack, audience = packs[pack].meta.pack.kids ? settings.audience : 'family';
      game = newGame({
        players: players.map((p) => ({ id: p.id, name: p.name.trim() })), pack, audience, scoring: settings.scoring,
        questions: gameQuestions(pack, audience), prevDeck: lastDeck,
      });
      lastDeck = game.deck;
      screen = rulesSeen.includes(pack) ? 'categories' : 'rules';
    } else {
      game = { ...updatePlayers(game, players, names), scoring: settings.scoring };
      screen = catId ? 'grid' : 'categories';
    }
  }
  function finish(num, outcome, answerer, points) {
    game = finishCard(game, catId, num, outcome, answerer, points);
    selected = null;
    const sfx = { correct: 'point', wrong: 'miss', skipped: 'skip' }[outcome];
    if (sfx) playSfx(sfx, { enabled: settings.sounds });
    const name = orderPlayers[answerer]?.name;
    if (outcome === 'correct') party++;
    // повідомлення з «Скасувати»: за столом часто тиснуть не ту кнопку
    toast = {
      ok: outcome === 'correct',
      text: outcome === 'correct' ? t('app.toastPoint', { n: points ?? POINTS.right, name })
        : outcome === 'wrong' && name ? t('app.toastZero', { name })
        : outcome === 'skipped' ? t('app.toastSkip') : t('app.toastDone'),
    };
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (toast = null), UNDO_MS);
    // хід перейшов до наступного — він вибирає категорію сам (екран категорій відкривається згори)
    catId = null; screen = 'categories';
    if (allDone(game)) finishGame();
  }
  // «🎲 Випадкове»: будь-яка категорія з картами, у ній будь-яка карта
  function openRandom() {
    const r = randomCard(game, data.categories.map((c) => c.id));
    if (r) { catId = r.cat; pending = r.num; screen = 'grid'; }
  }
  // колесо зупинилось на категорії — у ній випадкова ще не відкрита карта
  function openWheel(id) {
    const num = randomNumber(game, id);
    if (num != null) { catId = id; pending = num; screen = 'grid'; }
  }
  /** «Скасувати»: остання картка знову закрита, бали й черга як були — і вона знову відкрита. */
  function undo() {
    const l = game?.last;
    toast = null; clearTimeout(toastTimer);
    if (!l || game.over) return;
    game = undoCard(game);
    catId = l.cat; screen = 'grid'; selected = l.num;
  }
  /** Гра закінчилась: запис в історію, далі лише підсумок і нова гра. */
  function finishGame() {
    history = addRecord(history, gameRecord($state.snapshot(game), names, { finished: true }));
    game = endGame(game); selected = null; sheet = null; screen = 'summary';
  }
  function newGameAsk() {
    if (game && !game.over) {
      if (!confirm(t('app.newGameConfirm'))) return;
      history = addRecord(history, gameRecord($state.snapshot(game), names, { finished: false }));
    }
    game = null; catId = null; selected = null; sheet = null; screen = 'setup';
  }
  function endAsk() {
    sheet = null;
    if (confirm(t('app.endConfirm'))) finishGame();
  }
  function openHistory() { historyFrom = screen; sheet = null; screen = 'history'; }
  function clearHistory() {
    if (confirm(t('app.clearHistory'))) history = [];
  }
  const go = (s) => { sheet = null; screen = s; };
</script>

<main>
  {#if errors.length}
    <section class="errors">
      <h1>{t('app.dataError')}</h1>
      <ul>{#each errors as e}<li>{e}</li>{/each}</ul>
    </section>
  {:else if screen === 'setup'}
    <Setup bind:players bind:settings packs={packOrder.map((id) => packs[id].meta.pack)} gamePack={game?.pack} inGame={!!game} onstart={start} historyCount={history.length} onhistory={openHistory} showInstall={installKind !== 'installed'} oninstall={openInstall} onabout={openAbout} voiceAvailable={!!voice} audioCount={audioIds.size} wakeLock={wakeSupported()}
      {favCount} audioFull={audioFull} audio={{ total: audioTotal, done: audioDone, busy: audioBusy, mb: audioMb, fetch: fetchAudio, remove: removeAudio }} />
  {:else if screen === 'rules'}
    <Rules rules={data.meta.rules} again={!!rulesFrom}
      onok={() => { if (!rulesSeen.includes(game.pack)) rulesSeen = [...rulesSeen, game.pack]; screen = rulesFrom || 'categories'; rulesFrom = null; }} />
  {:else if screen === 'summary'}
    <Summary {game} {players} {names} onnew={newGameAsk} onhistory={openHistory} />
  {:else if screen === 'about'}
    <About onback={() => (screen = aboutFrom === 'about' ? 'setup' : aboutFrom)} />
  {:else if screen === 'install'}
    <Install kind={installKind} canPrompt={!!installPrompt} oninstall={installNow} onback={() => (screen = installFrom === 'install' ? 'setup' : installFrom)} />
  {:else if screen === 'history'}
    <History {history} {players} packs={Object.fromEntries(packOrder.map((id) => [id, packs[id].meta.pack]))} onback={() => (screen = historyFrom === 'history' ? 'setup' : historyFrom)} onclear={clearHistory} />
  {:else}
    <TopBar players={orderPlayers} {game} onmenu={() => (sheet = 'menu')} onscores={() => (sheet = 'scores')}
      big={screen !== 'grid'} back={screen === 'grid' ? () => { catId = null; pending = null; screen = 'categories'; } : null} />
    {#if screen === 'grid' && category}
      <Grid {category} index={data.categories.indexOf(category)} {game} players={orderPlayers} {byId} roleNames={data.meta.pack.roleNames} {favorites} onlike={like}
        scoringCategories={data.meta.scoringCategories} {sound} bind:selected bind:pending onfinish={finish} />
    {:else}
      <Categories categories={data.categories} {game} mode={settings.mode} sounds={settings.sounds} onmode={(m) => (settings.mode = m)}
        onpick={(id) => { catId = id; screen = 'grid'; }} onrandom={openRandom} onwheel={openWheel} />
    {/if}
  {/if}
</main>

{#if toast}
  <div class="toast" class:ok={toast.ok} role="status">
    <span>{toast.ok ? '🎉 ' : ''}{toast.text}</span>
    {#if game && !game.over && game.last}<button onclick={undo}>{t('app.undo')}</button>{/if}
  </div>
{/if}
{#if updateReady}
  <div class="update" role="alert"><span>{t('app.update')}</span><button onclick={() => window.__applyUpdate?.()}>{t('app.updateBtn')}</button></div>
{/if}
{#key party}{#if party}<Confetti />{/if}{/key}

{#if sheet === 'menu'}
  <Sheet title={t('menu.title')} onclose={() => (sheet = null)}>
    <nav class="menu">
      <button onclick={() => { rulesFrom = screen; go('rules'); }}><span>📜</span>{t('menu.rules')}</button>
      <button onclick={() => go('setup')}><span>👥</span>{t('menu.players')}</button>
      <button onclick={openHistory}><span>🏆</span>{t('menu.history')}</button>
      {#if installKind !== 'installed'}<button onclick={openInstall}><span>📲</span>{t('menu.install')}</button>{/if}
      <button onclick={openAbout}><span>ℹ️</span>{t('menu.about', { v: __APP_VERSION__ })}</button>
      <button onclick={endAsk}><span>🏁</span>{t('menu.end')}</button>
      <button class="danger" onclick={newGameAsk}><span>🔄</span>{t('menu.new')}</button>
    </nav>
  </Sheet>
{:else if sheet === 'scores'}
  <Sheet title={t('menu.scores')} onclose={() => (sheet = null)}>
    <ol class="scores">
      {#each orderPlayers.map((p) => ({ p, s: game.scores[p.id] || 0 })).sort((a, b) => b.s - a.s) as row}
        <li><Avatar player={row.p} size={40} /><span>{row.p.name}</span><b>{row.s}</b></li>
      {/each}
    </ol>
  </Sheet>
{/if}

<style>
  @font-face { font-family: 'Nunito'; src: url('/fonts/nunito-cyrillic.woff2') format('woff2'); font-weight: 200 1000; font-display: swap;
    unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116; }
  @font-face { font-family: 'Nunito'; src: url('/fonts/nunito-latin.woff2') format('woff2'); font-weight: 200 1000; font-display: swap;
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }

  :global(:root) {
    /* значення звіряються з TOKENS у src/lib/theme.js (e2e) — WCAG AA */
    --bg: #FFF5EA; --card: #FFFFFF; --ink: #2D1B3D; --dim: #76637E; --line: #F2E1D2;
    --accent: #E66E18; --accent2: #B5530C; --ok: #2AA660; --ok2: #1C7A45; --no: #E0434C; --no2: #AE2B33;
    --soft: #FFEBDC; --shadow: 0 10px 30px rgba(120, 60, 20, .14); --radius: 22px;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --bg: #1A1224; --card: #2A1F38; --ink: #F8F0FF; --dim: #B7A6C6; --line: #3B2D4D;
      --soft: #36284A; --shadow: 0 10px 30px rgba(0, 0, 0, .4);
      color-scheme: dark;
    }
  }
  :global(*) { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  :global(html) { background: var(--bg); }
  :global(body) {
    margin: 0; min-height: 100vh; color: var(--ink);
    font: 600 17px/1.35 Nunito, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    background:
      radial-gradient(circle at 12% 8%, rgba(255, 122, 26, .16) 0 90px, transparent 91px),
      radial-gradient(circle at 92% 22%, rgba(139, 108, 255, .14) 0 70px, transparent 71px),
      radial-gradient(circle at 80% 92%, rgba(54, 209, 196, .14) 0 110px, transparent 111px),
      radial-gradient(rgba(127, 90, 150, .09) 1.5px, transparent 1.6px) 0 0 / 22px 22px,
      var(--bg);
    background-attachment: fixed;
  }
  :global(button) { font: inherit; color: inherit; cursor: pointer; touch-action: manipulation; }
  :global(button:disabled) { cursor: default; }
  :global(:focus-visible) { outline: 3px solid var(--accent); outline-offset: 2px; }
  /* Об'ємна «ігрова» кнопка: --c — колір, --c2 — тінь */
  :global(.chunky) {
    --c: var(--accent); --c2: var(--accent2);
    border: none; border-radius: 18px; background: var(--c); color: #fff; font-weight: 900; font-size: 19px; /* ≥ 18.7px жирний = «великий текст» WCAG */
    min-height: 58px; padding: 0 20px; box-shadow: 0 5px 0 var(--c2), 0 10px 20px rgba(0, 0, 0, .12);
    transition: transform .08s, box-shadow .08s; text-shadow: 0 1px 0 rgba(0, 0, 0, .15);
  }
  :global(.chunky:active:not(:disabled)) { transform: translateY(4px); box-shadow: 0 1px 0 var(--c2), 0 4px 10px rgba(0, 0, 0, .1); }
  :global(.chunky:disabled) { filter: grayscale(.6); opacity: .5; }
  :global(.chunky.light) { --c: var(--card); --c2: var(--line); color: var(--ink); text-shadow: none; }
  @media (prefers-reduced-motion: reduce) { :global(*) { animation-duration: .01ms !important; transition-duration: .01ms !important; } }

  main {
    max-width: 560px; margin: 0 auto;
    padding: calc(env(safe-area-inset-top, 0px) + 14px) 16px calc(env(safe-area-inset-bottom, 0px) + 28px);
  }
  .toast {
    position: fixed; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 22px); transform: translateX(-50%); z-index: 40;
    display: flex; align-items: center; gap: 12px; max-width: calc(100vw - 24px);
    background: var(--ink); color: var(--bg); font-weight: 900; padding: 8px 8px 8px 18px; border-radius: 22px;
    box-shadow: var(--shadow); animation: drop .35s cubic-bezier(.2, 1.6, .4, 1); white-space: nowrap;
  }
  .toast.ok { background: var(--ok); color: #fff; box-shadow: 0 5px 0 var(--ok2), var(--shadow); }
  .toast span { overflow: hidden; text-overflow: ellipsis; }
  .toast button { flex: none; min-height: 40px; padding: 0 14px; border: none; border-radius: 16px; background: rgba(255, 255, 255, .22); color: inherit; font-weight: 900; font-size: 15px; }
  @keyframes drop { from { transform: translate(-50%, 40px) scale(.8); opacity: 0; } }
  .update {
    position: fixed; left: 12px; right: 12px; bottom: calc(env(safe-area-inset-bottom, 0px) + 12px); z-index: 45; max-width: 536px; margin: 0 auto;
    display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 10px 10px 16px;
    background: var(--ink); color: var(--bg); border-radius: 18px; font-weight: 900; box-shadow: var(--shadow);
  }
  .update button { border: none; border-radius: 14px; background: var(--accent); color: #fff; font-weight: 900; padding: 10px 16px; }
  .menu { display: flex; flex-direction: column; gap: 10px; }
  .menu button {
    display: flex; align-items: center; gap: 14px; min-height: 60px; border-radius: 18px; border: 2px solid var(--line);
    background: var(--card); font-weight: 800; font-size: 18px; text-align: left; padding: 0 16px; box-shadow: 0 3px 0 var(--line);
  }
  .menu button span { font-size: 24px; }
  .menu .danger { color: var(--no); }
  .scores { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .scores li { display: flex; align-items: center; gap: 12px; background: var(--card); border-radius: 16px; padding: 8px 14px; border: 2px solid var(--line); }
  .scores span { flex: 1; font-weight: 800; }
  .scores b { font-size: 24px; font-weight: 900; }
  .errors { background: var(--card); border: 3px solid var(--no); border-radius: var(--radius); padding: 16px; }
  .errors h1 { font-size: 20px; margin: 0 0 8px; }
</style>

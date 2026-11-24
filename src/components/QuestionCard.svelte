<script>
  import Avatar from './Avatar.svelte';
  import Timer from './Timer.svelte';
  import Info from './Info.svelte';
  import { roles, POINTS, isRated, pointsFor } from '../lib/state.js';
  import { listenMode, playQuestion, questionAudio, answerId } from '../lib/speech.js';
  import { onDestroy, untrack } from 'svelte';
  import { t } from '../lib/lang.svelte.js';

  // design — вигляд картки (lib/designs.js): логіка одна, різняться лише стилі нижче
  let { question, category, colors, number, game, players, design = 'k', sound = {}, roleNames = {}, onfinish } = $props();
  const uid = $props.id();
  let revealed = $state(false);
  // після «Показати відповідь» у «Цікавих фактах» кнопка й автоозвучка читають відповідь
  const answerItem = $derived(question.answer ? { id: answerId(question.id), text: question.answer } : null);
  const answerMode = $derived(answerItem ? listenMode(answerItem.id, sound) : null);
  const mode = $derived(revealed && answerMode ? answerMode : listenMode(question.id, sound));
  let stop = () => {};
  let playing = $state(false);
  let autoDone = false;
  function listen() {
    autoDone = true; // уже слухають — автоозвучка не повторює
    stop();
    playing = true;
    stop = playQuestion(revealed && answerMode ? answerItem : question, mode, {
      base: import.meta.env.BASE_URL, lang: sound.lang, start: sound.start, voice: sound.voice, synth: globalThis.speechSynthesis, Utterance: globalThis.SpeechSynthesisUtterance,
      makeAudio: (url) => questionAudio(url), onend: () => (playing = false),
    });
  }
  function reveal() {
    revealed = true;
    if (sound.auto && answerMode) listen(); // відповідь звучить сама, як і питання
  }
  function halt() { stop(); stop = () => {}; playing = false; }
  // Кнопка: грає — зупинити, мовчить — прослухати (ще раз)
  const toggle = () => (playing ? halt() : listen());
  onDestroy(() => stop());

  const n = $derived(players.length);
  const i = $derived(game.turn);
  // хто відповідає і про кого — вирішує гра (роль any — будь-хто з інших), вибирати не треба
  const people = $derived(roles(question, i, n, game.seed));
  const answerer = $derived(people.answerer);
  const about = $derived(people.about);
  const isGuess = $derived(question.type === 'guess' && answerer !== about);
  const isWho = $derived(question.type === 'who');
  // «Цікаві факти»: спершу відповідь гравця, потім — правильна відповідь
  const isQuiz = $derived(question.type === 'quiz');
  // «Хто з нас?»: той, чия черга, потай вгадує, на кого покажуть; усі показують; вгадав — бали йому
  let predict = $state(null);
  let voting = $state(false);
  // «Цікаві факти» з балами: спершу відповідь уголос («Відповідь сказано»), лише потім — правильна
  let said = $state(false);
  const showAbout = $derived(question.type !== 'who' && about !== answerer);
  // Відповідає не той, чия черга, а інший гравець — про себе: «Питає Оля → Відповідає Тарас»
  const asks = $derived(!isWho && !showAbout && answerer !== i);
  // Без правильної відповіді — бали за сміливість: відповів — +10, у сміливій категорії — 30, 40 чи 50
  const rated = $derived(isRated(question.type));
  const pts = $derived(pointsFor(question, category, game.seed));
  let tipOpen = $state(false);

  // підпис під іменем: «твоя черга», «твоя половинка»; «🎲 вибрала гра» — ні (власник 23.11)
  function roleText(role) {
    return roleNames[role] ?? (role === 'any' ? '' : t(`role.${role}`));
  }
  // питання на «ти» до того, чия черга: відповідає інший — замість нього
  const instead = $derived(question.form === 'you');
  const aboutRole = $derived(question.about === 'answerer' ? question.answerer : question.about);
  // розмір аватарів — під дизайн: у «Профілі» головна — людина, про яку питання
  const AV = { k: [58, 58], g: [34, 34], h: [52, 52], j: [44, 92], e: [40, 40], f: [56, 56] };
  const av = $derived(AV[design] ?? AV.k);

  // Автоозвучка: питання з'явилось на картці — одразу читаємо його, один раз.
  // Без затримки: файл почав завантажуватися ще при дотику до карти, а тиша на початку запису пропускається.
  const auto = $derived(!!sound.auto && !!mode);
  $effect(() => { if (auto && !autoDone) untrack(listen); });
</script>

{#snippet who(player, label, role, size, cls = '')}
  <div class="who {cls}"><span class="ph"><Avatar {player} {size} ring /></span>
    <span class="nm"><small>{label}</small><b>{player.name}</b>{#if roleText(role)}<em>{roleText(role)}</em>{/if}</span></div>
{/snippet}

<div class="overlay d-{design}" role="dialog" aria-modal="true" aria-label={t('card.label', { n: number })}>
  <article class="card" style="--c1:{colors[0]}; --c2:{colors[1]}; --t:{colors[2] || '#fff'}">
    {#if design === 'h'}
      <svg class="spot" aria-hidden="true" viewBox="0 0 390 520" preserveAspectRatio="none">
        <defs><radialGradient id="{uid}-spot" cx="50%" cy="0%" r="80%"><stop offset="0" stop-color="#7B5CFF" stop-opacity=".7" /><stop offset="1" stop-color="#7B5CFF" stop-opacity="0" /></radialGradient></defs>
        <polygon points="150,0 240,0 360,520 30,520" fill="url(#{uid}-spot)" />
      </svg>
    {/if}

    <header class="top">
      <span class="cat"><span class="emoji" aria-hidden="true">{category.emoji}</span><span class="ctitle">{category.title}</span></span>
      <span class="num">№ {number}</span>
      <span class="score"><span class="pts">{t('card.points', { n: pts })}</span><Info id="{uid}-pts" text={t('card.pointsHint')} what={t('card.pointsLabel')} /></span>
      {#if mode}
        <button class="listen" class:playing onclick={toggle} aria-label={playing ? t('card.stop') : t('card.listen')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path class="spk" d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
            {#if playing}<g class="bars"><rect x="15" y="8" width="2" height="8" rx="1" /><rect x="19" y="5" width="2" height="14" rx="1" /></g>
            {:else}<path class="wave" d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />{/if}
          </svg>
          <span>{playing ? t('card.stopShort') : t('card.listenShort')}</span>
        </button>
      {/if}
    </header>

    <div class="body">
      {#if question.type === 'who'}
        <div class="all"><span>👆</span> {t('card.whoAll')}</div>
      {:else if asks}
        <div class="people pair">
          {@render who(players[i], t('card.asks'), 'self', av[0])}
          <span class="arrow" aria-hidden="true">→</span>
          {@render who(players[answerer], t('card.answers'), question.answerer, av[1], 'main')}
        </div>
        <p class="instead">{t('card.asksHint', { name: players[answerer].name })}</p>
      {:else}
        {#if design === 'h'}<p class="hello">{t('card.forYou')}</p>{/if}
        <div class="people" class:pair={showAbout}>
          {@render who(players[answerer], t('card.answers'), question.answerer, av[0], 'ans')}
          {#if showAbout}
            <span class="arrow" aria-hidden="true">→</span>
            {@render who(players[about], instead ? t('card.insteadOf') : t('card.about'), aboutRole, av[1], 'main')}
          {/if}
        </div>
        {#if instead && showAbout}
          <p class="instead">{t('card.insteadHint', { name: players[about].name })}</p>
        {/if}
      {/if}

      <div class="qbox"><p class="q">{question.text}</p></div>

      {#if question.tip}
        <button class="tip" aria-expanded={tipOpen} onclick={() => (tipOpen = !tipOpen)}>
          <span>{t('card.tip')}</span><span aria-hidden="true">{tipOpen ? '▴' : '▾'}</span>
        </button>
        {#if tipOpen}<p class="tiptext">{question.tip}</p>{/if}
      {/if}

      {#if question.type === 'activity'}<Timer sounds={sound.sfx !== false} />{/if}

      <div class="actions">
        {#if isQuiz && !revealed && !said}
          <p class="check">{t('card.sayFirst')}</p>
          <button class="chunky wide" onclick={() => (said = true)}>{t('card.said')}</button>
        {:else if isQuiz && !revealed}
          <button class="chunky light wide" onclick={reveal}>{t('card.reveal')}</button>
        {:else}
          {#if isQuiz}
            <div class="answer" role="status"><small>{t('card.answer')}</small><p>{question.answer}</p></div>
          {/if}
          {#if isWho}
            {#if predict === null}
              <p class="check">{t('card.predict', { name: players[i].name })}</p>
              <div class="chips">
                {#each players as p, k}
                  <button class="chip" onclick={() => (predict = k)}><Avatar player={p} size={40} /><span>{p.name}</span></button>
                {/each}
              </div>
            {:else if !voting}
              <p class="check">{t('card.predicted')}</p>
              <button class="chunky ok wide" onclick={() => (voting = true)}>{t('card.shown')}</button>
            {:else}
              <p class="check">{t('card.predictQ', { who: players[predict].name })} <b>{t('card.points', { n: POINTS.right })}</b></p>
              <div class="row">
                <button class="chunky ok" onclick={() => onfinish('correct', i, POINTS.right)}><span class="ico" aria-hidden="true">✓</span><span class="lb">{t('card.guessed')}</span></button>
                <button class="chunky no" onclick={() => onfinish('wrong', i)}><span class="ico" aria-hidden="true">✕</span><span class="lb">{t('card.missed')}</span></button>
              </div>
            {/if}
          {:else if rated}
            <p class="check"><b>{players[answerer].name}</b>{t(category.brave ? 'card.braveQ' : 'card.answerQ', { n: pts })}</p>
            <button class="chunky ok wide" onclick={() => onfinish('correct', answerer, pts)}>{t('card.answered', { n: pts })}</button>
          {:else}
            {#if !isGuess || design === 'f' || design === 'j'}
            <p class="check verdict">
              {#if isGuess}{t('card.rightQ')}
              {:else if isQuiz}<b>{players[answerer].name}</b>{t('card.quizCheck')}
              {:else}<b>{players[answerer].name}</b>{t('card.acceptQ')}
              {/if}
            </p>
            {/if}
            <div class="row" class:alone={isGuess && design !== 'f' && design !== 'j'}>
              <button class="chunky ok" onclick={() => onfinish('correct', answerer, POINTS.right)}><span class="ico" aria-hidden="true">✓</span><span class="lb">{t(isQuiz || isGuess ? 'card.guessed' : 'card.right')}</span></button>
              <button class="chunky no" onclick={() => onfinish('wrong', answerer)}><span class="ico" aria-hidden="true">✕</span><span class="lb">{t(isQuiz || isGuess ? 'card.missed' : 'card.wrong')}</span></button>
            </div>
          {/if}
        {/if}
        <button class="skip" onclick={() => onfinish('skipped', null)}>{t('card.skipLong')}</button>
      </div>
    </div>
  </article>
</div>

<style>
  /* ---------- спільне для всіх дизайнів ---------- */
  .overlay {
    position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; overflow-y: auto;
    padding: calc(env(safe-area-inset-top, 0px) + 16px) 14px calc(env(safe-area-inset-bottom, 0px) + 16px);
    background: rgba(26, 14, 36, .55); backdrop-filter: blur(4px); animation: fade .2s;
  }
  @keyframes fade { from { opacity: 0; } }
  .card {
    position: relative; width: 100%; max-width: 520px; border-radius: 30px; background: var(--card); color: var(--ink);
    box-shadow: 0 30px 60px rgba(0, 0, 0, .35); animation: zoom .45s cubic-bezier(.2, 1.5, .4, 1);
  }
  @keyframes zoom { from { transform: scale(.6) rotateY(80deg); opacity: 0; } }
  .top { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 16px 18px 0; }
  .cat { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-weight: 900; font-size: 15px;
    background: color-mix(in srgb, var(--c1) 18%, var(--card)); color: color-mix(in srgb, var(--c2) 55%, var(--ink)); }
  .num { font-weight: 800; font-size: 13px; color: var(--dim); }
  .score { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
  .pts { white-space: nowrap; font-weight: 1000; font-size: 16px; }
  /* «Слухати» — круглий значок, щоб шапка вміщалась в один рядок; назву читає aria-label */
  .listen { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; flex: none;
    border-radius: 50%; border: 2px solid var(--line); background: var(--card); color: var(--ink);
  }
  .listen span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .listen svg { width: 22px; height: 22px; }
  .listen .spk { fill: currentColor; }
  .listen .wave { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
  .listen.playing { border-color: var(--c1); background: color-mix(in srgb, var(--c1) 14%, var(--card)); }
  .listen .bars rect { fill: currentColor; transform-origin: center; transform-box: fill-box; animation: bar .7s ease-in-out infinite alternate; }
  .listen .bars rect + rect { animation-delay: -.35s; }
  @keyframes bar { from { transform: scaleY(.35); } }
  @media (prefers-reduced-motion: reduce) { .listen .bars rect { animation: none; } }
  .body { position: relative; padding: 14px 18px 18px; }
  .people { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .who { display: flex; gap: 10px; align-items: center; min-width: 0; }
  .nm { display: flex; flex-direction: column; line-height: 1.1; min-width: 0; }
  .who b { font-size: 19px; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
  .who small { font-size: 11px; color: var(--dim); font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
  .who em { font-style: normal; font-size: 13px; color: var(--dim); font-weight: 800; }
  /* Двоє людей — поруч: аватар над підписом, стрілка між ними */
  .pair { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: start; padding: 10px 6px; }
  .pair .who { flex-direction: column; text-align: center; gap: 6px; }
  .pair .nm { align-items: center; max-width: 100%; }
  .pair .arrow { align-self: center; margin-top: -26px; }
  .arrow { font-size: 24px; font-weight: 900; color: var(--c1); margin: 0 4px; }
  .hello { display: none; }
  .instead { margin: 0 0 8px; font-size: 15px; font-weight: 800; color: var(--dim); }
  .all { display: flex; gap: 10px; align-items: center; font-weight: 800; background: color-mix(in srgb, var(--c1) 14%, var(--card)); padding: 12px 14px; border-radius: 16px; }
  .all span { font-size: 28px; }
  .q { font-size: clamp(26px, 7.4vw, 36px); font-weight: 1000; line-height: 1.15; margin: 14px 0 12px; letter-spacing: -.01em; }
  .answer { margin: 4px 0 12px; padding: 10px 14px; border-radius: 16px; background: var(--soft); }
  .answer small { display: block; font-weight: 900; color: var(--dim); text-transform: uppercase; letter-spacing: .05em; font-size: 12px; }
  .answer p { margin: 2px 0 0; font-size: 17px; font-weight: 800; line-height: 1.35; }
  .tip { width: 100%; display: flex; justify-content: space-between; align-items: center; min-height: 48px; padding: 0 14px; border-radius: 14px; border: 2px dashed var(--line); background: transparent; font-weight: 800; font-size: 15px; color: var(--ink); }
  .tiptext { margin: 8px 0 0; padding: 12px 14px; border-radius: 14px; background: var(--soft); font-size: 15px; font-weight: 700; }
  .chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
  .chip {
    display: flex; align-items: center; gap: 10px; min-height: 60px; padding: 0 12px 0 8px; border-radius: 18px; color: var(--ink);
    border: 2px solid var(--line); background: var(--card); font-weight: 900; box-shadow: 0 4px 0 var(--line); text-align: left;
  }
  .chip span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chip:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--line); }
  .check { font-weight: 800; color: var(--dim); margin: 14px 0 10px; }
  .check b { color: var(--ink); }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  /* шрифт лишається великим (≥ 18,67 px — білий на кольоровому має читатися); на найвужчих — одна під одною */
  .row .chunky { padding: 0 8px; white-space: nowrap; display: flex; align-items: center; justify-content: center; gap: 8px; }
  @media (max-width: 400px) { .row { grid-template-columns: 1fr; } }
  .row.alone { margin-top: 14px; }
  .chunky.ok { --c: var(--ok); --c2: var(--ok2); }
  .chunky.no { --c: var(--no); --c2: var(--no2); }
  .wide { width: 100%; margin-top: 12px; }
  .skip { width: 100%; margin-top: 10px; min-height: 48px; border: none; background: none; color: var(--dim); font-weight: 800; text-decoration: underline; text-underline-offset: 4px; }

  /* ---------- K — блокнот (за замовчуванням): аркуш у лінійку зі скотчем, полароїди, кнопки з обвідкою ---------- */
  .d-k .card {
    --card: #FFFDF7; --ink: #2D1B3D; --dim: #6B5A55; --line: #E3D6C3; --soft: #F3EAD9;
    border-radius: 6px; transform: rotate(.6deg); margin-top: 14px;
    background: repeating-linear-gradient(#FFFDF7 0 37px, #E6ECF7 37px 39px) #FFFDF7;
    box-shadow: 0 2px 0 #D6C6AE, 0 18px 40px rgba(40, 20, 0, .35);
  }
  .d-k .card::before { content: ''; position: absolute; top: -13px; left: 50%; width: 110px; height: 28px; margin-left: -55px; background: rgba(255, 214, 120, .8); transform: rotate(-3deg); }
  .d-k .cat { border-radius: 6px; transform: rotate(-2deg); background: color-mix(in srgb, var(--c1) 30%, #fff); color: #2D1B3D; }
  .d-k .pts { color: #B5530C; font-size: 19px; }
  .d-k .pair { gap: 4px; }
  .d-k .pair .who { background: #fff; padding: 6px 6px 8px; box-shadow: 0 4px 10px rgba(0, 0, 0, .15); transform: rotate(-4deg); }
  .d-k .pair .who.main { transform: rotate(4deg); }
  .d-k .pair .arrow { color: #8A7468; }
  .d-k .chunky { color: #2D1B3D; text-shadow: none; border: 3px solid #2D1B3D; box-shadow: 4px 4px 0 #2D1B3D; background: #FFE08A; }
  .d-k .chunky.ok { background: #9BE3B5; }
  .d-k .chunky.no { background: #FFB3B8; }
  .d-k .chunky.light { background: #fff; }
  .d-k .chip { border-color: #2D1B3D; box-shadow: 3px 3px 0 #2D1B3D; }

  /* ---------- G — тиха: біле, велике питання, імена рядками, кнопки-кружечки ---------- */
  .d-g .card { border-radius: 26px; }
  .d-g .who em { display: none; }
  .d-g .pair { display: flex; flex-direction: column; align-items: stretch; gap: 16px; padding: 4px 0; }
  .d-g .pair .arrow { display: none; }
  .d-g .pair .who { flex-direction: row; text-align: left; gap: 10px; }
  .d-g .pair .nm { flex-direction: row; align-items: baseline; gap: 10px; }
  .d-g .who small { flex: none; width: 86px; font-size: 12px; }
  .d-g .who b { font-size: 17px; }
  .d-g .q { font-size: clamp(30px, 9vw, 40px); }
  /* підпис під кружечком — колір кнопки, змішаний з кольором тексту: темніший у світлій темі, світліший у темній */
  .d-g .row .chunky { flex-direction: column; min-height: 0; padding: 0; background: none; box-shadow: none; text-shadow: none; color: color-mix(in srgb, var(--c) 55%, var(--ink)); font-size: 16px; gap: 6px; }
  .d-g .row .ico { width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center; font-size: 36px; background: var(--c); color: #fff; box-shadow: 0 6px 0 var(--c2); }
  .d-g .row .no .ico { background: var(--card); color: var(--c); border: 4px solid var(--c); box-shadow: none; }
  .d-g .row { grid-template-columns: 1fr 1fr; }

  /* ---------- H — телешоу: темна сцена, прожектор, великий номінал ---------- */
  .d-h .card { --card: #221636; --ink: #FFFFFF; --dim: #CFC2FF; --line: #4A3A66; --soft: #2C1E45; background: #140C22; overflow: hidden; }
  .d-h .spot { position: absolute; left: 0; top: 0; width: 100%; height: 70%; pointer-events: none; }
  .d-h .top { display: grid; grid-template-columns: 1fr auto; grid-template-areas: 'cat listen' 'score score'; row-gap: 10px; }
  .d-h .cat { grid-area: cat; background: none; padding: 0; color: #CFC2FF; text-transform: uppercase; letter-spacing: .1em; font-size: 13px; }
  .d-h .num { display: none; }
  .d-h .score { grid-area: score; justify-self: center; margin: 0; }
  .d-h .pts { font-size: 56px; color: #FFC86B; text-shadow: 0 0 24px rgba(255, 200, 107, .5); }
  .d-h .listen { grid-area: listen; border-color: #CFC2FF; background: #2C1E45; color: #fff; }
  .d-h .hello { display: block; text-align: center; font-size: 24px; font-weight: 1000; margin: 0 0 6px; }
  .d-h .pair .who.ans :global(.av) { filter: drop-shadow(0 0 10px rgba(255, 200, 107, .6)); }
  .d-h .arrow { color: #CFC2FF; }
  .d-h .people:not(.pair) { justify-content: center; } /* одна людина — по центру, під «Тобі питання!» */
  .d-h .qbox { padding: 6px 16px; border-radius: 22px; background: #221636; border: 2px solid #7B5CFF; box-shadow: 0 0 0 6px rgba(123, 92, 255, .18), 0 0 40px rgba(123, 92, 255, .35); margin: 12px 0; }
  .d-h .q { text-align: center; font-size: clamp(24px, 7vw, 30px); }
  .d-h .all { background: #2C1E45; }

  /* ---------- J — профіль: людина, про яку питання, — велика на кольоровій шапці ---------- */
  .d-j .card { overflow: hidden; }
  .d-j .top { padding-bottom: 12px; background: var(--c1); color: var(--t); border-radius: 30px 30px 0 0; }
  .d-j .cat { background: rgba(255, 255, 255, .25); color: var(--t); }
  .d-j .num { color: var(--t); opacity: .8; }
  .d-j .top { --dim: var(--t); }
  .d-j .pts { background: #fff; color: #2D1B3D; padding: 4px 10px; border-radius: 999px; }
  .d-j .body { padding-top: 0; }
  .d-j .people.pair, .d-j .all { margin: 0 -18px; padding: 4px 18px 18px; border-radius: 0 0 28px 28px; background: var(--c1); color: var(--t); }
  .d-j .pair { align-items: end; }
  .d-j .pair .who.main b { font-size: 26px; }
  .d-j .pair small, .d-j .pair em, .d-j .pair .arrow { color: var(--t); opacity: .85; }
  .d-j .qbox { position: relative; margin-top: -2px; }
  .d-j .people:not(.pair) { margin-top: 14px; } /* одна людина — нижче кольорової шапки, а не на ній */

  /* ---------- E — ігрова карта: рамка кольору категорії, номінал у кутку, карта трохи нахилена ---------- */
  .d-e .card { border: 8px solid var(--c1); border-radius: 28px; box-shadow: 0 8px 0 var(--c2), 0 30px 60px rgba(0, 0, 0, .35); transform: rotate(-1deg); }
  .d-e .top { display: grid; grid-template-columns: auto 1fr auto; grid-template-areas: 'score . listen' 'cat cat cat'; row-gap: 4px; }
  .d-e .score { grid-area: score; margin: 0; }
  /* колір категорії буває світлим (жовтий) — для тексту змішуємо з кольором тексту */
  .d-e .pts { font-size: 26px; color: color-mix(in srgb, var(--c1) 50%, var(--ink)); }
  .d-e .listen { grid-area: listen; }
  .d-e .num { display: none; }
  .d-e .cat { grid-area: cat; justify-self: center; flex-direction: column; background: none; text-transform: uppercase; letter-spacing: .06em; font-size: 14px; color: color-mix(in srgb, var(--c1) 50%, var(--ink)); }
  .d-e .cat .emoji { font-size: 52px; }
  .d-e .q { text-align: center; }
  .d-e .people { justify-content: center; }

  /* ---------- F — розмова: питання — бульбашка між людиною, про яку питають (згори), і тим, хто відповідає (знизу) ---------- */
  .d-f .card { background: var(--bg); }
  .d-f .body { display: flex; flex-direction: column; }
  .d-f .body > :global(*) { order: 5; }
  .d-f .body > .people, .d-f .body > .all { order: 1; }
  .d-f .people.pair { display: contents; }
  .d-f .pair .arrow { display: none; }
  .d-f .pair .who { flex-direction: row; text-align: left; margin: 4px 0; }
  .d-f .pair .nm { align-items: flex-start; }
  .d-f .pair .who.main { order: 1; }
  .d-f .body > .qbox { order: 2; background: var(--card); border: 3px solid var(--c1); border-radius: 8px 28px 28px 28px; padding: 4px 18px; box-shadow: var(--shadow); }
  .d-f .pair .who.ans { order: 3; flex-direction: row-reverse; text-align: right; }
  .d-f .pair .who.ans .nm { align-items: flex-end; }
  .d-f .body > .instead { order: 4; }
</style>

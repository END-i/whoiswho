<script>
  import Avatar from './Avatar.svelte';
  import { roles } from '../lib/state.js';
  import { listenMode, playQuestion, questionAudio, AUTO_DELAY } from '../lib/speech.js';
  import { onDestroy } from 'svelte';
  import { t } from '../lib/lang.svelte.js';

  let { question, category, colors, number, game, players, scoring, sound = {}, roleNames = {}, onfinish } = $props();
  const mode = $derived(listenMode(question.id, sound));
  let stop = () => {};
  let playing = $state(false);
  let autoTimer, autoDone = false;
  function listen() {
    clearTimeout(autoTimer); autoDone = true; // уже слухають — автоозвучка не повторює
    stop();
    playing = true;
    stop = playQuestion(question, mode, {
      base: import.meta.env.BASE_URL, lang: sound.lang, voice: sound.voice, synth: globalThis.speechSynthesis, Utterance: globalThis.SpeechSynthesisUtterance,
      makeAudio: (url) => questionAudio(url), onend: () => (playing = false),
    });
  }
  function halt() { stop(); stop = () => {}; playing = false; }
  // Кнопка: грає — зупинити, мовчить — прослухати (ще раз)
  const toggle = () => (playing ? halt() : listen());
  onDestroy(() => { clearTimeout(autoTimer); stop(); });

  const n = $derived(players.length);
  const i = $derived(game.turn);
  const base = $derived(roles(question, i, n));
  let picked = $state({ answerer: null, about: null });
  const answerer = $derived(base.answerer ?? picked.answerer);
  const about = $derived(question.about === 'answerer' ? answerer : (base.about ?? picked.about));
  // Що ще треба вибрати, перш ніж показати питання
  const need = $derived(question.type === 'who' ? null
    : answerer === null ? 'answerer' : about === null ? 'about' : null);
  const isGuess = $derived(question.type === 'guess' && answerer !== about);
  const isWho = $derived(question.type === 'who');
  // «Цікаві факти»: спершу відповідь гравця, потім — правильна відповідь
  const isQuiz = $derived(question.type === 'quiz');
  let revealed = $state(false);
  // «Хто з нас?»: після того як показали пальцем, вибираємо, на кого показала більшість
  let voting = $state(false);
  const showAbout = $derived(question.type !== 'who' && about !== null && about !== answerer);
  let tipOpen = $state(false);

  function roleText(role) {
    return roleNames[role] ?? t(`role.${role}`);
  }
  // питання на «ти» до того, чия черга: відповідає інший — замість нього
  const instead = $derived(question.form === 'you');
  const aboutRole = $derived(question.about === 'answerer' ? question.answerer : question.about);

  // Автоозвучка: питання з'явилось на картці (гравців уже вибрано) — читаємо його один раз
  const auto = $derived(!!sound.auto && !!mode && !need);
  $effect(() => {
    if (!auto || autoDone) return;
    autoTimer = setTimeout(listen, AUTO_DELAY);
    return () => clearTimeout(autoTimer);
  });

</script>

<div class="overlay" role="dialog" aria-modal="true" aria-label={t('card.label', { n: number })}>
  <article class="card" style="--c1:{colors[0]}; --c2:{colors[1]}; --t:{colors[2] || '#fff'}">
    <div class="band">
      <span class="emoji" aria-hidden="true">{category.emoji}</span>
      <span class="cat">{category.title}</span>
      <span class="cardno">№ {number}</span>
    </div>

    <div class="body">
      <div class="badges">
        <span class="badge">{t(`type.${question.type}`)}</span>
        {#if scoring}<span class="badge pts">{t('card.point')}</span>{/if}
        {#if mode}
          <button class="listen" class:playing onclick={toggle} aria-label={playing ? t('card.stop') : t('card.listen')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path class="spk" d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
              {#if playing}<g class="bars"><rect x="15" y="8" width="2" height="8" rx="1" /><rect x="19" y="5" width="2" height="14" rx="1" /></g>
              {:else}<path class="wave" d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />{/if}
            </svg>
            <span>{playing ? t('card.stopShort') : t('card.listenShort')}</span>
          </button>
        {/if}
      </div>

      {#if question.type === 'who'}
        <div class="all"><span>👆</span> {t('card.whoAll')}</div>
      {:else if !need}
        <div class="people" class:pair={showAbout}>
          <div class="who"><Avatar player={players[answerer]} size={56} ring />
            <span><small>{t('card.answers')}</small><b>{players[answerer].name}</b><em>{roleText(question.answerer)}</em></span></div>
          {#if showAbout}
            <span class="arrow" aria-hidden="true">→</span>
            <div class="who"><Avatar player={players[about]} size={56} ring />
              <span><small>{instead ? t('card.insteadOf') : t('card.about')}</small><b>{players[about].name}</b><em>{roleText(aboutRole)}</em></span></div>
          {/if}
        </div>
        {#if instead && showAbout}
          <p class="instead">{t('card.insteadHint', { name: players[about].name })}</p>
        {/if}
      {/if}

      {#if need}
        <p class="ask">{need === 'answerer' ? t('card.pickAnswerer') : t('card.pickAbout')}</p>
        <div class="chips">
          {#each players as p, k}
            {#if k !== i && !(need === 'about' && k === answerer)}
              <button class="chip" onclick={() => (picked = { ...picked, [need]: k })}><Avatar player={p} size={40} /><span>{p.name}</span></button>
            {/if}
          {/each}
        </div>
        <button class="skip" onclick={() => onfinish('skipped', null)}>{t('card.skip')}</button>
      {:else}
        <p class="q">{question.text}</p>

        {#if question.tip}
          <button class="tip" aria-expanded={tipOpen} onclick={() => (tipOpen = !tipOpen)}>
            <span>{t('card.tip')}</span><span aria-hidden="true">{tipOpen ? '▴' : '▾'}</span>
          </button>
          {#if tipOpen}<p class="tiptext">{question.tip}</p>{/if}
        {/if}

        {#if isQuiz && !revealed}
          <button class="chunky light wide" onclick={() => (revealed = true)}>{t('card.reveal')}</button>
        {:else}
        {#if isQuiz}
          <div class="answer" role="status"><small>{t('card.answer')}</small><p>{question.answer}</p></div>
        {/if}
        {#if !scoring}
          <button class="chunky ok wide" onclick={() => onfinish('answered', answerer)}>{t('card.next')}</button>
        {:else if isWho}
          {#if !voting}
            <button class="chunky ok wide" onclick={() => (voting = true)}>{t('card.shown')}</button>
          {:else}
            <p class="check">{t('card.majority')} <b>{t('card.plusOne')}</b></p>
            <div class="chips">
              {#each players as p, k}
                <button class="chip" onclick={() => onfinish('correct', k)}><Avatar player={p} size={40} /><span>{p.name}</span></button>
              {/each}
            </div>
            <button class="chunky light wide" onclick={() => onfinish('wrong', null)}>{t('card.tie')}</button>
          {/if}
        {:else}
          <p class="check">
            {#if isGuess}{t('card.checks')} <b>{players[about].name}</b>{t('card.checksQ')}
            {:else if isQuiz}<b>{players[answerer].name}</b>{t('card.quizCheck')}
            {:else}<b>{players[answerer].name}</b>{t('card.acceptQ')}{/if}
          </p>
          <div class="row">
            <button class="chunky ok" onclick={() => onfinish('correct', answerer)}><span class="ico" aria-hidden="true">✅&nbsp;</span>{isGuess || isQuiz ? t('card.right') : t('card.accepted')}</button>
            <button class="chunky no" onclick={() => onfinish('wrong', answerer)}><span class="ico" aria-hidden="true">❌&nbsp;</span>{isGuess || isQuiz ? t('card.wrong') : t('card.no')}</button>
          </div>
        {/if}
        {/if}
        <button class="skip" onclick={() => onfinish('skipped', null)}>{t('card.skipLong')}</button>
      {/if}
    </div>
  </article>
</div>

<style>
  .overlay {
    position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; overflow-y: auto;
    padding: calc(env(safe-area-inset-top, 0px) + 16px) 14px calc(env(safe-area-inset-bottom, 0px) + 16px);
    background: rgba(26, 14, 36, .55); backdrop-filter: blur(4px); animation: fade .2s;
  }
  @keyframes fade { from { opacity: 0; } }
  .card {
    width: 100%; max-width: 520px; border-radius: 30px; overflow: hidden; background: var(--card);
    box-shadow: 0 8px 0 color-mix(in srgb, var(--c2) 70%, #000), 0 30px 60px rgba(0, 0, 0, .35);
    animation: zoom .45s cubic-bezier(.2, 1.5, .4, 1);
  }
  @keyframes zoom { from { transform: scale(.6) rotateY(80deg); opacity: 0; } }
  .band {
    display: flex; align-items: center; gap: 10px; padding: 14px 16px; color: var(--t);
    background: repeating-linear-gradient(45deg, rgba(255, 255, 255, .14) 0 8px, transparent 8px 16px), linear-gradient(150deg, var(--c1), var(--c2));
  }
  .emoji { font-size: 24px; width: 42px; height: 42px; display: grid; place-items: center; background: #fff; border-radius: 14px; }
  .cat { flex: 1; font-weight: 900; font-size: 19px; }
  .cardno { font-weight: 900; background: rgba(255, 255, 255, .25); padding: 4px 10px; border-radius: 12px; }
  .body { padding: 16px 18px 18px; }
  .badges { display: flex; gap: 6px; align-items: center; margin-bottom: 14px; }
  .badge { white-space: nowrap; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; background: color-mix(in srgb, var(--c1) 18%, var(--card)); color: color-mix(in srgb, var(--c2) 45%, var(--ink)); padding: 5px 10px; border-radius: 10px; }
  .badge.pts { background: #FFC23D; color: #5a3a00; }
  .listen {
    margin-left: auto; display: flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px 0 10px;
    border-radius: 22px; border: 2px solid var(--line); background: var(--card); font-weight: 900; font-size: 14px; color: var(--ink);
  }
  .listen svg { width: 22px; height: 22px; }
  .listen .spk { fill: currentColor; }
  .listen .wave { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
  .listen.playing { border-color: var(--c1); background: color-mix(in srgb, var(--c1) 14%, var(--card)); }
  .listen .bars rect { fill: var(--c1); transform-origin: center; transform-box: fill-box; animation: bar .7s ease-in-out infinite alternate; }
  .listen .bars rect + rect { animation-delay: -.35s; }
  @keyframes bar { from { transform: scaleY(.35); } }
  @media (prefers-reduced-motion: reduce) { .listen .bars rect { animation: none; } }
  /* вузький екран: лише значок — назву кнопки все одно читає aria-label */
  @media (max-width: 360px) { .listen { padding: 0 10px; } .listen span { display: none; } }
  .people { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .who { display: flex; gap: 10px; align-items: center; min-width: 0; }
  .answer { margin: 4px 0 12px; padding: 10px 14px; border-radius: 16px; background: var(--soft); }
  .answer small { display: block; font-weight: 900; color: var(--dim); text-transform: uppercase; letter-spacing: .05em; font-size: 12px; }
  .answer p { margin: 2px 0 0; font-size: 17px; font-weight: 800; line-height: 1.35; }
  .instead { margin: 0 0 8px; font-size: 15px; font-weight: 800; color: var(--dim); }
  .who span { display: flex; flex-direction: column; line-height: 1.1; min-width: 0; }
  .who b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* Двоє людей — поруч: аватар над підписом, стрілка між ними */
  .pair { display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; background: color-mix(in srgb, var(--c1) 10%, var(--card)); border-radius: 20px; padding: 12px 8px; }
  .pair .who { flex-direction: column; text-align: center; gap: 6px; }
  .pair .who span { align-items: center; }
  .pair .arrow { align-self: center; margin-top: -26px; }
  .who small { font-size: 11px; color: var(--dim); font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
  .who b { font-size: 19px; font-weight: 900; }
  .who em { font-style: normal; font-size: 13px; color: color-mix(in srgb, var(--c2) 45%, var(--ink)); font-weight: 800; }
  @media (prefers-color-scheme: dark) { .who em, .badge { color: color-mix(in srgb, var(--c1) 70%, #fff); } }
  .arrow { font-size: 24px; font-weight: 900; color: var(--c1); margin: 0 4px; }
  .all { display: flex; gap: 10px; align-items: center; font-weight: 800; background: color-mix(in srgb, var(--c1) 14%, var(--card)); padding: 12px 14px; border-radius: 16px; }
  .all span { font-size: 28px; }
  .ask { font-weight: 900; font-size: 22px; margin: 6px 0 12px; }
  .chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
  .chip {
    display: flex; align-items: center; gap: 10px; min-height: 60px; padding: 0 12px 0 8px; border-radius: 18px;
    border: 2px solid var(--line); background: var(--card); font-weight: 900; box-shadow: 0 4px 0 var(--line); text-align: left;
  }
  .chip:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--line); }
  .q { font-size: clamp(24px, 6.6vw, 32px); font-weight: 900; line-height: 1.25; margin: 14px 0 16px; letter-spacing: -.01em; }
  .tip { width: 100%; display: flex; justify-content: space-between; align-items: center; min-height: 48px; padding: 0 14px; border-radius: 14px; border: 2px dashed var(--line); background: transparent; font-weight: 800; font-size: 15px; }
  .tiptext { margin: 8px 0 0; padding: 12px 14px; border-radius: 14px; background: var(--soft); font-size: 15px; font-weight: 700; }
  .check { font-weight: 800; color: var(--dim); margin: 16px 0 10px; }
  .check b { color: var(--ink); }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  /* шрифт лишається великим (≥ 18,67 px — білий на кольоровому має читатися), тому на вужчих телефонах
     спершу ховаємо значок, а на найвужчих кнопки стають одна під одною — «Неправильно» не розривається */
  .row .chunky { padding: 0 8px; white-space: nowrap; }
  @media (max-width: 420px) { .row .ico { display: none; } }
  @media (max-width: 360px) { .row { grid-template-columns: 1fr; } }
  .chips + .wide { margin-top: 12px; }
  .chunky.ok { --c: var(--ok); --c2: var(--ok2); }
  .chunky.no { --c: var(--no); --c2: var(--no2); }
  .wide { width: 100%; margin-top: 16px; }
  .skip { width: 100%; margin-top: 12px; min-height: 48px; border: none; background: none; color: var(--dim); font-weight: 800; text-decoration: underline; text-underline-offset: 4px; }
</style>

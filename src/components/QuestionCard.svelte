<script>
  import Avatar from './Avatar.svelte';
  import { roles } from '../lib/state.js';
  import { listenMode, playQuestion } from '../lib/speech.js';
  import { onDestroy } from 'svelte';

  let { question, category, colors, number, game, players, scoring, sound = {}, onfinish } = $props();
  const mode = $derived(listenMode(question.id, sound));
  let stop = () => {};
  let playing = $state(false);
  function listen() {
    stop();
    playing = true;
    stop = playQuestion(question, mode, {
      base: import.meta.env.BASE_URL, voice: sound.voice, synth: globalThis.speechSynthesis, Utterance: globalThis.SpeechSynthesisUtterance,
      makeAudio: (url) => new Audio(url), onend: () => (playing = false),
    });
  }
  onDestroy(() => stop());

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
  // «Хто з нас?»: після того як показали пальцем, вибираємо, на кого показала більшість
  let voting = $state(false);
  const showAbout = $derived(question.type !== 'who' && about !== null && about !== answerer);
  let tipOpen = $state(false);

  function roleText(role) {
    return { self: 'твоя черга', left: 'гравець ліворуч', right: 'гравець праворуч', pick: 'на твій вибір' }[role];
  }
  // питання на «ти» до того, чия черга: відповідає інший — замість нього
  const instead = $derived(question.form === 'you');
  const aboutRole = $derived(question.about === 'answerer' ? question.answerer : question.about);
  const TYPE = { open: 'Розкажи', choice: 'Вибери', activity: 'Покажи', guess: 'Вгадай', who: 'Хто з нас?' };
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-label="Картка {number}">
  <article class="card" style="--c1:{colors[0]}; --c2:{colors[1]}; --t:{colors[2] || '#fff'}">
    <div class="band">
      <span class="emoji" aria-hidden="true">{category.emoji}</span>
      <span class="cat">{category.title}</span>
      <span class="cardno">№ {number}</span>
    </div>

    <div class="body">
      <div class="badges">
        <span class="badge">{TYPE[question.type]}</span>
        {#if scoring}<span class="badge pts">⭐ +1 бал</span>{/if}
        {#if mode}<button class="listen" class:playing onclick={listen} aria-label="Прослухати питання">🔊</button>{/if}
      </div>

      {#if question.type === 'who'}
        <div class="all"><span>👆</span> Усі разом: на рахунок «три» покажіть пальцем!</div>
      {:else if !need}
        <div class="people" class:pair={showAbout}>
          <div class="who"><Avatar player={players[answerer]} size={56} ring />
            <span><small>Відповідає</small><b>{players[answerer].name}</b><em>{roleText(question.answerer)}</em></span></div>
          {#if showAbout}
            <span class="arrow" aria-hidden="true">→</span>
            <div class="who"><Avatar player={players[about]} size={56} ring />
              <span><small>{instead ? 'Замість кого' : 'Про кого'}</small><b>{players[about].name}</b><em>{roleText(aboutRole)}</em></span></div>
          {/if}
        </div>
        {#if instead && showAbout}
          <p class="instead">Відповідай так, ніби ти — {players[about].name}. {players[about].name} каже, чи влучно.</p>
        {/if}
      {/if}

      {#if need}
        <p class="ask">{need === 'answerer' ? 'Хто відповідатиме?' : 'Про кого буде питання?'}</p>
        <div class="chips">
          {#each players as p, k}
            {#if k !== i && !(need === 'about' && k === answerer)}
              <button class="chip" onclick={() => (picked = { ...picked, [need]: k })}><Avatar player={p} size={40} /><span>{p.name}</span></button>
            {/if}
          {/each}
        </div>
        <button class="skip" onclick={() => onfinish('skipped', null)}>Пропустити</button>
      {:else}
        <p class="q">{question.text}</p>

        {#if question.tip}
          <button class="tip" aria-expanded={tipOpen} onclick={() => (tipOpen = !tipOpen)}>
            <span>💡 Підказка для дорослих</span><span aria-hidden="true">{tipOpen ? '▴' : '▾'}</span>
          </button>
          {#if tipOpen}<p class="tiptext">{question.tip}</p>{/if}
        {/if}

        {#if !scoring}
          <button class="chunky ok wide" onclick={() => onfinish('answered', answerer)}>✅ Далі</button>
        {:else if isWho}
          {#if !voting}
            <button class="chunky ok wide" onclick={() => (voting = true)}>👆 Показали — хто переміг?</button>
          {:else}
            <p class="check">На кого показала більшість? Йому чи їй — <b>+1 бал</b></p>
            <div class="chips">
              {#each players as p, k}
                <button class="chip" onclick={() => onfinish('correct', k)}><Avatar player={p} size={40} /><span>{p.name}</span></button>
              {/each}
            </div>
            <button class="chunky light wide" onclick={() => onfinish('wrong', null)}>🤝 Нічия — без балів</button>
          {/if}
        {:else}
          <p class="check">
            {#if isGuess}Перевіряє <b>{players[about].name}</b>: вгадали?
            {:else}Усі разом: зарахувати відповідь <b>{players[answerer].name}</b>?{/if}
          </p>
          <div class="row">
            <button class="chunky ok" onclick={() => onfinish('correct', answerer)}>✅ {isGuess ? 'Правильно' : 'Зараховано'}</button>
            <button class="chunky no" onclick={() => onfinish('wrong', answerer)}>❌ {isGuess ? 'Неправильно' : 'Ні'}</button>
          </div>
        {/if}
        <button class="skip" onclick={() => onfinish('skipped', null)}>Пропустити — без відповіді</button>
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
  .badge { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; background: color-mix(in srgb, var(--c1) 18%, var(--card)); color: color-mix(in srgb, var(--c2) 45%, var(--ink)); padding: 5px 10px; border-radius: 10px; }
  .badge.pts { background: #FFC23D; color: #5a3a00; }
  .listen { margin-left: auto; width: 40px; height: 40px; border-radius: 14px; border: 2px solid var(--line); background: var(--card); font-size: 18px; }
  .listen.playing { border-color: var(--c1); animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { transform: scale(1.1); } }
  .people { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .who { display: flex; gap: 10px; align-items: center; min-width: 0; }
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
  .row .chunky { padding: 0 10px; }
  .chips + .wide { margin-top: 12px; }
  .chunky.ok { --c: var(--ok); --c2: var(--ok2); }
  .chunky.no { --c: var(--no); --c2: var(--no2); }
  .wide { width: 100%; margin-top: 16px; }
  .skip { width: 100%; margin-top: 12px; min-height: 48px; border: none; background: none; color: var(--dim); font-weight: 800; text-decoration: underline; text-underline-offset: 4px; }
</style>

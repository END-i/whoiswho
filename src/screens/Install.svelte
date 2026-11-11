<script>
  let { kind, canPrompt = false, oninstall, onback } = $props();
  // kind — результат platform(): ios-safari | ios-other | android | desktop | installed
</script>

<header>
  <button class="icon" onclick={onback} aria-label="Назад">←</button>
  <h1>📲 Встановити гру</h1>
</header>
<p class="lead">Після встановлення гра відкривається з головного екрана, як звичайний застосунок, і працює без інтернету.</p>

{#if kind === 'installed'}
  <p class="done">✅ Гру вже встановлено — ти зараз у ній.</p>
{:else}
  {#if canPrompt}
    <button class="chunky ok wide" onclick={oninstall}>📲 Встановити</button>
  {/if}

  <div class="platforms">
  <section class:mine={kind === 'ios-safari' || kind === 'ios-other'} aria-label="iPhone та iPad">
    <h2>📱 iPhone та iPad</h2>
    {#if kind === 'ios-other'}<p class="warn">Встановити можна лише з <b>Safari</b>: відкрий цю сторінку в Safari.</p>{/if}
    <ol>
      <li>Відкрий гру в <b>Safari</b>.</li>
      <li>Натисни <b>«Поділитися»</b> <span class="key">⎋↑</span> — квадрат зі стрілкою внизу екрана.</li>
      <li>Прокрути список і вибери <b>«На початковий екран»</b>.</li>
      <li>Натисни <b>«Додати»</b>.</li>
    </ol>
  </section>

  <section class:mine={kind === 'android'} aria-label="Android">
    <h2>🤖 Android</h2>
    <ol>
      <li>Відкрий гру в <b>Chrome</b>.</li>
      <li>Натисни меню <span class="key">⋮</span> угорі праворуч.</li>
      <li>Вибери <b>«Встановити застосунок»</b> або <b>«Додати на головний екран»</b>.</li>
      <li>Підтверди <b>«Встановити»</b>.</li>
    </ol>
  </section>

  </div>

  {#if kind === 'desktop'}
    <p class="note">💻 На комп'ютері в Chrome чи Edge — значок встановлення в адресному рядку справа.</p>
  {/if}
{/if}

<style>
  header { display: flex; align-items: center; gap: 10px; margin: 4px 0 8px; }
  h1 { font-size: 26px; margin: 0; font-weight: 1000; }
  .icon { width: 48px; height: 48px; flex: none; border-radius: 16px; border: none; background: var(--card); font-size: 21px; font-weight: 900; box-shadow: 0 3px 0 var(--line); }
  .lead { color: var(--dim); font-weight: 700; margin: 0 0 14px; }
  .wide { width: 100%; margin-bottom: 14px; }
  .chunky.ok { --c: var(--ok); --c2: var(--ok2); }
  .platforms { display: flex; flex-direction: column; }
  section { background: var(--card); border: 2px solid var(--line); border-radius: 20px; padding: 12px 16px; margin-bottom: 12px; }
  section.mine { border-color: var(--accent); box-shadow: 0 4px 0 var(--line); order: -1; }
  h2 { font-size: 19px; margin: 0 0 6px; font-weight: 900; }
  ol { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 6px; font-weight: 700; }
  .key { display: inline-block; min-width: 26px; padding: 0 6px; border-radius: 8px; background: var(--soft); font-weight: 900; text-align: center; }
  .warn { margin: 0 0 8px; font-weight: 800; color: #b7791f; }
  .done, .note { background: var(--card); border: 2px solid var(--line); border-radius: 18px; padding: 14px; font-weight: 800; }
</style>

<script>
  import { t } from '../lib/lang.svelte.js';
  import { formatVersion, parseChangelog } from '../lib/version.js';
  import changelog from '../../CHANGELOG.md?raw';

  let { onback } = $props();
  const version = formatVersion({ version: __APP_VERSION__, date: __BUILD_DATE__, commit: __COMMIT__ });
  const news = parseChangelog(changelog).slice(0, 2);
  let checking = $state(false);
  let checked = $state('');
  async function check() {
    if (!window.__checkUpdate) { checked = t('about.noSw'); return; }
    checking = true;
    try { await window.__checkUpdate(); checked = t('about.checked'); }
    catch { checked = t('about.offline'); }
    finally { checking = false; }
  }
</script>

<header>
  <button class="icon" onclick={onback} aria-label={t('common.back')}>←</button>
  <h1>{t('about.title')}</h1>
</header>

<section class="ver">
  <img src="/icons/icon-192.png" alt="" width="64" height="64" />
  <div><b>{t('app.title')}</b><span data-testid="version">{t('about.version', { v: version })}</span></div>
</section>
<button class="chunky light wide" onclick={check} disabled={checking}>{checking ? t('about.checking') : t('about.check')}</button>
{#if checked}<p class="note">{checked}</p>{/if}

<h2>{t('about.news')}</h2>
{#each news as n}
  <section class="news">
    <b>{n.version}{n.date ? ` — ${n.date}` : ''}</b>
    <ul>{#each n.items as it}<li>{it}</li>{/each}</ul>
  </section>
{/each}

<h2>{t('about.privacy')}</h2>
<p class="txt">{t('about.privacyText')}</p>

<h2>{t('about.credits')}</h2>
<ul class="txt">
  <li>{t('about.font')} <b>Nunito</b> — SIL Open Font License 1.1.</li>
  <li>{t('about.voice')}</li>
  <li>{t('about.code')} <a href="https://github.com/END-i/whoiswho" target="_blank" rel="noopener">github.com/END-i/whoiswho</a>.</li>
</ul>

<style>
  header { display: flex; align-items: center; gap: 10px; margin: 4px 0 12px; }
  h1 { font-size: 26px; margin: 0; font-weight: 1000; }
  h2 { font-size: 18px; margin: 18px 0 8px; font-weight: 900; }
  .icon { width: 48px; height: 48px; flex: none; border-radius: 16px; border: none; background: var(--card); font-size: 21px; font-weight: 900; box-shadow: 0 3px 0 var(--line); }
  .ver { display: flex; align-items: center; gap: 14px; background: var(--card); border: 2px solid var(--line); border-radius: 20px; padding: 12px 14px; margin-bottom: 12px; }
  .ver img { border-radius: 16px; }
  .ver div { display: flex; flex-direction: column; }
  .ver b { font-size: 20px; font-weight: 1000; }
  .ver span { color: var(--dim); font-weight: 800; }
  .wide { width: 100%; }
  .note { color: var(--dim); font-weight: 700; margin: 8px 0 0; }
  .news { background: var(--card); border: 2px solid var(--line); border-radius: 18px; padding: 10px 14px; margin-bottom: 8px; }
  .news ul, ul.txt { margin: 6px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-weight: 700; }
  .txt { font-weight: 700; }
  a { color: inherit; font-weight: 900; }
</style>

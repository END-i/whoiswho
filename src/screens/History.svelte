<script>
  import Avatar from '../components/Avatar.svelte';
  import { leaderboard } from '../lib/history.js';

  // packs — { id: meta.pack }, щоб підписати, з якого набору гра
  let { history, players, packs = {}, onback, onclear } = $props();
  const board = $derived(leaderboard(history));
  // фото й шаблон беремо в поточного гравця з тим самим id, якщо він ще є
  const face = (id, name) => players.find((p) => p.id === id) || { id, name };
  const date = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(+d) ? '' : d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' }) + ', ' + d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  };
</script>

<header>
  <button class="icon" onclick={onback} aria-label="Назад">←</button>
  <h1>🏆 Історія ігор</h1>
</header>

{#if !history.length}
  <p class="empty">Тут з'являться завершені ігри: хто переміг і скільки балів. Зіграйте першу! 🎲</p>
{:else}
  <h2>Загальний рахунок</h2>
  <ol class="board" aria-label="Загальний рахунок">
    {#each board as e (e.id)}
      <li class:lead={e.place === 1 && e.wins > 0}>
        <span class="place">{e.place}</span>
        <Avatar player={face(e.id, e.name)} size={42} ring={e.place === 1 && e.wins > 0} />
        <span class="name">{e.name}<small>ігор: {e.games}</small></span>
        <span class="num"><b>{e.wins}</b><small>перемог</small></span>
        <span class="num"><b>{e.points}</b><small>балів</small></span>
      </li>
    {/each}
  </ol>

  <h2>Ігри</h2>
  <ul class="games">
    {#each history as g (g.id)}
      <li>
        <div class="top"><span class="date">{date(g.date)}</span>
          <span class="tags">{#if packs[g.pack] && g.pack !== 'family'}<span class="tag pk">{packs[g.pack].emoji} {packs[g.pack].title}</span>{/if}{#if !g.finished}<span class="tag">не завершена</span>{/if}</span></div>
        <p class="win">
          {#if !g.scoring}Без балів{:else if g.winners.length}🥇 {g.players.filter((p) => g.winners.includes(p.id)).map((p) => p.name).join(', ')}{:else}Без переможців{/if}
        </p>
        <p class="scores">{g.players.map((p) => `${p.name} ${p.score}`).join(' · ')}</p>
        <p class="cards">карток: {g.cards.answered + g.cards.skipped}</p>
      </li>
    {/each}
  </ul>
  <button class="clear" onclick={onclear}>🗑️ Очистити історію</button>
{/if}

<style>
  header { display: flex; align-items: center; gap: 10px; margin: 4px 0 14px; }
  h1 { font-size: 26px; margin: 0; font-weight: 1000; }
  h2 { font-size: 18px; margin: 18px 0 8px; font-weight: 900; }
  .icon { width: 48px; height: 48px; flex: none; border-radius: 16px; border: none; background: var(--card); font-size: 21px; font-weight: 900; box-shadow: 0 3px 0 var(--line); }
  .empty { background: var(--card); border: 2px solid var(--line); border-radius: 20px; padding: 18px; font-weight: 800; text-align: center; }
  .board, .games { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .board li { display: flex; align-items: center; gap: 10px; background: var(--card); border: 2px solid var(--line); border-radius: 18px; padding: 8px 12px; }
  .board li.lead { border-color: #FFC23D; background: var(--soft); }
  .place { width: 18px; font-weight: 900; color: var(--dim); }
  .name { flex: 1; min-width: 0; font-weight: 900; display: flex; flex-direction: column; }
  small { color: var(--dim); font-weight: 700; font-size: 12px; }
  .num { display: flex; flex-direction: column; align-items: center; min-width: 52px; }
  .num b { font-size: 22px; font-weight: 1000; line-height: 1; }
  .games li { background: var(--card); border: 2px solid var(--line); border-radius: 18px; padding: 10px 14px; }
  .top { display: flex; justify-content: space-between; gap: 8px; }
  .date { color: var(--dim); font-weight: 800; font-size: 13px; }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .tag { font-size: 12px; font-weight: 900; color: var(--dim); background: var(--soft); padding: 2px 8px; border-radius: 8px; }
  .win { margin: 4px 0 2px; font-weight: 900; }
  .scores, .cards { margin: 0; font-size: 14px; color: var(--dim); font-weight: 700; }
  .clear { width: 100%; min-height: 48px; margin-top: 16px; border: none; background: none; color: var(--no); font-weight: 900; }
</style>

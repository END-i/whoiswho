// Російські набори питань — окремим шматком збірки: українська гра їх не завантажує.
// Офлайн вони все одно є — service worker кешує всі шматки збірки.
const loaders = import.meta.glob('./data/packs/ru/*.json', { import: 'default' });

/** { 'family.json': дані, … } */
export async function loadRuFiles() {
  const entries = await Promise.all(Object.entries(loaders).map(async ([f, load]) => [f.split('/').pop(), await load()]));
  return Object.fromEntries(entries);
}

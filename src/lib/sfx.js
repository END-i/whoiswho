// Звуки гри без файлів: синтез Web Audio. «point» — весела висхідна мелодія за бал, «miss» — коротка тиха нота.

/** Ноти для звуку: частота (Гц), початок і тривалість (с), гучність 0…1. */
export function tones(kind) {
  switch (kind) {
    case 'point': return [
      { freq: 784, start: 0, dur: 0.12, gain: 0.25 },     // G5
      { freq: 988, start: 0.1, dur: 0.12, gain: 0.25 },   // B5
      { freq: 1319, start: 0.2, dur: 0.28, gain: 0.3 },   // E6
    ];
    case 'miss': return [{ freq: 220, start: 0, dur: 0.18, gain: 0.12 }];
    default: return [];
  }
}

let shared = null;
/**
 * Відтворити звук. AudioContextClass передається параметром (у тестах — підставний).
 * Повертає кількість запущених нот (0 — звук вимкнено чи браузер не вміє).
 */
export function playSfx(kind, { enabled = true, AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext, ctx } = {}) {
  if (!enabled || (!ctx && !AudioContextClass)) return 0;
  try {
    const ac = ctx || (shared ||= new AudioContextClass());
    ac.resume?.();
    const t0 = ac.currentTime, notes = tones(kind);
    for (const n of notes) {
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = 'triangle'; osc.frequency.value = n.freq;
      g.gain.setValueAtTime(0.0001, t0 + n.start);
      g.gain.exponentialRampToValueAtTime(n.gain, t0 + n.start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.start + n.dur);
      osc.connect(g); g.connect(ac.destination);
      osc.start(t0 + n.start); osc.stop(t0 + n.start + n.dur + 0.02);
    }
    return notes.length;
  } catch {
    return 0; // звук не критичний — гра працює далі
  }
}

/** Для тестів: скинути спільний AudioContext. */
export const resetSfx = () => { shared = null; };

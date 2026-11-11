// Звуки гри без файлів: ноти синтезуються у WAV у пам'яті й граються через <audio>.
// Не Web Audio: на iPhone перемикач беззвучного режиму глушить Web Audio, а <audio> (як і озвучку) — ні.
// «point» — весела висхідна мелодія за бал, «miss» — смішне «ва-ва», «skip» — тихе «шух»;
// «tick» і «end» — таймер «Покажи!» і викликів.

export const SFX_RATE = 22050;

/** Звук як набір нот: частота (Гц; slide — до якої ковзає), початок і тривалість (с), гучність 0…1; noise — шум. */
export function tones(kind) {
  switch (kind) {
    case 'point': return [
      { freq: 784, start: 0, dur: 0.12, gain: 0.5 },     // G5
      { freq: 988, start: 0.1, dur: 0.12, gain: 0.5 },   // B5
      { freq: 1319, start: 0.2, dur: 0.3, gain: 0.6 },   // E6
    ];
    // «ва-ва»: дві ноти вниз, кожна ще й сповзає — смішно, не прикро; вище 300 Гц, щоб було чути на динаміку телефона
    case 'miss': return [
      { freq: 523, slide: 466, start: 0, dur: 0.2, gain: 0.45 },     // C5 → A#4
      { freq: 415, slide: 311, start: 0.22, dur: 0.38, gain: 0.45 }, // G#4 → D#4
    ];
    case 'skip': return [{ noise: true, start: 0, dur: 0.16, gain: 0.18 }];
    // таймер: коротке «тік» в останні секунди й подвійний сигнал, коли час вийшов
    case 'tick': return [{ freq: 1568, start: 0, dur: 0.05, gain: 0.35 }]; // G6
    case 'end': return [
      { freq: 880, start: 0, dur: 0.18, gain: 0.5 },    // A5
      { freq: 880, start: 0.24, dur: 0.3, gain: 0.5 },
    ];
    default: return [];
  }
}

/** Детермінований шум (щоб тести були стабільні). */
function noiseGen(seed = 1) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s / 0x7fffffff) * 2 - 1; };
}

/** Відрендерити звук у PCM 16 біт: трикутна хвиля з м'якою атакою й згасанням; шум — зі згасанням. */
export function render(kind, rate = SFX_RATE) {
  const notes = tones(kind);
  const end = notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0);
  const out = new Float32Array(Math.ceil(end * rate) + 1);
  const noise = noiseGen();
  for (const n of notes) {
    const from = Math.floor(n.start * rate), len = Math.floor(n.dur * rate);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.min(1, i / (0.01 * rate)) * (1 - t) ** 2; // атака 10 мс, далі згасання
      let v;
      if (n.noise) v = noise();
      else {
        phase += (n.slide ? n.freq + (n.slide - n.freq) * t : n.freq) / rate;
        v = 4 * Math.abs(phase - Math.floor(phase + 0.5)) - 1; // трикутник
      }
      out[from + i] += v * env * n.gain;
    }
  }
  return Int16Array.from(out, (v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767));
}

/** PCM 16 біт моно → байти WAV. */
export function wav(pcm, rate = SFX_RATE) {
  const b = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const str = (o, s) => [...s].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); b.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, rate, true); b.setUint32(28, rate * 2, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true);
  str(36, 'data'); b.setUint32(40, pcm.length * 2, true);
  pcm.forEach((v, i) => b.setInt16(44 + i * 2, v, true));
  return new Uint8Array(b.buffer);
}

const players = new Map();
/**
 * Відтворити звук. Audio і URL передаються параметрами (у тестах — підставні).
 * Плеєр на кожен звук створюється один раз. Повертає true, якщо звук запущено.
 */
export function playSfx(kind, { enabled = true, Audio = globalThis.Audio, URL = globalThis.URL } = {}) {
  if (!enabled || !Audio || !URL?.createObjectURL || !tones(kind).length) return false;
  try {
    let a = players.get(kind);
    if (!a) {
      a = new Audio(URL.createObjectURL(new Blob([wav(render(kind))], { type: 'audio/wav' })));
      a.dataset.sfx = kind; // щоб e2e бачив, який звук грав
      players.set(kind, a);
    }
    a.currentTime = 0;
    a.play()?.catch?.(() => {}); // браузер може не дозволити звук — гра працює далі
    return true;
  } catch {
    return false;
  }
}

/** Для тестів: забути створені плеєри. */
export const resetSfx = () => players.clear();

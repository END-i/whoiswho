// Одне завантаження озвучки за раз. Нове для іншого набору чи мови зупиняє попереднє:
// інакше гра докачувала весь старий набір, а новий чекав (відгук 19.11).

/**
 * start(key, run) — запустити run(signal) для key → { result, aborted }; той самий key, що вже качається, — те саме завантаження.
 * aborted — завантаження зупинили (інший набір, мова чи «Видалити»): його result уже нікому не потрібен.
 * stop() — зупинити поточне. key — що качається зараз (null — нічого).
 */
export function createAudioLoader() {
  let current = null;
  return {
    get key() { return current?.key ?? null; },
    start(key, run) {
      if (current?.key === key) return current.promise;
      current?.ctrl.abort();
      const job = { key, ctrl: new AbortController() };
      current = job;
      job.promise = Promise.resolve()
        // зупинили ще до старту (кілька перемикань поспіль) — не починати зовсім
        .then(() => (job.ctrl.signal.aborted ? undefined : run(job.ctrl.signal)))
        .then((result) => ({ result, aborted: job.ctrl.signal.aborted }))
        .finally(() => { if (current === job) current = null; });
      return job.promise;
    },
    stop() {
      current?.ctrl.abort();
      current = null;
    },
  };
}

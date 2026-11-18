-- Помилки з браузерів гравців (whoiswho, cards, movies). Лише технічне: без імен, питань і даних карток.
CREATE TABLE IF NOT EXISTS errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,          -- коли (UTC, ISO)
  app TEXT NOT NULL,         -- whoiswho | cards | movies
  version TEXT NOT NULL,     -- версія застосунку
  kind TEXT NOT NULL,        -- error | rejection
  message TEXT NOT NULL,
  source TEXT NOT NULL,      -- файл:рядок:стовпчик або перші рядки стеку
  page TEXT NOT NULL,        -- шлях сторінки без параметрів
  ua TEXT NOT NULL           -- браузер
);
CREATE INDEX IF NOT EXISTS errors_at ON errors (at);
CREATE INDEX IF NOT EXISTS errors_app_at ON errors (app, at);

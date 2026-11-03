-- SQLite schema untuk Google Maps Scraper Dashboard

CREATE TABLE IF NOT EXISTS scraping_tasks (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  keyword           TEXT NOT NULL,
  category_group    TEXT DEFAULT 'Lainnya',
  region_selection  TEXT NOT NULL,
  config            TEXT NOT NULL,

  status            TEXT NOT NULL DEFAULT 'queued',
  phase             TEXT NOT NULL DEFAULT 'pending',

  urls_found        INTEGER NOT NULL DEFAULT 0,
  processed         INTEGER NOT NULL DEFAULT 0,
  successful        INTEGER NOT NULL DEFAULT 0,
  failed            INTEGER NOT NULL DEFAULT 0,

  current_province  TEXT,
  error_message     TEXT,

  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  started_at        TEXT,
  completed_at      TEXT
);

CREATE TABLE IF NOT EXISTS scraping_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  name TEXT,
  full_address TEXT,
  email TEXT,
  category TEXT,
  phones TEXT,
  latitude REAL,
  longitude REAL,
  rating TEXT,
  total_reviews INTEGER,
  google_maps_url TEXT,
  website TEXT,
  province TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES scraping_tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scraping_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  result_id INTEGER NOT NULL,
  author_name TEXT,
  rating INTEGER,
  review_text TEXT,
  published_at TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES scraping_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (result_id) REFERENCES scraping_results(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scraping_urls (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id           TEXT NOT NULL REFERENCES scraping_tasks(id) ON DELETE CASCADE,
  url               TEXT NOT NULL,
  province          TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  UNIQUE(task_id, url)
);

CREATE TABLE IF NOT EXISTS scraping_logs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id           TEXT NOT NULL REFERENCES scraping_tasks(id) ON DELETE CASCADE,
  timestamp         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  level             TEXT NOT NULL DEFAULT 'info',
  message           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_results_task ON scraping_results(task_id);
CREATE INDEX IF NOT EXISTS idx_reviews_task ON scraping_reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_reviews_result ON scraping_reviews(result_id);
CREATE INDEX IF NOT EXISTS idx_urls_task_status ON scraping_urls(task_id, status);
CREATE INDEX IF NOT EXISTS idx_logs_task ON scraping_logs(task_id);
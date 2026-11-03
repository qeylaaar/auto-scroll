const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'scraper.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Auto-migrate: Tambahkan kolom rating dan total_reviews jika belum ada di database lama
try {
  db.prepare(`ALTER TABLE scraping_results ADD COLUMN rating TEXT`).run();
} catch (e) {}

try {
  db.prepare(`ALTER TABLE scraping_results ADD COLUMN total_reviews INTEGER`).run();
} catch (e) {}

// Auto-migrate: Pastikan tabel scraping_reviews tersedia
db.exec(`
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
`);

try {
  db.prepare(`ALTER TABLE scraping_tasks ADD COLUMN category_group TEXT DEFAULT 'Lainnya'`).run();
} catch (e) {}

try {
  db.prepare(`ALTER TABLE scraping_results ADD COLUMN website TEXT`).run();
} catch (e) {}

module.exports = db;
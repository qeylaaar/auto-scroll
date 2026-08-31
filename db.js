const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'crawler_state.db'));

// 1. Tabel untuk tracking task direktori master dari CSV/Excel
db.exec(`
    CREATE TABLE IF NOT EXISTS directories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kategori TEXT,
        nama_direktori TEXT UNIQUE,
        status TEXT DEFAULT 'PENDING',
        total_data INTEGER DEFAULT 0,
        update_terakhir TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// 2. Tabel untuk tracking per URL tempat Google Maps
db.exec(`
    CREATE TABLE IF NOT EXISTS places (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE,
        category TEXT,
        part INTEGER,
        name TEXT,
        full_address TEXT,
        phones TEXT,
        latitude TEXT,
        longitude TEXT,
        rating TEXT,
        total_reviews TEXT,
        status TEXT DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME
    )
`);

// --- FUNGSI MANAJEMEN DIREKTORI MASTER ---

function upsertDirectory(kategori, namaDirektori, status, totalData, updateTerakhir) {
    const stmt = db.prepare(`
        INSERT INTO directories (kategori, nama_direktori, status, total_data, update_terakhir, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(nama_direktori) DO UPDATE SET
            kategori = excluded.kategori,
            status = excluded.status,
            total_data = excluded.total_data,
            update_terakhir = excluded.update_terakhir,
            updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(kategori, namaDirektori, status, totalData, updateTerakhir);
}

function getAllDirectories() {
    return db.prepare(`SELECT id, kategori, nama_direktori, status, total_data, update_terakhir FROM directories ORDER BY id ASC`).all();
}

// --- FUNGSI MANAJEMEN PLACES (URL CRAWLING) ---

function initUrls(urls, category, part) {
    const insert = db.prepare(`
        INSERT OR IGNORE INTO places (url, category, part, status) 
        VALUES (?, ?, ?, 'PENDING')
    `);
    const insertMany = db.transaction((urlList) => {
        for (const url of urlList) insert.run(url, category, part);
    });
    insertMany(urls);
}

function getPendingUrls(category, part) {
    return db.prepare(`
        SELECT url FROM places 
        WHERE category = ? AND part = ? AND status != 'CRAWLED'
    `).all(category, part).map(r => r.url);
}

function getAllCrawledData(category, part) {
    return db.prepare(`
        SELECT name, full_address as fullAddress, '' as email, category, 
               phones, latitude, longitude, rating, total_reviews as totalReviews
        FROM places 
        WHERE category = ? AND part = ? AND status = 'CRAWLED'
    `).all(category, part);
}

function updatePlaceCrawled(url, data) {
    const stmt = db.prepare(`
        UPDATE places 
        SET name = ?, full_address = ?, phones = ?, latitude = ?, longitude = ?, 
            rating = ?, total_reviews = ?, status = 'CRAWLED', updated_at = CURRENT_TIMESTAMP 
        WHERE url = ?
    `);
    stmt.run(
        data.name || '',
        data.fullAddress || '',
        data.phones || '',
        data.latitude || '',
        data.longitude || '',
        data.rating || '0',
        data.totalReviews || '0',
        url
    );
}

function updatePlaceFailed(url) {
    const stmt = db.prepare(`
        UPDATE places 
        SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP 
        WHERE url = ?
    `);
    stmt.run(url);
}

function getSummaryStats() {
    return db.prepare(`
        SELECT category, part, 
               COUNT(*) as total,
               SUM(CASE WHEN status = 'CRAWLED' THEN 1 ELSE 0 END) as crawled,
               SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
               SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending
        FROM places 
        GROUP BY category, part
    `).all();
}

module.exports = {
    upsertDirectory,
    getAllDirectories,
    initUrls,
    getPendingUrls,
    getAllCrawledData,
    updatePlaceCrawled,
    updatePlaceFailed,
    getSummaryStats
};
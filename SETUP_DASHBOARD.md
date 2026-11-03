# Setup & Menjalankan Google Maps Scraper Dashboard

## Cara Paling Mudah — Double-Click (Direkomendasikan)

Cukup **double-click `start-dashboard.bat`** di folder utama project.

Script ini otomatis mengecek versi Node.js Anda. Kalau bukan versi 18/20/22 (misalnya Node v24, yang diketahui bikin `better-sqlite3` gagal install), dan Anda sudah punya **nvm-windows** terpasang, script akan **otomatis beralih ke Node 22.11.0** tanpa perlu langkah manual. Kalau belum punya nvm-windows, script akan kasih instruksi jelas cara install-nya (sekali saja, per komputer).

Selain itu, di percobaan pertama, ini otomatis akan:
1. Install semua dependency backend (`npm install`)
2. Install semua dependency frontend (`npm install` di folder `frontend`)
3. Build dashboard jadi file statis
4. Menjalankan server
5. **Membuka browser otomatis** ke `http://localhost:4000`

Setelah percobaan pertama (yang makan waktu beberapa menit karena install & build), pemakaian berikutnya tinggal **double-click lagi** — langsung jalan dalam hitungan detik karena semua dependency & build sudah tersimpan.

**Untuk berhenti**: tutup jendela hitam (Command Prompt) yang muncul, atau tekan `Ctrl+C` di situ.

**Kalau Anda mengubah tampilan/warna/logo** (lihat bagian kustomisasi di bawah), jalankan `rebuild-dashboard.bat` setelah selesai edit, supaya perubahannya ter-build ulang — `start-dashboard.bat` sendiri tidak akan rebuild otomatis kalau folder `frontend/dist` sudah ada.

---

## Cara Manual (untuk development / edit kode)

Project ini punya 2 bagian yang bisa dijalankan terpisah: **backend** (API + scraper orchestration, di root folder) dan **frontend** (dashboard React, di folder `frontend/`).

### 1. Install & jalankan Backend

```bash
npm install
npm run server
```
Backend akan listen di `http://localhost:4000`. Biarkan terminal ini tetap terbuka.

Puppeteer otomatis download Chromium saat `npm install` (butuh akses internet penuh).

Kalau `npm install` gagal dengan error terkait `better-sqlite3` / `node-gyp` / "Could not find Visual Studio" di Windows: itu karena Node.js versi Anda terlalu baru dan belum ada prebuilt binary. Solusi tercepat: install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases), lalu `nvm install 22.11.0 && nvm use 22.11.0`, hapus `node_modules` & `package-lock.json`, install ulang.

### 2. Install & jalankan Frontend (mode development, dengan hot-reload)

Buka **terminal baru** (backend tetap jalan di terminal pertama):
```bash
cd frontend
npm install
npm run dev
```
Frontend akan listen di `http://localhost:5173` dengan hot-reload (perubahan kode langsung terlihat tanpa refresh manual) dan otomatis mem-proxy semua request `/api/*` dan `/socket.io` ke backend di port 4000.

**Gunakan mode ini kalau Anda sedang edit kode/tampilan.** Untuk pemakaian sehari-hari (bukan development), pakai `start-dashboard.bat` saja — lebih simpel, cuma 1 server, cuma 1 port.

## Buka Dashboard

- Lewat `start-dashboard.bat`: **http://localhost:4000**
- Lewat mode development manual: **http://localhost:5173**

Anda akan melihat:
- **Dashboard** (`/`) — ringkasan statistik & recent tasks
- **New Task** (`/new-task`) — buat scraping task baru
- **Task History** (`/tasks`) — semua task + actions
- **Task Detail** (`/tasks/:id`) — monitoring realtime, live logs, results table, dan map

## Struktur Project

```
/                       <- backend (Node.js/Express) + scraper engine
  scraper/              <- refactor dari index.js/extract_detail.js/merge_clean.js (logic scraping tidak diubah)
  backend/              <- API, job manager, database, websocket
  frontend/             <- dashboard React (folder terpisah, package.json sendiri)
  data/                 <- database SQLite (scraper.db) dibuat otomatis saat backend pertama kali jalan
  index.js, extract_detail.js, dll  <- script CLI ORIGINAL, tidak disentuh, masih bisa dipakai langsung
```

## Alur kerja singkat

1. Start backend (`npm run server`) dan frontend (`cd frontend && npm run dev`)
2. Buka `http://localhost:5173` → klik **New Task**
3. Isi nama, keyword, pilih wilayah (Seluruh Indonesia atau provinsi tertentu) → **Create Task**
4. Otomatis diarahkan ke halaman Task Detail → klik **Start**
5. Progress, log, dan hasil scraping muncul realtime tanpa perlu refresh
6. Setelah selesai (atau bahkan saat masih jalan), buka tab **Results Table** atau **Map**, lalu download **CSV/XLSX/GeoJSON** dari tombol export

## Catatan penting

- **Task tetap jalan meski browser ditutup** — selama proses `node backend/server.js` masih hidup di terminal, scraping berjalan sebagai background job (child process terpisah per task). Buka lagi browser dan task masih lanjut/bisa dipantau.
- **Resume otomatis**: kalau backend/PC restart saat task sedang jalan, tinggal buka Task History → klik Resume pada task yang berhenti, scraping akan lanjut dari URL terakhir yang belum berhasil (tidak mengulang dari awal).
- Maksimal **2 task berjalan bersamaan** secara default (bisa diubah di `backend/jobs/jobManager.js`, konstanta `MAX_CONCURRENT_TASKS`) — task lain otomatis masuk antrian.

# 🗺️ Universal Google Maps Scraper Indonesia (Interactive CLI + SQLite Tracking)

Sistem otomasi ekstraksi data lokasi bisnis/tempat se-Indonesia dari Google Maps berbasis Node.js, Puppeteer, dan SQLite Database State Tracking.

Script ini bersifat universal (mendukung semua kategori kata kunci seperti: *Tempat Gym, Bengkel, Cuci Mobil, Tempat Spa, Apotik, Toko Bangunan, Cafe, dll.*) serta dilengkapi antarmuka terminal interaktif dan pelacakan progres otomatis untuk mencegah duplikasi atau data hilang saat crawling terhenti.

---

## 📊 Hasil Output Excel (9 Kolom Lengkap)
Setiap task ekstraksi menghasilkan file Excel (.xlsx) dengan struktur kolom:
1. Name — Nama Tempat / Unit Bisnis
2. Fulladdress — Alamat Lengkap (bersih dari ikon unicode)
3. Email — Alamat Email (jika tersedia)
4. Categories — Kategori Resmi dari Google Maps
5. Phones — Nomor Telepon
6. Latitude — Koordinat Garis Lintang
7. Longitude — Koordinat Garis Bujur
8. Rating — Nilai Ulasan / Bintang (contoh: 4.8)
9. Total Reviews — Jumlah Total Ulasan Pengguna (contoh: 1240)

---

## 🏗️ Struktur Folder Proyek
auto-scroll/
├── Data_Kabupaten_Kota_Part_1.xlsx  # Database Wilayah Indonesia Part 1
├── Data_Kabupaten_Kota_Part_2.xlsx  # Database Wilayah Indonesia Part 2
├── Data_Kabupaten_Kota_Part_3.xlsx  # Database Wilayah Indonesia Part 3
├── Task Crawling - Google Map.csv   # Rekap Master Task Kategori Direktori
├── crawler_state.db                 # Database SQLite (State & Tracking Otomatis)
├── db.js                            # Konfigurasi Schema & Fungsi Query SQLite
├── import_task_csv.js               # Importer Rekap Task CSV ke Database
├── index.js                         # Fase 1: Scanning URL & Infinite Scroll
├── extract_detail.js                # Fase 2: Ekstraksi Detail, Rating & Reviews
├── merge_clean.js                   # Fase 3: Penggabungan File Part & Data Cleaning
├── main.js                          # CLI Dashboard & Task Orchestrator Utama
├── package.json
└── readme.md

---

## ⚙️ Persyaratan Sistem (Prerequisites)
* Node.js (v18.x atau lebih baru disarankan: https://nodejs.org)
* NPM (Bawaan Node.js)
* Google Chrome Browser terpasang di sistem

---

## 🚀 Langkah Instalasi

1. Clone repository:
   git clone https://github.com/qeylaaar/auto-scroll.git
   cd auto-scroll

2. Install seluruh dependencies:
   npm install

3. (Opsional - Sekali di awal) Impor daftar master direktori dari CSV ke database SQLite:
   node import_task_csv.js

---

## 🛠️ Panduan Menjalankan Sistem

Jalankan menu pusat antarmuka terminal:
node main.js

Pilihan menu yang tersedia:
1. 🗺️  Google Maps - Fase 1 (Scanning URL)
2. 📝 Google Maps - Fase 2 (Extract Detail & Reviews)
3. 🧹 Google Maps - Fase 3 (Merge & Clean Excel)
4. 📊 Cek Status & Statistik Database SQLite
5. ❌ Keluar

---

### 📍 Alur 3 Fase Scraping:

#### 1. FASE 1: Scanning URL (node index.js)
* Membaca daftar kabupaten/kota dari Data_Kabupaten_Kota_Part_<no>.xlsx.
* Menjalankan browser untuk auto-scroll dan mengumpulkan seluruh link listing tempat.
* Auto-Save & DB Sync: Link tersimpan ke file JSON (urls_<kategori>_part<no>.json) dan otomatis diinisialisasi ke database SQLite dengan status PENDING.

#### 2. FASE 2: Ekstraksi Detail, Koordinat & Reviews (node extract_detail.js)
* Membuka setiap link detail tempat menggunakan antrean multi-worker tab concurrent.
* Mengekstrak Nama, Alamat, Kategori, Telepon, Latitude, Longitude, Rating, dan Jumlah Ulasan.
* Smart Memory Flush: Browser me-refresh session otomatis secara berkala untuk menjaga stabilitas penggunaan RAM.
* Auto-Resume & State Tracking: Hanya memproses URL yang belum berstatus CRAWLED. Progres otomatis terkunci berkala ke file Excel Hasil_<kategori>_Part_<no>.xlsx.

#### 3. FASE 3: Penggabungan File & Data Cleaning (node merge_clean.js)
* Menggabungkan hasil Excel Part 1, Part 2, dan Part 3 menjadi satu file master.
* Membersihkan data duplikat dan menormalisasi format string.

---

### 📊 Monitoring Progres via SQLite (Menu 4)
Pilih opsi 4 di main.js untuk melihat tabel rekap status dari seluruh 79 kategori direktori:
* Total direktori target vs yang sudah SELESAI vs PENDING.
* Jumlah data hasil ekstraksi terbaru per kategori.
* Status antrean URL yang sedang aktif berjalan di database.

---

## 💻 Tips Multi-Terminal Execution (Multi-Part Sekaligus)
Untuk mempercepat proses pengambilan data 3 part sekaligus di satu perangkat:
1. Buka 3 tab terminal di VS Code.
2. Terminal 1: Jalankan node index.js -> Pilih Part 1.
3. Terminal 2: Jalankan node index.js -> Pilih Part 2.
4. Terminal 3: Jalankan node index.js -> Pilih Part 3.
5. Setelah Fase 1 selesai, jalankan node extract_detail.js di masing-masing tab sesuai part-nya. Database SQLite akan mengelola status masing-masing data secara aman tanpa terjadi bentrok (race condition).
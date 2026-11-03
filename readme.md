# 🗺️ Universal Google Maps Scraper Indonesia (Interactive CLI)

Script otomatisasi scraping data lokasi bisnis/tempat di seluruh kabupaten/kota Indonesia dari Google Maps menggunakan Node.js dan Puppeteer.

Script ini bersifat Universal dan mendukung kata kunci (keyword) kategori apapun (seperti: Tempat Gym, Bengkel, Cuci Mobil, Tempat Spa, Apotik, Sekolah, Klinik, dll.) serta dilengkapi antarmuka interaktif di terminal.

---

## 📊 Hasil Output Excel (7 Kolom Utama)
Setiap task scraping akan mengekstrak data berikut ke file Excel (.xlsx):
1. Name — Nama Tempat / Bisnis
2. Fulladdress — Alamat Lengkap (bebas dari ikon/karakter unicode)
3. Email — Alamat Email (jika tersedia di deskripsi)
4. Categories — Kategori Resmi dari Google Maps
5. Phones — Nomor Telepon
6. Latitude — Koordinat Latitude
7. Longitude — Koordinat Longitude

---

## ⚙️ Persyaratan Sistem (Prerequisites)
Sebelum menjalankan script, pastikan perangkat kamu sudah terinstal:
* Node.js (Versi 18+ disarankan: https://nodejs.org)
* VS Code / Terminal favorit

---

## 🚀 Langkah Installasi (Cuma Sekali di Awal)

1. Clone repository ini:
   git clone <https://github.com/qeylaaar/auto-scroll.git>
   cd auto-scroll

2. Install semua dependencies:
   npm install

---

## 🛠️ Cara Menjalankan Script (3 Langkah Mudah)

### 📍 FASE 1: Scanning URL (Pencarian Wilayah)

Jalankan perintah berikut di terminal:
node index.js

Terminal akan langsung menanyakan 2 hal:
1. Kategori yang mau dicari (misal: tempat spa, bengkel, cuci mobil, apotik)
2. Pilihan Part Wilayah (ketik 1, 2, atau 3)

💡 Fitur Auto-Save Real-time:
Data URL yang didapat akan otomatis tersimpan ke file urls_<kategori>_part<no>.json. Jika internet terputus, laptop mati, atau terminal ke-close di tengah jalan, tinggal jalankan ulang perintah "node index.js", script akan otomatis melanjutkan tanpa mengulang dari awal!

---

### 📝 FASE 2: Ekstraksi Detail ke Excel

Jalankan Fase 2 setelah Fase 1 selesai (ditandai pesan [BERHASIL SELESAI FASE 1]).

Jalankan perintah:
node extract_detail.js

Terminal akan menanyakan kategori dan nomor Part. Masukkan Kategori & Part yang sama seperti di Fase 1.

💡 Fitur Auto-Save Progress:
Data detail akan otomatis terkunci ke file Excel Hasil_<kategori>_Part_<no>.xlsx setiap kelipatan 20 data.

---

### 🧹 FASE 3: Penggabungan File & Cleaning Data

Setelah seluruh Part selesai diekstrak ke Excel, kumpulkan file-file Excel part tersebut di folder project, lalu jalankan:
node merge_clean.js

Script ini akan otomatis:
* Memberihkan ikon/karakter unicode aneh pada kolom alamat.
* Menghapus data duplikat.
* Menghasilkan file master akhir siap pakai: Data_Gym_Seluruh_Indonesia.xlsx (atau nama file master kategori terkait).

---

## 💻 Tips Menjalankan Multiple Terminal (1 Laptop)

Jika kamu ingin menjalankan 3 Part sekaligus di 1 laptop (multi-tasking):

1. Buka 3 Tab Terminal di VS Code.
2. Di Terminal 1, jalankan: node index.js -> pilih Part 1.
3. Di Terminal 2, jalankan: node index.js -> pilih Part 2.
4. Di Terminal 3, jalankan: node index.js -> pilih Part 3.

Setelah Fase 1 selesai semua, lakukan hal yang sama untuk: node extract_detail.js di masing-masing tab terminal!
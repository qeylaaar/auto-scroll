/**
 * regions.js
 *
 * Loader terpadu untuk Data_Kabupaten_Kota_Part_{1,2,3}.xlsx.
 *
 * PENTING: file Part_1/2/3 dibagi rata berdasarkan JUMLAH BARIS (~171-172
 * kab/kota per file), BUKAN per-provinsi utuh. Contoh: "Jawa Timur" muncul
 * di Part 1 & Part 2 sekaligus, "Papua Pegunungan" muncul di Part 2 & 3.
 *
 * Modul ini TIDAK mengubah file .xlsx asli maupun cara index.js membacanya
 * secara mandiri (index.js/extract_detail.js/main.js CLI tetap bisa
 * dijalankan apa adanya). Modul ini hanya menyediakan cara terpadu untuk
 * backend memilih wilayah lintas-part berdasarkan pilihan user (provinsi
 * tertentu, beberapa provinsi, atau seluruh Indonesia).
 */

const path = require('path');
const XLSX = require('xlsx');

const PART_FILES = [1, 2, 3].map((n) =>
  path.join(__dirname, '..', `Data_Kabupaten_Kota_Part_${n}.xlsx`)
);

let _cache = null;

/**
 * Baca ketiga file Part dan gabungkan jadi satu daftar flat:
 * [{ provinsi, kabupatenKota, part }]
 */
function loadAllRegions() {
  if (_cache) return _cache;

  const all = [];
  PART_FILES.forEach((filePath, idx) => {
    const partNum = idx + 1;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    rows.forEach((row) => {
      const provinsi = (row['Provinsi'] || '').toString().trim();
      const kabupatenKota = (
        row['Kabupaten/Kota'] ||
        row['Kabupaten / Kota'] ||
        row['Kabupaten'] ||
        Object.values(row)[1] ||
        ''
      )
        .toString()
        .trim();

      if (provinsi && kabupatenKota) {
        all.push({ provinsi, kabupatenKota, part: partNum });
      }
    });
  });

  _cache = all;
  return all;
}

/** Daftar provinsi unik (untuk dropdown di UI New Task) */
function listProvinces() {
  const all = loadAllRegions();
  return [...new Set(all.map((r) => r.provinsi))].sort();
}

/**
 * Resolusi pilihan wilayah dari form New Task menjadi daftar
 * { provinsi, kabupatenKota, part } yang perlu discrape.
 *
 * @param {Object} selection
 * @param {'all'|'provinces'|'kabupaten'} selection.mode
 * @param {string[]} [selection.provinces] - dipakai jika mode 'provinces'
 * @param {string[]} [selection.kabupatenKota] - dipakai jika mode 'kabupaten'
 */
function resolveSelection(selection) {
  const all = loadAllRegions();

  if (!selection || selection.mode === 'all') {
    return all;
  }

  if (selection.mode === 'provinces') {
    const wanted = new Set((selection.provinces || []).map((p) => p.toUpperCase()));
    return all.filter((r) => wanted.has(r.provinsi.toUpperCase()));
  }

  if (selection.mode === 'kabupaten') {
    const wanted = new Set((selection.kabupatenKota || []).map((k) => k.toUpperCase()));
    return all.filter((r) => wanted.has(r.kabupatenKota.toUpperCase()));
  }

  throw new Error(`Unknown region selection mode: ${selection.mode}`);
}

module.exports = { loadAllRegions, listProvinces, resolveSelection, PART_FILES };

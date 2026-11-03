/**
 * cleaner.js — Fase 3: Clean + dedup hasil scraping.
 *
 * Refactor dari merge_clean.js. LOGIC CLEANING/DEDUP TIDAK DIUBAH:
 * - hapus karakter unicode/icon aneh di awal alamat (range \uE000-\uF8FF)
 * - dedup berdasarkan kombinasi (name lowercase + latitude)
 *
 * Perbedaan: merge_clean.js asli membaca 3 file Excel terpisah lalu
 * menggabungkannya. Di arsitektur baru, semua hasil satu task sudah
 * tersimpan di SQLite (satu task = satu proses, tidak lagi terpecah
 * Part 1/2/3 secara file terpisah), jadi fungsi ini menerima array hasil
 * langsung dan mengembalikan array yang sudah bersih + statistik.
 */

function cleanAddress(address) {
  if (!address) return address;
  return address.replace(/^[\uE000-\uF8FF\s]+/, '').trim();
}

/**
 * @param {Object[]} items - hasil scraping mentah (field: name, fullAddress, ...)
 * @returns {{ cleaned: Object[], totalBefore: number, duplicatesRemoved: number }}
 */
function cleanAndDedup(items) {
  const totalBefore = items.length;
  const uniqueMap = new Map();

  items.forEach((item) => {
    const cleanedItem = {
      ...item,
      fullAddress: cleanAddress(item.fullAddress),
    };

    const nameLower = (cleanedItem.name || '').toLowerCase().trim();
    const lat = cleanedItem.latitude ? String(cleanedItem.latitude).trim() : '';
    const key = `${nameLower}_${lat}`;

    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, cleanedItem);
    }
  });

  const cleaned = Array.from(uniqueMap.values());

  return {
    cleaned,
    totalBefore,
    duplicatesRemoved: totalBefore - cleaned.length,
  };
}

module.exports = { cleanAndDedup, cleanAddress };

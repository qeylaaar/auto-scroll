/**
 * Konfigurasi terpusat untuk scraping.
 * Sesuai brief: "Buat satu central configuration ... Jangan menyebarkan
 * konfigurasi tersebut di banyak file."
 *
 * Nilai default diambil dari nilai asli di index.js / extract_detail.js
 * supaya behavior default tetap sama seperti sebelumnya.
 */

const DEFAULTS = {
  // Basic (aman diubah user lewat form New Task)
  MAX_WORKERS: 2, // = CONCURRENCY_LIMIT di extract_detail.js asli
  REQUEST_DELAY: 0, // ms delay antar-request tambahan (opsional, 0 = tidak ada)
  RETRY_COUNT: 2, // = MAX_RETRIES asli

  // Advanced (ditampilkan di bagian "Advanced Settings")
  TIMEOUT_MS: 12000, // hard-timeout per URL di Fase 2 (asli: 12000)
  RESTART_BROWSER_EVERY: 200, // asli: 200
  NAVIGATION_TIMEOUT_MS: 20000, // timeout page.goto Fase 1 (asli: 20000)
};

const LIMITS = {
  MAX_WORKERS_MAX: 8, // di atas ini beri warning stabilitas (lihat validateConfig)
  MAX_WORKERS_WARN: 5,
};

/**
 * Validasi & normalisasi config dari user, kembalikan { config, warnings }.
 * Tidak melempar error untuk nilai yang "tidak ideal" (misal concurrency
 * tinggi) — cukup warning, sesuai brief ("beri warning, jangan blokir").
 */
function validateConfig(input = {}) {
  const warnings = [];
  const config = { ...DEFAULTS, ...input };

  config.MAX_WORKERS = Math.max(1, Math.min(LIMITS.MAX_WORKERS_MAX, Number(config.MAX_WORKERS) || DEFAULTS.MAX_WORKERS));
  config.RETRY_COUNT = Math.max(0, Number(config.RETRY_COUNT) || 0);
  config.REQUEST_DELAY = Math.max(0, Number(config.REQUEST_DELAY) || 0);
  config.TIMEOUT_MS = Math.max(3000, Number(config.TIMEOUT_MS) || DEFAULTS.TIMEOUT_MS);
  config.RESTART_BROWSER_EVERY = Math.max(10, Number(config.RESTART_BROWSER_EVERY) || DEFAULTS.RESTART_BROWSER_EVERY);

  if (config.MAX_WORKERS >= LIMITS.MAX_WORKERS_WARN) {
    warnings.push(
      `MAX_WORKERS=${config.MAX_WORKERS} cukup tinggi — dapat meningkatkan penggunaan CPU/RAM dan membuat scraping tidak stabil. Rekomendasi: 2-4.`
    );
  }

  return { config, warnings };
}

module.exports = { DEFAULTS, LIMITS, validateConfig };

/**
 * collector.js — Fase 1: Collect Google Maps place URLs.
 *
 * Refactor dari index.js. SCRAPING LOGIC TIDAK DIUBAH:
 * - selector 'div[role="feed"]'
 * - mekanisme scroll (interval 1200ms, cek "sameHeightCount")
 * - selector link 'a[href*="/maps/place/"]'
 * - deteksi teks "You've reached the end" / "Anda telah mencapai akhir"
 *
 * Yang berubah dari index.js:
 * - Tidak lagi baca file Part .xlsx sendiri / prompt CLI. Daftar wilayah
 *   ({ provinsi, kabupatenKota }) dan keyword diberikan sebagai parameter,
 *   supaya bisa dipanggil dari task manapun (task bisa lintas Part karena
 *   provinsi terpotong antar file — lihat scraper/regions.js).
 * - Progress & log dikirim lewat callback (onProgress/onLog) alih-alih
 *   console.log, supaya backend bisa relay ke WebSocket + simpan ke DB.
 * - Mendukung cancel via AbortSignal.
 * - Auto-save realtime tetap ada, tapi lewat callback onSave (backend yang
 *   memutuskan mau ditulis ke JSON file / DB / keduanya).
 */

// Puppeteer versi terbaru (v22+) adalah ESM-only, sehingga require('puppeteer')
// gagal dengan ERR_REQUIRE_ESM. File ini tetap CommonJS (agar konsisten dengan
// sisa codebase), jadi Puppeteer di-load lewat dynamic import() di dalam
// fungsi async di bawah — ini didukung penuh dari modul CJS sejak Node 12+.
async function loadPuppeteer() {
  const mod = await import('puppeteer');
  return mod.default || mod; // Fallback jika default undefined
}

/**
 * @param {Object} opts
 * @param {string} opts.keyword - kategori pencarian, mis. "bengkel mobil"
 * @param {{provinsi:string, kabupatenKota:string}[]} opts.regions - daftar wilayah target
 * @param {Map<string,string>} [opts.existingUrls] - URL->provinsi yang sudah pernah didapat (untuk resume)
 * @param {AbortSignal} [opts.signal] - untuk cancel task
 * @param {(evt:Object)=>void} [opts.onProgress] - dipanggil tiap wilayah selesai
 * @param {(msg:string, level?:string)=>void} [opts.onLog]
 * @param {(urls:Map<string,string>)=>void} [opts.onSave] - dipanggil tiap wilayah selesai (auto-save realtime)
 * @param {boolean} [opts.headless] - default true untuk mode server; index.js asli pakai false (visible) untuk mode CLI interaktif
 * @returns {Promise<Map<string,string>>} peta URL -> provinsi asal
 */
async function collectUrls({
  keyword,
  regions,
  existingUrls,
  signal,
  onProgress = () => {},
  onLog = () => {},
  onSave = () => {},
  headless = true,
}) {
  // Map, bukan Set: setiap URL perlu diingat provinsi asalnya, supaya di
  // Fase 2 (extractor) data hasil scraping bisa diberi kolom Province.
  // Sebelumnya ini Set<string> polos sehingga info provinsi hilang begitu
  // URL dikumpulkan — itu sebabnya kolom Province di tabel hasil kosong.
  const collectedUrls = existingUrls ? new Map(existingUrls) : new Map();

  onLog(`[FASE 1] Mulai collect URL untuk kategori "${keyword}" (${regions.length} wilayah)`);

const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();

  try {
    for (let i = 0; i < regions.length; i++) {
      if (signal?.aborted) {
        onLog('Task dibatalkan oleh user, menghentikan Fase 1.', 'warn');
        break;
      }

      const { provinsi, kabupatenKota } = regions[i];
      const searchKeyword = `${keyword} di ${kabupatenKota}`;
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchKeyword)}/`;

      onLog(`[${i + 1}/${regions.length}] Scanning: "${searchKeyword}"`);
      onProgress({
        type: 'province_started',
        province: provinsi,
        kabupatenKota,
        index: i + 1,
        total: regions.length,
      });

      try {
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 });

        const feedExists = await page
          .waitForSelector('div[role="feed"]', { timeout: 6000 })
          .catch(() => null);

        if (!feedExists) {
          onLog(` -> Skip (tidak ada list di ${kabupatenKota})`);
          continue;
        }

        // Scroll panel kiri — logic identik dengan index.js asli
        await page.evaluate(async () => {
          const scrollableSection = document.querySelector('div[role="feed"]');
          await new Promise((resolve) => {
            let lastHeight = 0;
            let sameHeightCount = 0;

            const timer = setInterval(() => {
              scrollableSection.scrollBy(0, 1000);
              const currentHeight = scrollableSection.scrollHeight;

              const isEnd =
                document.body.innerText.includes("You've reached the end") ||
                document.body.innerText.includes('Anda telah mencapai akhir');

              if (currentHeight === lastHeight) {
                sameHeightCount++;
              } else {
                sameHeightCount = 0;
                lastHeight = currentHeight;
              }

              if (sameHeightCount >= 3 || isEnd) {
                clearInterval(timer);
                resolve();
              }
            }, 1200);
          });
        });

        const newUrls = await page.evaluate(() => {
          const links = Array.from(
            document.querySelectorAll('div[role="feed"] a[href*="/maps/place/"]')
          );
          return links.map((a) => a.href);
        });

        let addedCount = 0;
        newUrls.forEach((url) => {
          if (!collectedUrls.has(url)) {
            collectedUrls.set(url, provinsi);
            addedCount++;
          }
        });

        onSave(collectedUrls);
        onLog(` -> +${addedCount} lokasi baru. [TOTAL: ${collectedUrls.size} URL]`);
        onProgress({
          type: 'province_completed',
          province: provinsi,
          kabupatenKota,
          added: addedCount,
          totalUrls: collectedUrls.size,
          index: i + 1,
          total: regions.length,
        });
      } catch (err) {
        onLog(` -> [WARN] Timeout di ${kabupatenKota}, lanjut... (${err.message})`, 'warn');
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  onLog(`[FASE 1 SELESAI] Total ${collectedUrls.size} URL terkumpul.`);
  return collectedUrls;
}

module.exports = { collectUrls };

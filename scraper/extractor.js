/**
 * extractor.js — Fase 2: Extract business detail & reviews per URL.
 */

async function loadPuppeteer() {
  const mod = await import("puppeteer");
  return mod.default || mod;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Scrape email dari homepage website bisnis (best-effort, tidak memblokir jika gagal)
async function scrapeEmailFromWebsite(browser, websiteUrl) {
  let page;
  try {
    page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["image", "media", "font", "stylesheet"].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(websiteUrl, { waitUntil: "domcontentloaded", timeout: 8000 });

    const email = await page.evaluate((regex) => {
      const bodyText = document.body?.innerText || "";
      const mailtoEl = document.querySelector('a[href^="mailto:"]');
      if (mailtoEl) {
        return mailtoEl.getAttribute("href").replace("mailto:", "").split("?")[0].trim();
      }
      const match = bodyText.match(new RegExp(regex));
      return match ? match[0] : null;
    }, EMAIL_REGEX.source);

    return email || null;
  } catch {
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

async function scrapeSingleUrl(browser, url, includeReviews = false) {
  const page = await browser.newPage();

  await page.setViewport({ width: 1366, height: 850 });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  );

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (["image", "media", "font"].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForSelector("h1", { timeout: 4000 }).catch(() => null);

    // 1. Ekstrak data info utama & rating
    const baseData = await page.evaluate((currentUrl) => {
      const h1El = document.querySelector("h1.DUwif, h1");
      const name = h1El ? h1El.innerText.trim() : "";

      let fullAddress = "";
      let phone = "";
      let email = "";

      const addressBtn = document.querySelector(
        'button[data-item-id*="address"]',
      );
      if (addressBtn)
        fullAddress = addressBtn.innerText.replace(/[\n\r]+/g, " ").trim();

      const phoneBtn = document.querySelector('button[data-item-id*="phone"]');
      if (phoneBtn) phone = phoneBtn.innerText.replace(/[\n\r]+/g, " ").trim();

      if (!fullAddress || !phone) {
        const allButtons = Array.from(
          document.querySelectorAll("button[aria-label]"),
        );
        allButtons.forEach((btn) => {
          const label = btn.getAttribute("aria-label") || "";
          if (
            !fullAddress &&
            (label.startsWith("Alamat:") || label.startsWith("Address:"))
          ) {
            fullAddress = label.replace(/^Alamat:\s*|^Address:\s*/, "").trim();
          }
          if (
            !phone &&
            (label.startsWith("Telepon:") || label.startsWith("Phone:"))
          ) {
            phone = label.replace(/^Telepon:\s*|^Phone:\s*/, "").trim();
          }
        });
      }

      const mailtoLink = document.querySelector('a[href^="mailto:"]');
      if (mailtoLink) {
        email = mailtoLink
          .getAttribute("href")
          .replace("mailto:", "")
          .split("?")[0]
          .trim();
      }
      if (!email) {
        const emailBtn = document.querySelector(
          'button[data-item-id*="email"]',
        );
        if (emailBtn)
          email = emailBtn.innerText.replace(/[\n\r]+/g, " ").trim();
      }

      // Ambil URL website bisnis dari panel GMaps
      let website = "";
      const websiteBtn = document.querySelector('a[data-item-id*="authority"], a[aria-label*="Website"], a[aria-label*="website"], a[data-tooltip*="website"]');
      if (websiteBtn) {
        website = websiteBtn.href || websiteBtn.getAttribute("href") || "";
      }
      if (!website) {
        // Fallback: cari link eksternal yang bukan maps/google di panel utama
        const allLinks = Array.from(document.querySelectorAll('div[role="main"] a[href^="http"]'));
        const externalLink = allLinks.find((a) => {
          const h = a.href || "";
          return !h.includes("google.com") && !h.includes("maps.app") && !h.includes("goo.gl");
        });
        if (externalLink) website = externalLink.href;
      }

      const catBtn = document.querySelector('button[jsaction*="category"]');
      const category = catBtn ? catBtn.innerText.trim() : "";

      let latitude = "";
      let longitude = "";
      const coordMatch =
        currentUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
        currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coordMatch) {
        latitude = coordMatch[1];
        longitude = coordMatch[2];
      }

      // Deteksi Rating & Jumlah Ulasan dengan selector yang lebih luas
      let rating = "-";
      let totalReviews = "-";

      const ratingEl = document.querySelector(
        'div.F7nice span[aria-hidden="true"], span.ceNzKf',
      );
      if (ratingEl) {
        rating = ratingEl.innerText.trim().replace(",", ".");
      }

      // Cari jumlah ulasan dari span aria-label atau teks ulasan
      const reviewCandidates = [
        document.querySelector("div.F7nice button"),
        document.querySelector("div.F7nice span:last-child"),
        document.querySelector(
          'button[aria-label*="ulasan"], button[aria-label*="review"], button[aria-label*="reviews"]',
        ),
      ];

      for (const el of reviewCandidates) {
        if (!el) continue;
        const txt = el.getAttribute("aria-label") || el.innerText || "";
        const m =
          txt.replace(/\./g, "").match(/(\d+)\s*(?:ulasan|review|reviews)/i) ||
          txt.replace(/\./g, "").match(/\((\d+)\)/);
        if (m) {
          totalReviews = m[1];
          break;
        }
      }

      return {
        name,
        fullAddress,
        email,
        category,
        phones: phone,
        latitude,
        longitude,
        rating,
        totalReviews,
        website,
        _rawPanelText:
          document.querySelector('div[role="main"]')?.innerText || "",
      };
    }, url);

    if (!baseData.name) {
      await page.close().catch(() => {});
      return null;
    }

    if (!baseData.email && baseData._rawPanelText) {
      const match = baseData._rawPanelText.match(EMAIL_REGEX);
      if (match) baseData.email = match[0];
    }
    delete baseData._rawPanelText;
    baseData.googleMapsUrl = url;

    // Coba ambil email dari website bisnis jika email masih kosong dan website ada
    if (!baseData.email && baseData.website) {
      const emailFromSite = await scrapeEmailFromWebsite(browser, baseData.website);
      if (emailFromSite) baseData.email = emailFromSite;
    }

    // 2. Ekstraksi Detail Reviews
    let reviewsList = [];
    // Jalankan jika opsi aktif dan lokasi memiliki indikasi rating atau review
    const hasAnyReview =
      (baseData.totalReviews !== "-" && Number(baseData.totalReviews) > 0) ||
      (baseData.rating !== "-" && Number(baseData.rating) > 0);

    if (includeReviews && hasAnyReview) {
      try {
        // Klik tombol tab/ulasan menggunakan Puppeteer page.evaluate
        const clicked = await page.evaluate(() => {
          const tabBtn =
            document.querySelector('button[role="tab"][data-tab-index="1"]') ||
            Array.from(
              document.querySelectorAll('button[role="tab"], button'),
            ).find((b) =>
              /ulasan|reviews/i.test(
                b.getAttribute("aria-label") || b.innerText || "",
              ),
            ) ||
            document.querySelector("div.F7nice button");

          if (tabBtn) {
            tabBtn.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          await new Promise((r) => setTimeout(r, 1500));
          await page
            .waitForSelector("div.jftiEf, div[data-review-id]", {
              timeout: 4000,
            })
            .catch(() => null);

          // Scroll di kontainer review agar elemen DOM dirender
          await page.evaluate(() => {
            const scrollContainers = Array.from(
              document.querySelectorAll(
                'div.m6QErb.DxyBCb, div.m6QErb, div[role="main"]',
              ),
            );
            scrollContainers.forEach((el) => {
              if (el.scrollHeight > el.clientHeight) el.scrollTop += 500;
            });
          });

          await new Promise((r) => setTimeout(r, 600));

          // Buka teks komentar yang panjang
          await page.evaluate(() => {
            document
              .querySelectorAll(
                'button.w8nwRe, button[aria-label*="ulasan lengkap"], button[aria-label*="full review"]',
              )
              .forEach((b) => b.click());
          });

          // Ambil array review item
          // Ambil daftar review dengan deduplikasi
          reviewsList = await page.evaluate(() => {
            const list = [];
            const seenKeys = new Set();

            // Gunakan selector spesifik ke container kartu ulasan utama
            const cards = Array.from(
              document.querySelectorAll("div[data-review-id]"),
            ).slice(0, 20);

            cards.forEach((card) => {
              const reviewId = card.getAttribute("data-review-id");

              const authorEl = card.querySelector(
                'div.d4r55, .WNx5fc, button[aria-label*="Foto profil"]',
              );
              const authorName = authorEl
                ? authorEl.innerText.trim()
                : "Pengguna Google";

              const starEl = card.querySelector(
                'span.kvMYJc, span[aria-label*="bintang"], span[aria-label*="star"], span[aria-label*="stars"]',
              );
              let ratingVal = null;
              if (starEl) {
                const match = (starEl.getAttribute("aria-label") || "").match(
                  /(\d+)/,
                );
                if (match) ratingVal = parseInt(match[1], 10);
              }

              const textEl = card.querySelector("span.wiI7pd, .MyEned");
              const reviewText = textEl ? textEl.innerText.trim() : "";

              const dateEl = card.querySelector("span.rsqaWe");
              const publishedAt = dateEl ? dateEl.innerText.trim() : "";

              // Kunci unik: pakai data-review-id jika ada, fallback ke kombinasi teks
              const uniqueKey =
                reviewId ||
                `${authorName}|${publishedAt}|${reviewText.slice(0, 30)}`;

              if (!seenKeys.has(uniqueKey) && (authorName || reviewText)) {
                seenKeys.add(uniqueKey);
                list.push({
                  authorName,
                  rating: ratingVal,
                  reviewText,
                  publishedAt,
                });
              }
            });
            return list;
          });
        }
      } catch (e) {
        // Abaikan jika tab ulasan gagal dibuka
      }
    }

    baseData.reviews = reviewsList;
    if (baseData.totalReviews === "-" && reviewsList.length > 0) {
      baseData.totalReviews = reviewsList.length;
    }

    await page.close().catch(() => {});
    return baseData;
  } catch (err) {
    await page.close().catch(() => {});
    return null;
  }
}
async function scrapeWithRetry(
  browser,
  url,
  index,
  total,
  { maxRetries, onLog, includeReviews },
  retryCount = 0,
) {
  const timeoutPromise = new Promise((resolve) =>
    setTimeout(() => resolve("TIMEOUT"), 25000),
  );
  const result = await Promise.race([
    scrapeSingleUrl(browser, url, includeReviews),
    timeoutPromise,
  ]);

  if (result && result !== "TIMEOUT") {
    const reviewCount = result.reviews ? result.reviews.length : 0;
    const reviewInfo = includeReviews
      ? ` | ⭐ ${result.rating} (${result.totalReviews} ulasan, ${reviewCount} didapat)`
      : "";
    onLog(
      `[${index + 1}/${total}] [OK] ${result.name} | ${result.phones || "-"}${reviewInfo}`,
    );
    return result;
  }

  if (retryCount < maxRetries) {
    onLog(
      ` -> [RETRY ${retryCount + 1}] Stalled/Error pada URL [${index + 1}], mengulang...`,
      "warn",
    );
    return scrapeWithRetry(
      browser,
      url,
      index,
      total,
      { maxRetries, onLog, includeReviews },
      retryCount + 1,
    );
  }

  onLog(
    `[${index + 1}/${total}] [SKIP] Gagal setelah ${maxRetries}x coba.`,
    "error",
  );
  return null;
}

async function extractDetails({
  urls,
  urlProvinceMap,
  processedUrls,
  config = {},
  signal,
  onProgress = () => {},
  onLog = () => {},
  onItem = () => {},
  headless = true,
}) {
  const provinceMap = urlProvinceMap || new Map();
  const {
    concurrency = 2,
    maxRetries = 2,
    restartBrowserEvery = 200,
    INCLUDE_REVIEWS = false,
  } = config;

  const alreadyDone = processedUrls || new Set();
  const urlsToProcess = urls.filter((u) => !alreadyDone.has(u));

  onLog(
    `[FASE 2] Total URL: ${urls.length} | Sudah selesai (resume): ${alreadyDone.size} | Sisa: ${urlsToProcess.length}`,
  );

  if (urlsToProcess.length === 0) {
    onLog("[FASE 2 SELESAI] Semua URL sudah pernah berhasil diekstrak.");
    return { successful: 0, failed: 0 };
  }

  const launchBrowser = async () => {
    const puppeteer = await loadPuppeteer();
    return puppeteer.launch({
      headless: headless ? "new" : false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
      ],
    });
  };

  let browser = await launchBrowser();
  let processedInCurrentBrowser = 0;
  let successCount = 0;
  let failCount = 0;

  try {
    for (let i = 0; i < urlsToProcess.length; i += concurrency) {
      if (signal?.aborted) {
        onLog("Task dibatalkan oleh user, menghentikan Fase 2.", "warn");
        break;
      }

      if (processedInCurrentBrowser >= restartBrowserEvery) {
        onLog("[AUTO-FLUSH RAM] Restart browser...");
        await browser.close().catch(() => {});
        browser = await launchBrowser();
        processedInCurrentBrowser = 0;
      }

      const chunk = urlsToProcess.slice(i, i + concurrency);
      const promises = chunk.map((url, chunkIdx) => {
        const globalIndex = alreadyDone.size + i + chunkIdx;
        return scrapeWithRetry(browser, url, globalIndex, urls.length, {
          maxRetries,
          onLog,
          includeReviews: INCLUDE_REVIEWS,
        });
      });

      const batchResults = await Promise.all(promises);

      batchResults.forEach((item, chunkIdx) => {
        const url = chunk[chunkIdx];
        if (item) {
          item.province = provinceMap.get(url) || null;
          successCount++;
          onItem(item);
          onProgress({ type: "item_success", url, item });
        } else {
          failCount++;
          onProgress({ type: "item_failed", url });
        }
      });

      processedInCurrentBrowser += chunk.length;
      onProgress({
        type: "progress_updated",
        processed: alreadyDone.size + i + chunk.length,
        total: urls.length,
        successful: successCount + alreadyDone.size,
        failed: failCount,
      });
    }
  } finally {
    await browser.close().catch(() => {});
  }

  onLog(`[FASE 2 SELESAI] Berhasil: ${successCount} | Gagal: ${failCount}`);
  return { successful: successCount, failed: failCount };
}

module.exports = { extractDetails, EMAIL_REGEX };

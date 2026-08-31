const puppeteer = require('puppeteer');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { 
    initUrls, 
    getPendingUrls, 
    getAllCrawledData, 
    updatePlaceCrawled, 
    updatePlaceFailed 
} = require('./db');

const CONCURRENCY_LIMIT = 3; 
const MAX_RETRIES = 2;
const RESTART_BROWSER_EVERY = 150;

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, answer => {
        rl.close();
        resolve(answer.trim());
    }));
}

async function saveToExcel(dataList, filePath, includeReviews) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    const columns = [
        { header: 'Name', key: 'name', width: 32 },
        { header: 'Fulladdress', key: 'fullAddress', width: 45 },
        { header: 'Email', key: 'email', width: 20 },
        { header: 'Categories', key: 'category', width: 25 },
        { header: 'Phones', key: 'phones', width: 20 },
        { header: 'Latitude', key: 'latitude', width: 15 },
        { header: 'Longitude', key: 'longitude', width: 15 }
    ];

    if (includeReviews) {
        columns.push(
            { header: 'Rating', key: 'rating', width: 10 },
            { header: 'Total Reviews', key: 'totalReviews', width: 15 }
        );
    }

    worksheet.columns = columns;

    dataList.forEach(item => worksheet.addRow(item));

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '1F4E78' }
    };

    if (includeReviews) {
        worksheet.getColumn('rating').alignment = { horizontal: 'center' };
        worksheet.getColumn('totalReviews').alignment = { horizontal: 'center' };
    }

    await workbook.xlsx.writeFile(filePath);
}

async function scrapeSingleUrl(browser, url, includeReviews) {
    const page = await browser.newPage();
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'media', 'font'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
        await page.waitForSelector('h1', { timeout: 4000 }).catch(() => null);

        const data = await page.evaluate((currentUrl, needReviews) => {
            const h1El = document.querySelector('h1.DUwDvf, h1');
            const name = h1El ? h1El.innerText.trim() : '';

            let fullAddress = '';
            let phone = '';

            const addressBtn = document.querySelector('button[data-item-id*="address"]');
            if (addressBtn) {
                fullAddress = addressBtn.innerText.replace(/[\n\r]+/g, ' ').replace(/^/, '').trim();
            }

            const phoneBtn = document.querySelector('button[data-item-id*="phone"]');
            if (phoneBtn) {
                phone = phoneBtn.innerText.replace(/[\n\r]+/g, ' ').replace(/^/, '').trim();
            }

            if (!fullAddress || !phone) {
                const allButtons = Array.from(document.querySelectorAll('button[aria-label]'));
                allButtons.forEach(btn => {
                    const label = btn.getAttribute('aria-label') || '';
                    if (!fullAddress && (label.startsWith('Alamat:') || label.startsWith('Address:'))) {
                        fullAddress = label.replace(/^Alamat:\s*|^Address:\s*/, '').trim();
                    }
                    if (!phone && (label.startsWith('Telepon:') || label.startsWith('Phone:'))) {
                        phone = label.replace(/^Telepon:\s*|^Phone:\s*/, '').trim();
                    }
                });
            }

            const catBtn = document.querySelector('button[jsaction*="category"]');
            const category = catBtn ? catBtn.innerText.trim() : '';

            // Koordinat Geospasial
            let latitude = '';
            let longitude = '';
            const coordMatch = currentUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (coordMatch) {
                latitude = coordMatch[1];
                longitude = coordMatch[2];
            }

            // Ekstraksi Rating & Reviews (Hanya jika opsi dipilih)
            let rating = '-';
            let totalReviews = '-';

            if (needReviews) {
                const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]');
                if (ratingEl) rating = ratingEl.innerText.trim().replace(',', '.');

                const reviewBtn = document.querySelector('div.F7nice button span, div.F7nice span:last-child');
                if (reviewBtn) {
                    const rMatch = reviewBtn.innerText.replace(/\./g, '').match(/([\d]+)/);
                    if (rMatch) totalReviews = rMatch[1];
                }
            }

            return {
                name,
                fullAddress,
                email: '',
                category,
                phones: phone,
                latitude,
                longitude,
                rating,
                totalReviews
            };
        }, url, includeReviews);

        await page.close().catch(() => {});
        return data.name ? data : null;

    } catch (err) {
        await page.close().catch(() => {});
        return null;
    }
}

async function scrapeWithRetry(browser, url, index, total, includeReviews, retryCount = 0) {
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), 14000));
    const result = await Promise.race([scrapeSingleUrl(browser, url, includeReviews), timeoutPromise]);

    if (result && result !== 'TIMEOUT') {
        const logReview = includeReviews ? ` | ⭐ ${result.rating} (${result.totalReviews} reviews)` : '';
        console.log(`[${index + 1}/${total}] [OK] ${result.name} | 📞 ${result.phones || '-'}${logReview}`);
        updatePlaceCrawled(url, result);
        return result;
    }

    if (retryCount < MAX_RETRIES) {
        console.log(` -> [RETRY ${retryCount + 1}] Ulang URL [${index + 1}]...`);
        return scrapeWithRetry(browser, url, index, total, includeReviews, retryCount + 1);
    }

    console.log(`[${index + 1}/${total}] [SKIP] Gagal setelah ${MAX_RETRIES}x coba.`);
    updatePlaceFailed(url);
    return null;
}

(async () => {
    console.log(`\n==================================================`);
    console.log(` ⚡ GOOGLE MAPS DETAIL EXTRACTOR (FASE 2)`);
    console.log(`==================================================\n`);

    let categoryKeyword = await askQuestion('👉 Masukkan Kategori (misal: tempat spa / bengkel): ');
    if (!categoryKeyword) categoryKeyword = 'tempat gym';

    let partNum = await askQuestion('👉 Pilih Nomor Part Wilayah (1 / 2 / 3): ');
    if (!['1', '2', '3'].includes(partNum)) partNum = '1';

    let reviewChoice = await askQuestion('👉 Ambil data Rating & Reviews juga? (y/n) [Default: n]: ');
    const includeReviews = reviewChoice.toLowerCase() === 'y';

    const categorySlug = categoryKeyword.toLowerCase().trim().replace(/\s+/g, '_');
    const partInt = parseInt(partNum, 10);
    const JSON_FILE = path.join(__dirname, `urls_${categorySlug}_part${partNum}.json`);
    const OUTPUT_EXCEL = path.join(__dirname, `Hasil_${categorySlug}_Part_${partNum}.xlsx`);

    if (!fs.existsSync(JSON_FILE)) {
        console.error(`\n[ERROR] File ${JSON_FILE} tidak ditemukan! Pastikan Fase 1 sudah dijalankan.`);
        process.exit(1);
    }

    const allUrls = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
    initUrls(allUrls, categorySlug, partInt);

    const urlsToProcess = getPendingUrls(categorySlug, partInt);
    const completedData = getAllCrawledData(categorySlug, partInt);

    console.log(`\n--------------------------------------------------`);
    console.log(`Kategori       : "${categoryKeyword}"`);
    console.log(`Part           : Part ${partNum}`);
    console.log(`Mode Ekstraksi : ${includeReviews ? '🌟 Lengkap (+ Rating & Reviews)' : '⚡ Cepat (Data Pokok Saja)'}`);
    console.log(`Total Target   : ${allUrls.length} URL`);
    console.log(`Sudah Selesai  : ${completedData.length} URL`);
    console.log(`Sisa Antrean   : ${urlsToProcess.length} URL`);
    console.log(`--------------------------------------------------\n`);

    if (urlsToProcess.length === 0) {
        console.log(`[SELESAI] Semua data part ini sudah berstatus CRAWLED.`);
        await saveToExcel(completedData, OUTPUT_EXCEL, includeReviews);
        process.exit(0);
    }

    const launchBrowser = async () => {
        return await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });
    };

    let browser = await launchBrowser();
    let processedInCurrentBrowser = 0;

    for (let i = 0; i < urlsToProcess.length; i += CONCURRENCY_LIMIT) {
        if (processedInCurrentBrowser >= RESTART_BROWSER_EVERY) {
            console.log(`\n🔄 [FLUSH RAM] Mereset browser session...`);
            await browser.close().catch(() => {});
            browser = await launchBrowser();
            processedInCurrentBrowser = 0;
        }

        const chunk = urlsToProcess.slice(i, i + CONCURRENCY_LIMIT);
        const promises = chunk.map((url, chunkIdx) => {
            const globalIndex = completedData.length + i + chunkIdx;
            return scrapeWithRetry(browser, url, globalIndex, allUrls.length, includeReviews);
        });

        await Promise.all(promises);
        processedInCurrentBrowser += chunk.length;

        // Auto Save ke Excel berkala
        if ((i + CONCURRENCY_LIMIT) % 30 === 0 || i + CONCURRENCY_LIMIT >= urlsToProcess.length) {
            const currentResults = getAllCrawledData(categorySlug, partInt);
            await saveToExcel(currentResults, OUTPUT_EXCEL, includeReviews);
            console.log(` -> [CHECKPOINT] ${currentResults.length}/${allUrls.length} tersimpan di DB & Excel.`);
        }
    }

    const finalResults = getAllCrawledData(categorySlug, partInt);
    await saveToExcel(finalResults, OUTPUT_EXCEL, includeReviews);
    await browser.close().catch(() => {});

    console.log(`\n==================================================`);
    console.log(`[SUKSES] Total ${finalResults.length} data tersimpan di ${OUTPUT_EXCEL}`);
    console.log(`==================================================\n`);
})();
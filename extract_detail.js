const puppeteer = require('puppeteer');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// BISA DISESUAIKAN (Rekomendasi: 3 - 5 tab biar stabil)
const CONCURRENCY_LIMIT = 2; 
const MAX_RETRIES = 2;
const RESTART_BROWSER_EVERY = 200; // Reset browser tiap 200 URL biar RAM gak penuh

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

async function saveToExcel(dataList, filePath) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    worksheet.columns = [
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Fulladdress', key: 'fullAddress', width: 45 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Categories', key: 'category', width: 25 },
        { header: 'Phones', key: 'phones', width: 20 },
        { header: 'Latitude', key: 'latitude', width: 15 },
        { header: 'Longitude', key: 'longitude', width: 15 }
    ];

    dataList.forEach(item => worksheet.addRow(item));

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '1F4E78' }
    };

    await workbook.xlsx.writeFile(filePath);
}

// LOGIKA SINGLE SCRAPE UNTUK 1 URL
async function scrapeSingleUrl(browser, url) {
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
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForSelector('h1', { timeout: 3000 }).catch(() => null);

        const data = await page.evaluate((currentUrl) => {
            const h1El = document.querySelector('h1.DUwif, h1');
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

            let latitude = '';
            let longitude = '';
            const coordMatch = currentUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (coordMatch) {
                latitude = coordMatch[1];
                longitude = coordMatch[2];
            }

            return {
                name,
                fullAddress,
                email: '',
                category,
                phones: phone,
                latitude,
                longitude
            };
        }, url);

        await page.close().catch(() => {});
        return data.name ? data : null;

    } catch (err) {
        await page.close().catch(() => {});
        return null;
    }
}

// SCRAPE DENGAN PROTEKSI HARD-TIMEOUT 12 DETIK & AUTO-RETRY
async function scrapeWithRetry(browser, url, index, total, retryCount = 0) {
    // Race Promise: Jika 12 detik gak kelar, paksa return null
    const timeoutPromise = new Promise(resolve => 
        setTimeout(() => resolve('TIMEOUT'), 12000)
    );

    const result = await Promise.race([
        scrapeSingleUrl(browser, url),
        timeoutPromise
    ]);

    if (result && result !== 'TIMEOUT') {
        console.log(`[${index + 1}/${total}] [OK] ${result.name} | ${result.phones || '-'}`);
        return result;
    }

    if (retryCount < MAX_RETRIES) {
        console.log(` -> [RETRY ${retryCount + 1}] Stalled / Error pada URL [${index + 1}], mengulang...`);
        return scrapeWithRetry(browser, url, index, total, retryCount + 1);
    }

    console.log(`[${index + 1}/${total}] [SKIP] Gagal setelah ${MAX_RETRIES}x coba.`);
    return null;
}

(async () => {
    console.log(`\n==================================================`);
    console.log(` ⚡ EXTRACTOR WITH AUTO-RETRY & AUTO-FLUSH RAM`);
    console.log(`==================================================\n`);

    let categoryKeyword = await askQuestion('👉 Masukkan Kategori (misal: tempat spa / bengkel): ');
    if (!categoryKeyword) categoryKeyword = 'tempat gym';

    let partNum = await askQuestion('👉 Pilih Nomor Part Wilayah (1 / 2 / 3): ');
    if (!['1', '2', '3'].includes(partNum)) partNum = '1';

    const categorySlug = categoryKeyword.toLowerCase().trim().replace(/\s+/g, '_');
    const JSON_FILE = path.join(__dirname, `urls_${categorySlug}_part${partNum}.json`);
    const OUTPUT_EXCEL = path.join(__dirname, `Hasil_${categorySlug}_Part_${partNum}.xlsx`);

    if (!fs.existsSync(JSON_FILE)) {
        console.error(`\n[ERROR] File ${JSON_FILE} tidak ditemukan! Pastikan Fase 1 sudah selesai.`);
        process.exit(1);
    }

    const allUrls = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
    const results = [];

    // RESUME DATA DARI EXCEL LAMA
    if (fs.existsSync(OUTPUT_EXCEL)) {
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(OUTPUT_EXCEL);
            const worksheet = workbook.getWorksheet('Sheet1');
            
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) {
                    results.push({
                        name: row.getCell(1).value || '',
                        fullAddress: row.getCell(2).value || '',
                        email: row.getCell(3).value || '',
                        category: row.getCell(4).value || '',
                        phones: row.getCell(5).value || '',
                        latitude: row.getCell(6).value || '',
                        longitude: row.getCell(7).value || ''
                    });
                }
            });
            console.log(`[RESUME] Ditemukan file Excel lama dengan ${results.length} data tersimpan.`);
        } catch (e) {
            console.log(`[RESUME] Mulai ekstraksi dari awal.`);
        }
    }

    const urlsToProcess = allUrls.slice(results.length);

    console.log(`\n--------------------------------------------------`);
    console.log(`Kategori      : "${categoryKeyword}"`);
    console.log(`Part          : Part ${partNum}`);
    console.log(`Total URLs    : ${allUrls.length}`);
    console.log(`Sudah Selesai : ${results.length} URL`);
    console.log(`Sisa Process  : ${urlsToProcess.length} URL`);
    console.log(`Speed Mode    : ${CONCURRENCY_LIMIT} Tab Sekaligus`);
    console.log(`--------------------------------------------------\n`);

    if (urlsToProcess.length === 0) {
        console.log(`[SELESAI] Semua URL untuk Part ini sudah berhasil diekstrak!`);
        process.exit(0);
    }

    // FUNGSI INIT BROWSER
    const launchBrowser = async () => {
        return await puppeteer.launch({ 
            headless: 'new',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });
    };

    let browser = await launchBrowser();
    let processedInCurrentBrowser = 0;

    for (let i = 0; i < urlsToProcess.length; i += CONCURRENCY_LIMIT) {
        // FLUSH RAM: Restart browser berkala
        if (processedInCurrentBrowser >= RESTART_BROWSER_EVERY) {
            console.log(`\n🔄 [AUTO-FLUSH RAM] Mengubah dan mereset memori browser...`);
            await browser.close().catch(() => {});
            browser = await launchBrowser();
            processedInCurrentBrowser = 0;
        }

        const chunk = urlsToProcess.slice(i, i + CONCURRENCY_LIMIT);
        
        const promises = chunk.map((url, chunkIdx) => {
            const globalIndex = results.length + chunkIdx;
            return scrapeWithRetry(browser, url, globalIndex, allUrls.length);
        });

        const batchResults = await Promise.all(promises);
        
        batchResults.forEach(item => {
            if (item) results.push(item);
        });

        processedInCurrentBrowser += chunk.length;

        // Auto Save per 40 data
        if (results.length % 40 === 0 || i + CONCURRENCY_LIMIT >= urlsToProcess.length) {
            await saveToExcel(results, OUTPUT_EXCEL);
            console.log(` -> [AUTO-SAVE] Total ${results.length} data terkunci ke Excel.`);
        }
    }

    await saveToExcel(results, OUTPUT_EXCEL);
    console.log(`\n==================================================`);
    console.log(`[BERHASIL SELESAI FASE 2] Data tersimpan di: ${OUTPUT_EXCEL}`);
    console.log(`==================================================\n`);

    await browser.close().catch(() => {});
})();
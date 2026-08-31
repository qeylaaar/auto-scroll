const puppeteer = require('puppeteer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { initUrls } = require('./db');

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

function getDaftarWilayahFromPart(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const listWilayah = [];
    data.forEach(row => {
        const namaWilayah = row['Kabupaten/Kota'] || row['Kabupaten / Kota'] || row['Kabupaten'] || Object.values(row)[1];
        if (namaWilayah) {
            listWilayah.push(namaWilayah.toString().trim());
        }
    });
    return [...new Set(listWilayah)];
}

(async () => {
    console.log(`\n==================================================`);
    console.log(` 🗺️  GOOGLE MAPS CRAWLER INDONESIA (FASE 1)`);
    console.log(`==================================================\n`);

    let categoryKeyword = await askQuestion('👉 Masukkan Kata Kunci Kategori (misal: tempat spa / bengkel / tempat gym): ');
    if (!categoryKeyword) categoryKeyword = 'tempat gym';

    let partNum = await askQuestion('👉 Pilih Nomor Part Wilayah (1 / 2 / 3): ');
    if (!['1', '2', '3'].includes(partNum)) partNum = '1';

    const categorySlug = categoryKeyword.toLowerCase().trim().replace(/\s+/g, '_');
    const EXCEL_PART_FILE = path.join(__dirname, `Data_Kabupaten_Kota_Part_${partNum}.xlsx`);
    const OUTPUT_JSON_FILE = path.join(__dirname, `urls_${categorySlug}_part${partNum}.json`);

    if (!fs.existsSync(EXCEL_PART_FILE)) {
        console.error(`\n[ERROR] File ${EXCEL_PART_FILE} tidak ditemukan!`);
        process.exit(1);
    }

    function loadSavedUrls() {
        if (fs.existsSync(OUTPUT_JSON_FILE)) {
            try {
                return new Set(JSON.parse(fs.readFileSync(OUTPUT_JSON_FILE, 'utf8')));
            } catch (e) {
                return new Set();
            }
        }
        return new Set();
    }

    function saveUrlsToFile(urlSet) {
        const arr = Array.from(urlSet);
        fs.writeFileSync(OUTPUT_JSON_FILE, JSON.stringify(arr, null, 2));
        initUrls(arr, categorySlug, parseInt(partNum, 10)); // Sinkron ke SQLite
    }

    const listWilayah = getDaftarWilayahFromPart(EXCEL_PART_FILE);
    const collectedUrls = loadSavedUrls();
    console.log(`[INIT] Wilayah: ${listWilayah.length} | Data Tersimpan: ${collectedUrls.size} URL\n`);

    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();

    for (let i = 0; i < listWilayah.length; i++) {
        const wilayah = listWilayah[i];
        const keyword = `${categoryKeyword} di ${wilayah}`;
        const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(keyword)}/`;

        console.log(`[PART ${partNum}] [${i + 1}/${listWilayah.length}] Scanning: "${keyword}"`);

        try {
            await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 });
            
            const feedExists = await page.waitForSelector('div[role="feed"]', { timeout: 6000 }).catch(() => null);
            if (!feedExists) {
                console.log(` -> Skip (tidak ada list di ${wilayah})`);
                continue;
            }

            await page.evaluate(async () => {
                const scrollableSection = document.querySelector('div[role="feed"]');
                await new Promise((resolve) => {
                    let lastHeight = 0;
                    let sameHeightCount = 0;
                    
                    const timer = setInterval(() => {
                        scrollableSection.scrollBy(0, 1000);
                        const currentHeight = scrollableSection.scrollHeight;
                        const isEnd = document.body.innerText.includes("You've reached the end") || 
                                      document.body.innerText.includes("Anda telah mencapai akhir");

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
                const links = Array.from(document.querySelectorAll('div[role="feed"] a[href*="/maps/place/"]'));
                return links.map(a => a.href);
            });

            let addedCount = 0;
            newUrls.forEach(url => {
                if (!collectedUrls.has(url)) {
                    collectedUrls.add(url);
                    addedCount++;
                }
            });

            saveUrlsToFile(collectedUrls);
            console.log(` -> +${addedCount} lokasi baru. [TOTAL: ${collectedUrls.size} URL]`);

        } catch (err) {
            console.log(` -> [WARN] Timeout di ${wilayah}, lanjut...`);
        }
    }

    await browser.close();
    console.log(`\n[SELESAI] Data tersimpan di ${OUTPUT_JSON_FILE} & database SQLite.`);
})();
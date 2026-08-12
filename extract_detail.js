const puppeteer = require('puppeteer');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

(async () => {
    console.log(`\n==================================================`);
    console.log(` 📝  GOOGLE MAPS DETAIL EXTRACTOR (FASE 2)`);
    console.log(`==================================================\n`);

    let categoryKeyword = await askQuestion('👉 Masukkan Kategori yang mau di-extract (misal: tempat spa / bengkel): ');
    if (!categoryKeyword) categoryKeyword = 'tempat gym';

    let partNum = await askQuestion('👉 Pilih Nomor Part Wilayah (1 / 2 / 3): ');
    if (!['1', '2', '3'].includes(partNum)) partNum = '1';

    const categorySlug = categoryKeyword.toLowerCase().trim().replace(/\s+/g, '_');
    const JSON_FILE = path.join(__dirname, `urls_${categorySlug}_part${partNum}.json`);
    const OUTPUT_EXCEL = path.join(__dirname, `Hasil_${categorySlug}_Part_${partNum}.xlsx`);

    if (!fs.existsSync(JSON_FILE)) {
        console.error(`\n[ERROR] File ${JSON_FILE} tidak ditemukan! Pastikan Fase 1 sudah selesai untuk kategori dan Part ini.`);
        process.exit(1);
    }

    const urls = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));

    console.log(`\n--------------------------------------------------`);
    console.log(`Kategori    : "${categoryKeyword}"`);
    console.log(`Part        : Part ${partNum}`);
    console.log(`Total URLs  : ${urls.length}`);
    console.log(`File Excel  : ${OUTPUT_EXCEL}`);
    console.log(`--------------------------------------------------\n`);

    const browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // HANYA BLOKIR GAMBAR & MEDIA
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'media'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    const results = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
            await page.waitForSelector('h1', { timeout: 6000 }).catch(() => null);

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

            if (data.name) {
                results.push(data);
                console.log(`[${i + 1}/${urls.length}] [OK] ${data.name} | ${data.fullAddress.substring(0, 30)}... | Phone: ${data.phones || '-'}`);
            } else {
                console.log(`[${i + 1}/${urls.length}] [WARN] Skip: Nama/Alamat tidak ter-render`);
            }

            if (results.length % 20 === 0 || i === urls.length - 1) {
                await saveToExcel(results, OUTPUT_EXCEL);
            }

        } catch (err) {
            console.log(`[${i + 1}/${urls.length}] [SKIP] Timeout / Error URL.`);
        }
    }

    await saveToExcel(results, OUTPUT_EXCEL);
    console.log(`\n==================================================`);
    console.log(`[BERHASIL SELESAI FASE 2] Data tersimpan di: ${OUTPUT_EXCEL}`);
    console.log(`==================================================\n`);

    await browser.close();
})();
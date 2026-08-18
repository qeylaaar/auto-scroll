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

// DAFTAR PROVINSI PER PART
const PROVINSI_PART_1 = [
    "Bali", "Banten", "Bengkulu", "DI Yogyakarta", "DKI Jakarta", 
    "Gorontalo", "Jambi", "Jawa Barat", "Jawa Tengah", "Jawa Timur", 
    "Kalimantan Barat", "Kalimantan Selatan", "Kalimantan Tengah"
];

const PROVINSI_PART_2 = [
    "Kalimantan Timur", "Kalimantan Utara", "Kepulauan Bangka Belitung", 
    "Kepulauan Riau", "Lampung", "Luar Negeri", "Maluku", "Maluku Utara", 
    "Nanggroe Aceh Darussalam", "Nusa Tenggara Barat", "Nusa Tenggara Timur", 
    "Papua", "Papua Barat"
];

const PROVINSI_PART_3 = [
    "Papua Barat Daya", "Papua Pegunungan", "Papua Selatan", "Papua Tengah", 
    "Riau", "Sulawesi Barat", "Sulawesi Selatan", "Sulawesi Tengah", 
    "Sulawesi Tenggara", "Sulawesi Utara", "Sumatera Barat", "Sumatera Selatan", "Sumatera Utara"
];

async function saveToExcel(dataList, filePath) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Eksportir Kemenperin');

    worksheet.columns = [
        { header: 'No', key: 'no', width: 8 },
        { header: 'Nama Perusahaan', key: 'nama', width: 40 },
        { header: 'KBLI', key: 'kbli', width: 15 },
        { header: 'Telepon', key: 'telp', width: 25 },
        { header: 'Email', key: 'email', width: 35 },
        { header: 'Provinsi', key: 'provinsi', width: 25 }
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
    console.log(` 🏢 KEMENPERIN SCRAPER (DYNAMIC TRAVERSAL FULL)`);
    console.log(`==================================================\n`);

    let partNum = await askQuestion('👉 Pilih Part Wilayah Kemenperin (1 / 2 / 3): ');
    if (!['1', '2', '3'].includes(partNum)) partNum = '1';

    let targetProvinces = [];
    if (partNum === '1') targetProvinces = PROVINSI_PART_1;
    else if (partNum === '2') targetProvinces = PROVINSI_PART_2;
    else if (partNum === '3') targetProvinces = PROVINSI_PART_3;

    const outputFileName = `Hasil_Kemenperin_Part_${partNum}.xlsx`;
    const allResults = [];

    const browser = await puppeteer.launch({ 
        headless: 'new', 
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    for (let p = 0; p < targetProvinces.length; p++) {
        const provName = targetProvinces[p];
        console.log(`\n--------------------------------------------------`);
        console.log(`[PROVINSI ${p + 1}/${targetProvinces.length}] Memproses: ${provName}`);
        console.log(`--------------------------------------------------`);

        try {
            await page.goto('https://kemenperin.go.id/direktori-perusahaan', { waitUntil: 'networkidle2', timeout: 30000 });

            // 1. Pilih Provinsi dari Dropdown
            const optionValue = await page.evaluate((targetProv) => {
                const select = document.querySelector('select[name="prov"]');
                if (!select) return null;
                const options = Array.from(select.options);
                const match = options.find(opt => opt.text.trim().toLowerCase() === targetProv.toLowerCase());
                return match ? match.value : null;
            }, provName);

            if (!optionValue) {
                console.log(` -> [SKIP] Provinsi "${provName}" tidak ditemukan di dropdown.`);
                continue;
            }

            await page.select('select[name="prov"]', optionValue);

            // 2. Klik "Tampilkan"
            await Promise.all([
                page.click('input[type="submit"][value="Tampilkan"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => null)
            ]);

            let pageCounter = 1;
            let hasNextPage = true;

            const extractTableData = () => {
                const rows = Array.from(document.querySelectorAll('#newspaper-a tbody tr'));
                return rows.map(row => {
                    const cols = row.querySelectorAll('td');
                    if (cols.length < 3) return null;

                    const no = cols[0].innerText.trim();
                    const colText = cols[1].innerText;
                    
                    const nama = cols[1].querySelector('b') ? cols[1].querySelector('b').innerText.trim() : colText.split('\n')[0].trim();

                    const telpMatch = colText.match(/Telp\.\s*:\s*([^\n\r]+)/i) || colText.match(/Telp\.\s*([^\n\r]+)/i);
                    const emailMatch = colText.match(/Email\s*:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);

                    const telp = telpMatch ? telpMatch[1].trim() : '-';
                    const email = emailMatch ? emailMatch[1].trim() : '-';
                    const kbli = cols[2].innerText.trim();

                    return { no, nama, kbli, telp, email };
                }).filter(item => item && item.nama);
            };

            // 3. Loop Traversal Berantai Sampai Beneran Habis
            while (hasNextPage) {
                const currentPageData = await page.evaluate(extractTableData);

                if (currentPageData.length > 0) {
                    currentPageData.forEach(d => allResults.push({ ...d, provinsi: provName }));
                    console.log(` -> Scrape Halaman ${pageCounter}: +${currentPageData.length} data. (Total: ${allResults.length})`);
                } else {
                    console.log(` -> [KOSONG] Tidak ada data di Halaman ${pageCounter}.`);
                    break;
                }

                await saveToExcel(allResults, outputFileName);

                // CARI DAN KLIK KANDIDAT TOMBOL HALAMAN BERIKUTNYA
                const nextUrl = await page.evaluate((currPageNum) => {
                    const paginationLinks = Array.from(document.querySelectorAll('ul.pagination li a'));
                    if (paginationLinks.length === 0) return null;

                    const targetNextNum = currPageNum + 1;

                    // A. Cari tombol angka persis setelahnya (misal tombol "2", "3", "4", "22")
                    let nextEl = paginationLinks.find(a => a.innerText.trim() === targetNextNum.toString());

                    // B. Jika tidak ada angka persis, cari tombol chunk lanjutan (seperti "11..", "21..", "31..", "Next", ">")
                    if (!nextEl) {
                        nextEl = paginationLinks.find(a => {
                            const txt = a.innerText.trim();
                            return txt.endsWith('..') || txt.toLowerCase().includes('next') || txt === '>';
                        });
                    }

                    if (nextEl && nextEl.href && !nextEl.href.endsWith('#') && !nextEl.href.startsWith('javascript')) {
                        return nextEl.href;
                    }

                    return null;
                }, pageCounter);

                if (nextUrl) {
                    pageCounter++;
                    await page.goto(nextUrl, { waitUntil: 'networkidle2', timeout: 20000 });
                    await new Promise(r => setTimeout(r, 300));
                } else {
                    // Jika tidak ada lagi link halaman selanjutnya, tandai SELESAI
                    hasNextPage = false;
                }
            }

            console.log(` [SELESAI ${provName}] Total ${pageCounter} halaman diproses sempurna.`);

        } catch (err) {
            console.log(` -> [ERROR] Gagal memproses ${provName}: ${err.message}`);
        }
    }

    await saveToExcel(allResults, outputFileName);
    await browser.close();

    console.log(`\n==================================================`);
    console.log(`[SUKSES PART ${partNum}] Berhasil mengekstrak ${allResults.length} data!`);
    console.log(`File tersimpan sebagai: ${outputFileName}`);
    console.log(`==================================================\n`);
})();
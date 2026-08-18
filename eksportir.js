const axios = require('axios');
const cheerio = require('cheerio');
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

const BASE_URL = "https://kemenperin.go.id/direktori-eksportir";

async function saveToExcel(dataList, filePath) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Direktori Eksportir');

    worksheet.columns = [
        { header: 'Keyword', key: 'keyword', width: 15 },
        { header: 'Nama Perusahaan', key: 'nama', width: 35 },
        { header: 'Alamat', key: 'alamat', width: 45 },
        { header: 'Telepon', key: 'telp', width: 20 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Website', key: 'website', width: 30 },
        { header: 'Komoditi', key: 'komoditi', width: 35 },
        { header: 'Bidang Usaha', key: 'bidangUsaha', width: 35 }
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

// SCRAPE SINGLE PAGE + BACA LINK PAGINATION BERIKUTNYA
async function scrapePage(targetUrl) {
    try {
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const pageData = [];

        $('#newspaper-a tbody tr').each((i, el) => {
            const row = $(el);
            const cols = row.find('td');
            if (cols.length < 4) return;

            // Kolom 2: Detail Perusahaan (Parsing HTML via <br>)
            const colPerusahaanHtml = cols.eq(1).html() || '';
            const parts = colPerusahaanHtml
                .split(/<br\s*\/?>/i)
                .map(p => cheerio.load(p).text().trim())
                .filter(p => p.length > 0);

            let nama = '';
            let alamat = '-';
            let telp = '-';
            let email = '-';
            let website = '-';

            if (parts.length > 0) {
                nama = parts[0]; // Baris 1: Nama Perusahaan
            }

            if (parts.length > 1) {
                // Baris 2 biasanya Alamat
                if (!parts[1].toLowerCase().startsWith('telp') && 
                    !parts[1].toLowerCase().startsWith('e-mail') && 
                    !parts[1].toLowerCase().startsWith('email') && 
                    !parts[1].toLowerCase().startsWith('website')) {
                    alamat = parts[1];
                }
            }

            // Loop sisa baris untuk Telp, Email, Website, atau Alamat Tambahan
            for (let idx = 1; idx < parts.length; idx++) {
                const item = parts[idx];
                const itemLower = item.toLowerCase();

                if (itemLower.startsWith('telp')) {
                    telp = item.replace(/^telp\.?\s*:?\s*/i, '').trim() || '-';
                } else if (itemLower.startsWith('e-mail') || itemLower.startsWith('email')) {
                    email = item.replace(/^e-?mail\s*:?\s*/i, '').trim() || '-';
                } else if (itemLower.startsWith('website')) {
                    website = item.replace(/^website\s*:?\s*/i, '').trim() || '-';
                } else if (idx > 1 && alamat === '-') {
                    alamat = item;
                }
            }

            // Kolom 3 & 4: Komoditi & Bidang Usaha
            const komoditi = cols.eq(2).text().trim() || '-';
            const bidangUsaha = cols.eq(3).text().trim() || '-';

            if (nama) {
                pageData.push({ nama, alamat, telp, email, website, komoditi, bidangUsaha });
            }
        });

        // Cari link halaman berikutnya
        let nextUrl = null;
        const activeLi = $('ul.pagination li.active');
        if (activeLi.length > 0) {
            const nextLi = activeLi.next('li');
            if (nextLi.length > 0) {
                const href = nextLi.find('a').attr('href');
                if (href && href !== '#' && !href.startsWith('javascript')) {
                    nextUrl = href.startsWith('http') ? href : `https://kemenperin.go.id/${href}`;
                }
            }
        }

        return { pageData, nextUrl };

    } catch (err) {
        return { pageData: [], nextUrl: null };
    }
}

(async () => {
    console.log(`\n==================================================`);
    console.log(` 📦 KEMENPERIN EKSPORTIR CRAWLER (MULTI-TERMINAL)`);
    console.log(`==================================================\n`);

    const KEYWORD_FILE = path.join(__dirname, 'keywords_komoditi_final.json');
    if (!fs.existsSync(KEYWORD_FILE)) {
        console.error(`[ERROR] File ${KEYWORD_FILE} tidak ditemukan! Pastikan script Python pembersih sudah dijalankan.`);
        process.exit(1);
    }

    const allKeywords = JSON.parse(fs.readFileSync(KEYWORD_FILE, 'utf8'));

    const totalTerminalsInput = await askQuestion('👉 Masukkan Total Terminal yang Dijalankan (misal 3 atau 5): ');
    const totalTerminals = parseInt(totalTerminalsInput) || 3;

    const currentTerminalInput = await askQuestion(`👉 Masukkan Nomor Terminal Ini (1 - ${totalTerminals}): `);
    const currentTerminal = parseInt(currentTerminalInput) || 1;

    // CHUNKING KEYWORD
    const chunkSize = Math.ceil(allKeywords.length / totalTerminals);
    const startIndex = (currentTerminal - 1) * chunkSize;
    const endIndex = Math.min(startIndex + chunkSize, allKeywords.length);
    const myKeywords = allKeywords.slice(startIndex, endIndex);

    const outputFileName = `Hasil_Eksportir_Terminal_${currentTerminal}.xlsx`;
    const results = [];

    // AUTO-RESUME JIKA TERMINAL PERNAH STOP
    let processedKeywordCount = 0;
    if (fs.existsSync(outputFileName)) {
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(outputFileName);
            const worksheet = workbook.getWorksheet('Direktori Eksportir');
            
            const existingKeywords = new Set();
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) {
                    const kw = row.getCell(1).value;
                    if (kw) existingKeywords.add(kw);
                    results.push({
                        keyword: row.getCell(1).value || '',
                        nama: row.getCell(2).value || '',
                        alamat: row.getCell(3).value || '',
                        telp: row.getCell(4).value || '',
                        email: row.getCell(5).value || '',
                        website: row.getCell(6).value || '',
                        komoditi: row.getCell(7).value || '',
                        bidangUsaha: row.getCell(8).value || ''
                    });
                }
            });
            processedKeywordCount = existingKeywords.size;
            console.log(`[RESUME] Ditemukan ${results.length} data tersimpan dari ${processedKeywordCount} keywords.`);
        } catch (e) {}
    }

    console.log(`\n--------------------------------------------------`);
    console.log(`Terminal Nomor  : ${currentTerminal} / ${totalTerminals}`);
    console.log(`Alokasi Keyword : ${myKeywords.length} Keyword (${startIndex + 1} s/d ${endIndex})`);
    console.log(`Output File     : ${outputFileName}`);
    console.log(`--------------------------------------------------\n`);

    for (let k = 0; k < myKeywords.length; k++) {
        const kw = myKeywords[k];
        console.log(`\n[${k + 1}/${myKeywords.length}] 🔍 Searching Keyword: "${kw}"`);

        let currentUrl = `${BASE_URL}?what=${encodeURIComponent(kw)}&prov=0`;
        let pageNum = 1;
        let kwDataCount = 0;

        while (currentUrl) {
            console.log(` -> Scrape Halaman ${pageNum}...`);
            const { pageData, nextUrl } = await scrapePage(currentUrl);

            if (pageData.length > 0) {
                pageData.forEach(item => results.push({ keyword: kw, ...item }));
                kwDataCount += pageData.length;
                console.log(`    +${pageData.length} eksportir didapat. (Total Terminal ${currentTerminal}: ${results.length})`);
            } else {
                if (pageNum === 1) console.log(`    [KOSONG] Tidak ada eksportir untuk keyword "${kw}".`);
                break;
            }

            currentUrl = nextUrl;
            pageNum++;
            await new Promise(r => setTimeout(r, 250)); // Delay halus
        }

        // Save progress per keyword
        await saveToExcel(results, outputFileName);
    }

    await saveToExcel(results, outputFileName);
    console.log(`\n==================================================`);
    console.log(`[SUKSES TERMINAL ${currentTerminal}] Berhasil mengekstrak ${results.length} data eksportir!`);
    console.log(`==================================================\n`);
})();
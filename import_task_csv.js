const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { upsertDirectory } = require('./db');

const csvFilePath = path.join(__dirname, 'Task Crawling - Google Map.csv');

if (!fs.existsSync(csvFilePath)) {
    console.error(`[ERROR] File ${csvFilePath} tidak ditemukan!`);
    process.exit(1);
}

console.log('==================================================');
console.log(' 📥 IMPORT DIREKTORI MASTER (DATA TERUPDATE: AGU 2026)');
console.log('==================================================\n');

// Baca CSV menggunakan parser XLSX bawaan yang otomatis handle koma, kutip & baris kosong
const workbook = XLSX.readFile(csvFilePath, { raw: true });
const sheetName = workbook.SheetNames[0];
const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

let importedCount = 0;

// Cari baris header yang berisi "Nama Direktori"
let headerIndex = -1;
let colMap = {};

for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i].map(c => String(c || '').trim());
    if (row.includes('Nama Direktori') || row.includes('Kategori')) {
        headerIndex = i;
        row.forEach((colName, idx) => {
            if (colName) colMap[colName.toLowerCase()] = idx;
        });
        break;
    }
}

if (headerIndex === -1) {
    console.error('[ERROR] Format header CSV tidak dikenali!');
    process.exit(1);
}

// Proses baris data setelah header
for (let i = headerIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const no = row[colMap['no']];
    const kategori = String(row[colMap['kategori']] || '-').trim();
    const namaDirektori = String(row[colMap['nama direktori']] || '').trim();
    const dataTerupdate = String(row[colMap['data terupdate']] || '').trim();
    const totalDataRaw = String(row[colMap['terbaru']] || '0').trim();

    if (!namaDirektori || isNaN(parseInt(no, 10))) {
        continue;
    }

    const totalData = parseInt(totalDataRaw.replace(/[,."]/g, ''), 10) || 0;
    const status = (totalData > 0) ? 'SELESAI' : 'PENDING';

    let updatePeriode = '-';
    if (dataTerupdate && dataTerupdate !== '') {
        updatePeriode = dataTerupdate.replace('Aug', 'Agu').trim();
    } else if (status === 'SELESAI') {
        updatePeriode = 'Agu 2026';
    }

    upsertDirectory(kategori, namaDirektori, status, totalData, updatePeriode);
    importedCount++;
}

console.log(`[SUKSES] Berhasil memperbarui ${importedCount} task direktori ke database SQLite!\n`);
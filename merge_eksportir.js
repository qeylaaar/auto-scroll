const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

console.log(`\n==================================================`);
console.log(` 🧹 MERGE DATA EKSPORTIR INDONESIA`);
console.log(`==================================================\n`);

let allData = [];

// Merekam semua file Terminal yang ada di folder
const files = fs.readdirSync(__dirname).filter(f => f.startsWith('Hasil_Eksportir_Terminal_') && f.endsWith('.xlsx'));

if (files.length === 0) {
    console.error(`[ERROR] Tidak ada file Hasil_Eksportir_Terminal_X.xlsx yang ditemukan.`);
    process.exit(1);
}

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    console.log(`[OK] Memproses: ${file}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    allData = allData.concat(rows);
});

// DEDUPLIKASI BERDASARKAN NAMA PERUSAHAAN & ALAMAT
const uniqueMap = new Map();
allData.forEach(item => {
    const key = `${(item['Nama Perusahaan'] || '').toLowerCase().trim()}_${(item['Alamat'] || '').toLowerCase().trim()}`;
    if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
    }
});

const cleanedData = Array.from(uniqueMap.values());

// ATUR ULANG KODE NO
const finalData = cleanedData.map((item, idx) => ({
    'No': idx + 1,
    'Nama Perusahaan': item['Nama Perusahaan'] || '-',
    'Alamat': item['Alamat'] || '-',
    'Telepon': item['Telepon'] || '-',
    'Email': item['Email'] || '-',
    'Website': item['Website'] || '-',
    'Komoditi': item['Komoditi'] || '-',
    'Bidang Usaha': item['Bidang Usaha'] || '-',
    'Sample Keyword': item['Keyword'] || '-'
}));

const newWorkbook = XLSX.utils.book_new();
const newWorksheet = XLSX.utils.json_to_sheet(finalData);

newWorksheet['!cols'] = [
    { wch: 8 },  // No
    { wch: 35 }, // Nama Perusahaan
    { wch: 45 }, // Alamat
    { wch: 20 }, // Telepon
    { wch: 30 }, // Email
    { wch: 30 }, // Website
    { wch: 35 }, // Komoditi
    { wch: 35 }, // Bidang Usaha
    { wch: 15 }  // Sample Keyword
];

XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Eksportir Indonesia');
const outputFilename = 'Data_Eksportir_Indonesia_Seluruh.xlsx';
XLSX.writeFile(newWorkbook, outputFilename);

console.log(`\n==================================================`);
console.log(`[SUKSES MERGE EKSPORTIR]`);
console.log(` -> Total Data Mentah : ${allData.length}`);
console.log(` -> Total Data Unik   : ${finalData.length}`);
console.log(`\nMaster File tersimpan sebagai: ${outputFilename}`);
console.log(`==================================================\n`);
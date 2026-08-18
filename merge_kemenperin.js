const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const files = [
    'Hasil_Kemenperin_Part_1.xlsx',
    'Hasil_Kemenperin_Part_2.xlsx',
    'Hasil_Kemenperin_Part_3.xlsx'
];

let allData = [];

console.log(`\n==================================================`);
console.log(` 🧹 MERGE & CLEANUP DATA KEMENPERIN`);
console.log(`==================================================\n`);

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`[OK] Memproses dan membaca: ${file}`);
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet);

        allData = allData.concat(rows);
    } else {
        console.log(`[WARN] File ${file} tidak ditemukan, dilewati.`);
    }
});

if (allData.length === 0) {
    console.error(`\n[ERROR] Tidak ada file Kemenperin Part yang ditemukan.`);
    process.exit(1);
}

// HAPUS DUPLIKAT (Berdasarkan kombinasi Nama Perusahaan & Provinsi)
const uniqueMap = new Map();
allData.forEach(item => {
    const key = `${(item['Nama Perusahaan'] || '').toLowerCase().trim()}_${(item['Provinsi'] || '').toLowerCase().trim()}`;
    if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
    }
});

const cleanedData = Array.from(uniqueMap.values());

// RAPATKAN NOMOR URUT DARI 1 - END
const finalData = cleanedData.map((item, index) => ({
    'No': index + 1,
    'Nama Perusahaan': item['Nama Perusahaan'] || '-',
    'KBLI': item['KBLI'] || '-',
    'Telepon': item['Telepon'] || '-',
    'Email': item['Email'] || '-',
    'Provinsi': item['Provinsi'] || '-'
}));

// BUAT WORKBOOK EXCEL AKHIR
const newWorkbook = XLSX.utils.book_new();
const newWorksheet = XLSX.utils.json_to_sheet(finalData);

// LEBAR KOLOM
newWorksheet['!cols'] = [
    { wch: 8 },  // No
    { wch: 45 }, // Nama Perusahaan
    { wch: 15 }, // KBLI
    { wch: 25 }, // Telepon
    { wch: 35 }, // Email
    { wch: 25 }  // Provinsi
];

XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Direktori Kemenperin');
const outputFilename = 'Data_Eksportir_Kemenperin_Seluruh_Indonesia.xlsx';
XLSX.writeFile(newWorkbook, outputFilename);

console.log(`\n==================================================`);
console.log(`[SUKSES] Berhasil menggabungkan data Kemenperin!`);
console.log(` -> Total Data Mentah : ${allData.length}`);
console.log(` -> Total Data Unik   : ${finalData.length}`);
console.log(`\nFile tersimpan sebagai: ${outputFilename}`);
console.log(`==================================================\n`);
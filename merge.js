const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const files = [
    'Hasil_Gym_Part_1.xlsx',
    'Hasil_Gym_Part_2.xlsx',
    'Hasil_Gym_Part_3.xlsx'
];

let allData = [];

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`Memproses dan membaca ${file}...`);
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet);

        // Cleaning ikon aneh / private-use unicode di kolom Fulladdress
        rows.forEach(row => {
            if (row.Fulladdress) {
                row.Fulladdress = row.Fulladdress.replace(/^[\uE000-\uF8FF\s]+/, '').trim();
            }
        });

        allData = allData.concat(rows);
    } else {
        console.log(`[WARN] File ${file} tidak ditemukan, dilewati.`);
    }
});

// Hapus duplikat berdasarkan kombinasi Nama & Latitude (jika ada yang overlap)
const uniqueMap = new Map();
allData.forEach(item => {
    const key = `${(item.Name || '').toLowerCase().trim()}_${item.Latitude || ''}`;
    if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
    }
});

const finalData = Array.from(uniqueMap.values());

// Simpan ke file master akhir
const newWorkbook = XLSX.utils.book_new();
const newWorksheet = XLSX.utils.json_to_sheet(finalData);

// Atur lebar kolom agar rapi
newWorksheet['!cols'] = [
    { wch: 30 }, // Name
    { wch: 45 }, // Fulladdress
    { wch: 25 }, // Email
    { wch: 25 }, // Categories
    { wch: 20 }, // Phones
    { wch: 15 }, // Latitude
    { wch: 15 }  // Longitude
];

XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Gym Indonesia');
const outputFilename = 'Data_Gym_Seluruh_Indonesia.xlsx';
XLSX.writeFile(newWorkbook, outputFilename);

console.log(`\n==================================================`);
console.log(`[SUKSES] Berhasil menggabungkan ${finalData.length} data unik!`);
console.log(`File tersimpan sebagai: ${outputFilename}`);
console.log(`==================================================`);
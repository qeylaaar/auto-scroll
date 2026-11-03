const XLSX = require('xlsx');
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

(async () => {
    console.log(`\n==================================================`);
    console.log(` 🧹 MERGE & CLEANUP DATA MAPS (INTERACTIVE)`);
    console.log(`==================================================\n`);

    let categoryKeyword = await askQuestion('👉 Masukkan Nama Kategori/Objek (misal: tempat spa / bengkel / tempat gym): ');
    if (!categoryKeyword) categoryKeyword = 'tempat gym';

    const categorySlug = categoryKeyword.toLowerCase().trim().replace(/\s+/g, '_');
    
    // NAMA OBJEK UNTUK FILE AKHIR (misal: "Tempat Spa" -> "Data_Tempat_Spa.xlsx")
    const formattedObjName = categoryKeyword.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('_');
    const outputFilename = `Data_${formattedObjName}.xlsx`;

    const files = [
        `Hasil_${categorySlug}_Part_1.xlsx`,
        `Hasil_${categorySlug}_Part_2.xlsx`,
        `Hasil_${categorySlug}_Part_3.xlsx`
    ];

    let allData = [];

    console.log(`\n--------------------------------------------------`);
    console.log(`Mencari File Part untuk Kategori: "${categoryKeyword}"...`);
    console.log(`--------------------------------------------------`);

    files.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`[OK] Memproses dan membaca: ${file}`);
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet);

            // Cleaning ikon & karakter aneh pada alamat
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

    if (allData.length === 0) {
        console.error(`\n[ERROR] Tidak ada file Part yang ditemukan untuk kategori "${categoryKeyword}".`);
        process.exit(1);
    }

    // FILTER DEDUP (Hapus data duplikat murni berdasarkan kombinasi Name & Latitude)
    const uniqueMap = new Map();

    allData.forEach(item => {
        const nameLower = (item.Name || '').toLowerCase().trim();
        const lat = item.Latitude ? String(item.Latitude).trim() : '';

        // Gunakan key kombinasi nama dan koordinat latitude
        const key = `${nameLower}_${lat}`;
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, item);
        }
    });

    const finalData = Array.from(uniqueMap.values());

    // Simpan ke file master Excel akhir
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

    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, formattedObjName.replace(/_/g, ' '));
    XLSX.writeFile(newWorkbook, outputFilename);

    console.log(`\n==================================================`);
    console.log(`[SUKSES] Berhasil menggabungkan data!`);
    console.log(` -> Total Data Awal   : ${allData.length}`);
    console.log(` -> Duplikat Dibuang  : ${allData.length - finalData.length}`);
    console.log(` -> Total Data Bersih : ${finalData.length}`);
    console.log(`\nFile tersimpan sebagai: ${outputFilename}`);
    console.log(`==================================================\n`);
})();
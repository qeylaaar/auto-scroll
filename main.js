const readline = require('readline');
const { execSync } = require('child_process');
const { getAllDirectories, getSummaryStats } = require('./db');

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
    while (true) {
        console.clear();
        console.log(`==================================================`);
        console.log(` 🚀 AUTO-SCROLL ALL-IN-ONE SCRAPING TOOLKIT`);
        console.log(`==================================================\n`);

        console.log(`Pilih Task Scraping yang Ingin Dijalankan:`);
        console.log(`1. 🗺️  Google Maps - Fase 1 (Scanning URL)`);
        console.log(`2. 📝 Google Maps - Fase 2 (Extract Detail & Reviews)`);
        console.log(`3. 🧹 Google Maps - Fase 3 (Merge & Clean Excel)`);
        console.log(`4. 📊 Cek Status & Statistik Database SQLite`);
        console.log(`5. ❌ Keluar`);

        const choice = await askQuestion('\n👉 Masukkan Pilihan (1-5): ');

        try {
            switch (choice) {
                case '1':
                    execSync('node index.js', { stdio: 'inherit' });
                    break;
                case '2':
                    execSync('node extract_detail.js', { stdio: 'inherit' });
                    break;
                case '3':
                    execSync('node merge_clean.js', { stdio: 'inherit' });
                    break;
                case '4': {
                    console.log(`\n==================================================`);
                    console.log(` 📊 REKAP STATUS DIREKTORI MASTER (crawler_state.db)`);
                    console.log(`==================================================`);

                    const dirs = getAllDirectories();
                    if (dirs.length === 0) {
                        console.log('\n[INFO] Tabel direktori masih kosong. Jalankan "node import_task_csv.js" terlebih dahulu.');
                    } else {
                        const selesai = dirs.filter(d => d.status === 'SELESAI').length;
                        const pending = dirs.filter(d => d.status === 'PENDING').length;

                        console.log(`\nTotal Direktori: ${dirs.length} | ✅ Selesai: ${selesai} | ⏳ Pending: ${pending}\n`);
                        console.table(dirs.map(d => ({
                            No: d.id,
                            Kategori: d.kategori,
                            Direktori: d.nama_direktori,
                            Status: d.status === 'SELESAI' ? '✅ SELESAI' : '⏳ PENDING',
                            'Total Data': d.total_data.toLocaleString('id-ID'),
                            'Update Terakhir': d.update_terakhir
                        })));
                    }

                    // Menampilkan progres URL aktif (tabel places) jika ada
                    const urlStats = getSummaryStats();
                    if (urlStats.length > 0) {
                        console.log(`\n📌 PROGRES CRAWLING URL TEMPAT AKTIF:`);
                        console.table(urlStats);
                    }

                    await askQuestion('\nTekan ENTER untuk kembali ke menu utama...');
                    break;
                }
                case '5':
                    console.log('\nSampai jumpa!');
                    process.exit(0);
                default:
                    console.log('\nPilihan tidak valid.');
                    await askQuestion('\nTekan ENTER untuk lanjut...');
            }
        } catch (err) {
            console.error('\n[ERROR] Terjadi kesalahan saat menjalankan task.');
            await askQuestion('\nTekan ENTER untuk lanjut...');
        }
    }
})();
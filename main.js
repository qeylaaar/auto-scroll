const readline = require('readline');
const { execSync } = require('child_process');

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
    console.log(` 🚀 AUTO-SCROLL ALL-IN-ONE SCRAPING TOOLKIT`);
    console.log(`==================================================\n`);

    console.log(`Pilih Task Scraping yang Ingin Dijalankan:`);
    console.log(`1. 🗺️  Google Maps - Fase 1 (Scanning URL)`);
    console.log(`2. 📝 Google Maps - Fase 2 (Extract Detail)`);
    console.log(`3. 🧹 Google Maps - Fase 3 (Merge & Clean Excel)`);
    console.log(`--------------------------------------------------`);
    console.log(`4. 🏢 Kemenperin  - Scraping Part Wilayah`);
    console.log(`5. 🧹 Kemenperin  - Merge & Clean Data Excel`);
    console.log(`6. ❌ Keluar`);

    const choice = await askQuestion('\n👉 Masukkan Pilihan (1-6): ');

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
            case '4':
                execSync('node kemenperin.js', { stdio: 'inherit' });
                break;
            case '5':
                execSync('node merge_kemenperin.js', { stdio: 'inherit' });
                break;
            case '6':
                console.log('\nSampai jumpa!');
                process.exit(0);
            default:
                console.log('\nPilihan tidak valid.');
        }
    } catch (err) {
        console.error('\n[ERROR] Terjadi kesalahan saat menjalankan task.');
    }
})();
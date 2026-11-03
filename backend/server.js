const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Server } = require('socket.io');

const tasksRouter = require('./routes/tasks');
const jobManager = require('./jobs/jobManager');
const { setupSocket } = require('./websocket/socket');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', tasksRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Sajikan dashboard (hasil build React) langsung dari backend, supaya
// pemakaian sehari-hari cukup 1 server (1 double-click start-dashboard.bat)
// tanpa perlu terminal terpisah untuk `npm run dev`. Frontend tetap bisa
// dijalankan terpisah lewat Vite dev server (npm run dev di folder
// frontend) untuk keperluan development/edit tampilan.
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
} else {
  console.warn(
    '[backend] frontend/dist tidak ditemukan — dashboard belum di-build. Jalankan "npm run build" di folder frontend, atau gunakan start-dashboard.bat.'
  );
}

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

setupSocket(io);
jobManager.attachIo(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`[backend] Google Maps Scraper Dashboard listening on :${PORT}`);
  console.log(`[backend] Buka http://localhost:${PORT} di browser`);
});

module.exports = { app, server };

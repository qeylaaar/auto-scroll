/**
 * jobManager.js
 *
 * Mengelola child process scraping per task:
 * - Membatasi jumlah task yang boleh RUNNING bersamaan (MAX_CONCURRENT_TASKS)
 *   supaya komputer tidak overload dengan banyak instance browser sekaligus
 *   (brief #17: "menjalankan beberapa task secara terkontrol").
 * - Task lain yang di-start saat slot penuh masuk status 'queued' dan
 *   otomatis dijalankan begitu ada slot kosong.
 * - Relay event dari worker (log/progress/item) ke DB (persist) dan ke
 *   WebSocket (realtime ke frontend).
 * - Pause/cancel = kirim signal ke child process lalu kill dengan bersih
 *   (browser Puppeteer ikut ditutup di sisi worker sebelum exit).
 */

const { fork } = require('child_process');
const path = require('path');
const taskService = require('../services/taskService');
const { cleanAndDedup } = require('../../scraper/cleaner');

const MAX_CONCURRENT_TASKS = 2; // beberapa task browser sekaligus tetap dibatasi di level manager

const runningWorkers = new Map(); // taskId -> ChildProcess
const queue = [];
let io = null; // socket.io instance, di-set dari server.js

function attachIo(socketIoInstance) {
  io = socketIoInstance;
}

function emit(taskId, event, payload) {
  if (io) io.to(`task:${taskId}`).emit(event, { taskId, ...payload });
}

function activeCount() {
  return runningWorkers.size;
}

function startTask(taskId) {
  const task = taskService.getTask(taskId);
  if (!task) throw new Error('Task not found');
  if (['running'].includes(task.status)) return task;

  if (activeCount() >= MAX_CONCURRENT_TASKS) {
    taskService.updateTaskStatus(taskId, 'queued');
    if (!queue.includes(taskId)) queue.push(taskId);
    taskService.addLog(taskId, `Task masuk antrian (${activeCount()}/${MAX_CONCURRENT_TASKS} slot terpakai).`);
    emit(taskId, 'task_queued', {});
    return taskService.getTask(taskId);
  }

  return launchWorker(taskId);
}

function launchWorker(taskId) {
  const task = taskService.getTask(taskId);

  const processedUrls = Array.from(taskService.getProcessedUrls(taskId));
  const existingUrls = taskService.getAllUrls(taskId).map((r) => ({ url: r.url, province: r.province }));

  const workerPayload = {
    taskId,
    keyword: task.keyword,
    regionSelection: task.region_selection,
    config: task.config,
    existingUrls,
    processedUrls,
    phase: task.phase === 'pending' ? 'pending' : task.phase === 'collecting' ? 'collecting' : 'extracting',
  };

  // Jalankan worker tanpa melewatkan JSON raksasa ke argumen baris perintah (argv)
  const child = fork(path.join(__dirname, 'scrapeWorker.js'), [], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });

  runningWorkers.set(taskId, child);
  taskService.updateTaskStatus(taskId, 'running');
  taskService.addLog(taskId, `Task dimulai (worker pid ${child.pid}).`);
  emit(taskId, 'task_started', { pid: child.pid });

  // Kirim payload inisialisasi via IPC channel secara aman
  child.send({ type: 'INIT_TASK', payload: workerPayload });

  child.on('message', (msg) => handleWorkerMessage(taskId, msg));

  child.on('exit', (code, signal) => {
    runningWorkers.delete(taskId);
    onWorkerExit(taskId, code, signal);
    dequeueNext();
  });

  child.stderr?.on('data', (buf) => {
    taskService.addLog(taskId, `[stderr] ${buf.toString().slice(0, 500)}`, 'error');
  });

  return taskService.getTask(taskId);
}

function dequeueNext() {
  while (queue.length > 0 && activeCount() < MAX_CONCURRENT_TASKS) {
    const nextId = queue.shift();
    const t = taskService.getTask(nextId);
    if (t && t.status === 'queued') {
      launchWorker(nextId);
    }
  }
}

function handleWorkerMessage(taskId, msg) {
  switch (msg.type) {
    case 'log': {
      taskService.addLog(taskId, msg.message, msg.level || 'info');
      emit(taskId, 'log', { message: msg.message, level: msg.level || 'info' });
      break;
    }
    case 'phase': {
      taskService.updateTaskProgress(taskId, { phase: msg.phase });
      emit(taskId, 'phase_changed', { phase: msg.phase });
      break;
    }
    case 'urls_saved': {
      // msg.urls sudah berupa [{url, province}] dari worker (lihat scrapeWorker.js) —
      // sebelumnya di sini provinsinya sengaja dibuang ("provinceless"), itu
      // akar penyebab kolom Province kosong di tabel hasil.
      taskService.addUrls(taskId, msg.urls);
      taskService.updateTaskProgress(taskId, { urls_found: msg.urls.length });
      emit(taskId, 'progress_updated', { urlsFound: msg.urls.length });
      break;
    }
    case 'progress': {
      // FIX: evt dibungkus di msg.evt (lihat scrapeWorker.js) — sebelumnya
      // evt.type (mis. 'progress_updated', 'item_success') menimpa envelope
      // type='progress' via object spread, sehingga event ini SELALU jatuh
      // ke default/dibuang. Ini akar penyebab kolom Records selalu 0 dan
      // progress bar/current province tidak update realtime.
      handleScraperProgressEvent(taskId, msg.evt);
      break;
    }
    case 'item': {
      const item = msg.item;
      taskService.addResult(taskId, item, item.province);
      if (item.googleMapsUrl) taskService.markUrlStatus(taskId, item.googleMapsUrl, 'success');
      break;
    }
    case 'paused': {
      taskService.updateTaskStatus(taskId, 'paused');
      taskService.addLog(taskId, `Task dijeda/dibatalkan: ${msg.reason || ''}`, 'warn');
      emit(taskId, 'task_paused', { reason: msg.reason });
      break;
    }
    case 'completed': {
      finalizeTask(taskId, msg);
      break;
    }
    case 'failed': {
      taskService.updateTaskStatus(taskId, 'failed', { errorMessage: msg.error });
      taskService.addLog(taskId, `Task gagal: ${msg.error}`, 'error');
      emit(taskId, 'task_failed', { error: msg.error });
      break;
    }
    default:
      break;
  }
}

function handleScraperProgressEvent(taskId, evt) {
  if (evt.type === 'province_started') {
    taskService.updateTaskProgress(taskId, { current_province: evt.province });
    emit(taskId, 'province_started', evt);
  } else if (evt.type === 'province_completed') {
    emit(taskId, 'province_completed', evt);
  } else if (evt.type === 'item_success' || evt.type === 'item_failed') {
    emit(taskId, evt.type, evt);
  } else if (evt.type === 'progress_updated') {
    taskService.updateTaskProgress(taskId, {
      processed: evt.processed,
      successful: evt.successful,
      failed: evt.failed,
    });
    emit(taskId, 'progress_updated', evt);
  }
}

function finalizeTask(taskId, msg) {
  // Fase 3: clean & dedup dijalankan di sini terhadap SELURUH hasil task
  // dari DB (bisa gabungan dari beberapa kali resume).
  const { rows } = taskService.getResults(taskId, { limit: 1000000, offset: 0 });
  const { duplicatesRemoved } = cleanAndDedup(
    rows.map((r) => ({ name: r.name, fullAddress: r.full_address, latitude: r.latitude }))
  );

  taskService.updateTaskProgress(taskId, { phase: 'done' });
  taskService.updateTaskStatus(taskId, 'completed');
  taskService.addLog(
    taskId,
    `Task selesai. Berhasil: ${msg.successful}, Gagal: ${msg.failed}, Duplikat terdeteksi: ${duplicatesRemoved}.`
  );
  emit(taskId, 'task_completed', { successful: msg.successful, failed: msg.failed, duplicatesRemoved });
}

function onWorkerExit(taskId, code, signal) {
  const task = taskService.getTask(taskId);
  if (!task) return;
  // Kalau exit bukan karena completed/failed/paused yang sudah di-handle
  // via message (mis. proses ke-kill paksa / crash tanpa sempat kirim
  // message), pastikan status task tidak nyangkut di 'running'.
  if (task.status === 'running') {
    taskService.updateTaskStatus(taskId, 'failed', {
      errorMessage: `Worker berhenti tak terduga (code=${code}, signal=${signal}).`,
    });
    taskService.addLog(taskId, `Worker exit tak terduga (code=${code}, signal=${signal}).`, 'error');
    emit(taskId, 'task_failed', { error: 'worker_exited_unexpectedly' });
  }
}

function pauseTask(taskId) {
  const child = runningWorkers.get(taskId);
  if (!child) {
    // task belum/tidak sedang jalan (mungkin masih di queue)
    const idx = queue.indexOf(taskId);
    if (idx >= 0) queue.splice(idx, 1);
    taskService.updateTaskStatus(taskId, 'paused');
    return taskService.getTask(taskId);
  }
  child.send({ type: 'cancel' });
  // beri waktu graceful shutdown sebelum force-kill
  setTimeout(() => {
    if (runningWorkers.has(taskId)) child.kill('SIGTERM');
  }, 5000);
  return taskService.getTask(taskId);
}

function cancelTask(taskId) {
  const result = pauseTask(taskId); // mekanisme sama, status akhir beda
  taskService.updateTaskStatus(taskId, 'cancelled');
  return result;
}

function resumeTask(taskId) {
  return startTask(taskId); // startTask sudah otomatis pakai processedUrls/existingUrls utk resume
}

module.exports = { attachIo, startTask, pauseTask, cancelTask, resumeTask, activeCount, MAX_CONCURRENT_TASKS };

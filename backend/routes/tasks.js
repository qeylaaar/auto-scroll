const express = require('express');
const router = express.Router();
const multer = require('multer');

const taskService = require('../services/taskService');
const jobManager = require('../jobs/jobManager');
const { listProvinces } = require('../../scraper/regions');
const { exportCsv, exportXlsx, exportGeoJson, exportReviewsCsv } = require('../services/exportService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // Maksimal 50 MB
});

// ---- Meta ----
router.get('/meta/provinces', (req, res) => {
  res.json({ provinces: listProvinces() });
});

router.get('/dashboard/stats', (req, res) => {
  res.json(taskService.getDashboardStats());
});

// ---- Tasks CRUD ----
router.post('/tasks', (req, res) => {
  const { name, keyword, categoryGroup, regionSelection, config } = req.body;
  if (!name || !keyword) {
    return res.status(400).json({ error: 'name dan keyword wajib diisi' });
  }
  const { task, warnings } = taskService.createTask({
    name,
    keyword,
    categoryGroup: categoryGroup || 'Lainnya',
    regionSelection: regionSelection || { mode: 'all' },
    config: config || {},
  });
  res.status(201).json({ task, warnings });
});

router.get('/tasks', (req, res) => {
  const { categoryGroup } = req.query;
  res.json({ tasks: taskService.listTasks({ categoryGroup }) });
});

router.get('/tasks/:id', (req, res) => {
  const task = taskService.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });
  res.json({ task });
});

router.patch('/tasks/:id', (req, res) => {
  const task = taskService.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });
  const { name, categoryGroup } = req.body;
  const updated = taskService.updateTask(req.params.id, { name, categoryGroup });
  res.json({ task: updated });
});

router.delete('/tasks/:id', (req, res) => {
  const task = taskService.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });
  if (task.status === 'running' && req.query.confirm !== 'true') {
    return res.status(409).json({
      error: 'Task sedang berjalan. Tambahkan ?confirm=true untuk tetap menghapus (task akan dihentikan dulu).',
    });
  }
  if (task.status === 'running') jobManager.cancelTask(task.id);
  taskService.deleteTask(req.params.id);
  res.status(204).end();
});

// ---- Import Dataset Excel ----
// Endpoint Batch Import Dataset Excel (Mendukung hingga 50 file sekaligus)
// Gunakan upload.any() agar menerima field file baik bernama 'file' maupun 'files'
router.post('/tasks/import-excel', upload.any(), async (req, res) => {
  try {
    const uploadedFiles = req.files || [];
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'Minimal 1 file Excel (.xlsx) wajib diunggah.' });
    }

    const categoryGroup = req.body.categoryGroup || 'Lainnya';
    const importedResults = [];
    const errors = [];

    for (const file of uploadedFiles) {
      // Tentukan nama dataset: gunakan nama input jika 1 file, atau nama asli file
      let datasetName = req.body.name;
      if (!datasetName || uploadedFiles.length > 1) {
        datasetName = file.originalname
          .replace(/\.xlsx$/i, '')
          .replace(/^Data[_\-\s]+/i, '')
          .replace(/[_\-]+/g, ' ')
          .trim();
      }

      try {
        const result = await taskService.importExcelDataset({
          fileBuffer: file.buffer,
          name: datasetName,
          categoryGroup,
        });
        importedResults.push({ name: datasetName, count: result.totalImported });
      } catch (fileErr) {
        errors.push({ file: file.originalname, error: fileErr.message });
      }
    }

    res.status(201).json({
      success: true,
      importedCount: importedResults.length,
      items: importedResults,
      errors,
    });
  } catch (err) {
    res.status(500).json({ error: `Gagal memproses import: ${err.message}` });
  }
});

// ---- Job control ----
router.post('/tasks/:id/start', (req, res) => {
  try {
    const task = jobManager.startTask(req.params.id);
    res.json({ task });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/tasks/:id/pause', (req, res) => {
  const task = jobManager.pauseTask(req.params.id);
  res.json({ task });
});

router.post('/tasks/:id/resume', (req, res) => {
  const task = jobManager.resumeTask(req.params.id);
  res.json({ task });
});

router.post('/tasks/:id/cancel', (req, res) => {
  const task = jobManager.cancelTask(req.params.id);
  res.json({ task });
});

// ---- Logs ----
router.get('/tasks/:id/logs', (req, res) => {
  const afterId = Number(req.query.afterId) || 0;
  const logs = taskService.getLogs(req.params.id, { afterId, limit: 1000 });
  res.json({ logs });
});

router.delete('/tasks/:id/logs', (req, res) => {
  taskService.clearLogs(req.params.id);
  res.status(204).end();
});

// ---- Results & Reviews ----
router.get('/tasks/:id/results', (req, res) => {
  const { search, province, hasPhone, hasEmail, hasCoords, page = 1, pageSize = 50, sortBy, sortDir } = req.query;
  const limit = Math.min(500, Number(pageSize) || 50);
  const offset = (Math.max(1, Number(page)) - 1) * limit;

  const { rows, total } = taskService.getResults(req.params.id, {
    search,
    province,
    hasPhone: hasPhone === 'true',
    hasEmail: hasEmail === 'true',
    hasCoords: hasCoords === 'true',
    limit,
    offset,
    sortBy,
    sortDir,
  });

  res.json({ rows, total, page: Number(page), pageSize: limit });
});

router.get('/results/:resultId/reviews', (req, res) => {
  const reviews = taskService.getReviewsByResultId(Number(req.params.resultId));
  res.json({ reviews });
});

// ---- Export ----
router.get('/tasks/:id/export/csv', (req, res) => exportCsv(req.params.id, res));
router.get('/tasks/:id/export/xlsx', (req, res) => exportXlsx(req.params.id, res));
router.get('/tasks/:id/export/geojson', (req, res) => exportGeoJson(req.params.id, res));
router.get('/tasks/:id/export/reviews-csv', (req, res) => exportReviewsCsv(req.params.id, res));

module.exports = router;  
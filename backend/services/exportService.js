const ExcelJS = require('exceljs');
const taskService = require('./taskService');

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const COLUMNS = [
  { key: 'name', header: 'Name' },
  { key: 'full_address', header: 'Full Address' },
  { key: 'category', header: 'Category' },
  { key: 'phones', header: 'Phone' },
  { key: 'rating', header: 'Rating' },
  { key: 'total_reviews', header: 'Total Reviews' },
  { key: 'email', header: 'Email' },
  { key: 'website', header: 'Website' },
  { key: 'latitude', header: 'Latitude' },
  { key: 'longitude', header: 'Longitude' },
  { key: 'province', header: 'Province' },
  { key: 'google_maps_url', header: 'Google Maps URL' },
];

function exportCsv(taskId, res) {
  const task = taskService.getTask(taskId);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${task.name}-results.csv"`);

  res.write(COLUMNS.map((c) => csvEscape(c.header)).join(',') + '\n');
  for (const row of taskService.getAllResultsForExport(taskId)) {
    res.write(COLUMNS.map((c) => csvEscape(row[c.key])).join(',') + '\n');
  }
  res.end();
}

function exportReviewsCsv(taskId, res) {
  const task = taskService.getTask(taskId);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${task.name}-reviews.csv"`);

  const reviewHeaders = ['Business Name', 'Address', 'Reviewer Name', 'Rating', 'Review Text', 'Date Published'];
  res.write(reviewHeaders.map(csvEscape).join(',') + '\n');

  for (const row of taskService.getAllReviewsForExport(taskId)) {
    const line = [
      row.business_name,
      row.full_address,
      row.author_name,
      row.rating,
      row.review_text,
      row.published_at,
    ];
    res.write(line.map(csvEscape).join(',') + '\n');
  }
  res.end();
}

async function exportXlsx(taskId, res) {
  const task = taskService.getTask(taskId);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${task.name}-results.xlsx"`);

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
  const sheet = workbook.addWorksheet('Results');
  sheet.columns = COLUMNS.map((c) => ({
    header: c.header,
    key: c.key,
    width: 25,
  }));
  sheet.getRow(1).font = { bold: true };

  for (const row of taskService.getAllResultsForExport(taskId)) {
    sheet.addRow(COLUMNS.reduce((acc, c) => ({ ...acc, [c.key]: row[c.key] }), {})).commit();
  }

  sheet.commit();
  await workbook.commit();
}

function exportGeoJson(taskId, res) {
  const task = taskService.getTask(taskId);
  if (!task) return res.status(404).json({ error: 'Task tidak ditemukan' });

  res.setHeader('Content-Type', 'application/geo+json');
  res.setHeader('Content-Disposition', `attachment; filename="${task.name}-results.geojson"`);

  res.write('{"type":"FeatureCollection","features":[');
  let first = true;
  for (const row of taskService.getAllResultsForExport(taskId)) {
    if (row.latitude == null || row.longitude == null) continue;
    const feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [row.longitude, row.latitude] },
      properties: {
        name: row.name,
        address: row.full_address,
        category: row.category,
        phone: row.phones,
        rating: row.rating,
        totalReviews: row.total_reviews,
        email: row.email,
        website: row.website,
        province: row.province,
        googleMapsUrl: row.google_maps_url,
      },
    };
    res.write((first ? '' : ',') + JSON.stringify(feature));
    first = false;
  }
  res.write(']}');
  res.end();
}

module.exports = { exportCsv, exportXlsx, exportGeoJson, exportReviewsCsv };
const { randomUUID } = require("crypto");
const ExcelJS = require("exceljs");
const db = require("../db/db");
const { validateConfig } = require("../config");
const { listProvinces } = require("../../scraper/regions");

function nowIso() {
  return new Date().toISOString();
}

function detectProvinceFromAddress(address, provinceList) {
  if (!address) return null;
  const lowerAddr = address.toLowerCase();
  for (const prov of provinceList) {
    if (lowerAddr.includes(prov.toLowerCase())) {
      return prov;
    }
  }
  return null;
}

function createTask({ name, keyword, categoryGroup, regionSelection, config }) {
  const { config: validConfig, warnings } = validateConfig(config);
  const id = randomUUID();

  db.prepare(
    `INSERT INTO scraping_tasks (id, name, keyword, category_group, region_selection, config, status, phase)
     VALUES (?, ?, ?, ?, ?, ?, 'queued', 'pending')`,
  ).run(
    id,
    name,
    keyword,
    categoryGroup || "Lainnya",
    JSON.stringify(regionSelection),
    JSON.stringify(validConfig),
  );

  return { task: getTask(id), warnings };
}

function getTask(id) {
  const row = db.prepare(`SELECT * FROM scraping_tasks WHERE id = ?`).get(id);
  if (!row) return null;
  return deserializeTask(row);
}

function listTasks({ categoryGroup } = {}) {
  let query = `SELECT * FROM scraping_tasks`;
  const params = [];

  if (categoryGroup && categoryGroup !== "all") {
    query += ` WHERE category_group = ?`;
    params.push(categoryGroup);
  }

  query += ` ORDER BY created_at DESC`;
  const rows = db.prepare(query).all(...params);
  return rows.map(deserializeTask);
}

function deserializeTask(row) {
  return {
    ...row,
    category_group: row.category_group || "Lainnya",
    region_selection: JSON.parse(row.region_selection),
    config: JSON.parse(row.config),
  };
}

function updateTaskStatus(id, status, extra = {}) {
  const fields = ["status = ?", "updated_at = ?"];
  const values = [status, nowIso()];

  if (status === "running" && !extra.skipStartedAt) {
    fields.push("started_at = COALESCE(started_at, ?)");
    values.push(nowIso());
  }
  if (["completed", "failed", "cancelled"].includes(status)) {
    fields.push("completed_at = ?");
    values.push(nowIso());
  }
  if (extra.errorMessage !== undefined) {
    fields.push("error_message = ?");
    values.push(extra.errorMessage);
  }

  values.push(id);
  db.prepare(`UPDATE scraping_tasks SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values,
  );
  return getTask(id);
}

function updateTaskProgress(id, patch) {
  const allowed = [
    "phase",
    "urls_found",
    "processed",
    "successful",
    "failed",
    "current_province",
  ];
  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(patch[key]);
    }
  }
  if (fields.length === 0) return getTask(id);

  fields.push("updated_at = ?");
  values.push(nowIso());
  values.push(id);

  db.prepare(`UPDATE scraping_tasks SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values,
  );
  return getTask(id);
}

function updateTask(id, { name, categoryGroup }) {
  const fields = ['updated_at = ?'];
  const values = [nowIso()];

  if (name !== undefined) {
    fields.push('name = ?');
    values.push(name);
  }
  if (categoryGroup !== undefined) {
    fields.push('category_group = ?');
    values.push(categoryGroup);
  }

  values.push(id);
  db.prepare(`UPDATE scraping_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getTask(id);
}

function deleteTask(id) {
  db.prepare(`DELETE FROM scraping_tasks WHERE id = ?`).run(id);
}

// ---- URLs ----
function addUrls(taskId, urlProvincePairs) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO scraping_urls (task_id, url, province) VALUES (?, ?, ?)`,
  );
  const insertMany = db.transaction((pairs) => {
    for (const { url, province } of pairs)
      insert.run(taskId, url, province || null);
  });
  insertMany(urlProvincePairs);
}

function getAllUrls(taskId) {
  return db
    .prepare(
      `SELECT url, province, status FROM scraping_urls WHERE task_id = ?`,
    )
    .all(taskId);
}

function getProcessedUrls(taskId) {
  const rows = db
    .prepare(
      `SELECT url FROM scraping_urls WHERE task_id = ? AND status = 'success'`,
    )
    .all(taskId);
  return new Set(rows.map((r) => r.url));
}

function markUrlStatus(taskId, url, status) {
  db.prepare(
    `UPDATE scraping_urls SET status = ? WHERE task_id = ? AND url = ?`,
  ).run(status, taskId, url);
}

// ---- Results & Reviews ----
function addResult(taskId, item, province) {
  const insertResult = db.prepare(
    `INSERT INTO scraping_results
       (task_id, name, full_address, email, category, phones, latitude, longitude, rating, total_reviews, google_maps_url, website, province)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const info = insertResult.run(
    taskId,
    item.name || "",
    item.fullAddress || "",
    item.email || "",
    item.category || "",
    item.phones || "",
    item.latitude ? Number(item.latitude) : null,
    item.longitude ? Number(item.longitude) : null,
    item.rating || null,
    item.totalReviews ? Number(item.totalReviews) : null,
    item.googleMapsUrl || "",
    item.website || "",
    province || null,
  );

  const resultId = info.lastInsertRowid;

  // Simpan detail ulasan jika ada (dengan dedup)
  if (item.reviews && Array.isArray(item.reviews) && item.reviews.length > 0) {
    const insertReview = db.prepare(
      `INSERT INTO scraping_reviews (task_id, result_id, author_name, rating, review_text, published_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
    );

    const seen = new Set();
    const uniqueReviews = item.reviews.filter((r) => {
      const key = `${r.authorName}|${r.publishedAt}|${(r.reviewText || "").trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const insertManyReviews = db.transaction((revs) => {
      for (const r of revs) {
        insertReview.run(
          taskId,
          resultId,
          r.authorName,
          r.rating,
          r.reviewText,
          r.publishedAt,
        );
      }
    });
    insertManyReviews(uniqueReviews);
  }
}

function getResults(
  taskId,
  {
    search,
    province,
    hasPhone,
    hasEmail,
    hasCoords,
    limit = 100,
    offset = 0,
    sortBy = "id",
    sortDir = "ASC",
  } = {},
) {
  const where = ["task_id = ?"];
  const params = [taskId];

  if (search) {
    where.push("(name LIKE ? OR full_address LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (province) {
    where.push("province = ?");
    params.push(province);
  }
  if (hasPhone) where.push(`phones IS NOT NULL AND phones != ''`);
  if (hasEmail) where.push(`email IS NOT NULL AND email != ''`);
  if (hasCoords) where.push(`latitude IS NOT NULL AND longitude IS NOT NULL`);

  const allowedSort = [
    "id",
    "name",
    "province",
    "category",
    "created_at",
    "rating",
    "total_reviews",
  ];
  const safeSortBy = allowedSort.includes(sortBy) ? sortBy : "id";
  const safeSortDir = sortDir === "DESC" ? "DESC" : "ASC";

  const whereSql = where.join(" AND ");
  const total = db
    .prepare(`SELECT COUNT(*) as c FROM scraping_results WHERE ${whereSql}`)
    .get(...params).c;
  const rows = db
    .prepare(
      `SELECT * FROM scraping_results WHERE ${whereSql} ORDER BY ${safeSortBy} ${safeSortDir} LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);

  return { rows, total };
}

function getReviewsByResultId(resultId) {
  return db
    .prepare(
      `SELECT * FROM scraping_reviews WHERE result_id = ? ORDER BY id DESC`,
    )
    .all(resultId);
}

function getAllResultsForExport(taskId) {
  return db
    .prepare(`SELECT * FROM scraping_results WHERE task_id = ? ORDER BY id`)
    .iterate(taskId);
}

function getAllReviewsForExport(taskId) {
  return db
    .prepare(
      `
    SELECT r.*, s.name as business_name, s.full_address 
    FROM scraping_reviews r 
    JOIN scraping_results s ON r.result_id = s.id 
    WHERE r.task_id = ? 
    ORDER BY r.id
  `,
    )
    .iterate(taskId);
}

// ---- Import Excel Dataset ----
async function importExcelDataset({ fileBuffer, name, categoryGroup }) {
  const taskId = randomUUID();
  const validProvinces = listProvinces();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("File Excel kosong atau tidak memiliki worksheet.");
  }

  // Petakan index kolom dari baris header pertama
  const headerMap = {};
  const firstRow = worksheet.getRow(1);
  firstRow.eachCell((cell, colNumber) => {
    const val = String(cell.value || "").trim().toLowerCase();
    if (val === "name" || val.includes("nama")) headerMap.name = colNumber;
    else if (val.includes("address") || val.includes("alamat")) headerMap.address = colNumber;
    else if (val.includes("email")) headerMap.email = colNumber;
    else if (val.includes("categor")) headerMap.category = colNumber;
    else if (val.includes("phone") || val.includes("telepon")) headerMap.phones = colNumber;
    else if (val === "latitude" || val === "lat") headerMap.latitude = colNumber;
    else if (val === "longitude" || val === "long" || val === "lng") headerMap.longitude = colNumber;
    else if (val.includes("website") || val.includes("web") || val.includes("url")) headerMap.website = colNumber;
    else if (val.includes("prov")) headerMap.province = colNumber;
  });

  const rowsToInsert = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Lewati header

    const getVal = (colIdx) => {
      if (!colIdx) return "";
      const cell = row.getCell(colIdx);
      if (!cell || cell.value === null || cell.value === undefined) return "";
      if (typeof cell.value === "object" && cell.value.text) return String(cell.value.text).trim();
      return String(cell.value).trim();
    };

    const businessName = getVal(headerMap.name);
    if (!businessName) return;

    const fullAddress = getVal(headerMap.address);
    const email = getVal(headerMap.email);
    const category = getVal(headerMap.category);
    const phones = getVal(headerMap.phones);
    const website = getVal(headerMap.website);
    const lat = parseFloat(getVal(headerMap.latitude)) || null;
    const lng = parseFloat(getVal(headerMap.longitude)) || null;

    let province = getVal(headerMap.province) || null;
    if (!province && fullAddress) {
      province = detectProvinceFromAddress(fullAddress, validProvinces);
    }

    rowsToInsert.push({
      name: businessName,
      full_address: fullAddress,
      email,
      category,
      phones,
      website,
      latitude: lat,
      longitude: lng,
      province,
    });
  });

  const totalRecords = rowsToInsert.length;

  // 1. Catat task baru dengan status completed
  db.prepare(
    `INSERT INTO scraping_tasks (
      id, name, keyword, category_group, region_selection, config,
      status, phase, urls_found, processed, successful, failed, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'completed', 'done', ?, ?, ?, 0, ?)`,
  ).run(
    taskId,
    name,
    name,
    categoryGroup || "Lainnya",
    JSON.stringify({ mode: "imported" }),
    JSON.stringify({ imported: true }),
    totalRecords,
    totalRecords,
    totalRecords,
    nowIso(),
  );

  // 2. Simpan seluruh baris bisnis secara cepat menggunakan database transaction
  const insertResult = db.prepare(
    `INSERT INTO scraping_results
      (task_id, name, full_address, email, category, phones, latitude, longitude, rating, total_reviews, google_maps_url, website, province)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, null, null, '', ?, ?)`,
  );

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insertResult.run(
        taskId,
        item.name,
        item.full_address,
        item.email,
        item.category,
        item.phones,
        item.latitude,
        item.longitude,
        item.website,
        item.province,
      );
    }
  });

  insertMany(rowsToInsert);

  return { task: getTask(taskId), totalImported: totalRecords };
}

// ---- Logs ----
function addLog(taskId, message, level = "info") {
  db.prepare(
    `INSERT INTO scraping_logs (task_id, level, message) VALUES (?, ?, ?)`,
  ).run(taskId, level, message);
}

function getLogs(taskId, { limit = 500, afterId = 0 } = {}) {
  return db
    .prepare(
      `SELECT * FROM scraping_logs WHERE task_id = ? AND id > ? ORDER BY id ASC LIMIT ?`,
    )
    .all(taskId, afterId, limit);
}

function clearLogs(taskId) {
  db.prepare(`DELETE FROM scraping_logs WHERE task_id = ?`).run(taskId);
}

function getDashboardStats() {
  const totals = db
    .prepare(
      `SELECT
        COUNT(*) as totalTasks,
        COALESCE(SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END), 0) as runningTasks,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completedTasks,
        COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failedTasks
      FROM scraping_tasks`,
    )
    .get();
  const totalResults = db
    .prepare(`SELECT COUNT(*) as c FROM scraping_results`)
    .get().c;
  return { ...totals, totalBusinessesScraped: totalResults };
}

module.exports = {
  createTask,
  getTask,
  listTasks,
  updateTaskStatus,
  updateTaskProgress,
  updateTask,
  deleteTask,
  addUrls,
  getAllUrls,
  getProcessedUrls,
  markUrlStatus,
  addResult,
  getResults,
  getReviewsByResultId,
  getAllResultsForExport,
  getAllReviewsForExport,
  importExcelDataset,
  addLog,
  getLogs,
  clearLogs,
  getDashboardStats,
};
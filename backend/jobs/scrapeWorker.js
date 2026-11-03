/**
 * scrapeWorker.js
 *
 * Dijalankan sebagai CHILD PROCESS terpisah (via child_process.fork) per
 * task yang sedang running.
 */

const { collectUrls } = require('../../scraper/collector');
const { extractDetails } = require('../../scraper/extractor');
const { resolveSelection } = require('../../scraper/regions');

let aborted = false;
const abortController = new AbortController();

process.on('SIGTERM', () => {
  aborted = true;
  abortController.abort();
});

function send(type, payload = {}) {
  if (process.send) process.send({ type, ...payload });
}

function sendAndExit(type, payload = {}, code = 0) {
  if (process.send) {
    process.send({ type, ...payload }, () => process.exit(code));
    setTimeout(() => process.exit(code), 2000).unref();
  } else {
    process.exit(code);
  }
}

async function run(payload) {
  try {
    const { taskId, keyword, regionSelection, config, existingUrls, processedUrls, phase } = payload;

    const regions = resolveSelection(regionSelection);
    send('log', { message: `Resolusi wilayah: ${regions.length} kab/kota target.` });

    let urls = new Map((existingUrls || []).map(({ url, province }) => [url, province]));

    // ---- FASE 1: Collect URLs ----
    if (phase === 'pending' || phase === 'collecting') {
      send('phase', { phase: 'collecting' });

      urls = await collectUrls({
        keyword,
        regions,
        existingUrls: urls,
        signal: abortController.signal,
        headless: true,
        onLog: (message, level) => send('log', { message, level }),
        onProgress: (evt) => send('progress', { evt }),
        onSave: (urlMap) =>
          send('urls_saved', { urls: Array.from(urlMap.entries()).map(([url, province]) => ({ url, province })) }),
      });

      if (aborted) {
        sendAndExit('paused', { reason: 'cancelled_during_collecting' });
        return;
      }
    }

    // ---- FASE 2: Extract details ----
    send('phase', { phase: 'extracting' });

    const urlList = Array.from(urls.keys());
    const result = await extractDetails({
      urls: urlList,
      urlProvinceMap: urls,
      processedUrls: new Set(processedUrls || []),
      config: {
        concurrency: config.MAX_WORKERS,
        maxRetries: config.RETRY_COUNT,
        restartBrowserEvery: config.RESTART_BROWSER_EVERY,
        INCLUDE_REVIEWS: config.INCLUDE_REVIEWS || false,
      },
      signal: abortController.signal,
      headless: true,
      onLog: (message, level) => send('log', { message, level }),
      onProgress: (evt) => send('progress', { evt }),
      onItem: (item) => send('item', { item }),
    });

    if (aborted) {
      sendAndExit('paused', { reason: 'cancelled_during_extracting' });
      return;
    }

    // ---- FASE 3: Selesai ----
    send('phase', { phase: 'cleaning' });
    send('log', { message: 'Menjalankan cleaning & dedup akhir...' });

    sendAndExit('completed', { successful: result.successful, failed: result.failed });
  } catch (err) {
    sendAndExit('failed', { error: err.message, stack: err.stack }, 1);
  }
}

// Handler penerima IPC message dari jobManager.js
process.on('message', async (msg) => {
  if (msg.type === 'INIT_TASK') {
    await run(msg.payload);
  } else if (msg.type === 'cancel') {
    aborted = true;
    abortController.abort();
  }
});

process.on('uncaughtException', (err) => {
  sendAndExit('failed', { error: `Uncaught exception: ${err.message}`, stack: err.stack }, 1);
});

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  sendAndExit('failed', { error: `Unhandled rejection: ${err.message}`, stack: err.stack }, 1);
});
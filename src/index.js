const config = require("./config");
const logger = require("./utils/logger");
const { ensureDir, emptyDir, readLines } = require("./utils/file");
const { dedupePeople } = require("./utils/dedupe");
const { exportJson } = require("./exporters/jsonExporter");
const { exportCsv } = require("./exporters/csvExporter");
const { scrapeTitle } = require("./scraper/imdbScraper");
const { createBrowserRuntime } = require("./runtime/browserFactory");

function createTitleRunId(index) {
  return `T${index + 1}`;
}

async function runWithConcurrency(items, limit, worker) {
  const results = [];
  let currentIndex = 0;

  async function runner() {
    while (true) {
      const index = currentIndex++;
      if (index >= items.length) break;
      results[index] = await worker(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(limit || 1, items.length || 1));
  await Promise.all(Array.from({ length: workerCount }, () => runner()));
  return results;
}

async function closeRuntime(runtime) {
  if (!runtime) return;

  if (typeof runtime.close === "function") {
    await runtime.close();
    return;
  }

  if (runtime.context && typeof runtime.context.close === "function") {
    await runtime.context.close().catch(() => {});
  }

  if (runtime.browser && typeof runtime.browser.close === "function") {
    await runtime.browser.close().catch(() => {});
  }
}

async function main() {
  ensureDir(config.paths.outputRoot);
  ensureDir(config.paths.logsDir);
  ensureDir(config.paths.resultsDir);
  ensureDir(config.paths.screenshotsDir);
  ensureDir(config.paths.debugDir);
  ensureDir(config.paths.reportDir);

  emptyDir(config.paths.resultsDir);
  emptyDir(config.paths.screenshotsDir);
  emptyDir(config.paths.debugDir);
  emptyDir(config.paths.reportDir);

  logger.init();

  const urls = readLines(config.inputFile);
  const limitedUrls = config.titleLimit > 0 ? urls.slice(0, config.titleLimit) : urls;

  logger.info("INPUT_URLS_LOADED", {
    count: urls.length,
    effectiveCount: limitedUrls.length,
    titleLimit: config.titleLimit,
    titleConcurrency: config.titleConcurrency
  });

  const runtime = await createBrowserRuntime();
  const allResults = [];

  try {
    const nestedResults = await runWithConcurrency(
      limitedUrls,
      config.titleConcurrency || 1,
      async (url, index) => {
        const titleRunId = createTitleRunId(index);
        const page = await runtime.context.newPage();

        page.setDefaultTimeout(config.actionTimeout);
        page.setDefaultNavigationTimeout(config.navigationTimeout);

        try {
          logger.info("PROCESSING_TITLE", { titleRunId, url });
          return await scrapeTitle(page, url, { titleRunId });
        } catch (error) {
          logger.error("TITLE_PROCESS_FAILED", {
            titleRunId,
            url,
            error: error.message
          });
          return [];
        } finally {
          await page.close().catch(() => {});
        }
      }
    );

    allResults.push(...nestedResults.flat());

    const deduped = dedupePeople(allResults);
    logger.info("DEDUPE_COMPLETED", {
      before: allResults.length,
      after: deduped.length
    });

    const jsonPath = exportJson(deduped);
    const csvPath = exportCsv(deduped);

    logger.info("EXPORT_COMPLETED", {
      jsonPath,
      csvPath,
      total: deduped.length
    });
  } finally {
    await closeRuntime(runtime);
  }
}

main().catch((error) => {
  logger.error("FATAL_ERROR", { error: error.message });
  process.exit(1);
});

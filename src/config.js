const path = require("path");
require("dotenv").config();

module.exports = {
  browser: process.env.BROWSER || "chromium",
  headless: process.env.HEADLESS !== "false",
  slowMo: Number(process.env.SLOW_MO || 0),
  navigationTimeout: Number(process.env.NAVIGATION_TIMEOUT || 45000),
  actionTimeout: Number(process.env.ACTION_TIMEOUT || 15000),
  maxRetries: Number(process.env.MAX_RETRIES || 2),
  takeScreenshots: process.env.TAKE_SCREENSHOTS !== "false",
  useProfileVisit: process.env.USE_PROFILE_VISIT !== "false",
  titleLimit: Number(process.env.TITLE_LIMIT || 5),
  titleConcurrency: Number(process.env.TITLE_CONCURRENCY || 3),
  maxCastPerTitle: Number(process.env.MAX_CAST_PER_TITLE || 5),
  strictValidation: process.env.STRICT_VALIDATION === "true",
  appPort: Number(process.env.APP_PORT || 8000),
  logLevel: process.env.LOG_LEVEL || "INFO",
  outputDir: process.env.OUTPUT_DIR || "output",
  inputFile: process.env.INPUT_FILE || "input/urls.txt",
  paths: {
    outputRoot: path.resolve(process.env.OUTPUT_DIR || "output"),
    resultsDir: path.resolve(process.env.OUTPUT_DIR || "output", "results"),
    logsDir: path.resolve(process.env.OUTPUT_DIR || "output", "logs"),
    screenshotsDir: path.resolve(process.env.OUTPUT_DIR || "output", "screenshots"),
    debugDir: path.resolve(process.env.OUTPUT_DIR || "output", "debug"),
    reportDir: path.resolve(process.env.OUTPUT_DIR || "output", "report")
  }
};

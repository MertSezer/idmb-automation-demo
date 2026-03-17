const logger = require("./logger");

async function withRetry(fn, options = {}) {
  const {
    retries = 2,
    label = "operation",
    delayMs = 1000,
    meta = {}
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      logger.info(`${label} attempt ${attempt}`, meta);
      return await fn();
    } catch (error) {
      lastError = error;

      logger.warn(`${label} failed on attempt ${attempt}`, {
        ...meta,
        error: error.message
      });

      if (attempt <= retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

module.exports = { withRetry };

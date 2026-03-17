const path = require("path");
const fs = require("fs");
const config = require("../config");
const { ensureDir } = require("./file");

const logFile = path.join(config.paths.logsDir, "app.log");

function now() {
  return new Date().toISOString();
}

function init() {
  ensureDir(config.paths.logsDir);
  fs.writeFileSync(logFile, "", "utf-8");
}

function formatMessage(message, meta = null) {
  if (!meta || typeof meta !== "object") return message;

  const titleRunId = meta.titleRunId || meta.runId || "";
  if (!titleRunId) return message;

  return `[${titleRunId}] ${message}`;
}

function append(level, message, meta = null) {
  const formattedMessage = formatMessage(message, meta);
  const line = `[${now()}] [${level}] ${formattedMessage}${meta ? " " + JSON.stringify(meta) : ""}\n`;
  process.stdout.write(line);
  fs.appendFileSync(logFile, line, "utf-8");
}

module.exports = {
  init,
  info: (message, meta) => append("INFO", message, meta),
  warn: (message, meta) => append("WARN", message, meta),
  error: (message, meta) => append("ERROR", message, meta)
};

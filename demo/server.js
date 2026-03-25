const express = require("express");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const app = express();
const PORT = Number(process.env.PORT || process.env.DEMO_PORT || 3000);
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(__dirname, "public");
const OUTPUT_DIR = path.join(ROOT, "output");

const SUMMARY_PATH = path.join(ROOT, "output/report/summary.json");
const RESULTS_PATH = path.join(ROOT, "output/results/results.json");
const REPORT_PATH = path.join(ROOT, "output/report/report.html");
const CSV_PATH = path.join(ROOT, "output/results/results.csv");
const RUN_CONTRACT_PATH = path.join(ROOT, "output/report/run-contract.json");

app.use(express.json());
app.use(express.static(PUBLIC_DIR));
app.use("/artifacts", express.static(OUTPUT_DIR));

let currentRun = null;
let clients = [];
let runLogs = [];
let titleStatuses = [];
let lastRunMeta = {
  startedAt: null,
  finishedAt: null,
  limit: null,
  pid: null,
  exitCode: null
};

function sseWrite(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function broadcast(event) {
  for (const res of clients) {
    sseWrite(res, event);
  }
}

function safeReadJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function safeReadText(filePath, fallback = "") {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return fallback;
  }
}

function extractImdbId(url) {
  const m = String(url || "").match(/tt\d+/);
  return m ? m[0] : "";
}

function toTitleStatus(url, index) {
  return {
    order: index + 1,
    titleRunId: null,
    url,
    imdbId: extractImdbId(url),
    movieTitle: "",
    state: "queued",
    castRowsDiscovered: 0,
    matchedCount: 0,
    passedCount: 0,
    failedCount: 0,
    warningCount: 0,
    lastEvent: "queued",
    lastUpdatedAt: null,
    screenshotPath: ""
  };
}

function getInputUrlCandidates() {
  return [
    path.join(ROOT, "input", "urls.txt"),
    path.join(ROOT, "input", "imdb-urls.txt"),
    path.join(ROOT, "input", "titles.txt"),
    path.join(ROOT, "data", "urls.txt"),
    path.join(ROOT, "data", "imdb-urls.txt"),
    path.join(ROOT, "urls.txt")
  ];
}

function readInputUrls() {
  for (const filePath of getInputUrlCandidates()) {
    if (!fs.existsSync(filePath)) continue;

    const urls = safeReadText(filePath)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && /^https?:\/\/www\.imdb\.com\/title\/tt\d+/i.test(line));

    if (urls.length > 0) return urls;
  }

  const results = safeReadJson(RESULTS_PATH, []);
  const uniqueUrls = [...new Set(
    (results || [])
      .map((row) => String(row.movieUrl || "").trim())
      .filter(Boolean)
  )];

  return uniqueUrls;
}

function resetRunState(limit) {
  runLogs = [];
  lastRunMeta = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    limit,
    pid: null,
    exitCode: null
  };

  const urls = readInputUrls();
  const effective = limit > 0 ? urls.slice(0, limit) : urls;
  titleStatuses = effective.map(toTitleStatus);
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function findTitleStatusByRunId(titleRunId) {
  return titleStatuses.find((item) => item.titleRunId === titleRunId) || null;
}

function findTitleStatusByUrl(url) {
  return titleStatuses.find((item) => item.url === url) || null;
}

function touchStatus(status, patch = {}) {
  Object.assign(status, patch, { lastUpdatedAt: new Date().toISOString() });
}

function applyLogEvent(line) {
  const text = String(line || "").trim();
  if (!text) return;

  const match = text.match(/^\[(?<ts>[^\]]+)\]\s+\[(?<level>[^\]]+)\]\s+(?:\[(?<run>T\d+)\]\s+)?(?<event>[A-Z_]+)\s*(?<json>\{.*\})?$/);
  if (!match || !match.groups) return;

  const titleRunId = match.groups.run || null;
  const eventName = match.groups.event || "";
  const payload = match.groups.json ? safeJsonParse(match.groups.json) : {};

  let status =
    (titleRunId && findTitleStatusByRunId(titleRunId)) ||
    (payload.url && findTitleStatusByUrl(payload.url)) ||
    (payload.movieUrl && findTitleStatusByUrl(payload.movieUrl)) ||
    null;

  if (!status && eventName === "PROCESSING_TITLE" && payload.url) {
    status = findTitleStatusByUrl(payload.url);
  }

  if (!status) return;

  if (titleRunId && !status.titleRunId) {
    status.titleRunId = titleRunId;
  }

  switch (eventName) {
    case "PROCESSING_TITLE":
      touchStatus(status, { state: "running", lastEvent: eventName });
      break;
    case "TITLE_PAGE_OPENED":
      touchStatus(status, {
        state: "title-opened",
        movieTitle: payload.movieTitle || status.movieTitle,
        lastEvent: eventName
      });
      break;
    case "CAST_SECTION_FOUND":
      touchStatus(status, {
        state: "cast-found",
        movieTitle: payload.movieTitle || status.movieTitle,
        screenshotPath: payload.screenshotPath || status.screenshotPath,
        lastEvent: eventName
      });
      break;
    case "CAST_ROWS_DISCOVERED":
      touchStatus(status, {
        state: "cast-rows-discovered",
        movieTitle: payload.movieTitle || status.movieTitle,
        castRowsDiscovered: Number(payload.count || 0),
        lastEvent: eventName
      });
      break;
    case "ROW_SELECTED":
      touchStatus(status, {
        state: "row-selected",
        movieTitle: payload.movieTitle || status.movieTitle,
        lastEvent: eventName
      });
      break;
    case "PROFILE_OPENED":
      touchStatus(status, {
        state: "profile-opened",
        movieTitle: payload.movieTitle || status.movieTitle,
        lastEvent: eventName
      });
      break;
    case "PROFILE_NAME_EXTRACTED":
      touchStatus(status, {
        state: "profile-name-extracted",
        movieTitle: payload.movieTitle || status.movieTitle,
        lastEvent: eventName
      });
      break;
    case "ROW_PROFILE_MATCH_RESULT":
      touchStatus(status, {
        state: "match-evaluated",
        movieTitle: payload.movieTitle || status.movieTitle,
        lastEvent: eventName
      });
      break;
    case "PERSON_FOUND":
      touchStatus(status, {
        state: "passed",
        movieTitle: payload.movieTitle || status.movieTitle,
        matchedCount: Number(status.matchedCount || 0) + (payload.matchStatus === "matched" ? 1 : 0),
        passedCount: Number(status.passedCount || 0) + (payload.status === "passed" ? 1 : 0),
        failedCount: Number(status.failedCount || 0) + (payload.status === "failed" ? 1 : 0),
        warningCount: Number(status.warningCount || 0) + (payload.status === "warning" ? 1 : 0),
        lastEvent: eventName
      });
      break;
    default:
      break;
  }
}

function finalizeStatusesFromResults() {
  const results = safeReadJson(RESULTS_PATH, []);
  const byUrl = new Map();

  for (const row of results) {
    const url = String(row.movieUrl || "").trim();
    if (!url) continue;
    if (!byUrl.has(url)) byUrl.set(url, []);
    byUrl.get(url).push(row);
  }

  for (const status of titleStatuses) {
    const rows = byUrl.get(status.url) || [];
    if (rows.length === 0) continue;

    const first = rows[0] || {};
    const passedCount = rows.filter((r) => r.status === "passed").length;
    const failedCount = rows.filter((r) => r.status === "failed").length;
    const warningCount = rows.filter((r) => r.status === "warning").length;
    const matchedCount = rows.filter((r) => r.matchStatus === "matched").length;

    touchStatus(status, {
      movieTitle: first.movieTitle || status.movieTitle,
      state: failedCount > 0 ? "failed" : "completed",
      castRowsDiscovered: rows.length,
      passedCount,
      failedCount,
      warningCount,
      matchedCount,
      lastEvent: "RESULTS_SYNCED"
    });
  }
}

app.get("/api/logs", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  clients.push(res);
  sseWrite(res, { type: "connected" });

  for (const line of runLogs.slice(-300)) {
    sseWrite(res, { type: "stdout", message: line });
  }

  req.on("close", () => {
    clients = clients.filter((client) => client !== res);
  });
});

app.get("/api/status", (req, res) => {
  res.json({
    running: !!currentRun,
    pid: currentRun?.pid || null,
    ...lastRunMeta
  });
});

app.get("/api/summary", (req, res) => {
  res.json(safeReadJson(SUMMARY_PATH, {}));
});

app.get("/api/results", (req, res) => {
  res.json(safeReadJson(RESULTS_PATH, []));
});

app.get("/api/run-contract", (req, res) => {
  res.json(safeReadJson(RUN_CONTRACT_PATH, {}));
});

app.get("/api/input-urls", (req, res) => {
  const urls = readInputUrls();
  res.json(urls.map((url, index) => ({
    order: index + 1,
    imdbId: extractImdbId(url),
    url
  })));
});

app.get("/api/title-statuses", (req, res) => {
  res.json(titleStatuses);
});

app.get("/report", (req, res) => {
  if (!fs.existsSync(REPORT_PATH)) {
    return res.status(404).send("Report not found");
  }
  return res.sendFile(REPORT_PATH);
});

app.get("/download/results.csv", (req, res) => {
  if (!fs.existsSync(CSV_PATH)) {
    return res.status(404).send("CSV not found");
  }
  return res.download(CSV_PATH);
});

app.get("/download/results.json", (req, res) => {
  if (!fs.existsSync(RESULTS_PATH)) {
    return res.status(404).send("JSON not found");
  }
  return res.download(RESULTS_PATH);
});

app.post("/api/run", (req, res) => {
  if (currentRun) {
    return res.status(409).json({ error: "Run already in progress" });
  }

  const requestedLimit = Number(req.body?.limit || 36);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.floor(requestedLimit) : 36;

  resetRunState(limit);

  const child = spawn("npm", ["run", "start:validated"], {
    cwd: ROOT,
    shell: true,
    env: {
      ...process.env,
      TITLE_LIMIT: String(limit)
    }
  });

  currentRun = child;
  lastRunMeta.pid = child.pid;

  broadcast({ type: "run-started", pid: child.pid, limit });

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    const lines = text.split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      runLogs.push(line);
      applyLogEvent(line);
      broadcast({ type: "stdout", message: line });
    }
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    const lines = text.split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      runLogs.push(line);
      broadcast({ type: "stderr", message: line });
    }
  });

  child.on("close", (code) => {
    lastRunMeta.finishedAt = new Date().toISOString();
    lastRunMeta.exitCode = code;
    finalizeStatusesFromResults();
    broadcast({ type: "run-finished", exitCode: code });
    currentRun = null;
  });

  return res.json({ started: true, pid: child.pid, limit });
});

app.listen(PORT, () => {
  console.log(`Demo server running at http://localhost:${PORT}`);
});

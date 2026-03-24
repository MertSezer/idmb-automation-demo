const express = require("express");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.DEMO_PORT || 3000;
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(__dirname, "public");

const SUMMARY_PATH = path.join(ROOT, "output/report/summary.json");
const RESULTS_PATH = path.join(ROOT, "output/results/results.json");
const REPORT_PATH = path.join(ROOT, "output/report/report.html");
const CSV_PATH = path.join(ROOT, "output/results/results.csv");
const RUN_CONTRACT_PATH = path.join(ROOT, "output/report/run-contract.json");

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

let currentRun = null;
let clients = [];

function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  clients.forEach((res) => res.write(payload));
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

app.get("/api/logs", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  clients.push(res);
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  req.on("close", () => {
    clients = clients.filter((client) => client !== res);
  });
});

app.get("/api/status", (req, res) => {
  res.json({
    running: !!currentRun,
    pid: currentRun?.pid || null,
  });
});

app.get("/api/summary", (req, res) => {
  res.json(safeReadJson(SUMMARY_PATH) || {});
});

app.get("/api/results", (req, res) => {
  res.json(safeReadJson(RESULTS_PATH) || []);
});

app.get("/api/run-contract", (req, res) => {
  res.json(safeReadJson(RUN_CONTRACT_PATH) || {});
});

app.get("/report", (req, res) => {
  if (!fs.existsSync(REPORT_PATH)) {
    return res.status(404).send("Report not found");
  }
  res.sendFile(REPORT_PATH);
});

app.get("/download/results.csv", (req, res) => {
  if (!fs.existsSync(CSV_PATH)) {
    return res.status(404).send("CSV not found");
  }
  res.download(CSV_PATH);
});

app.get("/download/results.json", (req, res) => {
  if (!fs.existsSync(RESULTS_PATH)) {
    return res.status(404).send("JSON not found");
  }
  res.download(RESULTS_PATH);
});

app.post("/api/run", (req, res) => {
  if (currentRun) {
    return res.status(409).json({ error: "Run already in progress" });
  }

  const child = spawn("npm", ["run", "start:validated"], {
    cwd: ROOT,
    shell: true,
    env: process.env,
  });

  currentRun = child;
  broadcast({ type: "run-started", pid: child.pid });

  child.stdout.on("data", (chunk) => {
    broadcast({ type: "stdout", message: chunk.toString() });
  });

  child.stderr.on("data", (chunk) => {
    broadcast({ type: "stderr", message: chunk.toString() });
  });

  child.on("close", (code) => {
    broadcast({ type: "run-finished", exitCode: code });
    currentRun = null;
  });

  res.json({ started: true, pid: child.pid });
});

app.listen(PORT, () => {
  console.log(`Demo server running at http://localhost:${PORT}`);
});

const runBtn = document.getElementById("runBtn");
const run1Btn = document.getElementById("run1Btn");
const run5Btn = document.getElementById("run5Btn");
const logBox = document.getElementById("log");
const summaryBox = document.getElementById("summary");
const statusBox = document.getElementById("status");
const resultsBox = document.getElementById("results");
const filterInput = document.getElementById("filterInput");

let allRows = [];
let inputUrls = [];
let titleStatuses = [];

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function appendLog(text) {
  if (!logBox) return;
  logBox.textContent += text;
  logBox.scrollTop = logBox.scrollHeight;
}

function artifactPathToUrl(filePath) {
  const raw = String(filePath || "");
  const marker = "/output/";
  const index = raw.indexOf(marker);
  if (index === -1) return "";
  const relative = raw.slice(index + marker.length);
  return `/artifacts/${relative}`.replaceAll("\\", "/");
}

function ensureLightbox() {
  if (document.getElementById("shotLightbox")) return;

  const wrap = document.createElement("div");
  wrap.id = "shotLightbox";
  wrap.style.cssText = [
    "display:none",
    "position:fixed",
    "inset:0",
    "background:rgba(0,0,0,0.82)",
    "z-index:9999",
    "padding:24px",
    "align-items:center",
    "justify-content:center",
    "flex-direction:column"
  ].join(";");

  wrap.innerHTML = `
    <button id="shotLightboxClose" style="
      position:absolute;
      top:18px;
      right:18px;
      min-height:40px;
      padding:0 12px;
      border-radius:10px;
      border:1px solid #445;
      background:#111a;
      color:#fff;
      cursor:pointer;
      font-weight:700;
    ">Close</button>
    <div id="shotLightboxLabel" style="
      color:#fff;
      margin-bottom:12px;
      font-weight:700;
      font-size:14px;
    "></div>
    <img id="shotLightboxImg" src="" alt="" style="
      max-width:95vw;
      max-height:85vh;
      border-radius:14px;
      box-shadow:0 20px 60px rgba(0,0,0,0.45);
      background:#111;
    ">
  `;

  document.body.appendChild(wrap);

  wrap.addEventListener("click", (e) => {
    if (e.target === wrap || e.target.id === "shotLightboxClose") {
      wrap.style.display = "none";
    }
  });
}

function openShotPreview(label, url) {
  ensureLightbox();
  const wrap = document.getElementById("shotLightbox");
  const img = document.getElementById("shotLightboxImg");
  const text = document.getElementById("shotLightboxLabel");
  if (!wrap || !img || !text) return;

  text.textContent = label || "Screenshot Preview";
  img.src = url || "";
  wrap.style.display = "flex";
}

function shotThumb(label, path) {
  const url = artifactPathToUrl(path);
  if (!url) return "";

  return `
    <div style="display:inline-flex;flex-direction:column;align-items:center;gap:6px;margin-right:8px;margin-bottom:8px;">
      <button
        type="button"
        onclick="openShotPreview(${JSON.stringify(label)}, ${JSON.stringify(url)})"
        style="
          border:1px solid #2a3558;
          background:rgba(255,255,255,0.04);
          border-radius:10px;
          padding:4px;
          cursor:pointer;
        "
        title="${escapeHtml(label)}"
      >
        <img
          src="${escapeHtml(url)}"
          alt="${escapeHtml(label)}"
          style="width:64px;height:64px;object-fit:cover;border-radius:8px;display:block;"
        >
      </button>
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="font-size:12px;">
        ${escapeHtml(label)}
      </a>
    </div>
  `;
}

function renderStatus(data) {
  if (!statusBox) return;

  const running = !!data?.running;
  const pid = data?.pid || "-";
  const limit = data?.limit || "-";
  const exitCode = data?.exitCode ?? "-";

  statusBox.innerHTML = `
    <div><strong>Status:</strong> ${running ? '<span class="warn">Running</span>' : '<span class="ok">Ready</span>'}</div>
    <div><strong>PID:</strong> ${escapeHtml(pid)}</div>
    <div><strong>Limit:</strong> ${escapeHtml(limit)}</div>
    <div><strong>Exit Code:</strong> ${escapeHtml(exitCode)}</div>
  `;

  if (runBtn) runBtn.disabled = running;
  if (run1Btn) run1Btn.disabled = running;
  if (run5Btn) run5Btn.disabled = running;
}

function metricCard(label, value, tone = "") {
  return `
    <div style="
      border:1px solid #2a3558;
      border-radius:14px;
      padding:14px;
      background:rgba(255,255,255,0.03);
      min-height:88px;
    ">
      <div style="font-size:12px;color:#aeb8d0;margin-bottom:8px;">${escapeHtml(label)}</div>
      <div class="${tone}" style="font-size:24px;font-weight:800;letter-spacing:-0.02em;">
        ${escapeHtml(value)}
      </div>
    </div>
  `;
}

function renderSummary(data) {
  if (!summaryBox) return;

  const d = data || {};
  const verdictTone =
    d.runVerdict === "SUCCESS" ? "ok" :
    d.runVerdict ? "warn" : "";

  summaryBox.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
      ${metricCard("Titles Processed", d.titlesProcessed ?? "-")}
      ${metricCard("Total Rows", d.totalRows ?? "-")}
      ${metricCard("Matched", d.matchedCount ?? "-")}
      ${metricCard("Passed", d.passedCount ?? "-")}
      ${metricCard("Warnings", d.warningCount ?? "-")}
      ${metricCard("Screenshots", d.evidenceScreenshotCount ?? "-")}
      ${metricCard("Duration (s)", d.runDurationSeconds ?? "-")}
      ${metricCard("Verdict", d.runVerdict ?? "-", verdictTone)}
    </div>
    <details style="margin-top:14px;">
      <summary style="cursor:pointer;color:#9fc0ff;">Show raw summary JSON</summary>
      <pre style="
        margin-top:10px;
        border:1px solid #2a3558;
        border-radius:12px;
        background:rgba(255,255,255,0.025);
        padding:12px;
        overflow:auto;
        white-space:pre-wrap;
      ">${escapeHtml(JSON.stringify(d, null, 2))}</pre>
    </details>
  `;
}

function getBadgeClass(state) {
  switch (state) {
    case "completed":
    case "passed":
      return "ok";
    case "running":
    case "title-opened":
    case "cast-found":
    case "cast-rows-discovered":
    case "row-selected":
    case "profile-opened":
    case "profile-name-extracted":
    case "match-evaluated":
      return "warn";
    case "failed":
      return "err";
    default:
      return "";
  }
}

function renderInputTitles() {
  const container = document.getElementById("inputTitles");
  if (!container) return;

  const byUrl = new Map(titleStatuses.map((item) => [item.url, item]));
  const rows = inputUrls.map((item) => {
    const status = byUrl.get(item.url) || {};
    const state = status.state || "queued";
    const movieTitle = status.movieTitle || "-";

    const rowStyle =
      state === "running" ? 'background:rgba(255,215,106,0.12);' :
      state === "completed" || state === "passed" ? 'background:rgba(142,240,179,0.10);' :
      state === "failed" ? 'background:rgba(255,146,170,0.10);' :
      "";

    return `
      <tr style="${rowStyle}">
        <td>${item.order}</td>
        <td>${escapeHtml(item.imdbId)}</td>
        <td style="max-width:420px;word-break:break-all;">
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.url)}</a>
        </td>
        <td>${escapeHtml(movieTitle)}</td>
        <td><span class="${getBadgeClass(state)}">${escapeHtml(state)}</span></td>
        <td>${escapeHtml(status.castRowsDiscovered || 0)}</td>
        <td>${escapeHtml(status.matchedCount || 0)}</td>
        <td>${escapeHtml(status.passedCount || 0)}</td>
        <td>${escapeHtml(status.failedCount || 0)}</td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <div style="margin-bottom:8px;"><strong>Input Titles:</strong> ${inputUrls.length}</div>
    <div style="overflow:auto;">
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;background:#fff;">
        <thead>
          <tr>
            <th>#</th>
            <th>IMDb ID</th>
            <th>URL</th>
            <th>Movie Title</th>
            <th>State</th>
            <th>Rows</th>
            <th>Matched</th>
            <th>Passed</th>
            <th>Failed</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="9">No input titles found</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function screenshotLinks(row) {
  const items = [
    { label: "Title", path: row.titleScreenshotPath },
    { label: "Cast", path: row.castSectionScreenshotPath },
    { label: "Row", path: row.rowScreenshotPath },
    { label: "Profile", path: row.profileScreenshotPath }
  ];

  return items
    .filter((item) => item.path)
    .map((item) => shotThumb(item.label, item.path))
    .filter(Boolean)
    .join("");
}

function renderResults(rows) {
  if (!resultsBox) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    resultsBox.innerHTML = "No results yet.";
    return;
  }

  const q = (filterInput?.value || "").toLowerCase().trim();

  const filtered = rows.filter((row) => {
    if (!q) return true;

    return [
      row.movieTitle,
      row.listedFullName,
      row.profileFullName,
      row.characterName,
      row.matchStatus,
      row.status,
      row.profileUrl
    ]
      .map((x) => String(x || "").toLowerCase())
      .some((x) => x.includes(q));
  });

  const html = `
    <div style="margin-bottom:8px;"><strong>Total:</strong> ${filtered.length} records</div>
    <div style="overflow:auto;">
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;background:#fff;">
        <thead>
          <tr>
            <th>Film</th>
            <th>Row</th>
            <th>Listed Name</th>
            <th>Profile Name</th>
            <th>Character</th>
            <th>Match</th>
            <th>Status</th>
            <th>Profile URL</th>
            <th>Screenshots</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((row) => `
            <tr>
              <td>${escapeHtml(row.movieTitle || "")}</td>
              <td>${escapeHtml(row.rowIndex || "")}</td>
              <td>${escapeHtml(row.listedFullName || "")}</td>
              <td>${escapeHtml(row.profileFullName || "")}</td>
              <td>${escapeHtml(row.characterName || "-")}</td>
              <td>${escapeHtml(row.matchStatus || "")}</td>
              <td>${escapeHtml(row.status || "")}</td>
              <td>${row.profileUrl ? `<a href="${escapeHtml(row.profileUrl)}" target="_blank" rel="noopener noreferrer">open</a>` : "-"}</td>
              <td>${screenshotLinks(row) || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  resultsBox.innerHTML = html;
}

async function loadStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    renderStatus(data);
  } catch {
    if (statusBox) statusBox.textContent = "Failed to load status.";
  }
}

async function loadSummary() {
  try {
    const res = await fetch("/api/summary");
    const data = await res.json();
    renderSummary(data);
  } catch {
    if (summaryBox) summaryBox.textContent = "Failed to load summary.";
  }
}

async function loadResults() {
  try {
    const res = await fetch("/api/results");
    const data = await res.json();
    allRows = Array.isArray(data) ? data : [];
    renderResults(allRows);
  } catch {
    if (resultsBox) resultsBox.textContent = "Failed to load results.";
  }
}

async function loadInputUrls() {
  const container = document.getElementById("inputTitles");
  try {
    const res = await fetch("/api/input-urls");
    const data = await res.json();
    inputUrls = Array.isArray(data) ? data : [];
    renderInputTitles();
  } catch {
    if (container) container.textContent = "Failed to load input title list.";
  }
}

async function loadTitleStatuses() {
  try {
    const res = await fetch("/api/title-statuses");
    const data = await res.json();
    titleStatuses = Array.isArray(data) ? data : [];
    renderInputTitles();
  } catch {
    // ignore
  }
}

async function runWithLimit(limit) {
  try {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit })
    });

    const data = await res.json();

    if (!res.ok) {
      appendLog(`[UI] Error: ${data.error || "Run failed to start"}\n`);
      return;
    }

    appendLog(`[UI] Run started. PID=${data.pid}, TITLE_LIMIT=${data.limit}\n`);
    await loadStatus();
    await loadTitleStatuses();
  } catch (err) {
    appendLog(`[UI] Run error: ${err.message || "Unknown error"}\n`);
  }
}

if (runBtn) runBtn.onclick = () => runWithLimit(36);
if (run1Btn) run1Btn.onclick = () => runWithLimit(1);
if (run5Btn) run5Btn.onclick = () => runWithLimit(5);
if (filterInput) filterInput.addEventListener("input", () => renderResults(allRows));

const events = new EventSource("/api/logs");

events.onmessage = async (event) => {
  try {
    const data = JSON.parse(event.data);

    if (data.type === "connected") {
      appendLog("[UI] Log connected\n");
      return;
    }

    if (data.type === "stdout" || data.type === "stderr") {
      appendLog(`${data.message}\n`);
      await loadTitleStatuses();
      return;
    }

    if (data.type === "run-started") {
      appendLog(`[UI] Run started. PID=${data.pid}, limit=${data.limit}\n`);
      await loadStatus();
      await loadTitleStatuses();
      return;
    }

    if (data.type === "run-finished") {
      appendLog(`[UI] Run finished. Exit code=${data.exitCode}\n`);
      await loadStatus();
      await loadSummary();
      await loadResults();
      await loadTitleStatuses();
    }
  } catch {
    appendLog(`${event.data}\n`);
  }
};

(async function init() {
  ensureLightbox();
  window.openShotPreview = openShotPreview;

  await loadInputUrls();
  await loadTitleStatuses();
  await loadStatus();
  await loadSummary();
  await loadResults();

  setInterval(loadStatus, 3000);
  setInterval(loadSummary, 5000);
  setInterval(loadResults, 5000);
  setInterval(loadTitleStatuses, 3000);
})();
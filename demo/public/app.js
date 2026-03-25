const runBtn = document.getElementById("runBtn");
const run1Btn = document.getElementById("run1Btn");
const run5Btn = document.getElementById("run5Btn");
const logBox = document.getElementById("log");
const summaryBox = document.getElementById("summary");
const statusBox = document.getElementById("status");
const resultsBox = document.getElementById("results");
const filterInput = document.getElementById("filterInput");

let allRows = [];

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toArtifactUrl(filePath) {
  const marker = "/output/";
  const idx = String(filePath || "").indexOf(marker);
  if (idx === -1) return "";
  return "/artifacts/" + String(filePath).slice(idx + marker.length);
}

function appendLog(text) {
  if (!logBox) return;
  logBox.textContent += text;
  logBox.scrollTop = logBox.scrollHeight;
}

function renderStatus(data) {
  if (!statusBox) return;

  statusBox.innerHTML = data.running
    ? `<span class="warn">Çalışıyor</span> (PID: ${escapeHtml(data.pid)})`
    : `<span class="ok">Hazır</span>`;

  if (runBtn) runBtn.disabled = !!data.running;
  if (run1Btn) run1Btn.disabled = !!data.running;
  if (run5Btn) run5Btn.disabled = !!data.running;
}

function renderSummary(data) {
  if (!summaryBox) return;
  summaryBox.textContent = JSON.stringify(data || {}, null, 2);
}

function screenshotLinks(row) {
  const links = [
    ["Title", toArtifactUrl(row.titleScreenshotPath)],
    ["Cast", toArtifactUrl(row.castSectionScreenshotPath)],
    ["Row", toArtifactUrl(row.rowScreenshotPath)],
    ["Profile", toArtifactUrl(row.profileScreenshotPath)]
  ].filter(([, url]) => url);

  if (!links.length) return "-";

  return links
    .map(([label, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`)
    .join(" | ");
}

function renderResults(rows) {
  if (!resultsBox) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    resultsBox.innerHTML = "Henüz veri yok.";
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

  const topRows = filtered.slice(0, 25);

  const html = `
    <div style="margin-bottom:10px;">
      Toplam: <strong>${filtered.length}</strong> kayıt
      ${filtered.length > topRows.length ? `(ilk ${topRows.length} gösteriliyor)` : ""}
    </div>
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
        ${topRows.map((row) => `
          <tr>
            <td>${escapeHtml(row.movieTitle || "")}</td>
            <td>${escapeHtml(row.rowIndex || "")}</td>
            <td>${escapeHtml(row.listedFullName || "")}</td>
            <td>${escapeHtml(row.profileFullName || "")}</td>
            <td>${escapeHtml(row.characterName || "-")}</td>
            <td>${escapeHtml(row.matchStatus || "")}</td>
            <td>${escapeHtml(row.status || "")}</td>
            <td>
              ${row.profileUrl ? `<a href="${escapeHtml(row.profileUrl)}" target="_blank" rel="noopener noreferrer">open</a>` : "-"}
            </td>
            <td>${screenshotLinks(row)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  resultsBox.innerHTML = html;
}

async function loadSummary() {
  try {
    const res = await fetch("/api/summary");
    const data = await res.json();
    renderSummary(data);
  } catch {
    if (summaryBox) summaryBox.textContent = "Özet yüklenemedi.";
  }
}

async function loadResults() {
  try {
    const res = await fetch("/api/results");
    const data = await res.json();
    allRows = Array.isArray(data) ? data : [];
    renderResults(allRows);
  } catch {
    if (resultsBox) resultsBox.textContent = "Sonuçlar yüklenemedi.";
  }
}

async function loadStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    renderStatus(data);
  } catch {
    if (statusBox) statusBox.textContent = "Durum alınamadı.";
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
      appendLog(`[UI] Hata: ${data.error || "Bilinmeyen hata"}\n`);
      return;
    }

    appendLog(`[UI] Run started with TITLE_LIMIT=${limit}, PID=${data.pid}\n`);
    loadStatus();
  } catch (err) {
    appendLog(`[UI] Run error: ${err.message || "Bilinmeyen hata"}\n`);
  }
}

if (runBtn) runBtn.onclick = () => runWithLimit(36);
if (run1Btn) run1Btn.onclick = () => runWithLimit(1);
if (run5Btn) run5Btn.onclick = () => runWithLimit(5);
if (filterInput) filterInput.addEventListener("input", () => renderResults(allRows));

const evt = new EventSource("/api/logs");
evt.onmessage = async (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "connected") {
    appendLog("[UI] Log stream connected\n");
    return;
  }

  if (data.type === "stdout" || data.type === "stderr") {
    appendLog(data.message);
    return;
  }

  if (data.type === "run-started") {
    appendLog(`[UI] Run started. PID=${data.pid}, LIMIT=${data.limit}\n`);
    await loadStatus();
    return;
  }

  if (data.type === "run-finished") {
    appendLog(`[UI] Run finished. Exit code=${data.exitCode}\n`);
    await loadStatus();
    await loadSummary();
    await loadResults();
  }
};

loadStatus();
loadSummary();
loadResults();
setInterval(loadStatus, 3000);
setInterval(loadSummary, 5000);
setInterval(loadResults, 5000);

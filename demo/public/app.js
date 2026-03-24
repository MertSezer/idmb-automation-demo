const runBtn = document.getElementById("runBtn");
const run1Btn = document.getElementById("run1Btn");
const run5Btn = document.getElementById("run5Btn");
const logBox = document.getElementById("log");
const summaryBox = document.getElementById("summary");
const statusBox = document.getElementById("status");
const resultsBox = document.getElementById("results");
const filterInput = document.getElementById("filterInput");

let allRows = [];

function appendLog(text) {
  logBox.textContent += text;
  logBox.scrollTop = logBox.scrollHeight;
}

function renderStatus(data) {
  statusBox.innerHTML = data.running
    ? `<span class="warn">Çalışıyor</span> (PID: ${data.pid})`
    : `<span class="ok">Hazır</span>`;
  runBtn.disabled = !!data.running;
  if (run1Btn) run1Btn.disabled = !!data.running;
  if (run5Btn) run5Btn.disabled = !!data.running;
}

function renderSummary(data) {
  summaryBox.textContent = JSON.stringify(data || {}, null, 2);
}

function renderResults(rows) {
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
      row.status
    ]
      .map((x) => String(x || "").toLowerCase())
      .some((x) => x.includes(q));
  });

  const topRows = filtered.slice(0, 15);

  const html = `
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
        </tr>
      </thead>
      <tbody>
        ${topRows.map((row) => `
          <tr>
            <td>${row.movieTitle || ""}</td>
            <td>${row.rowIndex || ""}</td>
            <td>${row.listedFullName || ""}</td>
            <td>${row.profileFullName || ""}</td>
            <td>${row.characterName || "-"}</td>
            <td>${row.matchStatus || ""}</td>
            <td>${row.status || ""}</td>
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
    summaryBox.textContent = "Özet yüklenemedi.";
  }
}

async function loadResults() {
  try {
    const res = await fetch("/api/results");
    const data = await res.json();
    allRows = Array.isArray(data) ? data : [];
    renderResults(allRows);
  } catch {
    resultsBox.textContent = "Sonuçlar yüklenemedi.";
  }
}

async function loadStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    renderStatus(data);
  } catch {
    statusBox.textContent = "Durum alınamadı.";
  }
}

function runWithLimit(limit) {
  fetch("/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit })
  }).then(() => {
    appendLog(`Run started with TITLE_LIMIT=${limit}\n`);
    loadStatus();
  }).catch((err) => {
    appendLog(`Run error: ${err.message || "Bilinmeyen hata"}\n`);
  });
}

if (runBtn) runBtn.onclick = () => runWithLimit(36);
if (run1Btn) run1Btn.onclick = () => runWithLimit(1);
if (run5Btn) run5Btn.onclick = () => runWithLimit(5);
if (filterInput) filterInput.addEventListener("input", () => renderResults(allRows));

const evt = new EventSource("/events");
evt.onmessage = (event) => appendLog(event.data + "\n");

loadStatus();
loadSummary();
loadResults();
setInterval(loadStatus, 3000);
setInterval(loadSummary, 5000);
setInterval(loadResults, 5000);

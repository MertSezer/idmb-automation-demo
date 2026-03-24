const runBtn = document.getElementById("runBtn");
const logBox = document.getElementById("log");
const summaryBox = document.getElementById("summary");
const statusBox = document.getElementById("status");
const resultsBox = document.getElementById("results");

function appendLog(text) {
  logBox.textContent += text;
  logBox.scrollTop = logBox.scrollHeight;
}

function renderStatus(data) {
  statusBox.innerHTML = data.running
    ? `<span class="warn">Çalışıyor</span> (PID: ${data.pid})`
    : `<span class="ok">Hazır</span>`;
  runBtn.disabled = !!data.running;
}

function renderResults(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    resultsBox.textContent = "Henüz veri yok.";
    return;
  }

  const sample = rows.slice(0, 15);

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  thead.innerHTML = `
    <tr>
      <th>Film</th>
      <th>Row</th>
      <th>Listed Name</th>
      <th>Profile Name</th>
      <th>Match</th>
      <th>Status</th>
    </tr>
  `;
  table.appendChild(thead);

  for (const row of sample) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.movieTitle || ""}</td>
      <td>${row.rowIndex || ""}</td>
      <td>${row.listedFullName || ""}</td>
      <td>${row.profileFullName || ""}</td>
      <td>${row.matchStatus || ""}</td>
      <td>${row.status || ""}</td>
    `;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  resultsBox.innerHTML = "";
  resultsBox.appendChild(table);
}

async function loadStatus() {
  const res = await fetch("/api/status");
  const data = await res.json();
  renderStatus(data);
}

async function loadSummary() {
  const res = await fetch("/api/summary");
  const data = await res.json();
  summaryBox.textContent = JSON.stringify(data, null, 2);
}

async function loadResults() {
  const res = await fetch("/api/results");
  const data = await res.json();
  renderResults(data);
}

const events = new EventSource("/api/logs");

events.onmessage = async (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "stdout" || data.type === "stderr") {
    appendLog(data.message);
  }

  if (data.type === "run-started") {
    appendLog(`\n[UI] Run started. PID: ${data.pid}\n`);
    await loadStatus();
  }

  if (data.type === "run-finished") {
    appendLog(`\n[UI] Run finished. Exit code: ${data.exitCode}\n`);
    await loadStatus();
    await loadSummary();
    await loadResults();
  }
};

runBtn.addEventListener("click", async () => {
  appendLog("\n[UI] Demo başlatılıyor...\n");

  const res = await fetch("/api/run", { method: "POST" });
  const data = await res.json();

  if (!res.ok) {
    appendLog(`[UI] Hata: ${data.error || "Bilinmeyen hata"}\n`);
    return;
  }

  appendLog(`[UI] PID: ${data.pid}\n`);
  await loadStatus();
});

(async function init() {
  await loadStatus();
  await loadSummary();
  await loadResults();
})();


document.getElementById("run1Btn").onclick = () => runWithLimit(1);
document.getElementById("run5Btn").onclick = () => runWithLimit(5);

function runWithLimit(limit) {
  fetch("/run", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ limit })
  });
}

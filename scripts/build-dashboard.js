#!/usr/bin/env node

/**
 * Dashboard builder for IMDb Automation Demo.
 *
 * Reads:
 * - output/report/summary.json
 * - output/results/results.json
 *
 * Produces:
 * - output/report/dashboard.html
 * - output/report/report.html (enhanced overwrite for convenience)
 *
 * No external dependencies required.
 */

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const summaryPath = path.join(root, "output", "report", "summary.json");
const resultsPath = path.join(root, "output", "results", "results.json");
const dashboardPath = path.join(root, "output", "report", "dashboard.html");
const reportPath = path.join(root, "output", "report", "report.html");

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function aggregateByTitle(results) {
  const map = new Map();

  for (const row of results) {
    const key = row.movieTitle || row.movieUrl || "Unknown";
    if (!map.has(key)) {
      map.set(key, {
        movieTitle: row.movieTitle || "Unknown",
        movieUrl: row.movieUrl || "",
        total: 0,
        passed: 0,
        warning: 0,
        blocked: 0,
        matched: 0,
        fixtureBacked: 0
      });
    }

    const entry = map.get(key);
    entry.total += 1;

    if (row.status === "passed") entry.passed += 1;
    if (row.status === "warning") entry.warning += 1;
    if (row.matchStatus === "blocked") entry.blocked += 1;
    if (row.matchStatus === "matched") entry.matched += 1;
    if (row.sourcePage === "fixture") entry.fixtureBacked += 1;
  }

  return Array.from(map.values()).sort((a, b) =>
    a.movieTitle.localeCompare(b.movieTitle)
  );
}

function aggregateErrors(results) {
  const counts = new Map();

  for (const row of results) {
    const key = row.errorMessage || "NONE";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function aggregateTopBlockedTitles(rows, limit = 8) {
  return [...rows]
    .sort((a, b) => {
      if (b.blocked !== a.blocked) return b.blocked - a.blocked;
      return a.movieTitle.localeCompare(b.movieTitle);
    })
    .slice(0, limit);
}

function aggregateTopPeople(results, limit = 15) {
  return results
    .map((row) => ({
      fullName: row.fullName || row.listedFullName || "Unknown",
      movieTitle: row.movieTitle || "Unknown",
      status: row.status || "",
      matchStatus: row.matchStatus || "",
      sourcePage: row.sourcePage || "",
      profileUrl: row.profileUrl || ""
    }))
    .slice(0, limit);
}

function buildMetricCard(label, value, tone = "neutral") {
  return `
    <div class="card metric ${tone}">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function buildBar(label, value, total) {
  const safeTotal = total > 0 ? total : 1;
  const percent = Math.max(0, Math.min(100, (value / safeTotal) * 100));
  return `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(label)}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${percent.toFixed(2)}%"></div>
      </div>
      <div class="bar-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function buildBadge(value, kind = "neutral") {
  return `<span class="badge badge-${escapeHtml(kind)}">${escapeHtml(value)}</span>`;
}

function buildTitleTable(rows) {
  const body = rows
    .map((row) => {
      const dominant =
        row.blocked > 0 ? buildBadge("blocked", "bad")
        : row.passed > 0 ? buildBadge("passed", "good")
        : buildBadge("mixed", "warn");

      const searchText = [
        row.movieTitle,
        row.total,
        row.passed,
        row.warning,
        row.blocked,
        row.matched,
        row.fixtureBacked
      ].join(" ").toLowerCase();

      return `
      <tr data-search="${escapeHtml(searchText)}">
        <td>${escapeHtml(row.movieTitle)}<div class="cell-sub">${dominant}</div></td>
        <td>${row.movieUrl ? `<a href="${escapeHtml(row.movieUrl)}" target="_blank" rel="noreferrer">open</a>` : "-"}</td>
        <td>${row.total}</td>
        <td>${row.passed}</td>
        <td>${row.warning}</td>
        <td>${row.blocked}</td>
        <td>${row.matched}</td>
        <td>${row.fixtureBacked}</td>
      </tr>
    `;
    })
    .join("");

  return `
    <table id="title-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>IMDb</th>
          <th>Total Rows</th>
          <th>Passed</th>
          <th>Warnings</th>
          <th>Blocked</th>
          <th>Matched</th>
          <th>Fixture-backed</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function buildErrorTable(rows) {
  const body = rows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${row.count}</td>
      </tr>
    `
    )
    .join("");

  return `
    <table>
      <thead>
        <tr>
          <th>Error / Cause</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function buildSampleTable(rows) {
  const body = rows
    .map((row) => {
      const statusBadge =
        row.status === "passed" ? buildBadge(row.status, "good")
        : row.status === "warning" ? buildBadge(row.status, "warn")
        : buildBadge(row.status || "-", "neutral");

      const matchBadge =
        row.matchStatus === "matched" ? buildBadge(row.matchStatus, "good")
        : row.matchStatus === "blocked" ? buildBadge(row.matchStatus, "bad")
        : buildBadge(row.matchStatus || "-", "neutral");

      const sourceBadge =
        row.sourcePage === "fixture" ? buildBadge("fixture", "warn")
        : buildBadge(row.sourcePage || "-", "neutral");

      return `
      <tr>
        <td>${escapeHtml(row.fullName)}</td>
        <td>${escapeHtml(row.movieTitle)}</td>
        <td>${statusBadge}</td>
        <td>${matchBadge}</td>
        <td>${sourceBadge}</td>
        <td>${row.profileUrl ? `<a href="${escapeHtml(row.profileUrl)}" target="_blank" rel="noreferrer">profile</a>` : "-"}</td>
      </tr>
    `;
    })
    .join("");

  return `
    <table>
      <thead>
        <tr>
          <th>Person</th>
          <th>Title</th>
          <th>Status</th>
          <th>Match</th>
          <th>Source</th>
          <th>Profile</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function render(summary, results) {
  const titleRows = aggregateByTitle(results);
  const errorRows = aggregateErrors(results);
  const topBlockedTitles = aggregateTopBlockedTitles(titleRows, 8);
  const sampleRows = aggregateTopPeople(results, 20);

  const totalRows = Number(summary.totalRows || 0);
  const blocked = Number(summary.profileBlocked || 0);
  const matched = Number(summary.matchedCount || 0);
  const warnings = Number(summary.warningCount || 0);
  const passed = Number(summary.passedCount || 0);
  const fixtureBacked = results.filter((r) => r.sourcePage === "fixture").length;

  const blockedPct = totalRows ? ((blocked / totalRows) * 100).toFixed(1) : "0.0";
  const matchedPct = totalRows ? ((matched / totalRows) * 100).toFixed(1) : "0.0";
  const passedPct = totalRows ? ((passed / totalRows) * 100).toFixed(1) : "0.0";
  const fixturePct = totalRows ? ((fixtureBacked / totalRows) * 100).toFixed(1) : "0.0";
  const liveCount = totalRows - fixtureBacked;
  const livePct = totalRows ? ((liveCount / totalRows) * 100).toFixed(1) : "0.0";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>IMDb Automation Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      --bg: #0b1020;
      --panel: #121933;
      --panel-2: #182244;
      --text: #eef3ff;
      --muted: #a9b5d1;
      --line: #28345f;
      --good: #1f9d55;
      --warn: #d97706;
      --bad: #dc2626;
      --accent: #4f46e5;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: linear-gradient(180deg, #0b1020 0%, #111933 100%);
      color: var(--text);
    }

    .wrap {
      max-width: 1400px;
      margin: 0 auto;
      padding: 24px;
    }

    h1, h2, h3 {
      margin: 0 0 12px;
    }

    p, li {
      color: var(--muted);
      line-height: 1.5;
    }

    .hero {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
    }

    .hero-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
    }

    .section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(180px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }

    .card {
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 16px;
    }

    .metric-label {
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 8px;
    }

    .metric-value {
      font-size: 28px;
      font-weight: 700;
    }

    .metric.good .metric-value { color: #7ef0aa; }
    .metric.warn .metric-value { color: #ffcb70; }
    .metric.bad .metric-value { color: #ff8e8e; }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .bar-row {
      display: grid;
      grid-template-columns: 140px 1fr 60px;
      gap: 12px;
      align-items: center;
      margin-bottom: 12px;
    }

    .bar-label, .bar-value {
      color: var(--muted);
      font-size: 14px;
    }

    .bar-track {
      height: 12px;
      background: #0f1630;
      border: 1px solid var(--line);
      border-radius: 999px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent), #8b5cf6);
    }

    .pill {
      display: inline-block;
      padding: 8px 12px;
      border-radius: 999px;
      background: #1b244a;
      border: 1px solid var(--line);
      color: var(--text);
      margin-right: 8px;
      margin-bottom: 8px;
      font-size: 13px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }

    th {
      color: var(--muted);
      font-weight: 600;
    }

    tr:hover td {
      background: rgba(255,255,255,0.02);
    }

    a {
      color: #9db4ff;
      text-decoration: none;
    }

    .muted {
      color: var(--muted);
    }

    .footer {
      color: var(--muted);
      text-align: center;
      font-size: 13px;
      padding: 12px 0 32px;
    }

    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid var(--line);
    }

    .badge-good {
      background: rgba(31, 157, 85, 0.18);
      color: #9af5be;
    }

    .badge-warn {
      background: rgba(217, 119, 6, 0.18);
      color: #ffd48c;
    }

    .badge-bad {
      background: rgba(220, 38, 38, 0.18);
      color: #ffaaaa;
    }

    .badge-neutral {
      background: rgba(79, 70, 229, 0.18);
      color: #c7c4ff;
    }

    .cell-sub {
      margin-top: 6px;
    }

    .toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      margin: 12px 0 16px;
      flex-wrap: wrap;
    }

    .search-input {
      width: 100%;
      max-width: 360px;
      background: #0f1630;
      color: var(--text);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
      outline: none;
    }

    .mini-list {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }

    .mini-item {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px 14px;
    }

    .mini-item strong {
      display: block;
      margin-bottom: 4px;
    }

    @media (max-width: 1000px) {
      .hero-grid, .grid-2, .metrics {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div class="hero-grid">
        <div>
          <h1>IMDb Automation Dashboard</h1>
          <p>
            End-to-end Playwright automation run summary with validation outcome,
            per-title distribution, error breakdown, and sample extracted rows.
          </p>
          <div>
            <span class="pill">Validation: ${escapeHtml(summary.runVerdict || summary.validationStatus || "-")}</span>
            <span class="pill">Extraction: ${escapeHtml(summary.extractionStatus || "-")}</span>
            <span class="pill">Report: ${escapeHtml(summary.reportStatus || "-")}</span>
          </div>
        </div>
        <div class="card">
          <h3>Run Snapshot</h3>
          <p><strong>Generated:</strong> ${escapeHtml(fmt(summary.generatedAt))}</p>
          <p><strong>Titles Processed:</strong> ${escapeHtml(fmt(summary.titlesProcessed))}</p>
          <p><strong>Total Rows:</strong> ${escapeHtml(fmt(summary.totalRows))}</p>
          <p><strong>Duration:</strong> ${escapeHtml(fmt(summary.runDurationSeconds))} sec</p>
          <p><strong>Root Cause:</strong> ${escapeHtml(fmt(summary.rootCause))}</p>
        </div>
      </div>

      <div class="metrics">
        ${buildMetricCard("Titles Processed", summary.titlesProcessed, "neutral")}
        ${buildMetricCard("Unique People", summary.uniquePeople, "neutral")}
        ${buildMetricCard("Passed", summary.passedCount, "good")}
        ${buildMetricCard("Warnings", summary.warningCount, "warn")}
        ${buildMetricCard("Blocked", summary.profileBlocked, "bad")}
        ${buildMetricCard("Matched", summary.matchedCount, "good")}
        ${buildMetricCard("Live Rows", liveCount, "neutral")}
        ${buildMetricCard("Fixture Rows", fixtureBacked, "warn")}
        ${buildMetricCard("Screenshots", summary.evidenceScreenshotCount, "neutral")}
        ${buildMetricCard("Debug Evidence", summary.debugEvidenceCount, "neutral")}
      </div>
    </section>

    <section class="section grid-2">
      <div>
        <h2>Outcome Distribution</h2>
        ${buildBar(`Blocked (${blockedPct}%)`, blocked, totalRows)}
        ${buildBar(`Matched (${matchedPct}%)`, matched, totalRows)}
        ${buildBar(`Passed (${passedPct}%)`, passed, totalRows)}
        ${buildBar("Warnings", warnings, totalRows)}
        ${buildBar(`Fixture-backed (${fixturePct}%)`, fixtureBacked, totalRows)}
        ${buildBar(`Live rows (${livePct}%)`, liveCount, totalRows)}
      </div>
      <div>
        <h2>Top Blocked Titles</h2>
        <div class="mini-list">
          ${topBlockedTitles.map((row) => `
            <div class="mini-item">
              <div>
                <strong>${escapeHtml(row.movieTitle)}</strong>
                <div class="muted">Total: ${row.total} · Matched: ${row.matched} · Fixture: ${row.fixtureBacked}</div>
              </div>
              <div>${buildBadge(`${row.blocked} blocked`, "bad")}</div>
            </div>
          `).join("")}
        </div>
      </div>
    </section>

    <section class="section">
      <h2>Per-Title Breakdown</h2>
      <div class="toolbar">
        <input id="title-search" class="search-input" type="text" placeholder="Filter titles..." />
        <span class="muted">Search by title or metric values.</span>
      </div>
      ${buildTitleTable(titleRows)}
    </section>

    <section class="section grid-2">
      <div>
        <h2>Error Breakdown</h2>
        ${buildErrorTable(errorRows)}
      </div>
      <div>
        <h2>Sample Rows</h2>
        ${buildSampleTable(sampleRows)}
      </div>
    </section>

    <div class="footer">
      IMDb Automation Demo Dashboard
    </div>
  </div>

  <script>
    (function () {
      const input = document.getElementById("title-search");
      const table = document.getElementById("title-table");
      if (!input || !table) return;

      input.addEventListener("input", function () {
        const q = String(input.value || "").toLowerCase().trim();
        const rows = table.querySelectorAll("tbody tr");
        rows.forEach((row) => {
          const hay = String(row.getAttribute("data-search") || "");
          row.style.display = !q || hay.includes(q) ? "" : "none";
        });
      });
    })();
  </script>
</body>
</html>`;
}

function main() {
  const summary = readJson(summaryPath);
  const results = readJson(resultsPath);

  const html = render(summary, results);

  fs.writeFileSync(dashboardPath, html, "utf-8");
  fs.writeFileSync(reportPath, html, "utf-8");

  console.log("DASHBOARD_GENERATED", {
    dashboardPath,
    reportPath,
    totalRows: summary.totalRows,
    titlesProcessed: summary.titlesProcessed
  });
}

main();

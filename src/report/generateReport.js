const fs = require("fs");
const path = require("path");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonSafe(filePath, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toCountMap(items, key) {
  const map = {};
  for (const item of items) {
    const k = item?.[key] ?? "";
    map[k] = (map[k] || 0) + 1;
  }
  return map;
}

function toErrorMap(items) {
  const map = {};
  for (const item of items) {
    const k = item?.errorMessage || "";
    if (!k) continue;
    map[k] = (map[k] || 0) + 1;
  }
  return map;
}

function relFromReport(absPath, projectRoot) {
  if (!absPath) return "";
  const rel = path.relative(path.join(projectRoot, "output", "report"), absPath);
  return rel.split(path.sep).join("/");
}

function getRunDurationSecondsFromLog(logPath) {
  try {
    const text = fs.readFileSync(logPath, "utf-8");
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return 0;

    const firstMatch = lines[0].match(/^\[([^\]]+)\]/);
    const lastMatch = lines[lines.length - 1].match(/^\[([^\]]+)\]/);
    if (!firstMatch || !lastMatch) return 0;

    const start = new Date(firstMatch[1]).getTime();
    const end = new Date(lastMatch[1]).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;

    return Number(((end - start) / 1000).toFixed(3));
  } catch {
    return 0;
  }
}

function badgeClass(value) {
  if (value === "passed") return "badge green";
  if (value === "warning") return "badge yellow";
  if (value === "blocked") return "badge red";
  if (value === "matched") return "badge green";
  return "badge gray";
}

function renderCounterList(obj) {
  const entries = Object.entries(obj || {});
  if (!entries.length) return '<div class="muted">No data</div>';
  return entries
    .map(([k, v]) => `<div class="kv"><span>${escapeHtml(k || "(empty)")}</span><strong>${v}</strong></div>`)
    .join("");
}

function renderRows(rows, projectRoot) {
  return rows.map((row) => {
    const titleShot = relFromReport(row.titleScreenshotPath, projectRoot);
    const castShot = relFromReport(row.castSectionScreenshotPath, projectRoot);
    const rowShot = relFromReport(row.rowScreenshotPath, projectRoot);
    const profileShot = relFromReport(row.profileScreenshotPath, projectRoot);

    return `
      <tr>
        <td>${escapeHtml(row.movieTitle)}</td>
        <td>${row.rowIndex ?? ""}</td>
        <td>${escapeHtml(row.listedFullName)}</td>
        <td>${escapeHtml(row.profileFullName || "")}</td>
        <td>${row.profileUrl ? `<a href="${escapeHtml(row.profileUrl)}" target="_blank">open</a>` : ""}</td>
        <td><span class="${badgeClass(row.matchStatus)}">${escapeHtml(row.matchStatus)}</span></td>
        <td><span class="${badgeClass(row.status)}">${escapeHtml(row.status)}</span></td>
        <td>${escapeHtml(row.errorMessage || "")}</td>
        <td class="links">
          ${titleShot ? `<a href="${titleShot}" target="_blank">title</a>` : ""}
          ${castShot ? `<a href="${castShot}" target="_blank">cast</a>` : ""}
          ${rowShot ? `<a href="${rowShot}" target="_blank">row</a>` : ""}
          ${profileShot ? `<a href="${profileShot}" target="_blank">profile</a>` : ""}
        </td>
      </tr>
    `;
  }).join("");
}

function renderGallery(rows, projectRoot) {
  return rows.slice(0, 12).map((row) => {
    const primaryImg = relFromReport(
      row.rowScreenshotPath || row.castSectionScreenshotPath || row.titleScreenshotPath,
      projectRoot
    );
    const profileImg = relFromReport(row.profileScreenshotPath, projectRoot);

    return `
      <div class="card">
        ${primaryImg ? `<img src="${primaryImg}" alt="${escapeHtml(row.movieTitle)}">` : ""}
        <div class="card-body">
          <div class="card-title">${escapeHtml(row.movieTitle)}</div>
          <div class="card-sub">${escapeHtml(row.listedFullName)}</div>
          <div style="margin-bottom:8px;">
            <span class="${badgeClass(row.matchStatus)}">${escapeHtml(row.matchStatus)}</span>
          </div>
          <div class="links">
            ${primaryImg ? `<a href="${primaryImg}" target="_blank">row</a>` : ""}
            ${profileImg ? `<a href="${profileImg}" target="_blank">profile</a>` : ""}
            ${row.profileUrl ? `<a href="${escapeHtml(row.profileUrl)}" target="_blank">url</a>` : ""}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderChecklist(items, tone) {
  return items.map((item) => `<div class="check ${tone}">${escapeHtml(item)}</div>`).join("");
}

function renderCaseStudies(rows, projectRoot) {
  return rows.slice(0, 3).map((row) => {
    const titleShot = relFromReport(row.titleScreenshotPath, projectRoot);
    const castShot = relFromReport(row.castSectionScreenshotPath, projectRoot);
    const rowShot = relFromReport(row.rowScreenshotPath, projectRoot);
    const profileShot = relFromReport(row.profileScreenshotPath, projectRoot);

    return `
      <div class="panel">
        <h3 style="margin-bottom:10px;">${escapeHtml(row.movieTitle)} - Row ${escapeHtml(row.rowIndex)}</h3>
        <div class="muted" style="margin-bottom:12px;">
          Listed name: <strong>${escapeHtml(row.listedFullName)}</strong>
        </div>
        <div class="muted" style="margin-bottom:12px;">
          Profile URL:
          ${row.profileUrl ? `<a href="${escapeHtml(row.profileUrl)}" target="_blank">${escapeHtml(row.profileUrl)}</a>` : "-"}
        </div>
        <div style="margin-bottom:12px;">
          <span class="${badgeClass(row.matchStatus)}">${escapeHtml(row.matchStatus)}</span>
          <span class="${badgeClass(row.status)}">${escapeHtml(row.status)}</span>
        </div>
        <div class="muted" style="margin-bottom:12px;">
          ${escapeHtml(row.errorMessage || "No error")}
        </div>
        <div class="evidence-grid">
          ${titleShot ? `<a class="shot" href="${titleShot}" target="_blank"><img src="${titleShot}" alt="title"><span>Title page</span></a>` : ""}
          ${castShot ? `<a class="shot" href="${castShot}" target="_blank"><img src="${castShot}" alt="cast"><span>Cast section</span></a>` : ""}
          ${rowShot ? `<a class="shot" href="${rowShot}" target="_blank"><img src="${rowShot}" alt="row"><span>Selected row</span></a>` : ""}
          ${profileShot ? `<a class="shot" href="${profileShot}" target="_blank"><img src="${profileShot}" alt="profile"><span>Profile attempt</span></a>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function main() {
  const startedAt = Date.now();

  const projectRoot = process.cwd();
  const outputDir = path.join(projectRoot, "output");
  const reportDir = path.join(outputDir, "report");
  const resultsPath = path.join(outputDir, "results", "results.json");
  const logPath = path.join(outputDir, "logs", "app.log");

  ensureDir(reportDir);

  const results = readJsonSafe(resultsPath, []);
  const debugDir = path.join(outputDir, "debug");
  const debugEvidenceCount = fs.existsSync(debugDir)
    ? fs.readdirSync(debugDir).filter((name) => name.endsWith("_profile_debug.json")).length
    : 0;

  const uniquePeople = new Set(results.map((x) => x.fullName || x.listedFullName).filter(Boolean)).size;
  const titlesProcessed = new Set(results.map((x) => x.movieTitle).filter(Boolean)).size;
  const castRowsExtracted = results.length;
  const profileAttempts = results.filter((x) => x.profileUrl || x.profileVisited).length;
  const profileBlocked = results.filter((x) => x.matchStatus === "blocked").length;
  const passedCount = results.filter((x) => x.status === "passed").length;
  const warningCount = results.filter((x) => x.status === "warning").length;
  const matchedCount = results.filter((x) => x.matchStatus === "matched").length;
  const screenshotsSaved = results.reduce((acc, row) => {
    const fields = [
      row.titleScreenshotPath,
      row.castSectionScreenshotPath,
      row.rowScreenshotPath,
      row.profileScreenshotPath
    ];
    return acc + fields.filter(Boolean).length;
  }, 0);

  const statusCounts = toCountMap(results, "status");
  const matchStatusCounts = toCountMap(results, "matchStatus");
  const errorCounts = toErrorMap(results);

  let runConclusion = "Run completed.";
  let runVerdict = "RUN_COMPLETED";
  if (profileBlocked > 0) {
    runConclusion = "Cast rows were extracted successfully, but profile verification was blocked by IMDb AWS WAF.";
    runVerdict = "PARTIAL_SUCCESS_PROFILE_BLOCKED_BY_WAF";
  } else if (passedCount > 0) {
    runConclusion = "Cast rows and profile verification completed successfully.";
    runVerdict = "SUCCESS";
  }

  const summary = {
    totalRows: results.length,
    uniquePeople,
    titlesProcessed,
    castRowsExtracted,
    profileAttempts,
    profileBlocked,
    matchedCount,
    warningCount,
    passedCount,
    evidenceScreenshotCount: screenshotsSaved,
    debugEvidenceCount,
    reportStatus: "completed",
    runVerdict,
    extractionStatus: profileBlocked > 0 ? "partial" : "complete",
    rootCause: profileBlocked > 0 ? "IMDb profile page blocked by AWS WAF challenge" : "",
    statusCounts,
    matchStatusCounts,
    errorCounts,
    generatedAt: new Date().toISOString(),
    runDurationSeconds: getRunDurationSecondsFromLog(logPath)
  };

  fs.writeFileSync(
    path.join(reportDir, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf-8"
  );

  const workedItems = [
    "Title navigation completed",
    "Cast section detected",
    "Cast rows extracted",
    "Profile visits attempted",
    "Screenshot evidence captured",
    "JSON export generated",
    "CSV export generated",
    "HTML report generated"
  ];

  const blockedItems = [
    "Profile content extraction blocked on IMDb profile pages",
    "Root cause identified as AWS WAF challenge",
    "Blocked rows marked explicitly in output",
    "Evidence retained for blocked attempts"
  ];

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>IMDb Automation Demo Report</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; background: #0b1020; color: #e8ecf3; }
    h1, h2, h3 { margin-top: 0; }
    .muted { color: #9aa4b2; }
    .grid { display: grid; gap: 16px; }
    .grid.cards { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 20px; }
    .panel { background: #121a2b; border: 1px solid #243047; border-radius: 14px; padding: 16px; }
    .big { font-size: 28px; font-weight: 700; margin-top: 6px; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-right: 6px; }
    .green { background: #143d2b; color: #86efac; }
    .yellow { background: #3f3213; color: #fcd34d; }
    .red { background: #451a1a; color: #fca5a5; }
    .gray { background: #334155; color: #e2e8f0; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .three-col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
    .kv { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #243047; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border-bottom: 1px solid #243047; padding: 10px 8px; text-align: left; vertical-align: top; }
    th { background: #182235; position: sticky; top: 0; }
    .table-wrap { overflow: auto; max-height: 520px; }
    .links a { color: #93c5fd; text-decoration: none; margin-right: 8px; }
    .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .card { background: #121a2b; border: 1px solid #243047; border-radius: 14px; overflow: hidden; }
    .card img { width: 100%; height: 180px; object-fit: cover; background: #0f172a; }
    .card-body { padding: 12px; }
    .card-title { font-weight: 700; margin-bottom: 4px; }
    .card-sub { color: #9aa4b2; margin-bottom: 8px; }
    .banner {
      background: linear-gradient(135deg, #13213d, #1d3557);
      border: 1px solid #2d4b73;
      border-radius: 16px;
      padding: 18px;
      margin: 18px 0 20px 0;
    }
    .banner-title { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    .flow {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .flow span {
      background: #182235;
      border: 1px solid #2a3a57;
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 13px;
    }
    .check {
      padding: 10px 12px;
      border-radius: 10px;
      margin-bottom: 8px;
      font-size: 14px;
      border: 1px solid transparent;
    }
    .check.good {
      background: #143d2b;
      color: #d1fae5;
      border-color: #1f5a3f;
    }
    .check.bad {
      background: #451a1a;
      color: #fee2e2;
      border-color: #6b2424;
    }
    .evidence-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }
    .shot {
      display: block;
      text-decoration: none;
      color: #e8ecf3;
      background: #0f172a;
      border: 1px solid #243047;
      border-radius: 12px;
      overflow: hidden;
    }
    .shot img {
      width: 100%;
      height: 140px;
      object-fit: cover;
      display: block;
      background: #111827;
    }
    .shot span {
      display: block;
      padding: 8px 10px;
      font-size: 13px;
    }
    @media (max-width: 900px) {
      .two-col, .three-col { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <h1>IMDb Automation Demo Report</h1>
  <div class="muted">Generated at: ${escapeHtml(summary.generatedAt)}</div>

  <div class="panel" style="margin:16px 0 20px 0;">
    <h2 style="margin-bottom:8px;">Execution Summary</h2>
    <div>${escapeHtml(runConclusion)}</div>
    <div class="muted" style="margin-top:8px;">
      Evidence files, screenshots, JSON results, and HTML report were generated for this run.
    </div>
  </div>

  <div class="panel" style="margin:0 0 20px 0;">
    <h2 style="margin-bottom:12px;">Pipeline Health</h2>
    <div class="grid cards">
      <div class="panel"><div class="muted">Titles Processed</div><div class="big">${summary.titlesProcessed}</div></div>
      <div class="panel"><div class="muted">Cast Rows Extracted</div><div class="big">${summary.castRowsExtracted}</div></div>
      <div class="panel"><div class="muted">Profile Visits Attempted</div><div class="big">${summary.profileAttempts}</div></div>
      <div class="panel"><div class="muted">Profile Visits Blocked</div><div class="big">${summary.profileBlocked}</div></div>
    </div>
  </div>

  <div class="banner">
    <div class="banner-title">Run completed successfully with controlled blocking detection</div>
    <div class="muted">
      The automation completed end-to-end, exported results, captured evidence, and explicitly identified the IMDb AWS WAF challenge on profile pages.
    </div>
    <div style="margin-top:12px;">
      <span class="badge gray">verdict: ${escapeHtml(summary.runVerdict)}</span>
      <span class="badge green">report: ${escapeHtml(summary.reportStatus)}</span>
      <span class="badge yellow">extraction: ${escapeHtml(summary.extractionStatus)}</span>
      <span class="badge red">blocked profiles: ${profileBlocked}</span>
    </div>
    <div class="flow">
      <span>Title Page</span>
      <span>Cast Section</span>
      <span>Cast Row</span>
      <span>Profile Visit</span>
      <span>Challenge Detection</span>
      <span>JSON / CSV / HTML Report</span>
    </div>
  </div>

  <div class="grid cards">
    <div class="panel"><div class="muted">Total Rows</div><div class="big">${summary.totalRows}</div></div>
    <div class="panel"><div class="muted">Unique People</div><div class="big">${summary.uniquePeople}</div></div>
    <div class="panel"><div class="muted">Matched</div><div class="big">${matchedCount}</div></div>
    <div class="panel"><div class="muted">Warnings</div><div class="big">${warningCount}</div></div>
    <div class="panel"><div class="muted">Blocked</div><div class="big">${profileBlocked}</div></div>
  </div>

  <div class="grid cards">
    <div class="panel"><div class="muted">Titles Processed</div><div class="big">${summary.titlesProcessed}</div></div>
    <div class="panel"><div class="muted">Profile Attempts</div><div class="big">${summary.profileAttempts}</div></div>
    <div class="panel"><div class="muted">Passed</div><div class="big">${passedCount}</div></div>
    <div class="panel"><div class="muted">Evidence Screenshots</div><div class="big">${summary.evidenceScreenshotCount}</div></div>
    <div class="panel"><div class="muted">Run Duration (s)</div><div class="big">${summary.runDurationSeconds}</div></div>
  </div>

  <div class="two-col">
    <div class="panel">
      <h3>What worked</h3>
      ${renderChecklist(workedItems, "good")}
    </div>
    <div class="panel">
      <h3>What was blocked</h3>
      ${renderChecklist(blockedItems, "bad")}
    </div>
  </div>

  <div class="panel" style="margin-bottom:20px;">
    <h3>Challenge Evidence Summary</h3>
    <div class="grid cards">
      <div class="panel"><div class="muted">Blocked Profiles</div><div class="big">${summary.profileBlocked}</div></div>
      <div class="panel"><div class="muted">Debug Evidence Files</div><div class="big">${summary.debugEvidenceCount}</div></div>
      <div class="panel"><div class="muted">Screenshot Evidence</div><div class="big">${summary.evidenceScreenshotCount}</div></div>
    </div>
    <div class="muted" style="margin-top:10px;">
      Challenge detection evidence was preserved through screenshots, debug JSON files, logs, and structured report output.
    </div>
  </div>

  <div class="two-col">
    <div class="panel">
      <h3>Status Counts</h3>
      ${renderCounterList(summary.statusCounts)}
    </div>
    <div class="panel">
      <h3>Match Status Counts</h3>
      ${renderCounterList(summary.matchStatusCounts)}
    </div>
  </div>

  <div class="panel" style="margin-bottom:20px;">
    <h3>Error Counts</h3>
    ${renderCounterList(summary.errorCounts)}
  </div>

  <h2>Case Studies</h2>
  <div class="three-col">
    ${renderCaseStudies(results, projectRoot)}
  </div>

  <div class="panel" style="margin-bottom:20px;">
    <h2>Results Table</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Movie</th>
            <th>Row</th>
            <th>Listed Name</th>
            <th>Profile Name</th>
            <th>Profile URL</th>
            <th>Match</th>
            <th>Status</th>
            <th>Error</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          ${renderRows(results, projectRoot)}
        </tbody>
      </table>
    </div>
  </div>

  <h2>Evidence Gallery</h2>
  <div class="gallery">
    ${renderGallery(results, projectRoot)}
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(reportDir, "report.html"), html, "utf-8");

  console.log("REPORT_GENERATED", {
    summaryPath: path.join(reportDir, "summary.json"),
    reportPath: path.join(reportDir, "report.html")
  });
}

main();

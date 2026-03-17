const fs = require("fs");
const path = require("path");

function readJsonSafe(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
  const projectRoot = process.cwd();
  const reportDir = path.join(projectRoot, "output", "report");
  const summaryPath = path.join(reportDir, "summary.json");
  const contractPath = path.join(reportDir, "run-contract.json");

  ensureDir(reportDir);

  const summary = readJsonSafe(summaryPath, null);

  if (!summary) {
    const payload = {
      validationStatus: "FAILED_SUMMARY_MISSING",
      exitCode: 10,
      verdict: "UNKNOWN",
      totalRows: 0,
      blocked: 0,
      warnings: 0,
      generatedAt: new Date().toISOString()
    };

    fs.writeFileSync(contractPath, JSON.stringify(payload, null, 2), "utf-8");
    console.error("RUN_VALIDATION_FAILED", {
      reason: "summary.json not found or invalid",
      summaryPath,
      contractPath
    });
    process.exit(10);
  }

  const totalRows = Number(summary.totalRows || 0);
  const blocked = Number(summary.profileBlocked || 0);
  const warnings = Number(summary.warningCount || 0);
  const titlesProcessed = Number(summary.titlesProcessed || 0);
  const castRowsExtracted = Number(summary.castRowsExtracted || 0);
  const profileAttempts = Number(summary.profileAttempts || 0);
  const debugEvidenceCount = Number(summary.debugEvidenceCount || 0);
  const evidenceScreenshotCount = Number(summary.evidenceScreenshotCount || 0);
  const verdict = String(summary.runVerdict || "");
  const rootCause = String(summary.rootCause || "");
  const extractionStatus = String(summary.extractionStatus || "");
  const reportStatus = String(summary.reportStatus || "");

  let validationStatus = "UNKNOWN";
  let exitCode = 0;

  if (totalRows === 0) {
    validationStatus = "FAILED_NO_ROWS";
    exitCode = 20;
  } else if (blocked === totalRows && totalRows > 0) {
    validationStatus = "PARTIAL_SUCCESS_ALL_PROFILES_BLOCKED";
    exitCode = 2;
  } else if (warnings > 0) {
    validationStatus = "SUCCESS_WITH_WARNINGS";
    exitCode = 1;
  } else {
    validationStatus = "SUCCESS";
    exitCode = 0;
  }

  const payload = {
    validationStatus,
    exitCode,
    verdict,
    reportStatus,
    extractionStatus,
    rootCause,
    totals: {
      totalRows,
      titlesProcessed,
      castRowsExtracted,
      profileAttempts,
      blocked,
      warnings
    },
    evidence: {
      debugEvidenceCount,
      evidenceScreenshotCount
    },
    generatedAt: new Date().toISOString(),
    summaryPath,
    reportPath: path.join(reportDir, "report.html")
  };

  fs.writeFileSync(contractPath, JSON.stringify(payload, null, 2), "utf-8");

  console.log("RUN_VALIDATION_RESULT", payload);
  console.log("RUN_CONTRACT_WRITTEN", { contractPath });

  process.exit(exitCode);
}

main();

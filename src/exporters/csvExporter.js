const path = require("path");
const { stringify } = require("csv-stringify/sync");
const config = require("../config");
const { writeText } = require("../utils/file");

function exportCsv(data) {
  const filePath = path.join(config.paths.resultsDir, "results.csv");

  const csv = stringify(data, {
    header: true,
    columns: [
      "movieUrl",
      "movieTitle",
      "rowIndex",
      "listedFullName",
      "profileFullName",
      "name",
      "surname",
      "fullName",
      "sourcePage",
      "profileVisited",
      "profileUrl",
      "matchStatus",
      "status",
      "errorMessage",
      "titleScreenshotPath",
      "castSectionScreenshotPath",
      "rowScreenshotPath",
      "profileScreenshotPath",
      "stepName"
    ]
  });

  writeText(filePath, csv);
  return filePath;
}

module.exports = { exportCsv };

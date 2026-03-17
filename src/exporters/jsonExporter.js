const path = require("path");
const config = require("../config");
const { writeJson } = require("../utils/file");

function exportJson(data) {
  const filePath = path.join(config.paths.resultsDir, "results.json");
  writeJson(filePath, data);
  return filePath;
}

module.exports = { exportJson };

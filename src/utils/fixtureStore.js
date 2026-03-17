const fs = require("fs");
const path = require("path");
const config = require("../config");

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function safeReadJson(filePath) {
  try {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) return [];
    return JSON.parse(fs.readFileSync(resolved, "utf-8"));
  } catch {
    return [];
  }
}

function loadFixtures() {
  const rows = safeReadJson(config.fixtureFile);
  if (!Array.isArray(rows)) return [];
  return rows;
}

function findFixture(fixtures, movieTitle, listedFullName, profileUrl) {
  const movieTitleNorm = normalize(movieTitle);
  const listedFullNameNorm = normalize(listedFullName);
  const profileUrlNorm = normalize(profileUrl);

  return (
    fixtures.find((row) => {
      return (
        normalize(row.movieTitle) === movieTitleNorm &&
        normalize(row.listedFullName) === listedFullNameNorm
      );
    }) ||
    fixtures.find((row) => normalize(row.profileUrl) === profileUrlNorm) ||
    null
  );
}

module.exports = {
  loadFixtures,
  findFixture
};

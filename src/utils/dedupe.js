function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function dedupePeople(people) {
  const map = new Map();

  for (const person of people || []) {
    const movieUrl = normalize(person.movieUrl);
    const rowIndex = String(person.rowIndex || "");
    const listedFullName = normalize(person.listedFullName);
    const profileUrl = normalize(person.profileUrl);

    const key = `${movieUrl}|${rowIndex}|${listedFullName}|${profileUrl}`;

    if (!map.has(key)) {
      map.set(key, person);
      continue;
    }

    const existing = map.get(key);

    const existingScore =
      (existing.profileVisited ? 2 : 0) +
      (existing.profileFullName ? 2 : 0) +
      (existing.matchStatus === "matched" ? 1 : 0);

    const currentScore =
      (person.profileVisited ? 2 : 0) +
      (person.profileFullName ? 2 : 0) +
      (person.matchStatus === "matched" ? 1 : 0);

    if (currentScore >= existingScore) {
      map.set(key, person);
    }
  }

  return Array.from(map.values());
}

module.exports = { dedupePeople };

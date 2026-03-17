function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function dedupePeople(people) {
  const map = new Map();

  for (const person of people) {
    const profileUrl = normalize(person.profileUrl);
    const listedFullName = normalize(person.listedFullName);
    const fullName = normalize(person.fullName);
    const movieUrl = normalize(person.movieUrl);

    const key = profileUrl || `${movieUrl}|${listedFullName || fullName}`;

    if (!map.has(key)) {
      map.set(key, person);
    }
  }

  return Array.from(map.values());
}

module.exports = { dedupePeople };

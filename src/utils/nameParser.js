function cleanName(fullName) {
  if (!fullName) return "";
  return fullName
    .replace(/\s+/g, " ")
    .replace(/\.\.\./g, " ")
    .trim();
}

function splitName(fullName) {
  const clean = cleanName(fullName);
  if (!clean) {
    return { name: "", surname: "" };
  }

  const parts = clean.split(" ").filter(Boolean);

  if (parts.length === 1) {
    return { name: parts[0], surname: "" };
  }

  return {
    name: parts[0],
    surname: parts.slice(1).join(" ")
  };
}

module.exports = {
  cleanName,
  splitName
};

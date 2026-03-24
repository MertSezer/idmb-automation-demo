function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeProfileUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";

  try {
    const u = raw.startsWith("http")
      ? new URL(raw)
      : new URL(raw, "https://www.imdb.com");

    const match = u.pathname.match(/\/name\/nm\d+\//);
    return match ? `https://www.imdb.com${match[0]}` : "";
  } catch {
    return "";
  }
}


function resolveRowLimit(maxRows) {
  const n = Number(maxRows);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return 5;
}

function dedupeRows(rows) {
  const seen = new Set();
  const out = [];

  for (const row of rows || []) {
    const key = `${row.listedFullName}|${row.profileUrl}`;
    if (!row.listedFullName || !row.profileUrl) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

async function openTitlePage(page, movieUrl, timeoutMs) {
  await page.goto(movieUrl, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs
  });

  await page.waitForTimeout(2500).catch(() => {});
}

async function getMovieTitle(page) {
  const titleTag = cleanText(await page.title().catch(() => ""));
  if (titleTag) {
    const cleaned = titleTag.replace(/\s*-\s*IMDb\s*$/i, "").trim();
    if (cleaned) return cleaned;
  }

  const h1 = cleanText(
    await page.evaluate(() => {
      const el = document.querySelector("h1");
      return el ? el.textContent || "" : "";
    }).catch(() => "")
  );
  if (h1) return h1;

  return "";
}

async function findCastSection(page) {
  return { ok: true };
}

async function getCastRowsFromJsonLd(page) {
  const rows = await page.evaluate(() => {
    function cleanText(value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    }

    function normalizeProfileUrl(url) {
      const raw = String(url || "").trim();
      if (!raw) return "";

      try {
        const u = raw.startsWith("http")
          ? new URL(raw)
          : new URL(raw, "https://www.imdb.com");

        const match = u.pathname.match(/\/name\/nm\d+\//);
        return match ? `https://www.imdb.com${match[0]}` : "";
      } catch {
        return "";
      }
    }

    function visit(node, out) {
      if (!node) return;
      if (Array.isArray(node)) {
        for (const item of node) visit(item, out);
        return;
      }
      if (typeof node !== "object") return;

      const type = node["@type"];
      const actors = Array.isArray(node.actor)
        ? node.actor
        : Array.isArray(node.actors)
        ? node.actors
        : [];

      if (
        type === "Movie" ||
        type === "TVSeries" ||
        type === "TVEpisode" ||
        type === "CreativeWork"
      ) {
        for (const actor of actors) {
          if (!actor || typeof actor !== "object") continue;

          const listedFullName = cleanText(actor.name || "");
          const profileUrl = normalizeProfileUrl(actor.url || actor.sameAs || "");

          if (!listedFullName || !profileUrl) continue;
          out.push({ listedFullName, profileUrl });
        }
      }

      if (Array.isArray(node["@graph"])) visit(node["@graph"], out);
      if (node.itemListElement) visit(node.itemListElement, out);
    }

    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    const out = [];

    for (const script of scripts) {
      const raw = (script.textContent || "").trim();
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        visit(parsed, out);
      } catch {
        // ignore invalid json
      }
    }

    const seen = new Set();
    const deduped = [];

    for (const row of out) {
      const key = `${row.listedFullName}|${row.profileUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(row);
    }

    return deduped;
  }).catch(() => []);

  return rows;
}

async function getCastRowsFromDom(page) {
  const rows = await page.evaluate(() => {
    function cleanText(value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    }

    function normalizeProfileUrl(url) {
      const raw = String(url || "").trim();
      if (!raw) return "";

      try {
        const u = raw.startsWith("http")
          ? new URL(raw)
          : new URL(raw, "https://www.imdb.com");

        const match = u.pathname.match(/\/name\/nm\d+\//);
        return match ? `https://www.imdb.com${match[0]}` : "";
      } catch {
        return "";
      }
    }

    const anchors = Array.from(document.querySelectorAll('a[href*="/name/nm"]'));
    const rows = [];

    for (const a of anchors) {
      const listedFullName = cleanText(a.textContent || "");
      const href = a.getAttribute("href") || "";
      const profileUrl = normalizeProfileUrl(href);
      const absHref = a.href || "";

      if (!listedFullName || !profileUrl) continue;
      if (listedFullName.length < 3) continue;

      const looksLikeActor =
        /ref_=tt_ov_3_/i.test(absHref) ||
        /ref_=tt_cl_/i.test(absHref) ||
        /ref_=ttfc_fc_/i.test(absHref);

      if (!looksLikeActor) continue;

      rows.push({ listedFullName, profileUrl });
    }

    const seen = new Set();
    const out = [];

    for (const row of rows) {
      const key = `${row.listedFullName}|${row.profileUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }

    return out;
  }).catch(() => []);

  return rows;
}

async function getCastRows(page, maxRows) {
  const jsonLdRows = await getCastRowsFromJsonLd(page);
  const domRows = jsonLdRows.length > 0 ? jsonLdRows : await getCastRowsFromDom(page);

  return dedupeRows(domRows)
    .slice(0, resolveRowLimit(maxRows))
    .map((row, index) => ({
      rowIndex: index + 1,
      listedFullName: cleanText(row.listedFullName),
      profileUrl: normalizeProfileUrl(row.profileUrl)
    }));
}

module.exports = {
  openTitlePage,
  getMovieTitle,
  findCastSection,
  getCastRows
};


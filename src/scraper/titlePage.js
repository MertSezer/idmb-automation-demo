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
  const ok = await page.evaluate(() => {
    const selectors = [
      '[data-testid="title-cast"]',
      '[data-testid="title-cast-item"]',
      '.cast_list',
      '[data-testid="BottomSheet"]'
    ];

    return selectors.some((selector) => document.querySelector(selector));
  }).catch(() => false);

  return { ok };
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
          out.push({ listedFullName, profileUrl, characterName: "" });
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

    function getDirectText(el) {
      if (!el) return "";
      const parts = [];

      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = cleanText(node.textContent || "");
          if (text) parts.push(text);
        }
      }

      return cleanText(parts.join(" "));
    }

    function extractCharacterText(row, listedFullName) {
      const strongCandidates = [
        row.querySelector('td.character'),
        row.querySelector('[data-testid="title-cast-item__characters"]'),
        row.querySelector('[data-testid="cast-item-characters-link"]'),
        row.querySelector('.character')
      ];

      for (const el of strongCandidates) {
        const text = cleanText(el?.textContent || "");
        if (text && text !== listedFullName) return text;
      }

      const textNodes = Array.from(
        row.querySelectorAll('a, span, div, td')
      )
        .map((el) => cleanText(el.textContent || ""))
        .filter(Boolean)
        .filter((t) => t !== listedFullName)
        .filter((t) => !t.includes(listedFullName))
        .filter((t) => t.length <= 80)
        .filter((t) => !/^more$/i.test(t))
        .filter((t) => !/^see production/i.test(t))
        .filter((t) => !/^full cast/i.test(t));

      const unique = [];
      const seen = new Set();

      for (const item of textNodes) {
        if (seen.has(item)) continue;
        seen.add(item);
        unique.push(item);
      }

      return unique.length === 1 ? unique[0] : "";
    }

    function findActorRowNodes() {
      const testIdRows = Array.from(document.querySelectorAll('[data-testid="title-cast-item"]'));
      if (testIdRows.length) return testIdRows;

      const tableRows = Array.from(document.querySelectorAll('.cast_list tr'));
      if (tableRows.length) {
        return tableRows.filter((tr) => tr.querySelector('a[href*="/name/nm"]'));
      }

      return [];
    }

    const rowNodes = findActorRowNodes();
    const out = [];

    for (const row of rowNodes) {
      const actorAnchor = row.querySelector('a[href*="/name/nm"]');
      if (!actorAnchor) continue;

      const listedFullName = cleanText(actorAnchor.textContent || "");
      const profileUrl = normalizeProfileUrl(actorAnchor.getAttribute("href") || "");

      if (!listedFullName || !profileUrl) continue;
      if (listedFullName.length < 3) continue;

      const characterName = extractCharacterText(row, listedFullName);

      out.push({
        listedFullName,
        profileUrl,
        characterName
      });
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

async function getCastRows(page, maxRows) {
  const jsonLdRows = await getCastRowsFromJsonLd(page);
  const domRows = await getCastRowsFromDom(page);

  const domByKey = new Map(
    domRows.map((row) => [`${row.listedFullName}|${row.profileUrl}`, row])
  );

  const mergedBase = (jsonLdRows.length > 0 ? jsonLdRows : domRows).map((row) => {
    const key = `${row.listedFullName}|${row.profileUrl}`;
    const domRow = domByKey.get(key);

    return {
      listedFullName: cleanText(row.listedFullName),
      profileUrl: normalizeProfileUrl(row.profileUrl),
      characterName: cleanText(domRow?.characterName || row.characterName || "")
    };
  });

  const merged = mergedBase.length > 0 ? mergedBase : domRows.map((row) => ({
    listedFullName: cleanText(row.listedFullName),
    profileUrl: normalizeProfileUrl(row.profileUrl),
    characterName: cleanText(row.characterName || "")
  }));

  return dedupeRows(merged)
    .slice(0, resolveRowLimit(maxRows))
    .map((row, index) => ({
      rowIndex: index + 1,
      listedFullName: row.listedFullName,
      profileUrl: row.profileUrl,
      characterName: row.characterName
    }));
}

module.exports = {
  openTitlePage,
  getMovieTitle,
  findCastSection,
  getCastRows
};

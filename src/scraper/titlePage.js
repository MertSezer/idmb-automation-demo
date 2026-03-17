const { cleanName } = require("../utils/nameParser");
const { waitForPageReady } = require("../utils/wait");

async function openTitlePage(page, url, timeout) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  await waitForPageReady(page, timeout);
}

async function getMovieTitle(page) {
  const selectors = [
    '[data-testid="hero__pageTitle"]',
    "h1"
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      const text = cleanName(await locator.textContent());
      if (text) return text;
    }
  }

  return "";
}

async function findCastSection(page) {
  const possibleSections = [
    '[data-testid="title-cast"]',
    'section[data-testid*="title-cast"]',
    'section:has(a[href*="/name/nm"])',
    'main'
  ];

  for (const selector of possibleSections) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      return locator;
    }
  }

  return page.locator("main").first();
}

async function getCastRows(page, maxCastPerTitle = 5) {
  const pageText = await page.locator("body").innerText().catch(() => "");
  if (/403 forbidden/i.test(pageText)) {
    throw new Error("IMDb returned 403 Forbidden");
  }

  const castSection = await findCastSection(page);

  const rawRows = await castSection.locator('a[href*="/name/nm"]').evaluateAll((anchors) => {
    return anchors.map((a, index) => {
      const text = (a.textContent || "").trim();
      const href = a.href || "";
      const parentText = (a.parentElement?.textContent || "").trim();

      return {
        rowIndex: index + 1,
        listedFullName: text,
        profileUrl: href,
        parentText
      };
    });
  });

  const seen = new Set();

  const filtered = rawRows
    .filter((item) => item.profileUrl.includes("/name/nm"))
    .filter((item) => item.listedFullName && item.listedFullName.length > 1)
    .filter((item) => !/more like this|see production|full cast|director|writer|stars/i.test(item.listedFullName))
    .filter((item) => !/director|writer|creator/i.test(item.parentText || ""))
    .filter((item) => /^[A-Za-zÀ-ÿ0-9.' -]+$/.test(item.listedFullName))
    .filter((item) => {
      const key = `${item.listedFullName}|${item.profileUrl}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxCastPerTitle)
    .map((item, index) => ({
      rowIndex: index + 1,
      listedFullName: cleanName(item.listedFullName),
      profileUrl: item.profileUrl.split("?")[0]
    }));

  return filtered;
}

module.exports = {
  openTitlePage,
  getMovieTitle,
  findCastSection,
  getCastRows
};

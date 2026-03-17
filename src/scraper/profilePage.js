const path = require("path");
const config = require("../config");
const { cleanName } = require("../utils/nameParser");
const { waitForPageReady } = require("../utils/wait");
const { writeJson } = require("../utils/file");
const { sanitizeFileName } = require("../utils/file");

async function openProfilePage(page, url, timeout) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  await waitForPageReady(page, timeout);
}

async function getProfileFullName(page, debugKey = "profile") {
  const debugDir = config.paths.debugDir;

  const selectors = [
    '[data-testid="hero__pageTitle"]',
    '[data-testid="hero__primary-text"]',
    'section[data-testid="nm__hero"] h1',
    'main h1',
    'h1 span',
    'h1'
  ];

  const debug = {
    debugKey,
    url: page.url(),
    title: "",
    triedSelectors: [],
    chosenSelector: "",
    extractedText: "",
    htmlSnippets: {}
  };

  const isChallengePage = async () => {
    const html = await page.content().catch(() => "");
    return /AwsWafIntegration|challenge-container|token\.awswaf\.com|verify that you're not a robot/i.test(html);
  };

  try {
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);

    debug.title = await page.title().catch(() => "");
    debug.htmlSnippets["body_html_start"] = await page.locator("body").evaluate(el => el.innerHTML.slice(0, 3000)).catch(() => "");
    debug.htmlSnippets["body_text_start"] = await page.locator("body").innerText().then(t => (t || "").slice(0, 2000)).catch(() => "");
    debug.htmlSnippets["page_content_start"] = await page.content().then(t => (t || "").slice(0, 3000)).catch(() => "");

    if (await isChallengePage()) {
      debug.chosenSelector = "__challenge_page__";
      writeJson(
        path.join(debugDir, `${sanitizeFileName(debugKey)}_debug.json`),
        debug
      );
      return "__CHALLENGE__";
    }

    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      const count = await locator.count().catch(() => 0);

      const entry = { selector, count, text: "" };

      if (count > 0) {
        const text = cleanName(await locator.textContent().catch(() => ""));
        entry.text = text || "";

        const html = await locator.evaluate(el => el.outerHTML).catch(() => "");
        if (html) {
          debug.htmlSnippets[selector] = html;
        }

        if (text && !/IMDb|Known for/i.test(text)) {
          debug.triedSelectors.push(entry);
          debug.chosenSelector = selector;
          debug.extractedText = text;

          writeJson(
            path.join(debugDir, `${sanitizeFileName(debugKey)}_debug.json`),
            debug
          );

          return text;
        }
      }

      debug.triedSelectors.push(entry);
    }

    const title = await page.title().catch(() => "");
    if (title) {
      const cleanTitle = cleanName(title.replace(/\s*-\s*IMDb.*$/i, ""));
      if (cleanTitle) {
        debug.chosenSelector = "__page_title__";
        debug.extractedText = cleanTitle;

        writeJson(
          path.join(debugDir, `${sanitizeFileName(debugKey)}_debug.json`),
          debug
        );

        return cleanTitle;
      }
    }

    const bodyText = cleanName(
      await page.locator("body").innerText().catch(() => "")
    );

    if (bodyText) {
      debug.htmlSnippets["body_preview"] = bodyText.slice(0, 2000);
    }

    writeJson(
      path.join(debugDir, `${sanitizeFileName(debugKey)}_debug.json`),
      debug
    );

    return "";
  } catch (error) {
    debug.error = error.message || String(error);

    writeJson(
      path.join(debugDir, `${sanitizeFileName(debugKey)}_debug.json`),
      debug
    );

    return "";
  }
}

module.exports = {
  openProfilePage,
  getProfileFullName
};

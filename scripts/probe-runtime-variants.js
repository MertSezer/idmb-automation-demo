const fs = require("fs");
const { chromium } = require("playwright");

async function probe(name, launchOptions, contextOptions) {
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    await page.goto("https://www.imdb.com/title/tt0111161/", {
      waitUntil: "domcontentloaded",
      timeout: 45000
    });
    await page.waitForTimeout(3000);

    const title = await page.title().catch(err => `ERR:${err.message}`);
    const h1 = await page.locator("h1").first().textContent().catch(err => `ERR:${err.message}`);
    const nmCount = await page.locator('a[href*="/name/nm"]').count().catch(err => `ERR:${err.message}`);
    const html = await page.content().catch(err => `ERR:${err.message}`);
    const htmlLen = typeof html === "string" ? html.length : html;

    const screenshotPath = `probe-${name}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

    if (typeof html === "string") {
      fs.writeFileSync(`probe-${name}.html`, html, "utf-8");
    }

    console.log(`\n=== ${name} ===`);
    console.log("launchOptions:", launchOptions);
    console.log("contextOptions:", contextOptions);
    console.log("PAGE_TITLE:", title);
    console.log("H1:", h1);
    console.log("NM_LINK_COUNT:", nmCount);
    console.log("HTML_LEN:", htmlLen);
    console.log("SCREENSHOT:", screenshotPath);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

(async () => {
  await probe(
    "plain-headful",
    { headless: false },
    {}
  );

  await probe(
    "plain-headless",
    { headless: true },
    {}
  );

  await probe(
    "runtime-like-headful",
    { headless: false, channel: "chromium" },
    {
      viewport: { width: 1440, height: 900 },
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      locale: "en-US",
      timezoneId: "Europe/Istanbul",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        "Upgrade-Insecure-Requests": "1"
      }
    }
  );

  await probe(
    "runtime-like-headless",
    { headless: true, channel: "chromium" },
    {
      viewport: { width: 1440, height: 900 },
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      locale: "en-US",
      timezoneId: "Europe/Istanbul",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        "Upgrade-Insecure-Requests": "1"
      }
    }
  );
})();

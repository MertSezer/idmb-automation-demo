const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const url = "https://www.imdb.com/title/tt0111161/";
  await page.goto(url, { waitUntil: "domcontentloaded" });

  await page.waitForTimeout(3000);

  const html = await page.content();
  require("fs").writeFileSync("debug-title.html", html);

  const title = await page.title();
  console.log("PAGE TITLE:", title);

  const h1 = await page.locator("h1").first().textContent().catch(() => "");
  console.log("H1:", h1);

  const links = await page.$$eval('a[href*="/name/nm"]', els =>
    els.slice(0, 10).map(e => ({
      text: e.textContent.trim(),
      href: e.href
    }))
  );

  console.log("SAMPLE ACTOR LINKS:", links);

  await browser.close();
})();

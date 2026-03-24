const { createBrowserRuntime } = require("./../src/runtime/browserFactory");

(async () => {
  const runtime = await createBrowserRuntime();
  console.log("RUNTIME_KEYS:", Object.keys(runtime || {}));
  console.log("HAS_BROWSER:", !!runtime.browser);
  console.log("HAS_CONTEXT:", !!runtime.context);

  const page = await runtime.context.newPage();
  console.log("PAGE_CREATED:", !page.isClosed());

  try {
    await page.goto("https://www.imdb.com/title/tt0111161/", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    console.log("PAGE_CLOSED_AFTER_GOTO:", page.isClosed());

    const title = await page.title().catch(err => `ERR:${err.message}`);
    console.log("PAGE_TITLE:", title);

    const h1 = await page.locator("h1").first().textContent().catch(err => `ERR:${err.message}`);
    console.log("H1:", h1);

    const count = await page.locator('a[href*="/name/nm"]').count().catch(err => `ERR:${err.message}`);
    console.log("NM_LINK_COUNT:", count);

    const htmlLen = await page.content().then(x => x.length).catch(err => `ERR:${err.message}`);
    console.log("HTML_LEN:", htmlLen);
  } finally {
    await page.close().catch(() => {});
    if (runtime.context && typeof runtime.context.close === "function") {
      await runtime.context.close().catch(() => {});
    }
    if (runtime.browser && typeof runtime.browser.close === "function") {
      await runtime.browser.close().catch(() => {});
    }
  }
})();

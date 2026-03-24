const path = require("path");
const { createBrowserRuntime } = require("./../src/runtime/browserFactory");
const { openTitlePage, getMovieTitle, findCastSection, getCastRows } = require("./../src/scraper/titlePage");

(async () => {
  const runtime = await createBrowserRuntime();
  const page = await runtime.context.newPage();

  page.on("close", () => console.log("EVENT: page closed"));
  page.on("crash", () => console.log("EVENT: page crashed"));
  page.on("framenavigated", frame => {
    if (frame === page.mainFrame()) {
      console.log("EVENT: navigated ->", frame.url());
    }
  });

  try {
    const url = "https://www.imdb.com/title/tt0111161/?ref_=chttp_t_1";

    console.log("STEP 1: openTitlePage");
    await openTitlePage(page, url, 45000);
    console.log("PAGE CLOSED AFTER OPEN:", page.isClosed());

    console.log("STEP 2: getMovieTitle");
    const movieTitle = await getMovieTitle(page);
    console.log("MOVIE TITLE:", JSON.stringify(movieTitle));
    console.log("PAGE CLOSED AFTER TITLE:", page.isClosed());

    console.log("STEP 3: findCastSection");
    const castSection = await findCastSection(page);
    const castCount = await castSection.count().catch(err => `ERR:${err.message}`);
    console.log("CAST SECTION COUNT:", castCount);
    console.log("PAGE CLOSED AFTER CAST SECTION:", page.isClosed());

    console.log("STEP 4: screenshot");
    const shotPath = path.join(process.cwd(), "probe-cast-section.png");
    await page.screenshot({ path: shotPath, fullPage: true }).catch(err => {
      console.log("SCREENSHOT ERROR:", err.message);
    });
    console.log("SCREENSHOT PATH:", shotPath);
    console.log("PAGE CLOSED AFTER SCREENSHOT:", page.isClosed());

    console.log("STEP 5: count nm links before getCastRows");
    const nmCount = await page.locator('a[href*="/name/nm"]').count().catch(err => `ERR:${err.message}`);
    console.log("NM LINK COUNT:", nmCount);
    console.log("PAGE CLOSED BEFORE getCastRows:", page.isClosed());

    console.log("STEP 6: getCastRows");
    const rows = await getCastRows(page, 5);
    console.log("ROWS:", rows);
    console.log("PAGE CLOSED AFTER getCastRows:", page.isClosed());
  } catch (err) {
    console.log("FLOW ERROR:", err.message);
    console.log("PAGE CLOSED ON ERROR:", page.isClosed());
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


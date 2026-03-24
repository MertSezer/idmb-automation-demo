const { chromium, firefox, webkit } = require("playwright");
const config = require("../config");

function resolveBrowserType() {
  switch ((config.browser || "chromium").toLowerCase()) {
    case "firefox":
      return firefox;
    case "webkit":
      return webkit;
    case "chromium":
    default:
      return chromium;
  }
}

async function createBrowserRuntime() {
  const browserType = resolveBrowserType();

  const launchOptions = {
    headless: config.headless,
    slowMo: config.slowMo
  };

  const browser = await browserType.launch(launchOptions);

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();
  page.setDefaultTimeout(config.actionTimeout);
  page.setDefaultNavigationTimeout(config.navigationTimeout);

  return { browser, context, page };
}

module.exports = { createBrowserRuntime };

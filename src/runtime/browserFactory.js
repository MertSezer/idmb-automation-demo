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

  if ((config.browser || "chromium").toLowerCase() === "chromium") {
    launchOptions.channel = "chromium";
  }

  const browser = await browserType.launch(launchOptions);

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    locale: "en-US",
    timezoneId: "Europe/Istanbul",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      "Upgrade-Insecure-Requests": "1"
    }
  });

  const page = await context.newPage();
  page.setDefaultTimeout(config.actionTimeout);
  page.setDefaultNavigationTimeout(config.navigationTimeout);

  return { browser, context, page };
}

module.exports = { createBrowserRuntime };

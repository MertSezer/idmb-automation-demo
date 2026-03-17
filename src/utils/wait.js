async function waitForPageReady(page, timeout = 15000) {
  await page.waitForLoadState("domcontentloaded", { timeout }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout }).catch(() => {});
}

module.exports = { waitForPageReady };

const path = require("path");
const config = require("../config");
const logger = require("../utils/logger");
const { splitName, cleanName } = require("../utils/nameParser");
const { sanitizeFileName } = require("../utils/file");
const { withRetry } = require("../utils/retry");
const { openTitlePage, getMovieTitle, findCastSection, getCastRows } = require("./titlePage");
const { openProfilePage, getProfileFullName } = require("./profilePage");

async function maybeScreenshot(page, fileName) {
  if (!config.takeScreenshots) return "";
  const filePath = path.join(config.paths.screenshotsDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true }).catch(() => {});
  return filePath;
}

function normalizeForMatch(value) {
  return cleanName(value).toLowerCase();
}

function getMatchStatus(listedFullName, profileFullName) {
  if (!listedFullName || !profileFullName) return "unknown";
  return normalizeForMatch(listedFullName) === normalizeForMatch(profileFullName)
    ? "matched"
    : "different";
}

async function scrapeTitle(page, movieUrl, context = {}) {
  const titleRunId = context.titleRunId || '';
  await withRetry(
    () => openTitlePage(page, movieUrl, config.navigationTimeout),
    { retries: config.maxRetries, label: "openTitlePage", meta: { titleRunId } }
  );

  const movieTitle = await getMovieTitle(page);
  const movieSlug = sanitizeFileName(movieTitle || "unknown_movie");

  logger.info("TITLE_PAGE_OPENED", {
    titleRunId, movieTitle, movieUrl });
  const titleScreenshotPath = await maybeScreenshot(page, `${movieSlug}_title.png`);

  const castSection = await findCastSection(page);
  const castSectionScreenshotPath = await maybeScreenshot(page, `${movieSlug}_cast_section.png`);
  logger.info("CAST_SECTION_FOUND", {
    titleRunId,
    movieTitle,
    screenshotPath: castSectionScreenshotPath
  });

  const castRows = await getCastRows(page, config.maxCastPerTitle);
  logger.info("CAST_ROWS_DISCOVERED", {
    titleRunId,
    movieTitle,
    count: castRows.length
  });

  const results = [];
  const profilePage = await page.context().newPage();
  profilePage.setDefaultTimeout(config.actionTimeout);
  profilePage.setDefaultNavigationTimeout(config.navigationTimeout);

  try {
    for (const row of castRows) {
      const rowFileBase = `${movieSlug}_row_${row.rowIndex}`;
      let rowScreenshotPath = titleScreenshotPath;
      let profileScreenshotPath = "";
      let profileFullName = "";
      let sourcePage = "list";
      let profileVisited = false;
      let status = "passed";
      let errorMessage = "";
      let matchStatus = "unknown";

      logger.info("ROW_SELECTED", {
        titleRunId,
        movieTitle,
        rowIndex: row.rowIndex,
        listedFullName: row.listedFullName,
        profileUrl: row.profileUrl
      });

      rowScreenshotPath =
        (await maybeScreenshot(page, `${rowFileBase}_selected.png`)) || rowScreenshotPath;

      try {
        await withRetry(
          () => openProfilePage(profilePage, row.profileUrl, config.navigationTimeout),
          { retries: config.maxRetries, label: `openProfilePage_${row.rowIndex}`, meta: { titleRunId } }
        );

        profileVisited = true;
        logger.info("PROFILE_OPENED", {
          titleRunId,
          movieTitle,
          rowIndex: row.rowIndex,
          profileUrl: row.profileUrl
        });

        profileScreenshotPath =
          (await maybeScreenshot(profilePage, `${rowFileBase}_profile.png`)) || "";

        profileFullName = await getProfileFullName(profilePage, `${movieTitle}_row_${row.rowIndex}_profile`);

        logger.info("PROFILE_NAME_EXTRACTED", {
          titleRunId,
          movieTitle,
          rowIndex: row.rowIndex,
          profileFullName
        });

        if (profileFullName === "__CHALLENGE__") {
          profileFullName = "";
          sourcePage = "list";
          status = "warning";
          errorMessage = "IMDb profile page blocked by AWS WAF challenge";
          matchStatus = "blocked";
        } else {
          if (profileFullName) {
            sourcePage = "profile";
          }
          matchStatus = getMatchStatus(row.listedFullName, profileFullName || row.listedFullName);
        }

        logger.info("ROW_PROFILE_MATCH_RESULT", {
          titleRunId,
          movieTitle,
          rowIndex: row.rowIndex,
          listedFullName: row.listedFullName,
          profileFullName: profileFullName || "",
          matchStatus
        });
      } catch (error) {
        status = "warning";
        errorMessage = error.message;
        matchStatus = "unknown";

        logger.warn("PROFILE_VISIT_FAILED", {
          titleRunId,
          movieTitle,
          rowIndex: row.rowIndex,
          profileUrl: row.profileUrl,
          error: error.message
        });
      }

      const finalFullName = profileFullName || row.listedFullName;
      const { name, surname } = splitName(finalFullName);

      if (!name) {
        results.push({
          movieUrl,
          movieTitle,
          rowIndex: row.rowIndex,
          listedFullName: row.listedFullName,
          profileFullName,
          name: "",
          surname: "",
          fullName: finalFullName,
          sourcePage,
          profileVisited,
          profileUrl: row.profileUrl,
          matchStatus,
          status: "failed",
          errorMessage: errorMessage || "Name extraction failed",
          titleScreenshotPath,
          castSectionScreenshotPath,
          rowScreenshotPath,
          profileScreenshotPath,
          stepName: "TITLE_CAST_PROFILE_FLOW"
        });
        continue;
      }

      const record = {
        movieUrl,
        movieTitle,
        rowIndex: row.rowIndex,
        listedFullName: row.listedFullName,
        profileFullName,
        name,
        surname,
        fullName: finalFullName,
        sourcePage,
        profileVisited,
        profileUrl: row.profileUrl,
        matchStatus,
        status,
        errorMessage,
        titleScreenshotPath,
        castSectionScreenshotPath,
        rowScreenshotPath,
        profileScreenshotPath,
        stepName: "TITLE_CAST_PROFILE_FLOW"
      };

      logger.info("PERSON_FOUND", {
        titleRunId,
        ...record
      });
      results.push(record);
    }
  } finally {
    await profilePage.close().catch(() => {});
  }

  return results;
}

module.exports = { scrapeTitle };

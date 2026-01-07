import { test } from "@playwright/test";
import fs from "fs";
import path from "path";
import { toCsv, type ViolationRow } from "./reporters/toCsv";
import { toHtml } from "./reporters/toHtml";

type Target = { name: string; url: string };
type UrlFile = { targets: Target[] };

const REPORT_DIR = path.resolve(process.cwd(), "reports");
const SCREENSHOT_DIR = path.join(REPORT_DIR, "screenshots");
const URLS_FILE = path.resolve(process.cwd(), "urls.json");

// Accessibility configuration
const AXE_TAGS = ["wcag2a", "wcag2aa"];
const EXCLUDED_SELECTORS: string[] = [];

// CDN injection avoids ESM/CJS require issues
const AXE_CDN_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.0/axe.min.js";

// Optional delay after navigation (helps dynamic pages)
const POST_GOTO_DELAY_MS = 500;

// Timeouts
const GOTO_TIMEOUT_MS = 30000;

/* -------------------- helpers -------------------- */

function ensureDirs() {
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  if (!fs.existsSync(SCREENSHOT_DIR))
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function loadTargets(): Target[] {
  const raw = fs.readFileSync(URLS_FILE, "utf-8");
  const parsed = JSON.parse(raw) as UrlFile;
  if (!parsed.targets?.length) {
    throw new Error("urls.json must include a non-empty targets[] array");
  }
  return parsed.targets;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown-domain";
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/* -------------------- test -------------------- */

test("Accessibility scan (Playwright + axe-core)", async ({ page }) => {
  ensureDirs();

  const generatedAt = new Date().toISOString();
  const targets = loadTargets();

  const csvRows: ViolationRow[] = [];
  const allResults: any[] = [];

  for (const t of targets) {
    await test.step(`Scanning: ${t.name} — ${t.url}`, async () => {
      const domain = getDomain(t.url);

      // Precompute screenshot path (so we can reuse in success/failure)
      const safeName = slugify(`${domain}-${t.name}`);
      const screenshotFile = `screenshots/${safeName}.png`;
      const screenshotPath = path.join(REPORT_DIR, screenshotFile);

      // We'll record a scanResult object per page (success or failure)
      const scanRecord: any = {
        pageName: t.name,
        url: t.url,
        domain,
        generatedAt,
        ok: true,
        error: null as string | null,
        results: null as any
      };

      try {
        // Navigate
        await page.goto(t.url, {
          waitUntil: "domcontentloaded",
          timeout: GOTO_TIMEOUT_MS
        });

        // Optional delay
        if (POST_GOTO_DELAY_MS > 0) {
          await page.waitForTimeout(POST_GOTO_DELAY_MS);
        }

        // Screenshot (best effort)
        try {
          await page.screenshot({ path: screenshotPath, fullPage: true });
        } catch (sErr) {
          // Don't fail scan if screenshot fails; still log
          scanRecord.screenshot_error = toErrorMessage(sErr);
        }

        // Inject axe-core
        await page.addScriptTag({ url: AXE_CDN_URL });

        // Run axe
        const results = await page.evaluate(
          async ({ tags, excluded }) => {
            // Wait for axe to be present (CDN timing)
            for (let i = 0; i < 40; i++) {
              if ((window as any).axe) break;
              await new Promise(r => setTimeout(r, 50));
            }

            const axe = (window as any).axe;
            if (!axe) throw new Error("axe-core not found on window");

            const options: any = {
              runOnly: { type: "tag", values: tags }
            };

            // Most compatible signature: axe.run(document, options)
            if (excluded && excluded.length) {
              const context = { exclude: excluded.map((sel: string) => [sel]) };
              return await axe.run(context, options);
            }

            return await axe.run(document, options);
          },
          { tags: AXE_TAGS, excluded: EXCLUDED_SELECTORS }
        );

        scanRecord.results = results;

        // Convert violations to CSV/HTML rows
        for (const v of results.violations ?? []) {
          csvRows.push({
            domain,
            pageName: t.name,
            url: t.url,
            impact: v.impact ?? "unknown",
            id: v.id,
            description: v.description ?? "",
            help: v.help ?? "",
            helpUrl: v.helpUrl ?? "",
            nodes: (v.nodes ?? []).length,
            screenshot: screenshotFile
          });
        }
      } catch (err) {
        // Continue-on-error behavior:
        // 1) mark scanRecord as failed
        // 2) create a special "SCAN_ERROR" row so it appears in CSV/HTML
        scanRecord.ok = false;
        scanRecord.error = toErrorMessage(err);

        // Best-effort screenshot if we haven't already (helps debugging)
        try {
          await page.screenshot({ path: screenshotPath, fullPage: true });
        } catch {
          // ignore
        }

        csvRows.push({
          domain,
          pageName: t.name,
          url: t.url,
          impact: "error",
          id: "SCAN_ERROR",
          description: scanRecord.error ?? "Unknown scan error",
          help: "This page could not be scanned. See error details in description.",
          helpUrl: "",
          nodes: 0,
          screenshot: screenshotFile
        });
      } finally {
        allResults.push(scanRecord);
      }
    });
  }

  // Write outputs
  const stamp = Date.now();

  const jsonPath = path.join(REPORT_DIR, `a11y-report-${stamp}.json`);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ generatedAt, scans: allResults }, null, 2),
    "utf-8"
  );

  const csvPath = path.join(REPORT_DIR, `a11y-summary-${stamp}.csv`);
  fs.writeFileSync(csvPath, toCsv(csvRows), "utf-8");

  const htmlPath = path.join(REPORT_DIR, `a11y-report-${stamp}.html`);
  fs.writeFileSync(htmlPath, toHtml(csvRows, generatedAt), "utf-8");

  console.log("Accessibility scan complete:");
  console.log(`• JSON: ${jsonPath}`);
  console.log(`• CSV:  ${csvPath}`);
  console.log(`• HTML: ${htmlPath}`);

  const errors = csvRows.filter(r => r.id === "SCAN_ERROR");
  if (errors.length > 0) {
    console.warn(`⚠️ ${errors.length} pages failed to scan (SCAN_ERROR rows).`);
  }

  const critical = csvRows.filter(r =>
    ["critical", "serious"].includes(r.impact)
  );
  if (critical.length > 0) {
    console.warn(
      `⚠️ ${critical.length} critical/serious accessibility issues found.`
    );
  }
});

const fs = require("fs");
const path = require("path");

function findNewestRunFolder(reportsRoot) {
  const years = fs.readdirSync(reportsRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d{4}$/.test(d.name))
    .map(d => d.name)
    .sort();
  if (!years.length) return null;

  const newestYear = years[years.length - 1];
  const yearPath = path.join(reportsRoot, newestYear);

  const months = fs.readdirSync(yearPath, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d{2}$/.test(d.name))
    .map(d => d.name)
    .sort();
  if (!months.length) return null;

  const newestMonth = months[months.length - 1];
  const monthPath = path.join(yearPath, newestMonth);

  return { newestYear, newestMonth, monthPath };
}

function parseStats(jsonPath) {
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const violations = data.violations || [];
    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0, unknown: 0 };
    for (const v of violations) {
      const impact = (v.impact || "unknown").toLowerCase();
      counts[impact] = (counts[impact] ?? 0) + 1;
    }
    return { total: violations.length, counts };
  } catch {
    return { total: null, counts: null };
  }
}

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pill(label, cls, val) {
  return `<span class="pill ${cls}">${label}: ${val}</span>`;
}

function buildHtml(title, rowsHtml) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 24px; background: #0b0f17; color: #e6edf3; }
    .wrap { max-width: 1120px; margin: 0 auto; }
    h1 { margin: 0 0 6px; font-size: 22px; }
    .sub { opacity: .85; margin-bottom: 18px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,.08); font-size: 14px; vertical-align: top; }
    th { text-align: left; font-weight: 700; background: rgba(255,255,255,.04); }
    a { color: #8ab4f8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.06); font-size: 12px; margin-right: 6px; margin-bottom: 6px; }
    .critical { border-color: rgba(255,0,0,.35); }
    .serious  { border-color: rgba(255,140,0,.35); }
    .moderate { border-color: rgba(255,255,0,.25); }
    .minor    { border-color: rgba(0,255,255,.18); }
    .muted { opacity: .75; font-size: 13px; }
    .links a { margin-right: 10px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${esc(title)}</h1>
    <div class="sub">Most recent multi-scan dashboard. Each row links to the per-page report + downloadable artifacts.</div>
    <table>
      <thead>
        <tr>
          <th>Page</th>
          <th>Violations</th>
          <th>Severity</th>
          <th>Artifacts</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    <div class="muted" style="margin-top:12px;">
      Tip: Open <code>reports/latest.html</code> for the most recent single-page report, or <code>reports/index.html</code> for the dashboard.
    </div>
  </div>
</body>
</html>`;
}

function main() {
  const reportsRoot = path.join(process.cwd(), "reports");
  if (!fs.existsSync(reportsRoot)) {
    console.error("❌ reports/ folder not found. Run scans first.");
    process.exit(1);
  }

  const newest = findNewestRunFolder(reportsRoot);
  if (!newest) {
    console.error("❌ No year/month run folders found in reports/. Run scans first.");
    process.exit(1);
  }

  const { monthPath, newestYear, newestMonth } = newest;

  const jsonFiles = fs.readdirSync(monthPath).filter(f => f.endsWith("_a11y.json"));
  if (!jsonFiles.length) {
    console.error("❌ No *_a11y.json files found in newest reports folder.");
    process.exit(1);
  }

  const rows = jsonFiles.sort().map((jsonFile) => {
    const base = jsonFile.replace(/\.json$/i, "");
    const htmlFile = `${base}.html`;
    const csvFile = `${base}.csv`;

    const jsonPath = path.join(monthPath, jsonFile);
    const stats = parseStats(jsonPath);

    const pageLabel = base
      .replace(/^\d{4}-\d{2}-\d{2}_\d{6}_/, "")
      .replace(/_a11y$/, "");

    const relHtml = path.relative(path.join(process.cwd(), "reports"), path.join(monthPath, htmlFile)).replaceAll("\\", "/");
    const relJson = path.relative(path.join(process.cwd(), "reports"), path.join(monthPath, jsonFile)).replaceAll("\\", "/");
    const relCsv = path.relative(path.join(process.cwd(), "reports"), path.join(monthPath, csvFile)).replaceAll("\\", "/");

    const counts = stats.counts;
    const breakdown = counts
      ? [
          pill("critical", "critical", counts.critical ?? 0),
          pill("serious", "serious", counts.serious ?? 0),
          pill("moderate", "moderate", counts.moderate ?? 0),
          pill("minor", "minor", counts.minor ?? 0),
        ].join(" ")
      : `<span class="muted">n/a</span>`;

    const violationsCell = stats.total === null ? "n/a" : String(stats.total);

    return `
      <tr>
        <td>${esc(pageLabel)}</td>
        <td>${esc(violationsCell)}</td>
        <td>${breakdown}</td>
        <td class="links">
          <a href="${esc(relHtml)}" target="_blank" rel="noreferrer">HTML</a>
          <a href="${esc(relCsv)}"  target="_blank" rel="noreferrer">CSV</a>
          <a href="${esc(relJson)}" target="_blank" rel="noreferrer">JSON</a>
        </td>
      </tr>
    `;
  }).join("\n");

  const title = `a11y-scan dashboard (${newestYear}/${newestMonth})`;

  const monthIndex = path.join(monthPath, "index.html");
  const rootIndex = path.join(reportsRoot, "index.html");

  const html = buildHtml(title, rows);
  fs.writeFileSync(monthIndex, html, "utf8");
  fs.writeFileSync(rootIndex, html, "utf8");

  console.log(`🧾 Dashboard written to: ${monthIndex}`);
  console.log(`⭐ Latest dashboard updated: ${rootIndex}`);
}

main();

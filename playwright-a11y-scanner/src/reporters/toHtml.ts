import escapeHtml from "escape-html";
import type { ViolationRow } from "./toCsv";

export function toHtml(rows: ViolationRow[], generatedAt: string): string {
  // Group by domain
  const domains = new Map<string, ViolationRow[]>();
  for (const row of rows) {
    const domain = row.domain || "unknown-domain";
    domains.set(domain, [...(domains.get(domain) ?? []), row]);
  }

  const domainSections = [...domains.entries()]
    .map(([domain, domainRows]) => {
      // Group by page within domain
      const pages = new Map<string, ViolationRow[]>();
      for (const r of domainRows) {
        const pageKey = `${r.pageName} — ${r.url}`;
        pages.set(pageKey, [...(pages.get(pageKey) ?? []), r]);
      }

      const pageBlocks = [...pages.entries()]
        .map(([pageKey, violations]) => {
          const screenshotPath = violations[0]?.screenshot;

          const screenshotBlock = screenshotPath
            ? `
              <div style="margin: 12px 0;">
                <img
                  src="${escapeHtml(screenshotPath)}"
                  alt="Screenshot of ${escapeHtml(pageKey)}"
                  style="max-width: 100%; border: 1px solid #ccc; border-radius: 10px;"
                />
              </div>
            `
            : "";

          const items = violations
            .map(v => `
              <li>
                <strong>${escapeHtml(v.impact)}</strong>
                <code>${escapeHtml(v.id)}</code>
                — ${escapeHtml(v.help)}
                (<a href="${escapeHtml(v.helpUrl)}" target="_blank" rel="noreferrer">docs</a>)
                — affected nodes: ${v.nodes}
              </li>
            `)
            .join("");

          return `
            <div style="margin: 24px 0; padding: 12px 0; border-top: 1px solid #eee;">
              <h3 style="margin: 0 0 6px 0;">${escapeHtml(pageKey)}</h3>
              ${screenshotBlock}
              ${items ? `<ul style="margin: 0; padding-left: 20px;">${items}</ul>` : "<p>No violations.</p>"}
            </div>
          `;
        })
        .join("");

      return `
        <section style="margin: 28px 0; padding: 18px; border: 1px solid #ddd; border-radius: 14px;">
          <h2 style="margin: 0 0 12px 0;">${escapeHtml(domain)}</h2>
          ${pageBlocks || "<p>No violations for this domain.</p>"}
        </section>
      `;
    })
    .join("");

  const body =
    rows.length === 0
      ? "<p>✅ No accessibility violations found.</p>"
      : domainSections;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Accessibility Report</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; line-height: 1.5; }
    h1 { margin: 0 0 6px 0; }
    .meta { color: #555; margin-bottom: 18px; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 6px; }
    li { margin-bottom: 8px; }
  </style>
</head>
<body>
  <h1>Accessibility Audit Report</h1>
  <div class="meta">Generated: ${escapeHtml(generatedAt)}</div>
  ${body}
</body>
</html>`;
}

import json
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

AXE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js"


def slugify(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text or "report"


def build_report_paths(url: str) -> tuple[Path, Path, Path, Path]:
    """
    Returns:
      (dated_json, dated_html, latest_json, latest_html)

    Dated paths go to: ./reports/YYYY/MM/
    Latest paths go to: ./reports/latest.json and ./reports/latest.html
    """
    now = datetime.now()

    # Root reports folder
    reports_root = Path.cwd() / "reports"
    reports_root.mkdir(parents=True, exist_ok=True)

    # Year/month folder (e.g., reports/2026/01)
    dated_dir = reports_root / now.strftime("%Y") / now.strftime("%m")
    dated_dir.mkdir(parents=True, exist_ok=True)

    ts = now.strftime("%Y-%m-%d_%H%M%S")

    parsed = urlparse(url)
    host = parsed.netloc or parsed.path or "site"
    host_slug = slugify(host)

    base = f"{ts}_{host_slug}_a11y"

    dated_json = dated_dir / f"{base}.json"
    dated_html = dated_dir / f"{base}.html"

    latest_json = reports_root / "latest.json"
    latest_html = reports_root / "latest.html"

    return dated_json, dated_html, latest_json, latest_html


def run_a11y_scan(url: str) -> dict:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print(f"🔍 Scanning accessibility for: {url}")

        page.goto(url, wait_until="networkidle", timeout=90000)

        # Inject axe-core and run it in the page context
        page.add_script_tag(url=AXE_CDN)
        results = page.evaluate(
            """async () => {
                return await axe.run(document, {
                    resultTypes: ['violations']
                });
            }"""
        )

        browser.close()
        return results


def render_html_report(url: str, results: dict) -> str:
    violations = results.get("violations", [])
    scanned_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def esc(s: str) -> str:
        return (
            str(s)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
        )

    cards = []
    for v in violations:
        rule_id = esc(v.get("id", "unknown"))
        impact = esc(v.get("impact", "unknown"))
        description = esc(v.get("description", ""))
        help_url = esc(v.get("helpUrl", ""))

        targets = []
        for node in v.get("nodes", [])[:10]:
            for t in node.get("target", []):
                targets.append(esc(t))

        targets_html = "<br>".join(targets) if targets else "(no targets provided)"

        cards.append(
            f"""
            <div class="card">
              <div class="top">
                <div class="rule">{rule_id}</div>
                <div class="pill {impact}">{impact}</div>
              </div>
              <div class="desc">{description}</div>
              <div class="meta">
                <a href="{help_url}" target="_blank" rel="noreferrer">Deque rule help</a>
              </div>
              <div class="targets">
                <div class="label">Affected targets (sample)</div>
                <div class="code">{targets_html}</div>
              </div>
            </div>
            """
        )

    body = "\n".join(cards) if cards else """
      <div class="success">
        ✅ No accessibility violations found.
      </div>
    """

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>a11y-scan report</title>
  <style>
    body {{
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      background: #0b0f17;
      color: #e6edf3;
    }}
    .wrap {{
      max-width: 980px;
      margin: 0 auto;
    }}
    .header {{
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }}
    .title {{
      font-size: 22px;
      font-weight: 700;
    }}
    .sub {{
      font-size: 14px;
      opacity: .85;
      line-height: 1.4;
    }}
    .summary {{
      margin: 18px 0;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }}
    .stat {{
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 12px;
      padding: 10px 12px;
      font-size: 14px;
    }}
    .cards {{
      display: grid;
      gap: 12px;
    }}
    .card {{
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 14px;
      padding: 14px;
    }}
    .top {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }}
    .rule {{
      font-size: 16px;
      font-weight: 700;
      letter-spacing: .2px;
    }}
    .pill {{
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.16);
      background: rgba(255,255,255,.06);
      text-transform: lowercase;
      white-space: nowrap;
    }}
    .pill.critical {{ border-color: rgba(255,0,0,.35); }}
    .pill.serious  {{ border-color: rgba(255,140,0,.35); }}
    .pill.moderate {{ border-color: rgba(255,255,0,.25); }}
    .pill.minor    {{ border-color: rgba(0,255,255,.18); }}
    .desc {{
      font-size: 14px;
      opacity: .92;
      line-height: 1.45;
      margin-bottom: 10px;
    }}
    .meta a {{
      color: #8ab4f8;
      text-decoration: none;
      font-size: 13px;
    }}
    .meta a:hover {{ text-decoration: underline; }}
    .targets {{
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(255,255,255,.08);
    }}
    .label {{
      font-size: 12px;
      opacity: .8;
      margin-bottom: 6px;
    }}
    .code {{
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      background: rgba(0,0,0,.25);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 10px;
      padding: 10px;
      overflow-x: auto;
      line-height: 1.4;
    }}
    .success {{
      background: rgba(0,255,140,.08);
      border: 1px solid rgba(0,255,140,.18);
      padding: 14px;
      border-radius: 14px;
      font-size: 14px;
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="title">a11y-scan report</div>
      <div class="sub">
        URL: <strong>{esc(url)}</strong><br>
        Scanned: {esc(scanned_at)}
      </div>
    </div>

    <div class="summary">
      <div class="stat"><strong>Violations:</strong> {len(violations)}</div>
      <div class="stat"><strong>Engine:</strong> axe-core (via Playwright)</div>
    </div>

    <div class="cards">
      {body}
    </div>
  </div>
</body>
</html>
"""


def main():
    if len(sys.argv) < 2:
        print("❌ No URL provided.")
        print("Usage: python engine.py https://example.com")
        sys.exit(1)

    url = sys.argv[1]
    results = run_a11y_scan(url)

    violations = results.get("violations", [])

    print("\n♿ Accessibility Scan Results")
    print("=" * 40)

    if not violations:
        print("✅ No accessibility violations found!")
    else:
        print(f"❌ {len(violations)} accessibility issues detected:\n")

        for v in violations:
            rule_id = v.get("id", "unknown")
            impact = v.get("impact", "unknown")
            desc = v.get("description", "")
            help_url = v.get("helpUrl", "")

            print(f"Rule: {rule_id}")
            print(f"Impact: {impact}")
            print(f"Description: {desc}")
            print(f"Help: {help_url}")

            nodes = v.get("nodes", [])
            if nodes:
                for idx, node in enumerate(nodes[:3], start=1):
                    targets = node.get("target", [])
                    print(f"  Affected target {idx}: {targets}")

            print("-" * 40)

    dated_json, dated_html, latest_json, latest_html = build_report_paths(url)

    # Generate HTML once (so both dated + latest match exactly)
    html = render_html_report(url, results)
    json_text = json.dumps(results, indent=2)

    # Write dated outputs
    dated_json.write_text(json_text, encoding="utf-8")
    dated_html.write_text(html, encoding="utf-8")

    # Write "latest" outputs
    latest_json.write_text(json_text, encoding="utf-8")
    latest_html.write_text(html, encoding="utf-8")

    print(f"\n📄 JSON report saved to: {dated_json}")
    print(f"🧾 HTML report saved to: {dated_html}")
    print(f"⭐ Latest JSON updated:   {latest_json}")
    print(f"⭐ Latest HTML updated:   {latest_html}")


if __name__ == "__main__":
    main()

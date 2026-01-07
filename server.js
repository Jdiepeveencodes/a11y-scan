const express = require("express");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const app = express();
const PORT = 5177;

// ---- Helpers ----
function parseUrls(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function runPythonScan(url) {
  return new Promise((resolve, reject) => {
    const enginePath = path.join(__dirname, "playwright-a11y-scanner", "engine.py");
    const pythonCmd = "python"; // if your machine uses "py", change this to "py"

    const child = spawn(pythonCmd, [enginePath, url], { stdio: "inherit" });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Scan failed (exit ${code})`));
    });

    child.on("error", (err) => reject(err));
  });
}

function buildDashboard() {
  return new Promise((resolve, reject) => {
    const builder = path.join(__dirname, "scripts", "build-index.js");
    const child = spawn("node", [builder], { stdio: "inherit" });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Dashboard build failed (exit ${code})`));
    });

    child.on("error", reject);
  });
}

// ---- Middleware ----
app.use(express.json({ limit: "1mb" }));

// Serve the reports folder so HTML/CSV/JSON can be opened in browser
app.use("/reports", express.static(path.join(__dirname, "reports"), {
  setHeaders(res) {
    // helpful so CSV downloads nicely in many browsers
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
}));

// Serve a simple UI (no build tools)
app.get("/", (req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>a11y-scan launcher</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 28px; background: #0b0f17; color: #e6edf3; }
    .wrap { max-width: 900px; margin: 0 auto; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    p { margin: 0 0 18px; opacity: .85; line-height: 1.45; }
    textarea {
      width: 100%; height: 240px; resize: vertical;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.12);
      color: #e6edf3;
      border-radius: 12px;
      padding: 12px;
      font-size: 14px;
      line-height: 1.4;
    }
    .row { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
    button, a.btn {
      border: 1px solid rgba(255,255,255,.16);
      background: rgba(255,255,255,.06);
      color: #e6edf3;
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 14px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    button:hover, a.btn:hover { background: rgba(255,255,255,.10); }
    .log {
      margin-top: 16px;
      background: rgba(0,0,0,.25);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 12px;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      white-space: pre-wrap;
      line-height: 1.4;
      min-height: 90px;
    }
    .muted { opacity: .75; font-size: 13px; margin-top: 10px; }
    .ok { color: #7ee787; }
    .bad { color: #ff7b72; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>a11y-scan launcher</h1>
    <p>Paste one URL per line and click <strong>Run Scan</strong>. When finished, open the dashboard.</p>

    <textarea id="urls" placeholder="https://example.com
https://salesforce.com
# lines starting with # are ignored"></textarea>

    <div class="row">
      <button id="run">Run Scan</button>
      <a class="btn" href="/reports/index.html" target="_blank" rel="noreferrer">Open Dashboard</a>
      <a class="btn" href="/reports/latest.html" target="_blank" rel="noreferrer">Open Latest Report</a>
    </div>

    <div class="muted">Tip: This runs scans sequentially for stability.</div>

    <div id="log" class="log">Ready.</div>
  </div>

  <script>
    const $ = (id) => document.getElementById(id);
    const log = (msg) => { $("log").textContent += "\\n" + msg; $("log").scrollTop = $("log").scrollHeight; };

    $("run").addEventListener("click", async () => {
      const urls = $("urls").value;
      $("log").textContent = "";
      log("Starting scan...");

      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls })
        });

        const data = await res.json();

        if (!res.ok) {
          log("❌ Error: " + (data.error || "Unknown error"));
          return;
        }

        log("✅ Completed.");
        log("Scanned: " + data.scanned);
        if (data.failed && data.failed.length) {
          log("⚠ Failed:");
          data.failed.forEach(f => log(" - " + f.url + " :: " + f.error));
        } else {
          log("No failures.");
        }

        log("");
        log("Dashboard: " + data.dashboardUrl);
        log("Latest report: " + data.latestUrl);
      } catch (e) {
        log("❌ Exception: " + e.message);
      }
    });
  </script>
</body>
</html>`);
});

// Scan endpoint
app.post("/api/scan", async (req, res) => {
  const input = (req.body && req.body.urls) ? String(req.body.urls) : "";
  const urls = parseUrls(input);

  if (!urls.length) {
    return res.status(400).json({ error: "No URLs provided. Add one URL per line." });
  }

  const failed = [];
  let scanned = 0;

  // Ensure reports folder exists
  fs.mkdirSync(path.join(__dirname, "reports"), { recursive: true });

  // Run scans sequentially
  for (const url of urls) {
    try {
      console.log(`\n=== Scanning: ${url} ===`);
      await runPythonScan(url);
      scanned += 1;
    } catch (err) {
      failed.push({ url, error: err.message });
    }
  }

  // Build dashboard from newest folder
  try {
    await buildDashboard();
  } catch (err) {
    return res.status(500).json({ error: "Scans finished but dashboard build failed: " + err.message });
  }

  // Write failures log for visibility
  if (failed.length) {
    const out = path.join(__dirname, "reports", "latest-failures.json");
    fs.writeFileSync(out, JSON.stringify(failed, null, 2), "utf8");
  }

  return res.json({
    scanned,
    failed,
    dashboardUrl: "/reports/index.html",
    latestUrl: "/reports/latest.html"
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`✅ a11y-scan launcher running: http://localhost:${PORT}`);
  console.log(`📂 Reports served at: http://localhost:${PORT}/reports/index.html`);
});

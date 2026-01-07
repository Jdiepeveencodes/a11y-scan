const express = require("express");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const app = express();
const PORT = 5177;

function parseUrls(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function runPythonScan(url) {
  return new Promise((resolve, reject) => {
    const enginePath = path.join(__dirname, "playwright-a11y-scanner", "engine.py");

    // Use py on Windows if python isn't found
    const pythonCmd = process.platform === "win32" ? "py" : "python";

    const child = spawn(pythonCmd, [enginePath, url], { stdio: "inherit" });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Scan failed (exit ${code})`));
    });

    child.on("error", reject);
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

app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Serve launcher UI as a static site
app.use("/", express.static(path.join(__dirname, "a11y-web")));

// Serve reports (HTML/CSV/JSON)
app.use(
  "/reports",
  express.static(path.join(__dirname, "reports"), {
    setHeaders(res) {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

app.post("/api/scan", async (req, res) => {
  const urls = parseUrls(req.body && req.body.urls);
  if (!urls.length) return res.status(400).json({ error: "No URLs provided. Add one URL per line." });

  const failed = [];
  let scanned = 0;

  fs.mkdirSync(path.join(__dirname, "reports"), { recursive: true });

  for (const url of urls) {
    try {
      console.log(`\n=== Scanning: ${url} ===`);
      await runPythonScan(url);
      scanned += 1;
    } catch (err) {
      failed.push({ url, error: String(err && err.message ? err.message : err) });
    }
  }

  try {
    await buildDashboard();
  } catch (err) {
    return res.status(500).json({ error: "Scans finished but dashboard build failed: " + err.message });
  }

  if (failed.length) {
    fs.writeFileSync(
      path.join(__dirname, "reports", "latest-failures.json"),
      JSON.stringify(failed, null, 2),
      "utf8"
    );
  }

  res.json({
    scanned,
    failed,
    dashboardUrl: "/reports/index.html",
    latestUrl: "/reports/latest.html",
  });
});

app.listen(PORT, () => {
  console.log(`✅ a11y-scan launcher running: http://localhost:${PORT}`);
  console.log(`📂 Reports served at: http://localhost:${PORT}/reports/index.html`);
});

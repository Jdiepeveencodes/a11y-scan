const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function readUrls(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function runOne(url) {
  return new Promise((resolve, reject) => {
    const enginePath = path.join(__dirname, "..", "playwright-a11y-scanner", "engine.py");
    const pythonCmd = "python";

    console.log(`\n🔎 Scanning: ${url}`);
    const child = spawn(pythonCmd, [enginePath, url], { stdio: "inherit" });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Scan failed for ${url} (exit code ${code})`));
    });

    child.on("error", (err) => reject(err));
  });
}

(async function main() {
  const args = process.argv.slice(2);
  const file = args[0];

  if (!file) {
    console.error("❌ No file provided.");
    console.error("Usage: npm run scan:file -- urls.txt");
    process.exit(1);
  }

  const fullPath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);

  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${fullPath}`);
    process.exit(1);
  }

  const urls = readUrls(fullPath);

  if (!urls.length) {
    console.error("❌ No URLs found in file (or file is empty).");
    process.exit(1);
  }

  console.log(`📄 Loaded ${urls.length} URL(s) from ${fullPath}`);

  // Run sequentially (safer, avoids hammering sites)
  for (const url of urls) {
    await runOne(url);
  }

  // After all scans, build an index page from the newest dated run folder
  const indexBuilder = path.join(__dirname, "build-index.js");
  await new Promise((resolve, reject) => {
    const child = spawn("node", [indexBuilder], { stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("Index build failed"))));
    child.on("error", reject);
  });

  console.log("\n✅ Done. Open reports/index.html to view the most recent run dashboard.");
})().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});

const { spawn } = require("child_process");
const path = require("path");

function getUrlFromArgs() {
  const args = process.argv.slice(2);
  const url = args.find((a) => /^https?:\/\//i.test(a));
  return url || null;
}

const url = getUrlFromArgs();

if (!url) {
  console.error("❌ No URL provided.");
  console.error("Usage: npm run scan -- https://example.com");
  process.exit(1);
}

const enginePath = path.join(__dirname, "..", "playwright-a11y-scanner", "engine.py");

// Keep as "python" since that's working for you now.
// If needed later, change to "py".
const pythonCmd = "python";

console.log(`🔎 Running a11y scan: ${url}`);

const child = spawn(pythonCmd, [enginePath, url], { stdio: "inherit" });

child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error("❌ Failed to start Python:", err.message);
  process.exit(1);
});

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

def write_status(run_dir: Path, status: dict) -> None:
    (run_dir / "status.json").write_text(json.dumps(status, indent=2), encoding="utf-8")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--node-dir", required=True, help="Path to Node scanner project (playwright-a11y-scanner)")
    ap.add_argument("--run-dir", required=True, help="Path to run output folder (created by Streamlit)")
    ap.add_argument("--npm-script", default="a11y", help="npm script to run (default: a11y)")
    args = ap.parse_args()

    node_dir = Path(args.node_dir).resolve()
    run_dir = Path(args.run_dir).resolve()
    run_dir.mkdir(parents=True, exist_ok=True)

    urls_path = run_dir / "urls.json"
    log_path = run_dir / "worker.log"

    status = {
        "state": "starting",
        "started_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "node_dir": str(node_dir),
        "run_dir": str(run_dir),
        "urls_json": str(urls_path),
        "returncode": None,
        "error": None
    }
    write_status(run_dir, status)

    if not urls_path.exists():
        status["state"] = "failed"
        status["error"] = "urls.json not found in run directory."
        write_status(run_dir, status)
        sys.exit(2)

    env = os.environ.copy()
    env["A11Y_INPUT"] = str(urls_path)
    env["A11Y_OUTDIR"] = str(run_dir)
    env["A11Y_FIXED_OUTPUT"] = "1"

    cmd = ["npm", "run", args.npm_script]

    status["state"] = "running"
    status["command"] = " ".join(cmd)
    write_status(run_dir, status)

    with log_path.open("w", encoding="utf-8") as log:
        try:
            proc = subprocess.Popen(
                cmd,
                cwd=str(node_dir),
                env=env,
                stdout=log,
                stderr=subprocess.STDOUT,
                shell=False
            )
            status["pid"] = proc.pid
            write_status(run_dir, status)

            rc = proc.wait()
            status["returncode"] = rc
            status["finished_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
            status["state"] = "completed" if rc == 0 else "failed"
            write_status(run_dir, status)

            sys.exit(rc)

        except Exception as e:
            status["state"] = "failed"
            status["error"] = str(e)
            status["finished_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
            write_status(run_dir, status)
            print(f"Worker failed: {e}", file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    main()

from __future__ import annotations

import io
import json
import subprocess
import sys
from pathlib import Path
import streamlit as st
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"
SRC_DIR = PROJECT_ROOT / "src"


st.set_page_config(page_title="Healthcare Eligibility Automation", layout="wide")

st.title("Healthcare Intake & Insurance Eligibility Automation")
st.caption("Upload intake CSV → run validation & routing → download results and team queues.")

# --- Sidebar: rules file ---
st.sidebar.header("Configuration")
rules_path = st.sidebar.text_input(
    "Rules JSON path",
    value=str(DATA_DIR / "insurance_rules.json"),
    help="Default uses data/insurance_rules.json",
)
archive_input = st.sidebar.toggle("Archive input into output folder", value=True)

st.sidebar.divider()
st.sidebar.write("Tip: Use the same column headers your pipeline expects.")


# --- Upload ---
st.subheader("1) Upload Intake File")
uploaded = st.file_uploader("Choose a CSV file", type=["csv"])

colA, colB = st.columns([1, 1])

with colA:
    run_clicked = st.button("Run Automation", type="primary", disabled=(uploaded is None))

with colB:
    st.write("")
    st.write("")
    st.write("Outputs are written to the project's `outputs/YYYY-MM/` folder.")


def run_pipeline(input_csv_path: Path, rules_json_path: Path, archive: bool) -> str:
    """
    Executes run.py as a subprocess so we reuse all your existing logic
    (timestamps, monthly folders, queues, logs).
    Returns combined stdout/stderr text.
    """
    cmd = [
        sys.executable,
        str(SRC_DIR / "run.py"),
        "--input",
        str(input_csv_path),
        "--rules",
        str(rules_json_path),
    ]
    if archive:
        cmd.append("--archive-input")

    proc = subprocess.run(cmd, capture_output=True, text=True)
    return (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")


def find_latest_run_folder(outputs_root: Path) -> Path | None:
    if not outputs_root.exists():
        return None
    months = sorted([p for p in outputs_root.iterdir() if p.is_dir()], reverse=True)
    return months[0] if months else None


def find_latest_files(run_month_dir: Path) -> dict:
    """
    Finds latest timestamped artifacts in the month folder.
    We look for eligibility_results_*.csv and derive timestamp token.
    """
    if not run_month_dir or not run_month_dir.exists():
        return {}

    results = sorted(run_month_dir.glob("eligibility_results_*.csv"), reverse=True)
    if not results:
        return {}

    latest_results = results[0]
    # Extract timestamp token after prefix
    token = latest_results.stem.replace("eligibility_results_", "")

    files = {
        "results_csv": latest_results,
        "summary_json": run_month_dir / f"eligibility_summary_{token}.json",
        "intake_queue_csv": run_month_dir / f"intake_queue_{token}.csv",
        "insurance_queue_csv": run_month_dir / f"insurance_queue_{token}.csv",
        "log_file": run_month_dir / f"run_{token}.log",
        "token": token,
        "folder": run_month_dir,
    }
    return files


def safe_read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path, dtype=str).fillna("")


def safe_read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


if uploaded is not None:
    # Save uploaded file to a temp-ish location inside the project for processing
    st.subheader("2) Preview")
    try:
        df_preview = pd.read_csv(uploaded, dtype=str).fillna("")
        st.dataframe(df_preview.head(25), use_container_width=True)
        st.info(f"Rows detected: {len(df_preview)}")
    except Exception as e:
        st.error(f"Could not read CSV: {e}")

if run_clicked:
    # Write uploaded bytes to a file under data/incoming for traceability
    incoming_dir = DATA_DIR / "incoming"
    incoming_dir.mkdir(parents=True, exist_ok=True)

    input_name = Path(uploaded.name).stem if uploaded else "uploaded_intake"
    input_path = incoming_dir / f"{input_name}.csv"
    input_path.write_bytes(uploaded.getvalue())

    rules_json_path = Path(rules_path)

    st.subheader("3) Run")
    with st.spinner("Running automation..."):
        output_text = run_pipeline(input_path, rules_json_path, archive_input)

    st.code(output_text.strip() or "(No console output)", language="text")

    # Locate latest run artifacts
    month_dir = find_latest_run_folder(OUTPUTS_DIR)
    files = find_latest_files(month_dir) if month_dir else {}

    if not files:
        st.error("Run finished, but could not locate output files. Check console output and logs.")
    else:
        st.success(f"Run complete. Output folder: {files['folder']} (token: {files['token']})")

        # Load summary + key CSVs
        summary = safe_read_json(files["summary_json"])
        df_results = safe_read_csv(files["results_csv"])
        df_intake = safe_read_csv(files["intake_queue_csv"])
        df_ins = safe_read_csv(files["insurance_queue_csv"])

        st.subheader("4) Summary")
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Total Records", summary.get("total_records", len(df_results)))
        c2.metric("Approved %", summary.get("percent_approved", "—"))
        c3.metric("Review %", summary.get("percent_review", "—"))
        c4.metric("Rejected %", summary.get("percent_rejected", "—"))

        st.subheader("5) Team Queues")
        q1, q2 = st.columns(2)

        with q1:
            st.markdown("### Intake Queue (Registration)")
            st.caption(f"Rows: {len(df_intake)}")
            st.dataframe(df_intake.head(50), use_container_width=True)

        with q2:
            st.markdown("### Insurance Queue (Verification/Billing)")
            st.caption(f"Rows: {len(df_ins)}")
            st.dataframe(df_ins.head(50), use_container_width=True)

        st.subheader("6) Downloads")
        d1, d2, d3, d4 = st.columns(4)

        with d1:
            st.download_button(
                "Download Results CSV",
                data=files["results_csv"].read_bytes(),
                file_name=files["results_csv"].name,
                mime="text/csv",
            )
        with d2:
            if files["intake_queue_csv"].exists():
                st.download_button(
                    "Download Intake Queue CSV",
                    data=files["intake_queue_csv"].read_bytes(),
                    file_name=files["intake_queue_csv"].name,
                    mime="text/csv",
                )
        with d3:
            if files["insurance_queue_csv"].exists():
                st.download_button(
                    "Download Insurance Queue CSV",
                    data=files["insurance_queue_csv"].read_bytes(),
                    file_name=files["insurance_queue_csv"].name,
                    mime="text/csv",
                )
        with d4:
            if files["summary_json"].exists():
                st.download_button(
                    "Download Summary JSON",
                    data=files["summary_json"].read_bytes(),
                    file_name=files["summary_json"].name,
                    mime="application/json",
                )

        st.subheader("7) Top Issues")
        top_reasons = summary.get("top_reasons", {})
        if top_reasons:
            st.dataframe(
                pd.DataFrame(
                    [{"reason": k, "count": v} for k, v in top_reasons.items()]
                ),
                use_container_width=True,
            )
        else:
            st.write("No reasons found in summary.")

        st.subheader("8) Audit Log")
        if files["log_file"].exists():
            st.download_button(
                "Download Run Log",
                data=files["log_file"].read_bytes(),
                file_name=files["log_file"].name,
                mime="text/plain",
            )
            st.text_area("Log preview", value=files["log_file"].read_text(encoding="utf-8")[:6000], height=220)

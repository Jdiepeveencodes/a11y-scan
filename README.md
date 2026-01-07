# a11y-scan

Automated web accessibility (a11y) scanning tool using **Playwright** and **axe-core**, with a clean browser-based launcher, detailed HTML reports, and CSV/JSON exports aligned to **WCAG** guidelines.

This project focuses on **real-world usability**: handling messy user input, running stable scans, and producing reports that are easy to review and share.

---

## ✨ Features

- **Browser-based launcher UI**
  - Paste one URL per line
  - Handles malformed and mixed-format URLs
  - Sequential scanning for stability

- **Automated accessibility scanning**
  - Powered by Playwright + axe-core
  - WCAG-aligned rule detection
  - Severity classification (critical, serious, moderate, minor)

- **Rich reporting**
  - HTML report with severity badges
  - Downloadable CSV and JSON exports
  - “Latest report” shortcuts
  - Timestamped reports organized by year/month

- **Robust input handling**
  - Trims whitespace
  - Normalizes protocols (`http`, `https`)
  - Handles uppercase domains
  - Supports `www` and non-`www` variants

- **Cross-platform friendly**
  - No emoji / encoding issues
  - Works cleanly on Windows terminals
  - Designed for local use or CI extension

---

## 📁 Project Structure

### 📊 Reports Layout

```text
reports/
├── index.html          # Dashboard (multi-scan)
├── latest.html         # Most recent scan (HTML)
├── latest.json
├── latest.csv
└── YYYY/
    └── MM/
        ├── timestamp_site_a11y.html
        ├── timestamp_site_a11y.json
        └── timestamp_site_a11y.csv

## Reports are automatically organized and served by the launcher:

reports/
├─ index.html # Dashboard (multi-scan)
├─ latest.html # Most recent scan (HTML)
├─ latest.json
├─ latest.csv
└─ YYYY/
└─ MM/
├─ timestamp_site_a11y.html
├─ timestamp_site_a11y.json
└─ timestamp_site_a11y.csv
```
Each HTML report includes:
- Severity badges
- Rule descriptions
- Affected selectors
- Direct links to Deque rule documentation
- Download links for CSV and JSON


## Using the Launcher -- launch-dashboard.bat

The launcher will open at: http://localhost:5177
_______________________________________________________
Paste one URL per line

Click Run Scan

When finished:

Open the dashboard

View the latest report

Download CSV or JSON

Example input:

example.com

www.wikipedia.org

HTTP://NASA.GOV

https://dequeuniversity.com

## 📊 Reports
HTML Report

Severity badges

Rule descriptions

Affected element selectors

Direct links to Deque rule documentation

CSV Export

Ideal for:

Tracking issues over time

Importing into spreadsheets

Sharing with teams or stakeholders

JSON Export

Ideal for:

Automation pipelines

CI integration

Further processing

## 🧠 Design Goals

This project was built to demonstrate:

Practical accessibility automation

Defensive input handling

Stable Playwright usage

Clear, human-readable output

End-to-end system integration (UI → API → Python → Reports)

It is intentionally not a SaaS or hosted service — the focus is on tooling quality and reliability.

## ⚠️ Known Limitations

Some enterprise sites may block automated browsers

CAPTCHA or login-gated pages may fail to scan

Sequential scanning prioritizes stability over speed

These behaviors are handled gracefully and reported without crashing.

## Author
Created by Jesse Diepeveen

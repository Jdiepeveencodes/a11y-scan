# a11y-scan ♿

A browser-launched, automated accessibility (a11y) scanning platform built with **Playwright** and **axe-core**.  
It audits web pages against WCAG 2.1 AA standards and generates **HTML, CSV, and JSON reports** with severity badges and a live dashboard.

---

## 🚀 Features

- 🔍 **Single & multi-URL scanning**
- 🌐 **Browser-based launcher UI** (no CLI required)
- ♿ **WCAG 2.1 AA checks via axe-core**
- 📊 **Severity breakdown** (Critical / Serious / Moderate / Minor)
- 📄 **HTML reports** with readable issue cards
- 📈 **CSV export** for audits & compliance tracking
- 🧾 **JSON output** for automation & CI pipelines
- 🕒 **Timestamped reports** organized by year/month
- ⭐ **“Latest” snapshot** for quick access
- 🧩 **Graceful failure handling** (timeouts, DNS issues, blocked pages)

---

## 🖥️ Launcher UI

The project includes a lightweight web interface that allows users to:

1. Paste one or more URLs
2. Run accessibility scans
3. Open the dashboard or latest report in the browser

**Launcher URL:**
http://localhost:5177



## 📂 Report Structure for auditabiity

Reports are automatically organized and served by the launcher:

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


Each HTML report includes:
- Severity badges
- Rule descriptions
- Affected selectors
- Direct links to Deque rule documentation
- Download links for CSV and JSON

---

## ⚙️ Installation

### Prerequisites
- Node.js **18+**
- Python **3.10+**
- Playwright browsers installed

### Install dependencies

```bash
npm install
pip install playwright
playwright install

## Start the launcher 

OPEN - launcher-dashboard.bat

OR

npm start

http://localhost:5177


## 🧠 Accessibility Rules Covered

Examples include:

Color contrast (WCAG 1.4.3)

Missing or invalid ARIA attributes

Landmark structure issues

Missing link text

Heading hierarchy problems

Frame and iframe accessibility

Powered by axe-core, the industry standard used by enterprise accessibility tools.

## 💼 Why this project matters

This project demonstrates:

End-to-end automation (browser → server → scanner → reports)

Real-world accessibility auditing

Error-tolerant batch processing

Developer- and stakeholder-friendly reporting

CI/CD-ready architecture

It is designed to scale from local audits to automated compliance workflows.

## 👤 Author

Built by Jesse Diepeveen
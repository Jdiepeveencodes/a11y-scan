# a11y-scan ♿

**a11y-scan** is an automated accessibility auditing tool that evaluates web pages against internationally recognized accessibility standards (WCAG). It uses real browser automation to detect accessibility issues that impact users with disabilities and helps developers build more inclusive web experiences.

---

## 🚀 What This Project Does

- Automatically scans web pages for accessibility violations
- Uses real browser automation (not static HTML parsing)
- Detects common WCAG issues such as:
  - Missing alternative text
  - Color contrast failures
  - ARIA attribute errors
  - Keyboard navigation problems
  - Improper heading structure
- Generates actionable accessibility findings

---

## 🛠️ Tech Stack

- Node.js
- Playwright (browser automation)
- axe-core (WCAG accessibility rules engine)
- TypeScript / JavaScript
- HTML

---

## 📂 Project Structure

a11y-scan/
├─ a11y-web/ # Web interface / UI layer
├─ playwright-a11y-scanner/ # Core accessibility scanning logic
├─ package.json
├─ package-lock.json
└─ README.md

## ⚙️ Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Jdiepeveencodes/a11y-scan.git
cd a11y-scan
npm install

▶️ Running the Accessibility Scanner

npm run scan

OR

npm run scan -- https://example.com

📌 Disclaimer

This tool provides automated accessibility testing and should be used alongside manual testing and real user validation for full WCAG compliance.

🔮 Future Enhancements

CI/CD integration with GitHub Actions

Exportable accessibility reports (JSON / HTML)

Configurable WCAG levels (A / AA / AAA)

Visual dashboard for scan results

Multi-page and sitemap scanning

👤 Author

Jesse Diepeveen
GitHub: https://github.com/Jdiepeveencodes
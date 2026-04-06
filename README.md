# 💸 Expense Tracker

A mobile-friendly expense tracker that runs entirely in your browser — no backend, no install.
Log expenses on your phone, export as CSV, and import into Excel.

## Features

- Add expenses with date, amount, category, payment method, and notes
- **Receipt scanner** — point your camera at a receipt to auto-fill the amount
- Filter history by category or month
- Export all data as CSV for Excel
- Works offline — data saved locally in your browser

## How to Use

1. Open `index.html` in your browser (or host it on GitHub Pages)
2. Add expenses using the form
3. Use the 📷 scanner button to scan a receipt amount
4. Export as CSV from the Export tab, then import into `Expense-Tracker.xlsx`

## Folder Structure

```
expense-tracker/
├── index.html       # Main app
├── css/
│   └── style.css    # All styles
├── js/
│   ├── app.js       # Core app logic
│   └── scanner.js   # Receipt scanner (camera + OCR)
├── .gitignore
└── README.md
```

## Tech Stack

- Vanilla HTML / CSS / JavaScript
- [Tesseract.js](https://github.com/naptha/tesseract.js) for OCR (receipt scanning)
- localStorage for data persistence

## Deployment (GitHub Pages)

1. Push this folder to a GitHub repository
2. Go to Settings → Pages → Source: `main` branch, `/ (root)`
3. Your app will be live at `https://your-username.github.io/expense-tracker`

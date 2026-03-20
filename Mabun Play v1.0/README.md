# Mabun Play – Frontend

A mobile‑first Progressive Web App (PWA) for South Sudan's premier Trivia platform. Users can participate in hourly, daily, and weekly quizzes, win real money, and interact with the community.

## 📱 Features

- **Authentication** – Phone + password login, OTP verification, password reset
- **Dashboard** – Live quiz entry, challenge cards, statistics
- **Quiz** – Live timed quizzes with streak and score tracking
- **Leaderboard** – Real‑time rankings with prize indications
- **Wallet** – Balance, deposit/withdraw, transaction history
- **Profile** – User details, achievements, account settings
- **Community** – Social feed with posts, likes, comments
- **PWA** – Offline support, installable, push notifications
- **Responsive** – Mobile‑first, adapts to tablet and desktop

## 🛠️ Technologies

- **HTML5** – Semantic markup
- **CSS3** – Custom properties, Flexbox, Grid
- **JavaScript (ES6+)** – Vanilla, modular
- **Chart.js** – Performance history charts
- **Iconify** – Icon sets
- **Service Worker** – Offline caching
- **WebSocket** – Real‑time leaderboard updates

## 📁 Project Structure

```
mabun-quiz/
├── index.html
├── *.html (all pages)
├── css/
│   ├── main.css          # Master CSS (imports all)
│   ├── core/             # Reset, variables, typography, layout
│   ├── components/       # Buttons, forms, cards, modals, etc.
│   └── pages/            # Page‑specific styles
├── js/
│   ├── core/             # App bootstrap, config, API, storage, guards
│   ├── features/         # Page‑specific logic
│   └── utils/            # Helpers, formatters, validators
├── assets/
│   ├── images/
│   ├── icons/            # PWA icons
│   └── fonts/
├── service-worker.js
├── manifest.json
├── sitemap.xml
├── robots.txt
├── .env.example
├── .gitignore
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js (for local development server, optional)
- Modern browser (Chrome, Firefox, Safari, Edge)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/mabun/quiz-frontend.git
   cd quiz-frontend
   ```

2. No build step required – just serve the files with a static server:
   ```bash
   npx serve .
   ```
   Or open `index.html` directly (some features may require a server).

3. For full PWA functionality, serve over HTTPS (use localhost with ngrok or a tool like `https-server`).

### Configuration

Copy `.env.example` to `.env` and fill in your API endpoints (if connecting to a backend). For frontend‑only demo, the app uses `localStorage` and mock data.

## 📦 Deployment

1. Build (if any) – none required.
2. Upload all files to your web host (e.g., Netlify, Vercel, or any static hosting).
3. Ensure `service-worker.js` and `manifest.json` are served from the root.
4. Set up HTTPS for PWA features.

## 📄 License

Copyright © 2026 Mabun Play. All rights reserved.

## 🤝 Support

For issues, visit [support.html](support.html) or email support@mabunplay.com.
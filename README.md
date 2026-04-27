<div align="center">
<img width="1200" height="475" alt="FanNexus Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# 🚀 FanNexus

**A robust, distributed AO3 metadata extraction and tracking ecosystem.**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](#)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](#)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](#)

[Overview](#overview) • [Key Features](#key-features) • [Installation](#installation) • [Scraping Pipeline](#scraping-pipeline) • [Tech Stack](#tech-stack)

</div>

---

## 📖 Overview

**FanNexus** is a state-of-the-art data collection platform designed to systematically scrape, index, and monitor story metadata from Archive of Our Own (AO3). It solves the common challenges of large-scale scraping, such as the 5,000-page request limit and rate-limiting, by implementing a sophisticated discovery and chunking strategy coordinated across distributed workers via Firebase.

## ✨ Key Features

-   **🔍 Fandom Discovery**: Automatically crawls AO3 category trees (Media, Fandoms) to build a comprehensive target list.
-   **📅 Smart Chunking**: Bypasses the 5,000-page limit by automatically splitting large fandoms into small, manageable date-range chunks.
-   **🤝 Distributed Coordination**: Uses Firebase Realtime DB and Firestore for task locking and state management, allowing multiple local and CI workers (GitHub Actions) to collaborate without conflict.
-   **🛡️ Robust Resilience**: Built-in exponential backoff, request jitter, and automatic recovery from soft-bans and timeouts.
-   **📊 Modern Dashboard**: A premium React-based interface for visualizing scraping progress, fandom statistics, and system health.
-   **💾 Structured Export**: Saves data in high-performance JSONL formats, ready for downstream indexing and analysis.

## 🛠️ Tech Stack

-   **Frontend**: React 19, Vite, Tailwind CSS 4, Framer Motion (animations), Lucide React (icons).
-   **Backend**: Express.js, TypeScript.
-   **Database/Auth**: Firebase Admin SDK, Firestore.
-   **Scraper**: Cheerio (HTML parsing), node-fetch with custom retry logic.
-   **Intelligence**: Integration with Google Gemini/Groq for future automated tag analysis.

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v18+)
- A Firebase Project (Admin SDK service account JSON and Client config)

### 1. Clone & Install
```bash
git clone https://github.com/your-username/fannexus.git
cd fannexus
npm install
```

### 2. Environment Configuration
Create a `.env.local` file based on `.env.example`:
```env
GEMINI_API_KEY="your_api_key"
GROQ_API="your_api_key"
APP_URL="http://localhost"
```
Place your Firebase Admin service account key at `serviceAccountKey.json` and your client config at `firebase-applet-config.json`.

### 3. Run the App
```bash
# Start the development server (Frontend + Server)
npm run dev
```

---

## 🕷️ Scraping Pipeline

The scraping logic is split into several specialized phases:

| Command | Purpose |
| :--- | :--- |
| `npm run scrape:discover` | Crawl AO3's fandom list and update the master index. |
| `npm run scrape:run` | **The Orchestrator**: Manages workers, assigns tasks, and ensures full coverage. |
| `npm run scrape:local` | Run a local worker instance to process pending chunks. |
| `npm run scrape:test` | Run a test scrape on a specific fandom (e.g., "Smallville"). |

### How it works
1. **Discovery**: `fandomDiscovery.ts` maps out every fandom in a specific media type.
2. **Chunking**: The orchestrator splits fandoms into date ranges (e.g., 2024-01-01 to 2024-03-31) to keep results under page limits.
3. **Task Assignment**: Tasks are synced to Firebase.
4. **Execution**: Workers (Local or GitHub Actions) pick up tasks, scrape chunks, and save data to the `data/` directory.

---

## 📄 License

This project is for educational and research purposes. Please respect AO3's Terms of Service and `robots.txt` when running scrapers.

<div align="center">
Built with ❤️ for the Fandom Community
</div>

# FanNexus — Backstory

## Origins

FanNexus started as a simple idea: what if fan fiction readers had a single place to search, discover, and track stories across every platform? AO3, FFnet, Spacebattles, Wattpad — all of them, unified.

The vision was always bigger than a weekend project. Three phases were mapped out from the start:

- **Phase 1**: A beautiful search engine for fan fiction metadata — the foundation.
- **Phase 2**: An embedded reader with cross-platform interaction (likes, comments synced back to source sites).
- **Phase 3**: ML-powered recommendations and story scoring based on writing quality, plot complexity, character development, and world-building.

Phase 1 is where we live today. And it's already more than just a search engine.

Also, there a

## The Development Process

FanNexus is built through a unique workflow — part local engineering, part collaboration with Google AI Studio.

The process looks like this:

1. **Prompt**: Describe a feature to Google AI Studio — architecture, logic, UI, everything.
2. **Generate**: AI Studio produces the implementation — files, schemas, components, the works.
3. **Copy & Paste**: The generated files are copied into the local project.
4. **Finesse**: This is where the real work begins. Nothing lands perfectly on the first try. Dependencies clash, types don't align, Firebase config needs adjusting, styles need reworking, edge cases emerge. The finesse phase is where the code becomes *ours* — where it stops being AI-generated scaffolding and starts being a production system.

This back-and-forth rhythm defines the project. AI handles the heavy lifting of initial implementation. Local development handles the hard parts — integration, debugging, polish, and the thousand small decisions that make software actually work.

## What It Became

What started as a "beautiful search engine" evolved into a distributed scraping ecosystem:

- **Fandom Discovery**: Automatically crawls AO3's category trees to map every fandom.
- **Smart Chunking**: Splits large fandoms into date-range chunks to bypass the 5,000-page limit.
- **Distributed Coordination**: Firebase Realtime DB and Firestore enable multiple workers — local machines and GitHub Actions — to collaborate on scraping tasks without conflicts.
- **Resilience**: Exponential backoff, request jitter, automatic recovery from soft-bans.
- **Dashboard**: A React-based interface for monitoring progress and statistics in real time.

The scraper alone handles complexities that weren't part of the original plan but became necessary: rate limiting, checkpointing, task locking, structured JSONL export.

## The Tech Stack

The stack chose itself over time:

- **React 19 + Vite + Tailwind CSS 4**: Modern, fast, and visually premium.
- **Firebase**: The backbone for coordination, authentication, and data.
- **Express + TypeScript**: Server-side logic and scraping orchestration.
- **Cheerio**: HTML parsing for AO3 metadata extraction.
- **Framer Motion**: The animations that give the UI its buttery feel.
- **Google Gemini / Groq**: Future integration for automated tag analysis.

## Philosophy

FanNexus exists at the intersection of human ambition and AI capability. Every feature passes through two filters: what the AI can generate, and what human judgment can refine. The result is a system that's more than either could produce alone.

The project is a testament to iterative development — start with a vision, build what you can, refine what doesn't work, and never stop expanding what's possible.

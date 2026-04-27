import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
async function startServer() {
  const app = express();
  const PORT = 3e3;
  app.use(express.json());
  app.post("/api/scrape", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: "URL is required" });
      return;
    }
    try {
      console.log(`[Scraper API] Request to scrape: ${url}`);
      let result;
      if (url.includes("archiveofourown.org")) {
        result = { sourceSite: "AO3", status: "pending_logic", originalUrl: url };
      } else if (url.includes("fanfiction.net")) {
        result = { sourceSite: "FFN", status: "pending_logic", originalUrl: url };
      } else if (url.includes("spacebattles.com")) {
        result = { sourceSite: "Spacebattles", status: "pending_logic", originalUrl: url };
      } else if (url.includes("wattpad.com")) {
        result = { sourceSite: "Wattpad", status: "pending_logic", originalUrl: url };
      } else {
        res.status(400).json({ error: "Unsupported site" });
        return;
      }
      res.json(result);
    } catch (error) {
      console.error("[Scraper API] Error:", error);
      res.status(500).json({ error: "Failed to scrape URL" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();

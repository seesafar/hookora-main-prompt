const fetchFn =
  globalThis.fetch ||
  ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));


module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  try {
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const { idea, prompt, seconds } = req.body || {};
    const userInput = String(prompt || idea || "").trim();

    if (!userInput) return res.status(400).json({ error: "No prompt provided" });

    const s = Number(seconds);
    const safeSeconds = Number.isFinite(s) ? Math.min(45, Math.max(5, s)) : 30;

    const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
    if (!INTERNAL_API_KEY) {
      console.error("[public-generate] Missing INTERNAL_API_KEY");
      return res.status(500).json({ error: "Missing INTERNAL_API_KEY in env" });
    }

    // نداء generate (محمي)
    const url = "https://hookora-main-prompt-l4mm.vercel.app/api/generate";
    const r = await _fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": INTERNAL_API_KEY,
      },
      body: JSON.stringify({ idea: userInput, seconds: safeSeconds }),
    });

    const raw = await r.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = { raw }; }

    // لو generate رجّع خطأ، نرجعه زي ما هو مع تفاصيل
    return res.status(r.status).json(data);
  } catch (err) {
    console.error("[public-generate] Crash:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err?.message || String(err),
      stack: err?.stack || null,
    });
  }
};

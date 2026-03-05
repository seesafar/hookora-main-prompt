module.exports = async (req, res) => {
  // ✅ CORS (واجهة Webflow ما ترسل x-api-key)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { idea, prompt, seconds } = req.body || {};
    const userInput = String(prompt || idea || "").trim();

    if (!userInput) return res.status(400).json({ error: "No prompt provided" });

    const s = Number(seconds);
    const safeSeconds = Number.isFinite(s) ? Math.min(45, Math.max(5, s)) : 30;

    // 🔐 المفتاح يبقى داخل Vercel فقط
    const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
    if (!INTERNAL_API_KEY) {
      return res.status(500).json({ error: "Missing INTERNAL_API_KEY in env" });
    }

   const r = await fetch("https://hookora-main-prompt-l4mm.vercel.app/api/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": INTERNAL_API_KEY
  },
  body: JSON.stringify({ idea: userInput, seconds: safeSeconds })
});
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

    // يرجع نفس حالة generate (200/400/500..)
    return res.status(r.status).json(data);

  } catch (err) {
    console.error("API /public-generate crash:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err?.message || String(err),
    });
  }
};

module.exports = async (req, res) => {
  // ✅ CORS (بدون x-api-key لأن الواجهة ما ترسله)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { idea, prompt, seconds } = req.body || {};
    const userInput = (prompt || idea || "").trim();
    // ✅ seconds اختيارية (من 5 إلى 45)
    const s = Number(seconds);
    const safeSeconds = Number.isFinite(s) ? Math.min(45, Math.max(5, s)) : 30;
    if (!userInput) return res.status(400).json({ error: "No prompt provided" });

    // 🔐 المفتاح يبقى في Vercel فقط
    const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
    if (!INTERNAL_API_KEY) {
      return res.status(500).json({ error: "Missing INTERNAL_API_KEY in env" });
    }

    // ✅ استدعاء endpoint المحمي داخل نفس المشروع
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const baseUrl = `${proto}://${host}`;

    const r = await fetch(baseUrl + "/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": INTERNAL_API_KEY
      },
      body: JSON.stringify({ idea: userInput, seconds: safeSeconds })
    });

    const data = await r.json().catch(() => ({}));
    return res.status(r.status).json(data);
  } catch (err) {
    console.error("API /public-generate error:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err?.message || String(err),
    });
  }
};

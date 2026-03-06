const fetchFn =
  globalThis.fetch ||
  ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    // حماية داخلية
    const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
    const clientKey = req.headers["x-api-key"];

    if (!INTERNAL_API_KEY) {
      return res.status(500).json({ error: "Missing INTERNAL_API_KEY in env" });
    }

    if (!clientKey || clientKey !== INTERNAL_API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // مفتاح Fal
    const FAL_API_KEY = process.env.FAL_API_KEY;
    if (!FAL_API_KEY) {
      return res.status(500).json({ error: "Missing FAL_API_KEY in env" });
    }

    // الإدخال
    const { idea, prompt, seconds, sound } = req.body || {};
    const userInput = String(prompt || idea || "").trim();

    if (!userInput) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    // Kling 2.6 Pro يدعم 5 أو 10 ثواني
    const safeSeconds = Number(seconds) >= 10 ? 10 : 5;

    const response = await fetchFn(
      "https://queue.fal.run/fal-ai/kling-video/v2.6/pro/text-to-video",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: userInput,
          duration: String(safeSeconds),
          aspect_ratio: "9:16",
          sound: Boolean(sound)
        })
      }
    );

    const raw = await response.text();
    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    if (!response.ok) {
      console.error("Fal error:", response.status, data);
      return res.status(500).json({
        error: "Fal request failed",
        status: response.status,
        details: data
      });
    }

    // Fal queue يرجّع request_id وروابط المتابعة
    return res.status(200).json(data);
  } catch (error) {
    console.error("generate-video crash:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error?.message || String(error)
    });
  }
};

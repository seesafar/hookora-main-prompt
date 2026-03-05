module.exports = async (req, res) => {
  // ✅ CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-api-key"
  );

  // ✅ Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ✅ POST فقط
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    // ✅ مفاتيح البيئة (Vercel)
    const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!INTERNAL_API_KEY) {
      return res.status(500).json({ error: "Missing INTERNAL_API_KEY in env" });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY in env" });
    }

    const clientKey =
  req.headers["x-api-key"] ||
  req.headers["x_api_key"] ||
  req.headers["X-API-KEY"] ||
  req.headers["x-public-key"];

if (!clientKey || String(clientKey).trim() !== String(INTERNAL_API_KEY).trim()) {
  return res.status(401).json({
    error: "Unauthorized",
    got: clientKey ? String(clientKey) : null
  });
}

    // ✅ التقط المدخل: prompt أو idea
    const { prompt, idea, seconds } = req.body || {};
    const userInput = (prompt || idea || "").trim();
   // مدة الفيديو من السلايدر (5 إلى 45 ثانية)
    const s = Number(seconds);
    const safeSeconds = Number.isFinite(s) ? Math.min(45, Math.max(5, s)) : 30;
    if (!userInput) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    // ✅ نداء OpenAI (Responses API)
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
           content:
            `You are an expert direct-response advertising copywriter.  
           Write a high-converting ${safeSeconds}-second video ad script.

           Structure:
           1) Hook
           2) Problem/Desire
           3) Solution
           4) Benefits
           5) Strong CTA

Make the script fit approximately ${safeSeconds} seconds of spoken video.
Output only the final script.`,
          },
          {
            role: "user",
            content: userInput,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "OpenAI request failed",
        details: data,
      });
    }

    // ✅ استخراج النص من Responses API
    const script =
      (typeof data.output_text === "string" && data.output_text.trim()) ||
      (data?.output?.[0]?.content
        ?.find((c) => c?.type === "output_text" && typeof c?.text === "string")
        ?.text?.trim()) ||
      "";

    return res.status(200).json({ script });
  } catch (err) {
    console.error("API /generate error:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err?.message || String(err),
    });
  }
};

module.exports = async (req, res) => {
  // ✅ CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-public-key, x-api-key"
  );

  // ✅ Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ✅ السماح فقط POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    // ✅ مفاتيح البيئة (Vercel)
    const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
    const PUBLIC_API_KEY = process.env.PUBLIC_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!INTERNAL_API_KEY) {
      return res.status(500).json({ error: "Missing INTERNAL_API_KEY in env" });
    }

    if (!PUBLIC_API_KEY) {
      return res.status(500).json({ error: "Missing PUBLIC_API_KEY in env" });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY in env" });
    }

    // ✅ التحقق: داخلي أو عام
    const internalKey = req.headers["x-api-key"];
    const publicKey = req.headers["x-public-key"];

    const isInternal = internalKey && internalKey === INTERNAL_API_KEY;
    const isPublic = publicKey && publicKey === PUBLIC_API_KEY;

    if (!isInternal && !isPublic) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // ✅ التقط المدخل: prompt أو idea
    const { prompt, idea } = req.body || {};
    const userInput = (prompt || idea || "").trim();

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
            role: "user",
            content: `اكتب سكربت إعلان تسويقي احترافي بناءً على الطلب التالي:\n\n${userInput}\n\nأرجع النتيجة كنص واحد جاهز للنشر.`,
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

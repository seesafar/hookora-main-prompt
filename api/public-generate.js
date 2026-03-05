module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    // Auth (internal only)
    const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
    const clientKey = req.headers["x-api-key"];

    if (!INTERNAL_API_KEY) {
      return res.status(500).json({ error: "Missing INTERNAL_API_KEY in env" });
    }
    if (!clientKey || clientKey !== INTERNAL_API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // OpenAI key
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY in env" });
    }

    // Input
    const { idea, prompt, seconds } = req.body || {};
    const userInput = String(prompt || idea || "").trim();
    if (!userInput) return res.status(400).json({ error: "No prompt provided" });

    const s = Number(seconds);
    const safeSeconds = Number.isFinite(s) ? Math.min(45, Math.max(5, s)) : 30;

    // Build prompt
    const system =
      "You are a professional direct-response video ad scriptwriter. " +
      "Return a clean, ready-to-read script with: Hook, Problem, Solution, Benefits, CTA. " +
      "No markdown. No quotes. Keep it punchy.";
    const user =
      `Write a ${safeSeconds}-second video ad script about:\n` +
      `${userInput}\n` +
      `Target language: English.\n` +
      `Make it conversion-focused.`;

    // Call OpenAI REST (no SDK)
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.7,
      }),
    });

    const textRaw = await resp.text(); // مهم جدًا عشان لو مو JSON
    let data;
    try {
      data = JSON.parse(textRaw);
    } catch {
      data = { raw: textRaw };
    }

    if (!resp.ok) {
      console.error("OpenAI error:", resp.status, data);
      return res.status(500).json({
        error: "OpenAI request failed",
        status: resp.status,
        details: data,
      });
    }

    const out = data?.choices?.[0]?.message?.content?.trim();
    if (!out) {
      console.error("Empty completion:", data);
      return res.status(500).json({ error: "Empty completion from OpenAI" });
    }

    return res.status(200).json({ text: out, seconds: safeSeconds });
  } catch (err) {
    console.error("API /generate crash:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err?.message || String(err),
    });
  }
};

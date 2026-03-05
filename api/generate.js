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

    // مفتاح OpenAI
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY in env" });
    }

    // الإدخال
    const { idea, prompt, seconds } = req.body || {};
    const userInput = String(prompt || idea || "").trim();

    if (!userInput) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    const s = Number(seconds);
    const safeSeconds = Number.isFinite(s) ? Math.min(45, Math.max(5, s)) : 30;

    const rules = `
Rules:
- Total scene timing must start at 0 and end exactly at ${safeSeconds}.
- Use between 3 and 7 scenes.
- Keep voiceover natural, engaging, and concise.
- Do not invent brand names unless provided.
- Use English only.
`;

    const finalPrompt = `
Create a short ad video script.

Idea: ${userInput}
Duration: ${safeSeconds} seconds

${rules}
`;

    const resp = await fetchFn("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a professional direct-response video ad scriptwriter. Return a clean, ready-to-read ad script with Hook, Problem, Solution, Benefits, and CTA. No markdown. No quotes. Keep it punchy.",
          },
          {
            role: "user",
            content: finalPrompt,
          },
        ],
        temperature: 0.7,
      }),
    });

    const raw = await resp.text();
    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
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
      return res.status(500).json({ error: "Empty completion from OpenAI" });
    }

    return res.status(200).json({
      text: out,
      seconds: safeSeconds,
    });
  } catch (err) {
    console.error("API /generate crash:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err?.message || String(err),
    });
  }
};

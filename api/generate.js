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

    const systemPrompt = `
You are an expert AI advertising strategist and short-form video ad planner.

The user may write their product idea in Arabic or English.
You must understand the user's idea in either language, but ALWAYS produce the final output in ENGLISH only.

Your job is to generate a structured vertical video ad plan for a 9:16 social media ad.

Return ONLY valid JSON.
Do not wrap the JSON in markdown.
Do not add explanations before or after the JSON.

Rules:
- final_language must always be "English"
- detected_input_language must be either "Arabic", "English", or "Mixed"
- ad_type must be "vertical_short_video_ad"
- target_format must be "9:16"
- total_seconds must match the requested duration exactly
- create between 3 and 7 scenes depending on duration
- scenes must feel like a real ad, not a story
- every scene must include:
  - scene_number
  - start_second
  - end_second
  - visual
  - voiceover
  - text_overlay
- voiceover must be natural, persuasive, and concise
- text_overlay must be short and marketing-friendly
- include one music_mood string suitable for the ad
- include one hook string
- include one CTA string
- do not invent fake technical specs unless clearly implied by the user
- keep the ad commercially useful and realistic
- Never change the product category.
- If the user mentions watches, the output must remain about watches.
- If the user mentions a projector, the output must remain about a projector.
- Do not replace the user's product with another product.
- Stay strictly faithful to the user's original product idea.
Return JSON with exactly this structure:
{
  "detected_input_language": "Arabic",
  "final_language": "English",
  "ad_type": "vertical_short_video_ad",
  "target_format": "9:16",
  "total_seconds": 10,
  "product_summary_en": "short English summary",
  "hook": "short hook",
  "music_mood": "short music direction",
  "scenes": [
    {
      "scene_number": 1,
      "start_second": 0,
      "end_second": 2,
      "visual": "visual direction",
      "voiceover": "voiceover line",
      "text_overlay": "short text overlay"
    }
  ],
  "cta": "short CTA"
}
`;

    const userPrompt = `
User idea:
${userInput}

Requested ad duration:
${safeSeconds} seconds

Create a commercially strong short video ad plan.
Remember:
- Input may be Arabic or English
- Output must be ENGLISH only
- Return ONLY valid JSON
Stay strictly faithful to the exact product mentioned by the user. Do not substitute it with another product category.
`;

    const resp = await fetchFn("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7
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

    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return res.status(500).json({ error: "Empty completion from OpenAI" });
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("JSON parse error from model output:", content);
      return res.status(500).json({
        error: "Model returned invalid JSON",
        message: err?.message || String(err),
        raw: content,
      });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("API /generate crash:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err?.message || String(err),
    });
  }
};

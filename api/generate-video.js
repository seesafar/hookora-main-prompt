const fetchFn =
  globalThis.fetch ||
  ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

module.exports = async (req, res) => {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {

    const { idea, seconds } = req.body || {};
    const prompt = String(idea || "").trim();

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const FAL_API_KEY = process.env.FAL_API_KEY;

    if (!FAL_API_KEY) {
      return res.status(500).json({ error: "Missing FAL_API_KEY in env" });
    }

    const safeSeconds = Number.isFinite(Number(seconds))
      ? Math.min(10, Math.max(2, Number(seconds)))
      : 5;

    const response = await fetchFn(
      "https://queue.fal.run/fal-ai/kling-video/v2.6/pro/text-to-video",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          duration: safeSeconds,
          aspect_ratio: "9:16"
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
      return res.status(response.status).json({
        error: "Fal request failed",
        status: response.status,
        details: data
      });
    }

    return res.status(200).json({
      request_id: data.request_id || data.id || null,
      details: data
    });

  } catch (error) {

    return res.status(500).json({
      error: "Internal Server Error",
      details: error?.message || String(error)
    });

  }

};

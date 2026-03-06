const fetchFn =
  globalThis.fetch ||
  ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

module.exports = async (req, res) => {
  // CORS
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
    const { idea, prompt, seconds } = req.body || {};
    const userInput = String(prompt || idea || "").trim();

    if (!userInput) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const runwayKey = process.env.RUNWAY_API_KEY;
    if (!runwayKey) {
      return res.status(500).json({ error: "Missing RUNWAY_API_KEY in env" });
    }

    const safeSeconds = Number.isFinite(Number(seconds))
      ? Math.min(10, Math.max(2, Number(seconds)))
      : 5;

    const response = await fetchFn("https://api.runwayml.com/v1/video", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runwayKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06"
      },
      body: JSON.stringify({
        model: "gen4.5",
        promptText: userInput,
        ratio: "720:1280",
        duration: safeSeconds
      })
    });

    const raw = await response.text();
    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    if (!response.ok) {
      console.error("Runway error:", response.status, data);
      return res.status(500).json({
        error: "Runway request failed",
        status: response.status,
        details: data
      });
    }

    // Runway يرجع task id أولاً
    return res.status(200).json(data);
  } catch (error) {
    console.error("generate-video crash:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error?.message || String(error)
    });
  }
};

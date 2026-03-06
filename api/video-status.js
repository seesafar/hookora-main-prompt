const fetchFn =
  globalThis.fetch ||
  ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

module.exports = async (req, res) => {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  try {

    const taskId = String(req.query.taskId || "").trim();

    if (!taskId) {
      return res.status(400).json({ error: "Missing taskId" });
    }

    const runwayKey = process.env.RUNWAY_API_KEY;

    const response = await fetchFn(`https://api.runwayml.com/v1/tasks/${taskId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${runwayKey}`,
        "X-Runway-Version": "2024-11-06"
      }
    });

    const raw = await response.text();
    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    if (!response.ok) {
      return res.status(500).json({
        error: "Runway status request failed",
        status: response.status,
        details: data
      });
    }

    return res.status(200).json(data);

  } catch (error) {

    return res.status(500).json({
      error: "Internal Server Error",
      details: error?.message || String(error)
    });

  }

};

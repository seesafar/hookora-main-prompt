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
    const requestId = String(
      req.query.request_id || req.query.requestId || ""
    ).trim();

    if (!requestId) {
      return res.status(400).json({ error: "Missing request_id" });
    }

    const FAL_API_KEY = process.env.FAL_API_KEY;
    if (!FAL_API_KEY) {
      return res.status(500).json({ error: "Missing FAL_API_KEY in env" });
    }

    const falResp = await fetchFn(
      `https://queue.fal.run/fal-ai/kling-video/v2.6/pro/text-to-video/requests/${requestId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Key ${FAL_API_KEY}`
        }
      }
    );

    const raw = await falResp.text();

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { raw };
    }

    const status =
      payload?.status ||
      payload?.request?.status ||
      payload?.response?.status ||
      "UNKNOWN";

    const videoUrl =
      payload?.video?.url ||
      payload?.data?.video?.url ||
      payload?.data?.videos?.[0]?.url ||
      payload?.output?.video_url ||
      payload?.output?.video?.url ||
      payload?.response?.video?.url ||
      null;

    return res.status(200).json({
      ok: falResp.ok,
      fal_status_code: falResp.status,
      status,
      request_id: requestId,
      video_url: videoUrl,
      details: payload
    });
  } catch (error) {
    console.error("video-status crash:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error?.message || String(error)
    });
  }
};

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

    const statusResp = await fetchFn(
      `https://queue.fal.run/fal-ai/kling-video/v2.6/pro/text-to-video/requests/${requestId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Key ${FAL_API_KEY}`
        }
      }
    );

    const raw = await statusResp.text();

    let resultData;
    try {
      resultData = JSON.parse(raw);
    } catch {
      resultData = { raw };
    }

    if (!statusResp.ok) {
      console.error("Fal status error:", statusResp.status, resultData);
      return res.status(statusResp.status).json({
        error: "Fal status request failed",
        status: statusResp.status,
        details: resultData
      });
    }

    const status =
      resultData?.status ||
      resultData?.request?.status ||
      "UNKNOWN";

    const videoUrl =
      resultData?.video?.url ||
      resultData?.data?.video?.url ||
      resultData?.data?.videos?.[0]?.url ||
      resultData?.output?.video_url ||
      resultData?.output?.video?.url ||
      null;

    return res.status(200).json({
      status,
      request_id: requestId,
      video_url: videoUrl,
      raw: resultData
    });
  } catch (error) {
    console.error("video-status crash:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error?.message || String(error)
    });
  }
};

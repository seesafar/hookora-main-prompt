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

    // 1) فحص الحالة الصحيح
    const statusResp = await fetchFn(
      `https://queue.fal.run/fal-ai/kling-video/v2.6/pro/text-to-video/requests/${requestId}/status`,
      {
        method: "GET",
        headers: {
          Authorization: `Key ${FAL_API_KEY}`
        }
      }
    );

    const statusRaw = await statusResp.text();

    let statusPayload;
    try {
      statusPayload = JSON.parse(statusRaw);
    } catch {
      statusPayload = { raw: statusRaw };
    }

    if (!statusResp.ok) {
      return res.status(200).json({
        ok: false,
        fal_status_code: statusResp.status,
        status: "UNKNOWN",
        request_id: requestId,
        video_url: null,
        details: statusPayload
      });
    }

    const currentStatus =
      statusPayload?.status ||
      statusPayload?.request?.status ||
      statusPayload?.response?.status ||
      "IN_PROGRESS";

    // 2) إذا لم يكتمل بعد
    if (currentStatus !== "COMPLETED") {
      return res.status(200).json({
        ok: true,
        fal_status_code: statusResp.status,
        status: currentStatus,
        request_id: requestId,
        video_url: null,
        details: statusPayload
      });
    }

    // 3) إذا اكتمل، نجيب النتيجة النهائية
    const resultResp = await fetchFn(
      `https://queue.fal.run/fal-ai/kling-video/v2.6/pro/text-to-video/requests/${requestId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Key ${FAL_API_KEY}`
        }
      }
    );

    const resultRaw = await resultResp.text();

    let resultPayload;
    try {
      resultPayload = JSON.parse(resultRaw);
    } catch {
      resultPayload = { raw: resultRaw };
    }

    const videoUrl =
      resultPayload?.video?.url ||
      resultPayload?.data?.video?.url ||
      resultPayload?.data?.videos?.[0]?.url ||
      resultPayload?.output?.video_url ||
      resultPayload?.output?.video?.url ||
      resultPayload?.response?.video?.url ||
      null;

    return res.status(200).json({
      ok: resultResp.ok,
      fal_status_code: resultResp.status,
      status: "COMPLETED",
      request_id: requestId,
      video_url: videoUrl,
      details: resultPayload
    });
  } catch (error) {
    console.error("video-status crash:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error?.message || String(error)
    });
  }
};

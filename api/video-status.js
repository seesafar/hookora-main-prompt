const fetchFn =
  globalThis.fetch ||
  ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
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

    // مفتاح Fal
    const FAL_API_KEY = process.env.FAL_API_KEY;
    if (!FAL_API_KEY) {
      return res.status(500).json({ error: "Missing FAL_API_KEY in env" });
    }

    // نقرأ request_id بدل taskId
    const requestId = String(
      req.query.request_id || req.query.requestId || ""
    ).trim();

    if (!requestId) {
      return res.status(400).json({ error: "Missing request_id" });
    }

    // 1) نفحص الحالة
    const statusResp = await fetchFn(
      `https://queue.fal.run/fal-ai/kling-video/v2.6/pro/text-to-video/requests/${requestId}/status?logs=1`,
      {
        method: "GET",
        headers: {
          Authorization: `Key ${FAL_API_KEY}`
        }
      }
    );

    const statusRaw = await statusResp.text();
    let statusData;

    try {
      statusData = JSON.parse(statusRaw);
    } catch {
      statusData = { raw: statusRaw };
    }

    if (!statusResp.ok) {
      return res.status(statusResp.status).json({
        error: "Fal status request failed",
        status: statusResp.status,
        details: statusData
      });
    }

    // إذا لم يكتمل بعد، نرجّع الحالة كما هي
    if (statusResp.status === 202 || statusData?.status !== "COMPLETED") {
      return res.status(200).json({
        status: statusData?.status || "IN_PROGRESS",
        request_id: requestId,
        details: statusData
      });
    }

    // 2) إذا اكتمل، نجيب النتيجة النهائية
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
    let resultData;

    try {
      resultData = JSON.parse(resultRaw);
    } catch {
      resultData = { raw: resultRaw };
    }

    if (!resultResp.ok) {
      return res.status(resultResp.status).json({
        error: "Fal result request failed",
        status: resultResp.status,
        details: resultData
      });
    }

    return res.status(200).json({
      status: "COMPLETED",
      request_id: requestId,
      result: resultData,
      video_url:
        resultData?.video?.url ||
        resultData?.data?.video?.url ||
        resultData?.data?.videos?.[0]?.url ||
        null
    });
  } catch (error) {
    return res.status(500).json({
      error: "Internal Server Error",
      details: error?.message || String(error)
    });
  }
};

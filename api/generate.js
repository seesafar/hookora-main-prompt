module.exports = async (req, res) => {
  // 1) السماح فقط POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    // 2) تحقق من المفتاح الداخلي (لازم يكون موجود في Vercel)
    const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
    if (!INTERNAL_API_KEY) {
      return res.status(500).json({ error: "Missing INTERNAL_API_KEY in env" });
    }

    // ملاحظة: في Node/Vercel قد تأتي الهيدرز بحروف صغيرة دائمًا
    const clientKey = req.headers["x-api-key"];
    if (!clientKey || clientKey !== INTERNAL_API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 3) التقط المدخل: prompt أو idea
    const { prompt, idea } = req.body || {};
    const userInput = (prompt || idea || "").trim();

    if (!userInput) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    // 4) تحقق من مفتاح OpenAI
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY in env" });
    }

    // 5) نداء OpenAI (Responses API)
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        // نخليها منظمة أكثر
        input: [
          {
            role: "user",
            content: `اكتب سكربت إعلان تسويقي احترافي بناءً على الطلب التالي:\n\n${userInput}\n\nأرجع النتيجة كنص واحد جاهز للنشر.`,
          },
        ],
      }),
    });

    const data = await response.json();

    // لو OpenAI رجّع خطأ، نطلّعه واضح بدل 500 غامض
    if (!response.ok) {
      return res.status(response.status).json({
        error: "OpenAI request failed",
        details: data,
      });
    }

    // 6) استخراج النص من Responses API بأكثر من مسار (توافق عالي)
    const script =
      // بعض الردود توفر output_text جاهز
      (typeof data.output_text === "string" && data.output_text.trim()) ||
      // كثير من ردود Responses API تكون داخل output[0].content[type=output_text].text
      (data?.output?.[0]?.content
        ?.find((c) => c?.type === "output_text" && typeof c?.text === "string")
        ?.text?.trim()) ||
      // تجميع أي نصوص موجودة داخل output -> content -> text
      (Array.isArray(data?.output)
        ? data.output
            .map((o) =>
              Array.isArray(o?.content)
                ? o.content
                    .map((c) => (typeof c?.text === "string" ? c.text : ""))
                    .filter(Boolean)
                    .join("\n")
                : ""
            )
            .filter(Boolean)
            .join("\n")
            .trim()
        : "") ||
      "";

    // Debug مؤقت: يساعدنا لو طلع فاضي (احذفه لاحقًا بعد التأكد)
    return res.status(200).json({
      script,
      debug: {
        has_output_text: typeof data.output_text === "string",
        output_text_len: typeof data.output_text === "string" ? data.output_text.length : 0,
        has_output: Array.isArray(data.output),
        output_len: Array.isArray(data.output) ? data.output.length : 0,
      },
    });
  } catch (err) {
    console.error("API /generate error:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err?.message || String(err),
    });
  }
};

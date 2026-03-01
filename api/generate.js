module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    // Vercel sometimes gives body as string
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const idea = body.idea;

    if (!idea) {
      return res.status(400).json({ error: "Missing 'idea' in request body." });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `You are an expert direct-response advertising copywriter.

Write a high-converting 30-45 second video ad script.

Structure:
1) Hook
2) Problem or Desire
3) Solution
4) Benefits
5) Strong Call To Action

Product idea: ${idea}

Output only the final script.`,
      }),
    });

    const data = await response.json();

    const script =
      data.output_text ||
      (data.output && data.output[0]?.content?.[0]?.text) ||
      "No script generated.";

    return res.status(200).json({ script });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
};

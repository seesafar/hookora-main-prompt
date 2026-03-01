module.exports = async (req, res) => {

  // 🔐 حماية الـ API
  const apiKey = req.headers["x-api-key"];
  const internalKey = process.env.INTERNAL_API_KEY;

  if (!apiKey || apiKey !== internalKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // منع GET
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { prompt } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    // باقي كود OpenAI هنا...
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { idea } = req.body || {};
    if (!idea) return res.status(400).json({ error: "No idea provided" });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
      data.output?.[0]?.content?.[0]?.text ||
      "No script generated.";

    return res.status(200).json({ script });
  } catch (err) {
    return res.status(500).json({ error: "Something went wrong" });
  }
};

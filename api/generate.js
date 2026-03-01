module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const { prompt, idea } = req.body || {};
    const userInput = prompt || idea;

    if (!userInput) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: userInput,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    const text =
      data?.output?.[0]?.content?.find(c => c.type === "output_text")?.text ||
      data?.output_text ||
      "No text returned";

    return res.status(200).json({ script: text });

  } catch (error) {
    return res.status(500).json({
      error: "Function crashed",
      message: error.message,
    });
  }
};

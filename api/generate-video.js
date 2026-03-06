export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { prompt, seconds } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const runwayKey = process.env.RUNWAY_API_KEY;

    const response = await fetch("https://api.runwayml.com/v1/text_to_video", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${runwayKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06"
      },
      body: JSON.stringify({
        prompt: prompt,
        duration: seconds || 10,
        ratio: "9:16"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data });
    }

    return res.status(200).json(data);

  } catch (error) {

    return res.status(500).json({
      error: "Runway request failed",
      details: error.message
    });

  }
}

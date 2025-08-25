export default async function handler(req, res) {
  // Cho phép CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end(); // Trả về cho preflight
  }

  try {
    const { targetUrl, data } = req.body;

    if (!targetUrl) {
      return res.status(400).json({ error: "Missing targetUrl" });
    }

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data || {}),
    });

    const result = await response.text(); // có thể là JSON hoặc text
    res.status(200).json({
      success: true,
      targetStatus: response.status,
      targetResponse: result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

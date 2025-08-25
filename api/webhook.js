// api/webhook.js
// Universal Webhook Proxy for Vercel
// - Accepts POST from browser
// - Reads target webhook URL from body.target OR query ?target= OR header x-target-url
// - Forwards JSON payload to the target
// - Adds permissive CORS so you can call from any origin

export default async function handler(req, res) {
  // ---- CORS ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-target-url");
  if (req.method === "OPTIONS") {
    // Preflight
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Vercel may give you an object or a string, handle both safely
    let bodyData = req.body;
    if (typeof bodyData === "string") {
      try { bodyData = JSON.parse(bodyData || "{}"); } catch (_) { bodyData = {}; }
    }
    if (!bodyData || typeof bodyData !== "object") bodyData = {};

    const target =
      bodyData.target ||
      req.query?.target ||
      req.headers["x-target-url"];

    if (!target) {
      return res.status(400).json({ error: "Missing target URL. Provide in body.target, ?target=, or x-target-url header." });
    }

    // Determine payload to forward. If body.payload exists, use it.
    // Otherwise, use the whole body but remove the "target" key.
    let payload;
    if (Object.prototype.hasOwnProperty.call(bodyData, "payload")) {
      payload = bodyData.payload;
    } else {
      payload = { ...bodyData };
      delete payload.target;
    }

    // Forward to target webhook
    const upstream = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });

    const text = await upstream.text();

    // Mirror upstream status & body
    res.status(upstream.status).send(text);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Proxy failed", details: String(err && err.message or err) });
  }
}

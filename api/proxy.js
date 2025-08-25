const axios = require('axios');

module.exports = async (req, res) => {
  // Cấu hình CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-URL');

  // Xử lý preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Chỉ cho phép POST request
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Lấy URL đích từ header hoặc body
    const targetUrl = req.headers['x-webhook-url'] || req.body.webhookUrl;
    
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing webhook URL' });
    }

    // Lấy data cần forward
    const { webhookUrl, ...dataToForward } = req.body;

    // Forward request đến webhook đích
    const response = await axios.post(targetUrl, dataToForward, {
      headers: {
        'Content-Type': 'application/json',
        // Forward các headers cần thiết
        'User-Agent': req.headers['user-agent'] || 'Webhook-Proxy'
      },
      timeout: 30000 // 30 giây timeout
    });

    // Trả về response
    res.status(response.status).json({
      success: true,
      data: response.data,
      status: response.status
    });

  } catch (error) {
    console.error('Proxy error:', error.message);
    
    if (error.response) {
      // Lỗi từ webhook đích
      res.status(error.response.status).json({
        success: false,
        error: error.response.data,
        status: error.response.status
      });
    } else {
      // Lỗi network hoặc khác
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};

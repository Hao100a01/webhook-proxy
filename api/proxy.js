import axios from 'axios';

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { 
      targetUrl, 
      data, 
      headers: customHeaders = {},
      method = 'POST',
      timeout = 10000 
    } = req.body;

    if (!targetUrl) {
      return res.status(400).json({
        success: false,
        error: 'targetUrl is required'
      });
    }

    // Validate URL
    try {
      new URL(targetUrl);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid targetUrl format'
      });
    }

    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Webhook-Proxy/1.0',
      ...customHeaders
    };

    // Forward request
    const config = {
      method: method.toUpperCase(),
      url: targetUrl,
      headers,
      data: data || {},
      timeout: parseInt(timeout),
      validateStatus: () => true
    };

    const startTime = Date.now();
    const response = await axios(config);
    const duration = Date.now() - startTime;

    console.log('Webhook forwarded:', {
      targetUrl,
      method: config.method,
      status: response.status,
      duration: `${duration}ms`
    });

    res.status(200).json({
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers,
      duration: `${duration}ms`,
      target: targetUrl
    });

  } catch (error) {
    console.error('Proxy error:', error.message);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        success: false,
        error: 'Request timeout'
      });
    }

    if (error.response) {
      return res.status(200).json({
        success: false,
        status: error.response.status,
        error: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

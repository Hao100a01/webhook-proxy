export default async function handler(req, res) {
  // Enable CORS cho mọi origin
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // Chỉ accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    })
  }

  try {
    // Lấy webhook URL từ environment variable
    const webhookUrl = process.env.WEBHOOK_URL
    
    if (!webhookUrl) {
      return res.status(500).json({ 
        success: false, 
        message: 'WEBHOOK_URL not configured' 
      })
    }

    // Forward request đến webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-Proxy/1.0',
        // Có thể add thêm headers nếu webhook cần
        ...(process.env.WEBHOOK_AUTH && {
          'Authorization': `Bearer ${process.env.WEBHOOK_AUTH}`
        })
      },
      body: JSON.stringify(req.body)
    })

    // Parse response
    let data
    const contentType = response.headers.get('content-type')
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    // Return response
    res.status(response.status).json({
      success: response.ok,
      status: response.status,
      data: data
    })

  } catch (error) {
    console.error('Webhook proxy error:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
}

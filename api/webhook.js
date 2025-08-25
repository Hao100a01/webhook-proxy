export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin, X-Webhook-URL, X-Webhook-Auth')

  // Handle preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // Handle GET (API documentation)
  if (req.method === 'GET') {
    return res.status(200).json({
      name: 'Universal Webhook Proxy API',
      version: '1.0.0',
      description: 'Forward webhooks to any URL with CORS support',
      usage: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-URL': 'https://your-webhook-url.com/endpoint',
          'X-Webhook-Auth': 'Bearer token (optional)'
        },
        body: 'Any JSON payload'
      },
      examples: {
        curl: `curl -X POST "${req.headers.host}/api/webhook" \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-URL: https://webhook.site/your-id" \\
  -d '{"message": "Hello World"}'`,
        javascript: `fetch('/api/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-URL': 'https://your-webhook.com/endpoint'
  },
  body: JSON.stringify({message: 'Hello'})
})`
      },
      timestamp: new Date().toISOString()
    })
  }

  // Handle POST (main proxy logic)
  if (req.method === 'POST') {
    try {
      // Get webhook URL from header or body
      let webhookUrl = req.headers['x-webhook-url']
      let authToken = req.headers['x-webhook-auth']
      
      // Alternative: Get from request body
      if (!webhookUrl && req.body && req.body.webhook_url) {
        webhookUrl = req.body.webhook_url
        authToken = req.body.webhook_auth
        
        // Remove webhook config from forwarded payload
        delete req.body.webhook_url
        delete req.body.webhook_auth
      }

      // Validation
      if (!webhookUrl) {
        return res.status(400).json({
          success: false,
          error: 'Missing webhook URL',
          details: 'Please provide webhook URL via X-Webhook-URL header or webhook_url in body',
          usage: 'See GET request for API documentation'
        })
      }

      // Validate URL format
      try {
        new URL(webhookUrl)
      } catch (urlError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid webhook URL format',
          provided_url: webhookUrl
        })
      }

      // Security: Block private/internal URLs (optional)
      const url = new URL(webhookUrl)
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '10.', '192.168.', '172.']
      
      if (blockedHosts.some(blocked => url.hostname.includes(blocked))) {
        return res.status(403).json({
          success: false,
          error: 'Private/internal URLs are not allowed',
          blocked_host: url.hostname
        })
      }

      // Prepare headers for forwarding
      const forwardHeaders = {
        'Content-Type': 'application/json',
        'User-Agent': 'Universal-Webhook-Proxy/1.0',
        'X-Forwarded-By': 'Vercel-Proxy',
        'X-Original-Host': req.headers.host,
        'X-Forwarded-For': req.headers['x-forwarded-for'] || 'unknown'
      }

      // Add authentication if provided
      if (authToken) {
        if (authToken.startsWith('Bearer ')) {
          forwardHeaders['Authorization'] = authToken
        } else {
          forwardHeaders['Authorization'] = `Bearer ${authToken}`
        }
      }

      // Add custom headers if provided
      Object.keys(req.headers).forEach(key => {
        if (key.startsWith('x-custom-')) {
          const customKey = key.replace('x-custom-', '')
          forwardHeaders[customKey] = req.headers[key]
        }
      })

      console.log(`Forwarding to: ${webhookUrl}`)
      console.log('Payload:', req.body)

      // Forward request with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: forwardHeaders,
        body: JSON.stringify(req.body),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Parse response
      let responseData
      let responseHeaders = {}
      
      // Convert headers to object
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      const contentType = response.headers.get('content-type')
      
      try {
        if (contentType && contentType.includes('application/json')) {
          responseData = await response.json()
        } else {
          responseData = await response.text()
        }
      } catch (parseError) {
        responseData = await response.text()
      }

      // Return response
      return res.status(response.status).json({
        success: response.ok,
        proxy_info: {
          forwarded_to: webhookUrl,
          original_status: response.status,
          original_status_text: response.statusText,
          response_time: Date.now(),
          content_type: contentType
        },
        response_headers: responseHeaders,
        data: responseData
      })

    } catch (error) {
      console.error('Proxy error:', error)
      
      // Handle different error types
      let errorMessage = error.message
      let errorCode = 500
      
      if (error.name === 'AbortError') {
        errorMessage = 'Request timeout (30s)'
        errorCode = 504
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Failed to connect to webhook URL'
        errorCode = 502
      }
      
      return res.status(errorCode).json({
        success: false,
        error: errorMessage,
        error_type: error.name,
        timestamp: new Date().toISOString()
      })
    }
  }

  // Method not allowed
  return res.status(405).json({
    success: false,
    error: `Method ${req.method} not allowed`,
    allowed_methods: ['GET', 'POST', 'OPTIONS']
  })
}

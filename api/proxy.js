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
      version: '2.0.0',
      description: 'Forward webhooks with JSON data and file uploads',
      supported_content_types: [
        'application/json',
        'multipart/form-data',
        'application/x-www-form-urlencoded'
      ],
      usage: {
        json_mode: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-URL': 'https://your-webhook-url.com/endpoint',
            'X-Webhook-Auth': 'Bearer token (optional)'
          },
          body: 'JSON payload'
        },
        form_data_mode: {
          method: 'POST',
          headers: {
            'Content-Type': 'multipart/form-data',
            'X-Webhook-URL': 'https://your-webhook-url.com/endpoint',
            'X-Webhook-Auth': 'Bearer token (optional)'
          },
          body: 'FormData with text fields and files'
        }
      },
      examples: {
        json: `fetch('/api/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-URL': 'https://webhook.site/your-id'
  },
  body: JSON.stringify({message: 'Hello'})
})`,
        form_data: `const formData = new FormData();
formData.append('message', 'Hello');
formData.append('file', fileInput.files[0]);

fetch('/api/webhook', {
  method: 'POST',
  headers: {
    'X-Webhook-URL': 'https://webhook.site/your-id'
  },
  body: formData
})`
      },
      timestamp: new Date().toISOString()
    })
  }

  // Handle POST (main proxy logic)
  if (req.method === 'POST') {
    try {
      // Get webhook URL from header
      let webhookUrl = req.headers['x-webhook-url']
      let authToken = req.headers['x-webhook-auth']
      
      const contentType = req.headers['content-type'] || ''
      
      console.log('Content-Type:', contentType)
      console.log('Webhook URL:', webhookUrl)

      // Handle different content types
      let requestData = null
      let forwardHeaders = {
        'User-Agent': 'Universal-Webhook-Proxy/2.0',
        'X-Forwarded-By': 'Vercel-Proxy',
        'X-Original-Host': req.headers.host,
        'X-Forwarded-For': req.headers['x-forwarded-for'] || 'unknown'
      }

      // JSON Mode
      if (contentType.includes('application/json')) {
        // Get webhook URL from body if not in header
        if (!webhookUrl && req.body && req.body.webhook_url) {
          webhookUrl = req.body.webhook_url
          authToken = req.body.webhook_auth
          
          // Remove webhook config from forwarded payload
          delete req.body.webhook_url
          delete req.body.webhook_auth
        }

        requestData = JSON.stringify(req.body)
        forwardHeaders['Content-Type'] = 'application/json'
      }
      
      // Form Data Mode
      else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
        // For Vercel, we need to handle this differently
        // Vercel automatically parses form data but we need raw body for forwarding
        
        // Try to reconstruct form data from parsed body
        if (contentType.includes('application/x-www-form-urlencoded')) {
          // URL encoded form data
          const params = new URLSearchParams()
          
          // Get webhook URL from parsed body
          if (!webhookUrl && req.body && req.body.webhook_url) {
            webhookUrl = req.body.webhook_url
            authToken = req.body.webhook_auth
            delete req.body.webhook_url
            delete req.body.webhook_auth
          }
          
          // Build URL encoded string
          Object.keys(req.body).forEach(key => {
            if (Array.isArray(req.body[key])) {
              req.body[key].forEach(value => params.append(key, value))
            } else {
              params.append(key, req.body[key])
            }
          })
          
          requestData = params.toString()
          forwardHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
        } 
        else {
          // Multipart form data - this is tricky in Vercel
          // We'll convert to JSON for now, but provide alternative solution
          console.log('Form data received:', req.body)
          
          // Get webhook URL from form fields
          if (!webhookUrl && req.body && req.body.webhook_url) {
            webhookUrl = req.body.webhook_url
            authToken = req.body.webhook_auth
            delete req.body.webhook_url
            delete req.body.webhook_auth
          }
          
          // Convert form data to JSON (fallback)
          requestData = JSON.stringify({
            ...req.body,
            _note: 'Original form-data converted to JSON due to Vercel limitations',
            _original_content_type: contentType
          })
          forwardHeaders['Content-Type'] = 'application/json'
          forwardHeaders['X-Original-Content-Type'] = contentType
        }
      }
      
      // Raw text/other formats
      else {
        requestData = req.body
        forwardHeaders['Content-Type'] = contentType
      }

      // Validation
      if (!webhookUrl) {
        return res.status(400).json({
          success: false,
          error: 'Missing webhook URL',
          details: 'Please provide webhook URL via X-Webhook-URL header or webhook_url in body',
          content_type_received: contentType
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

      // Security: Block private/internal URLs
      const url = new URL(webhookUrl)
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '10.', '192.168.', '172.']
      
      if (blockedHosts.some(blocked => url.hostname.includes(blocked))) {
        return res.status(403).json({
          success: false,
          error: 'Private/internal URLs are not allowed',
          blocked_host: url.hostname
        })
      }

      // Add authentication if provided
      if (authToken) {
        if (authToken.startsWith('Bearer ') || authToken.startsWith('Basic ')) {
          forwardHeaders['Authorization'] = authToken
        } else {
          forwardHeaders['Authorization'] = `Bearer ${authToken}`
        }
      }

      // Add custom headers
      Object.keys(req.headers).forEach(key => {
        if (key.startsWith('x-custom-')) {
          const customKey = key.replace('x-custom-', '')
          forwardHeaders[customKey] = req.headers[key]
        }
      })

      console.log(`Forwarding to: ${webhookUrl}`)
      console.log('Forward headers:', forwardHeaders)
      console.log('Data type:', typeof requestData)

      // Forward request with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      const fetchOptions = {
        method: 'POST',
        headers: forwardHeaders,
        signal: controller.signal
      }

      // Add body based on content type
      if (forwardHeaders['Content-Type'] === 'application/json') {
        fetchOptions.body = requestData
      } else if (forwardHeaders['Content-Type'] === 'application/x-www-form-urlencoded') {
        fetchOptions.body = requestData
      } else {
        fetchOptions.body = requestData
      }

      const response = await fetch(webhookUrl, fetchOptions)
      clearTimeout(timeoutId)

      // Parse response
      let responseData
      let responseHeaders = {}
      
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      const responseContentType = response.headers.get('content-type')
      
      try {
        if (responseContentType && responseContentType.includes('application/json')) {
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
          original_content_type: contentType,
          forwarded_content_type: forwardHeaders['Content-Type'],
          original_status: response.status,
          original_status_text: response.statusText,
          response_time: Date.now(),
          data_size: requestData ? requestData.length : 0
        },
        response_headers: responseHeaders,
        data: responseData
      })

    } catch (error) {
      console.error('Proxy error:', error)
      
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

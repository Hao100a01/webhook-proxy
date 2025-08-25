import axios from 'axios';
import busboy from 'busboy';
import FormData from 'form-data';

export const config = {
  api: {
    bodyParser: false, // Disable default body parser for file uploads
  },
};

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Only POST requests are accepted.'
    });
  }

  try {
    const bb = busboy({ 
      headers: req.headers,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit per file
        files: 5, // Max 5 files
        fields: 20 // Max 20 fields
      }
    });

    const formData = new FormData();
    const fields = {};
    const files = [];
    let targetUrl = null;

    // Parse multipart form data
    bb.on('field', (name, value) => {
      if (name === 'targetUrl') {
        targetUrl = value;
      } else {
        fields[name] = value;
        formData.append(name, value);
      }
    });

    bb.on('file', (name, file, info) => {
      const { filename, encoding, mimeType } = info;
      const chunks = [];
      
      file.on('data', (chunk) => {
        chunks.push(chunk);
      });

      file.on('end', () => {
        const buffer = Buffer.concat(chunks);
        formData.append(name, buffer, {
          filename: filename,
          contentType: mimeType
        });
        
        files.push({
          name,
          filename,
          size: buffer.length,
          mimeType
        });
      });
    });

    bb.on('finish', async () => {
      try {
        if (!targetUrl) {
          return res.status(400).json({
            success: false,
            error: 'targetUrl is required as form field'
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

        // Get custom headers from form data
        const customHeaders = fields.headers ? JSON.parse(fields.headers) : {};

        // Prepare headers for forwarding
        const headers = {
          ...formData.getHeaders(),
          'User-Agent': 'Webhook-Proxy/1.0',
          ...customHeaders
        };

        // Forward the form data
        const startTime = Date.now();
        const response = await axios.post(targetUrl, formData, {
          headers,
          timeout: parseInt(fields.timeout || 30000),
          maxContentLength: 50 * 1024 * 1024, // 50MB
          maxBodyLength: 50 * 1024 * 1024, // 50MB
          validateStatus: () => true
        });

        const duration = Date.now() - startTime;

        console.log('File upload forwarded:', {
          targetUrl,
          files: files.map(f => `${f.name}: ${f.filename} (${f.size} bytes)`),
          fields: Object.keys(fields),
          status: response.status,
          duration: `${duration}ms`
        });

        res.status(200).json({
          success: true,
          status: response.status,
          data: response.data,
          files: files,
          fields: fields,
          duration: `${duration}ms`,
          target: targetUrl
        });

      } catch (error) {
        console.error('Upload error:', error.message);
        handleError(error, res);
      }
    });

    bb.on('error', (error) => {
      console.error('Busboy error:', error);
      res.status(500).json({
        success: false,
        error: 'Error parsing form data'
      });
    });

    req.pipe(bb);

  } catch (error) {
    console.error('Upload handler error:', error);
    handleError(error, res);
  }
}

function handleError(error, res) {
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

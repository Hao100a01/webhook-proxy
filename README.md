# Webhook Proxy API

API proxy để chuyển tiếp webhook requests và bypass CORS.

## Cách sử dụng

### Endpoint

### Headers
- `X-Webhook-URL`: URL đích của webhook
- `Content-Type`: application/json

### Body
JSON data cần gửi đến webhook đích

### Ví dụ JavaScript
```javascript
const response = await fetch('https://your-app.vercel.app/api/proxy', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Webhook-URL': 'https://example.com/webhook'
    },
    body: JSON.stringify({
        message: 'Hello from proxy!'
    })
});

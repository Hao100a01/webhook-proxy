# Universal Webhook Proxy (Vercel) + Tester UI

A minimal, beginner-friendly project that deploys to Vercel:
- `/api/webhook` – Universal proxy that forwards JSON to any target webhook.
- `/` – Simple HTML page to test your proxy from the browser.

## 1) Create a new GitHub repo
1. Create an empty GitHub repository (public or private).
2. Download this folder or the ZIP, then add all files to the repo and commit/push.

```
universal-webhook-proxy/
├─ api/
│  └─ webhook.js        # Serverless Function (proxy)
├─ index.html           # Tester UI
├─ vercel.json          # (optional) Vercel config
└─ package.json         # minimal metadata
```

## 2) Import the repo into Vercel
1. Go to https://vercel.com/import and choose "Import Git Repository".
2. Select your repo.
3. Framework preset: **Other** (or leave auto).
4. Build Command: **(empty)**.
5. Output Directory: **(empty)**.
6. Click **Deploy**.

Vercel will serve `index.html` at your project URL and create the API route at `/api/webhook`.

## 3) Test quickly
- Open: `https://<your-project>.vercel.app/`
- In the form, leave **Proxy URL** = `/api/webhook` (works when the UI and API are same domain).
- For **Target URL**, use e.g. `https://webhook.site/<your-id>` (open webhook.site to get your unique URL).
- Enter some JSON and click **Send**.

If you host the tester on a different domain, use the full proxy URL: `https://<your-project>.vercel.app/api/webhook`.

## 4) Common issues
- **Failed to fetch** in the UI:
  - Proxy URL is wrong (use `/api/webhook` or the full project URL).
  - Vercel deployment not finished or project sleeping – try refreshing.
  - You are opening `index.html` as a local file (`file://`) and CORS/preflight blocks it – host it on Vercel.
- **400 Missing target URL** – you didn't fill the Target URL.
- **Upstream webhook rejects** – check that your Target webhook accepts JSON and doesn't need extra auth.

## 5) Security notes
- This universal proxy will forward to any URL given. For production, consider restricting allowed domains or requiring an API key.

import { extname } from "https://deno.land/std@0.224.0/path/extname.ts";

const securityHeaders = {
  "x-content-type-options": "nosniff",
};

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  console.log(`[miniapp] Request: ${req.method} ${url.pathname} - Full URL: ${req.url}`);

  // Version endpoint
  if (url.pathname === "/miniapp/version") {
    const headers = new Headers({
      ...securityHeaders,
      "content-type": "application/json; charset=utf-8",
    });
    if (req.method === "HEAD") return new Response(null, { status: 200, headers });
    return new Response(
      JSON.stringify({ name: "miniapp", ts: new Date().toISOString() }),
      { status: 200, headers },
    );
  }

  // Serve root HTML - embedded content
  if (url.pathname === "/miniapp/" || url.pathname === "/miniapp") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response(null, { status: 405, headers: securityHeaders });
    }
    
    const htmlContent = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Mini App</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    body { 
      margin: 0; 
      padding: 20px; 
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--tg-theme-bg-color, #fff);
      color: var(--tg-theme-text-color, #000);
    }
    .container { 
      max-width: 400px; 
      margin: 0 auto; 
    }
    .form { 
      display: flex; 
      flex-direction: column; 
      gap: 16px; 
    }
    .input { 
      padding: 12px; 
      border: 1px solid var(--tg-theme-hint-color, #ccc); 
      border-radius: 8px; 
      font-size: 16px;
      background: var(--tg-theme-secondary-bg-color, #fff);
      color: var(--tg-theme-text-color, #000);
    }
    .button { 
      padding: 12px 24px; 
      background: var(--tg-theme-button-color, #007aff); 
      color: var(--tg-theme-button-text-color, #fff); 
      border: none; 
      border-radius: 8px; 
      font-size: 16px; 
      cursor: pointer; 
    }
    .button:disabled { 
      opacity: 0.5; 
      cursor: not-allowed; 
    }
    .status { 
      margin-top: 16px; 
      padding: 12px; 
      border-radius: 8px; 
      text-align: center; 
      font-size: 14px;
    }
    .status.success { 
      background: #d4edda; 
      color: #155724; 
    }
    .status.error { 
      background: #f8d7da; 
      color: #721c24; 
    }
    .status.processing { 
      background: #d1ecf1; 
      color: #0c5460; 
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Dynamic Capital Mini App</h1>
    <form id="deposit" class="form">
      <label>
        <span>Amount</span>
        <input name="amount" type="number" min="1" required class="input" placeholder="Enter amount" />
      </label>
      <button type="submit" class="button">Create Deposit</button>
      <div id="status" class="status" style="display: none;"></div>
    </form>
  </div>
  
  <script>
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
    
    const initData = tg?.initData || '';
    console.log('Mini App loaded, initData:', initData);
    
    const form = document.getElementById('deposit');
    const status = document.getElementById('status');
    
    function showStatus(message, type = 'processing') {
      status.textContent = message;
      status.className = 'status ' + type;
      status.style.display = 'block';
    }
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = Number(form.elements.namedItem('amount').value);
      
      if (!amount || amount <= 0) {
        showStatus('Please enter a valid amount', 'error');
        return;
      }
      
      showStatus('Processing deposit...', 'processing');
      
      try {
        const res = await fetch(\`\${window.location.origin}/miniapp-deposit\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData, amount }),
        });
        
        const data = await res.json();
        
        if (res.ok && data.ok) {
          showStatus('Deposit created successfully!', 'success');
          setTimeout(() => {
            if (tg) tg.close();
          }, 2000);
        } else {
          showStatus(data.error || 'Failed to create deposit', 'error');
        }
      } catch (err) {
        console.error('Network error:', err);
        showStatus('Network error. Please try again.', 'error');
      }
    });
  </script>
</body>
</html>`;

    const headers = new Headers({
      ...securityHeaders,
      "content-type": "text/html; charset=utf-8",
    });
    
    if (req.method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }
    
    return new Response(htmlContent, { status: 200, headers });
  }

  // Static assets
  if (url.pathname.startsWith("/assets/")) {
    const rel = url.pathname.slice("/assets/".length);
    const fileUrl = new URL(`./static/assets/${rel}`, import.meta.url);
    try {
      const body = await Deno.readFile(fileUrl);
      const headers = new Headers(securityHeaders);
      const ext = extname(rel);
      const type = ext === ".css"
        ? "text/css; charset=utf-8"
        : ext === ".js"
        ? "text/javascript; charset=utf-8"
        : "application/octet-stream";
      headers.set("content-type", type);
      if (req.method === "HEAD") return new Response(null, { status: 200, headers });
      return new Response(body, { status: 200, headers });
    } catch {
      return new Response(null, { status: 404, headers: securityHeaders });
    }
  }

  if (url.pathname.startsWith("/miniapp")) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response(null, { status: 405, headers: securityHeaders });
    }
    return new Response(null, { status: 404, headers: securityHeaders });
  }

  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: {
      ...securityHeaders,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export default handler;

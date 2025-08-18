// Embedded HTML content for the miniapp
const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Dynamic Capital Mini App</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #1e3a8a 0%, #7c3aed 50%, #3730a3 100%);
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
      min-height: 100vh;
    }
    .container {
      padding: 20px;
      max-width: 400px;
      margin: 0 auto;
    }
    .glass-panel {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 20px;
      margin: 16px 0;
    }
    .btn {
      background: rgba(59, 130, 246, 0.8);
      border: none;
      border-radius: 8px;
      color: white;
      padding: 12px 24px;
      width: 100%;
      margin: 8px 0;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.2s;
    }
    .btn:hover {
      background: rgba(59, 130, 246, 1);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="container">
      <div class="glass-panel">
        <h1 style="text-align: center; margin: 0 0 16px 0;">Dynamic Capital</h1>
        <p style="text-align: center; opacity: 0.8; margin: 0;">Premium Trading Signals & VIP Content</p>
      </div>
      
      <button class="btn" onclick="window.location.hash='/plan'">
        View VIP Plans
      </button>
      
      <button class="btn btn-secondary" onclick="window.location.hash='/status'">
        Check Status
      </button>
      
      <div class="glass-panel">
        <p style="text-align: center; font-size: 14px; opacity: 0.7; margin: 0;">
          Secure payments • 24/7 support
        </p>
      </div>
    </div>
  </div>
  
  <script>
    // Initialize Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
    
    // Simple routing
    function handleRoute() {
      const hash = window.location.hash.slice(1);
      const root = document.getElementById('root');
      
      switch (hash) {
        case '/plan':
          root.innerHTML = \`
            <div class="container">
              <div class="glass-panel">
                <h2>VIP Plans</h2>
                <p>Choose your subscription plan</p>
              </div>
              <button class="btn" onclick="window.location.hash='/'">Back to Home</button>
            </div>
          \`;
          break;
        case '/status':
          root.innerHTML = \`
            <div class="container">
              <div class="glass-panel">
                <h2>Subscription Status</h2>
                <p>Check your current subscription</p>
              </div>
              <button class="btn" onclick="window.location.hash='/'">Back to Home</button>
            </div>
          \`;
          break;
        default:
          // Home page already loaded
          break;
      }
    }
    
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  </script>
</body>
</html>`;

export function handler(req: Request): Response {
  const url = new URL(req.url);
  
  console.log(`[miniapp] Request: ${req.method} ${url.pathname} - Full URL: ${req.url}`);
  
  // Security headers
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "content-security-policy":
      "default-src 'self' https://*.telegram.org https://telegram.org; " +
      "script-src 'self' 'unsafe-inline' https://*.telegram.org; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https://*.functions.supabase.co https://*.supabase.co wss://*.supabase.co; " +
      "font-src 'self' data:; " +
      "frame-ancestors 'self' https://*.t.me https://*.telegram.org https://web.telegram.org https://telegram.org;",
    "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "permissions-policy": "geolocation=(), microphone=(), camera=()",
  });

  // Handle version endpoint
  if (url.pathname.includes("/version")) {
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(
      JSON.stringify({ name: "miniapp", ts: new Date().toISOString() }),
      { headers }
    );
  }

  // Handle all other requests with HTML
  return new Response(HTML_CONTENT, { headers });
}

export default handler;

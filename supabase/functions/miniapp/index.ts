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
  <title>Dynamic Capital</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--tg-theme-bg-color, linear-gradient(135deg, #667eea 0%, #764ba2 100%));
      color: var(--tg-theme-text-color, #1f2937);
      min-height: 100vh;
      padding: 0;
    }
    
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--tg-theme-bg-color, #f8fafc);
    }
    
    .header {
      background: var(--tg-theme-header-bg-color, #ffffff);
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--tg-theme-hint-color, #e2e8f0);
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    }
    
    .header-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--tg-theme-text-color, #1e293b);
      text-align: center;
    }
    
    .header-subtitle {
      font-size: 0.875rem;
      color: var(--tg-theme-hint-color, #64748b);
      text-align: center;
      margin-top: 0.25rem;
    }
    
    .main-content {
      flex: 1;
      padding: 2rem 1.5rem;
      max-width: 28rem;
      margin: 0 auto;
      width: 100%;
    }
    
    .card {
      background: var(--tg-theme-secondary-bg-color, #ffffff);
      border-radius: 1rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      padding: 2rem;
      border: 1px solid var(--tg-theme-hint-color, #e2e8f0);
    }
    
    .card-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--tg-theme-text-color, #1e293b);
    }
    
    .card-description {
      color: var(--tg-theme-hint-color, #64748b);
      margin-bottom: 2rem;
      line-height: 1.5;
    }
    
    .form-group {
      margin-bottom: 1.5rem;
    }
    
    .label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--tg-theme-text-color, #374151);
      margin-bottom: 0.5rem;
    }
    
    .input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid var(--tg-theme-hint-color, #d1d5db);
      border-radius: 0.5rem;
      font-size: 1rem;
      background: var(--tg-theme-bg-color, #ffffff);
      color: var(--tg-theme-text-color, #1f2937);
      transition: all 0.2s ease;
    }
    
    .input:focus {
      outline: none;
      border-color: var(--tg-theme-button-color, #3b82f6);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    .button {
      width: 100%;
      padding: 0.875rem 1.5rem;
      background: var(--tg-theme-button-color, linear-gradient(135deg, #667eea 0%, #764ba2 100%));
      color: var(--tg-theme-button-text-color, #ffffff);
      border: none;
      border-radius: 0.75rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px 0 rgba(102, 126, 234, 0.3);
    }
    
    .button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px 0 rgba(102, 126, 234, 0.4);
    }
    
    .button:active {
      transform: translateY(0);
    }
    
    .button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: 0 4px 14px 0 rgba(102, 126, 234, 0.3);
    }
    
    .status {
      margin-top: 1rem;
      padding: 1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      text-align: center;
      display: none;
      animation: slideIn 0.3s ease;
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .status.success {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }
    
    .status.error {
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
    }
    
    .status.processing {
      background: #dbeafe;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      position: relative;
    }
    
    .spinner {
      display: inline-block;
      width: 1rem;
      height: 1rem;
      border: 2px solid #bfdbfe;
      border-radius: 50%;
      border-top-color: #1d4ed8;
      animation: spin 1s linear infinite;
      margin-right: 0.5rem;
    }
    
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    
    .amount-suggestions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
      flex-wrap: wrap;
    }
    
    .suggestion-chip {
      padding: 0.5rem 1rem;
      background: var(--tg-theme-hint-color, #f1f5f9);
      border: 1px solid var(--tg-theme-hint-color, #e2e8f0);
      border-radius: 2rem;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s ease;
      color: var(--tg-theme-text-color, #64748b);
    }
    
    .suggestion-chip:hover {
      background: var(--tg-theme-button-color, #3b82f6);
      color: white;
      border-color: var(--tg-theme-button-color, #3b82f6);
    }
    
    .footer {
      padding: 1rem 1.5rem;
      text-align: center;
      color: var(--tg-theme-hint-color, #9ca3af);
      font-size: 0.75rem;
      border-top: 1px solid var(--tg-theme-hint-color, #e5e7eb);
    }
  </style>
</head>
<body>
  <div class="app-container">
    <header class="header">
      <h1 class="header-title">Dynamic Capital</h1>
      <p class="header-subtitle">VIP Trading Platform</p>
    </header>
    
    <main class="main-content">
      <div class="card">
        <h2 class="card-title">Create Deposit</h2>
        <p class="card-description">Enter the amount you would like to deposit to your VIP trading account</p>
        
        <form id="deposit">
          <div class="form-group">
            <label class="label" for="amount">Amount (USD)</label>
            <input 
              id="amount" 
              name="amount" 
              type="number" 
              min="1" 
              step="0.01" 
              required 
              class="input" 
              placeholder="Enter deposit amount" 
            />
            <div class="amount-suggestions">
              <span class="suggestion-chip" data-amount="100">$100</span>
              <span class="suggestion-chip" data-amount="500">$500</span>
              <span class="suggestion-chip" data-amount="1000">$1,000</span>
              <span class="suggestion-chip" data-amount="5000">$5,000</span>
            </div>
          </div>
          
          <button type="submit" class="button" id="submitBtn">
            Create Deposit
          </button>
          
          <div id="status" class="status"></div>
        </form>
      </div>
    </main>
    
    <footer class="footer">
      Powered by Dynamic Capital
    </footer>
  </div>
  
  <script>
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.enableClosingConfirmation();
    }
    
    const initData = tg?.initData || '';
    console.log('Dynamic Capital Mini App loaded, initData:', initData);
    
    const form = document.getElementById('deposit');
    const status = document.getElementById('status');
    const submitBtn = document.getElementById('submitBtn');
    const amountInput = document.getElementById('amount');
    const suggestions = document.querySelectorAll('.suggestion-chip');
    
    // Handle amount suggestions
    suggestions.forEach(chip => {
      chip.addEventListener('click', () => {
        const amount = chip.getAttribute('data-amount');
        amountInput.value = amount;
        amountInput.focus();
      });
    });
    
    function showStatus(message, type = 'processing') {
      status.innerHTML = type === 'processing' 
        ? '<span class="spinner"></span>' + message
        : message;
      status.className = 'status ' + type;
      status.style.display = 'block';
    }
    
    function hideStatus() {
      status.style.display = 'none';
    }
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = Number(amountInput.value);
      
      if (!amount || amount <= 0) {
        showStatus('Please enter a valid amount', 'error');
        return;
      }
      
      if (amount < 10) {
        showStatus('Minimum deposit amount is $10', 'error');
        return;
      }
      
      submitBtn.disabled = true;
      showStatus('Processing your deposit request...', 'processing');
      
      try {
        const res = await fetch(\`\${window.location.origin}/miniapp-deposit\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData, amount }),
        });
        
        const data = await res.json();
        
        if (res.ok && data.ok) {
          showStatus('✅ Deposit created successfully! Redirecting...', 'success');
          if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('success');
          }
          setTimeout(() => {
            if (tg) tg.close();
          }, 2500);
        } else {
          showStatus('❌ ' + (data.error || 'Failed to create deposit'), 'error');
          if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.notificationOccurred('error');
          }
          submitBtn.disabled = false;
        }
      } catch (err) {
        console.error('Network error:', err);
        showStatus('❌ Network error. Please check your connection and try again.', 'error');
        if (tg && tg.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('error');
        }
        submitBtn.disabled = false;
      }
    });
    
    // Auto-hide error messages after 5 seconds
    const observer = new MutationObserver(() => {
      if (status.classList.contains('error') && status.style.display !== 'none') {
        setTimeout(() => {
          if (status.classList.contains('error')) {
            hideStatus();
            submitBtn.disabled = false;
          }
        }, 5000);
      }
    });
    
    observer.observe(status, { attributes: true, attributeFilter: ['class'] });
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

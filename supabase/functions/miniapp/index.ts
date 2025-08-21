import { extname } from "https://deno.land/std@0.224.0/path/extname.ts";

const securityHeaders = {
  "x-content-type-options": "nosniff",
};

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Supabase edge functions are mounted under `/functions/v1` in production.
  // Strip that prefix and any trailing slashes so routing works the same
  // locally (where the prefix is absent) and in production.
  let pathname = url.pathname.replace(/^\/functions\/v1/, "").replace(/\/+$/, "");
  if (pathname !== "" && !pathname.startsWith("/")) pathname = `/${pathname}`;

  console.log(`[miniapp] Request: ${req.method} ${pathname} - Full URL: ${req.url}`);

  // Version endpoint
  if (pathname === "/miniapp/version") {
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

  // Serve root HTML - treat the bare function path and `/miniapp` the same
  if (pathname === "" || pathname === "/miniapp") {
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
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            'tg-bg': 'var(--tg-theme-bg-color, #f8fafc)',
            'tg-text': 'var(--tg-theme-text-color, #1f2937)',
            'tg-hint': 'var(--tg-theme-hint-color, #64748b)',
            'tg-button': 'var(--tg-theme-button-color, #3b82f6)',
            'tg-button-text': 'var(--tg-theme-button-text-color, #ffffff)',
            'tg-secondary-bg': 'var(--tg-theme-secondary-bg-color, #ffffff)',
            'tg-header-bg': 'var(--tg-theme-header-bg-color, #ffffff)',
          }
        }
      }
    }
  </script>
  <style>
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
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
    .status { animation: slideIn 0.3s ease; }
  </style>
</head>
<body class="font-sans bg-gradient-to-br from-blue-500 via-purple-500 to-purple-700 text-tg-text min-h-screen p-0 m-0">
  <div class="min-h-screen flex flex-col bg-tg-bg">
    <header class="bg-tg-header-bg px-6 py-4 border-b border-tg-hint/20 shadow-sm">
      <h1 class="text-2xl font-bold text-tg-text text-center">Dynamic Capital</h1>
      <p class="text-sm text-tg-hint text-center mt-1">VIP Trading Platform</p>
    </header>
    
    <main class="flex-1 px-6 py-8 max-w-md mx-auto w-full">
      <div class="bg-tg-secondary-bg rounded-2xl shadow-lg p-8 border border-tg-hint/10">
        <h2 class="text-xl font-semibold mb-2 text-tg-text">Create Deposit</h2>
        <p class="text-tg-hint mb-8 leading-relaxed">Enter the amount you would like to deposit to your VIP trading account</p>
        
        <form id="deposit" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-tg-text mb-2" for="amount">Amount (USD)</label>
            <input 
              id="amount" 
              name="amount" 
              type="number" 
              min="1" 
              step="0.01" 
              required 
              class="w-full px-4 py-3 border-2 border-tg-hint/30 rounded-lg text-base bg-tg-bg text-tg-text transition-all duration-200 focus:outline-none focus:border-tg-button focus:ring-2 focus:ring-tg-button/10" 
              placeholder="Enter deposit amount" 
            />
            <div class="flex gap-2 mt-2 flex-wrap">
              <span class="px-4 py-2 bg-tg-hint/10 border border-tg-hint/20 rounded-full text-sm cursor-pointer transition-all duration-200 text-tg-text hover:bg-tg-button hover:text-white hover:border-tg-button suggestion-chip" data-amount="100">$100</span>
              <span class="px-4 py-2 bg-tg-hint/10 border border-tg-hint/20 rounded-full text-sm cursor-pointer transition-all duration-200 text-tg-text hover:bg-tg-button hover:text-white hover:border-tg-button suggestion-chip" data-amount="500">$500</span>
              <span class="px-4 py-2 bg-tg-hint/10 border border-tg-hint/20 rounded-full text-sm cursor-pointer transition-all duration-200 text-tg-text hover:bg-tg-button hover:text-white hover:border-tg-button suggestion-chip" data-amount="1000">$1,000</span>
              <span class="px-4 py-2 bg-tg-hint/10 border border-tg-hint/20 rounded-full text-sm cursor-pointer transition-all duration-200 text-tg-text hover:bg-tg-button hover:text-white hover:border-tg-button suggestion-chip" data-amount="5000">$5,000</span>
            </div>
          </div>
          
          <button type="submit" class="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 rounded-xl text-base font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg" id="submitBtn">
            Create Deposit
          </button>
          
          <div id="status" class="mt-4 p-4 rounded-lg text-sm font-medium text-center hidden"></div>
        </form>
      </div>
    </main>
    
    <footer class="px-6 py-4 text-center text-tg-hint text-xs border-t border-tg-hint/10">
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
      
      // Remove existing classes and add new ones
      status.className = 'mt-4 p-4 rounded-lg text-sm font-medium text-center block';
      
      if (type === 'success') {
        status.classList.add('bg-green-50', 'text-green-700', 'border', 'border-green-200');
      } else if (type === 'error') {
        status.classList.add('bg-red-50', 'text-red-700', 'border', 'border-red-200');
      } else if (type === 'processing') {
        status.classList.add('bg-blue-50', 'text-blue-700', 'border', 'border-blue-200');
      }
    }
    
    function hideStatus() {
      status.classList.add('hidden');
      status.classList.remove('block');
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
        const res = await fetch(\`\${window.location.origin}/functions/v1/miniapp-deposit\`, {
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
      if (status.classList.contains('text-red-700') && !status.classList.contains('hidden')) {
        setTimeout(() => {
          if (status.classList.contains('text-red-700')) {
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

    const headers = new Headers();
    headers.set("x-content-type-options", "nosniff");
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("cache-control", "no-cache, no-store, must-revalidate");
    
    if (req.method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }
    
    return new Response(htmlContent, { status: 200, headers });
  }

  // Static assets
  if (pathname.startsWith("/assets/")) {
    const rel = pathname.slice("/assets/".length);
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

  if (pathname.startsWith("/miniapp")) {
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

Deno.serve(handler);

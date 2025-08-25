import './style.css';

declare global {
  interface Window {
    Telegram: unknown;
  }
}

const tg = window.Telegram?.WebApp;
if (tg) tg.ready();
const initData = tg?.initData || '';

const app = document.getElementById('app');
if (app) {
  app.innerHTML = `
    <div class="card">
      <h1>Dynamic Capital VIP</h1>
      <p class="muted">Welcome to the Mini App. Use the form below to create a deposit.</p>
      
      <form id="deposit" class="deposit-form">
        <div class="input-group">
          <label for="amount">Deposit Amount</label>
          <input name="amount" id="amount" type="number" min="1" step="0.01" required placeholder="Enter amount" />
        </div>
        <button type="submit" class="btn">Create Deposit</button>
      </form>
      
      <div id="status" class="muted" style="margin-top: 1rem; text-align: center;">Ready to process deposit</div>
    </div>
    
    <div class="card">
      <h2>Info</h2>
      <div class="kv"><div>WebApp user</div><div><span id="userName" class="muted">—</span></div></div>
      <div class="kv"><div>Theme</div><div><span id="theme" class="muted">—</span></div></div>
      <div class="kv"><div>Mini App URL</div><div><code id="miniUrl">—</code></div></div>
    </div>
  `;
  const form = app.querySelector<HTMLFormElement>('#deposit')!;
  const status = app.querySelector<HTMLDivElement>('#status')!;
  const amountInput = form.elements.namedItem('amount') as HTMLInputElement;
  const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      status.textContent = 'Enter a valid amount';
      return;
    }
    submitBtn.disabled = true;
    status.textContent = 'Processing...';
    try {
      const res = await fetch(`${window.location.origin}/miniapp-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, amount }),
      });
      const data = await res.json();
      if (res.ok && data.intent_id) {
        status.textContent = `Deposit created! ID: ${data.intent_id}`;
        amountInput.value = '';
        setTimeout(() => tg?.close(), 3000);
      } else {
        status.textContent = data.error || 'Failed to create deposit';
        setTimeout(() => tg?.close(), 3000);
      }
    } catch (err) {
      status.textContent = 'Network error';
      setTimeout(() => tg?.close(), 3000);
    } finally {
      submitBtn.disabled = false;
    }
  });
  
  // Initialize Telegram WebApp info
  const updateTelegramInfo = () => {
    const userNameEl = document.getElementById('userName');
    const themeEl = document.getElementById('theme');
    const miniUrlEl = document.getElementById('miniUrl');
    
    if (userNameEl && tg?.initDataUnsafe?.user) {
      userNameEl.textContent = tg.initDataUnsafe.user.first_name || 'Unknown';
    }
    
    if (themeEl && tg?.colorScheme) {
      themeEl.textContent = tg.colorScheme;
    }
    
    if (miniUrlEl) {
      miniUrlEl.textContent = window.location.href;
    }
  };
  
  // Update info when app loads
  updateTelegramInfo();
  
  // Listen for theme changes
  if (tg?.onEvent) {
    tg.onEvent('themeChanged', updateTelegramInfo);
  }
}

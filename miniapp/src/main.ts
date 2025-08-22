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
    <form id="deposit" class="space-y-2">
      <label class="block">
        <span class="block mb-1">Amount</span>
        <input name="amount" type="number" min="1" required class="border p-2 w-full" />
      </label>
      <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded">Deposit</button>
      <div id="status" class="text-sm mt-2"></div>
    </form>
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
}

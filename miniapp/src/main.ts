import './style.css';

declare global {
  interface Window {
    Telegram: unknown;
  }
}

const tg = window.Telegram?.WebApp;
if (tg) tg.ready();

const app = document.getElementById('app');
if (app) {
  app.innerHTML = `
    <div class="card coming-soon">
      <h1>Dynamic Capital VIP</h1>
      <p class="muted">Our mini app is coming soon. Stay tuned!</p>
    </div>
  `;
}

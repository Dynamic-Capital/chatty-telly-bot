import React from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';
import App from './App';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
      };
    };
  }
}

const tg = window.Telegram?.WebApp;
if (tg) tg.ready();

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

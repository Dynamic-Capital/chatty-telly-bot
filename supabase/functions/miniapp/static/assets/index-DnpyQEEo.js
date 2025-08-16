// Dynamic Capital VIP Mini App
console.log('Dynamic Capital VIP Mini App Loaded');

// Initialize Telegram WebApp if available
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
  
  // Set theme colors
  window.Telegram.WebApp.setHeaderColor('#1e3a8a');
  window.Telegram.WebApp.setBackgroundColor('#1e40af');
}

// App functionality
document.addEventListener('DOMContentLoaded', function() {
  console.log('Mini app ready');
});
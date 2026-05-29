import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register Service Worker — only in production builds to avoid dev-server conflicts
if ('serviceWorker' in navigator) {
  // In dev (vite), the SW intercepts vite's HMR/icon requests causing 503 spam.
  // Only register on the deployed origin, not localhost.
  const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  if (!isDev) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .then(reg => console.log('[SW] Registered:', reg.scope))
        .catch(err => console.warn('[SW] Registration failed:', err));
    });
  } else {
    // In dev, unregister any lingering SW so it doesn't interfere
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    });
  }
}

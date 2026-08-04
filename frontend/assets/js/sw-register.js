// ========================================================
// SECTION 13: PWA SERVICE WORKER REGISTRATION & ERROR LOGGING
// ========================================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker Registered successfully:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
  });
}

// Automated Real-Time Error Logging (Section 13.1)
let _isLoggingError = false;
window.addEventListener('error', (event) => {
  if (_isLoggingError) return;
  const msg = event.message || '';
  if (msg.includes('Cannot reach the server') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) return;

  _isLoggingError = true;
  const errorData = {
    error_type: event.error ? event.error.name : 'Uncaught Exception',
    message: msg || 'JavaScript Execution Error',
    component: window.location.pathname,
    stack_trace: event.error ? event.error.stack : `${event.filename}:${event.lineno}:${event.colno}`
  };
  
  try {
    fetch('http://127.0.0.1:8000/system/error-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorData)
    }).catch(() => {}).finally(() => { _isLoggingError = false; });
  } catch (e) {
    _isLoggingError = false;
  }
});

// ===== API Base Config =====
const API_BASE = "http://127.0.0.1:8000";

/**
 * Generic fetch wrapper for all API calls.
 * - Attaches JWT token from localStorage automatically
 * - Handles 401 by clearing session and redirecting to login
 * - Handles 204 No Content (no body to parse)
 * - Throws readable errors from the API detail field
 */
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("access_token");

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  let response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal
    });
    clearTimeout(timeoutId);
  } catch (networkErr) {
    throw new Error("Cannot reach the server. Make sure the backend is running.");
  }

  // Token expired or invalid
  if (response.status === 401) {
    localStorage.clear();
    window.location.href = "index.html";
    return;
  }

  // 204 No Content — nothing to parse
  if (response.status === 204) {
    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.detail || `Request failed (${response.status})`;
    showToast(errorMsg, "danger", "Action Failed");
    throw new Error(errorMsg);
  }

  return data;
}

/**
 * Global Toast Notification Helper
 * Usage: showToast("Action completed!", "success", "Notification Title");
 */
function showToast(message, type = 'info', title = '', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'check-circle',
    danger: 'alert-triangle',
    error: 'x-circle',
    warning: 'alert-circle',
    info: 'info'
  };

  const titles = {
    success: 'Success',
    danger: 'Error',
    error: 'Error',
    warning: 'Warning',
    info: 'Information'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconName = icons[type] || 'info';
  const toastTitle = title || titles[type] || 'Notification';

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="toast-icon"></i>
    <div class="toast-body">
      <div class="toast-title">${toastTitle}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button class="toast-close" onclick="dismissToast(this.parentElement)">
      <i data-lucide="x" style="width:14px;height:14px;"></i>
    </button>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  const timer = setTimeout(() => {
    dismissToast(toast);
  }, duration);

  toast.dataset.timer = timer;
}

function dismissToast(toastEl) {
  if (!toastEl || toastEl.classList.contains('toast-hiding')) return;
  if (toastEl.dataset.timer) clearTimeout(parseInt(toastEl.dataset.timer));
  toastEl.classList.add('toast-hiding');
  setTimeout(() => {
    if (toastEl.parentElement) toastEl.parentElement.removeChild(toastEl);
  }, 250);
}

// Auto-check for flash session toast messages on page load
document.addEventListener('DOMContentLoaded', () => {
  const flashMsg = sessionStorage.getItem('flash_toast_msg');
  const flashType = sessionStorage.getItem('flash_toast_type') || 'info';
  const flashTitle = sessionStorage.getItem('flash_toast_title') || '';

  if (flashMsg) {
    sessionStorage.removeItem('flash_toast_msg');
    sessionStorage.removeItem('flash_toast_type');
    sessionStorage.removeItem('flash_toast_title');
    setTimeout(() => {
      showToast(flashMsg, flashType, flashTitle);
    }, 200);
  }
});

/**
 * Global Confirm Action Modal
 * Replaces default browser alert/confirm with custom sleek dark dialog
 */
function confirmAction({
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "primary",
  icon = "help-circle",
  onConfirm
}) {
  let overlay = document.getElementById('confirm-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'confirm-modal-overlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }

  // Enforce Action Blue styling across all confirmation dialogs
  const iconClass = "primary";
  const btnClass  = "btn-primary";

  overlay.innerHTML = `
    <div class="confirm-modal-box">
      <div class="confirm-icon-wrap ${iconClass}">
        <i data-lucide="${icon}" style="width:26px;height:26px;"></i>
      </div>
      <div class="confirm-title">${title}</div>
      <div class="confirm-msg">${message}</div>
      <div class="confirm-actions">
        <button class="btn btn-outline" id="confirm-btn-cancel">${cancelText}</button>
        <button class="btn ${btnClass}" id="confirm-btn-ok">${confirmText}</button>
      </div>
    </div>
  `;

  overlay.classList.add('active');
  if (window.lucide) window.lucide.createIcons();

  const close = () => overlay.classList.remove('active');

  document.getElementById('confirm-btn-cancel').onclick = close;
  document.getElementById('confirm-btn-ok').onclick = () => {
    close();
    if (typeof onConfirm === 'function') onConfirm();
  };
  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };
}

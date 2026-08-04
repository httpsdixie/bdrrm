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
    ...(options.headers || {}),
  };

  if (options.body !== undefined && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const isSilent = options.silent || ["/auth/login", "/auth/forgot-password", "/auth/verify-recovery-otp", "/auth/reset-password", "/system/", "/map/puroks", "/manual-fallback/", "/support/"].some(path => endpoint.includes(path));

  let response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal
    });
    clearTimeout(timeoutId);
  } catch (networkErr) {
    if (!isSilent) {
      showToast("Cannot reach the server. Make sure the backend is running.", "danger", "Action Failed");
    }
    throw new Error("Cannot reach the server. Make sure the backend is running.");
  }

  // Token expired or invalid (except for login request itself)
  if (response.status === 401 && !endpoint.includes("/auth/login")) {
    localStorage.clear();
    window.location.href = "index.html";
    throw new Error("Session expired.");
  }

  // 204 No Content — nothing to parse
  if (response.status === 204) {
    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.detail || `Request failed (${response.status})`;
    if (!isSilent) {
      showToast(errorMsg, "danger", "Action Failed");
    }
    throw new Error(errorMsg);
  }

  return data;
}

/**
 * Standardized API Shorthand Service Object
 */
const API = {
  get: (endpoint, options = {}) => apiFetch(endpoint, { method: "GET", ...options }),
  post: (endpoint, body, options = {}) => apiFetch(endpoint, { method: "POST", body: JSON.stringify(body), ...options }),
  put: (endpoint, body, options = {}) => apiFetch(endpoint, { method: "PUT", body: JSON.stringify(body), ...options }),
  delete: (endpoint, options = {}) => apiFetch(endpoint, { method: "DELETE", ...options })
};

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
  } else {
    // Keep only 1 active notification at a time to prevent overlapping toast stacks
    container.innerHTML = '';
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

// Remove all placeholder attributes at runtime to enforce no static example text
// (This covers inputs, textareas, and selects rendered in the DOM)
document.addEventListener('DOMContentLoaded', () => {
  try {
    document.querySelectorAll('[placeholder]').forEach(el => el.removeAttribute('placeholder'));
  } catch (e) {
    console.warn('Placeholder cleanup failed:', e);
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

/**
 * System-Wide Form Draft Persistence (15-minute expiration)
 * Automatically caches input progress in local storage and provides manual Save Draft capabilities.
 */
function initFormDraftPersistence(formId, draftKey) {
  const form = typeof formId === 'string' ? document.getElementById(formId) : formId;
  if (!form) return;

  const storageKey = `form_draft_${draftKey}`;

  // Load existing draft if present and not expired (15 mins = 900,000 ms)
  const savedData = localStorage.getItem(storageKey);
  if (savedData) {
    try {
      const { timestamp, fields } = JSON.parse(savedData);
      const isExpired = (Date.now() - timestamp) > 15 * 60 * 1000;
      if (!isExpired && fields) {
        Object.keys(fields).forEach(name => {
          const input = form.querySelector(`[name="${name}"], #${name}`);
          if (input) {
            if (input.type === 'checkbox' || input.type === 'radio') {
              input.checked = fields[name];
            } else {
              input.value = fields[name];
            }
          }
        });
        showToast("Restored unsaved form draft (cached for 15 mins).", "info", "Draft Restored");
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (e) {
      localStorage.removeItem(storageKey);
    }
  }

  // Auto-save input changes to draft cache
  const saveDraftData = () => {
    const formData = new FormData(form);
    const fields = {};
    formData.forEach((val, key) => { fields[key] = val; });
    localStorage.setItem(storageKey, JSON.stringify({
      timestamp: Date.now(),
      fields
    }));
  };

  form.addEventListener('input', saveDraftData);
  form.addEventListener('change', saveDraftData);

  // Manual Save Draft Button click handler
  const saveDraftBtn = form.querySelector('.btn-save-draft') || document.getElementById(`save-draft-${draftKey}`);
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', (e) => {
      e.preventDefault();
      saveDraftData();
      showToast("Form progress saved as draft (valid for 15 mins).", "success", "Draft Saved");
    });
  }

  // Clear draft on successful submit
  form.addEventListener('submit', () => {
    localStorage.removeItem(storageKey);
  });
}

function clearFormDraft(draftKey) {
  localStorage.removeItem(`form_draft_${draftKey}`);
}

/**
 * System-Wide Form Input Validation
 * Validates mandatory inputs and numeric fields, highlighting errors in red and showing a alert notification.
 */
function validateFormInputs(formElement) {
  if (!formElement) return true;
  let isValid = true;
  let firstInvalidInput = null;

  const inputs = formElement.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    // Clear previous error states
    input.classList.remove('input-error');
    const existingHint = input.parentElement.querySelector('.input-error-hint');
    if (existingHint) existingHint.remove();

    let inputValid = true;
    let errorMsg = '';

    // Check required fields
    if (input.hasAttribute('required') && !input.value.trim()) {
      inputValid = false;
      errorMsg = 'This field is mandatory.';
    }

    // Check numeric-only constraints
    if (inputValid && (input.dataset.type === 'numeric' || input.type === 'number')) {
      if (input.value && isNaN(Number(input.value))) {
        inputValid = false;
        errorMsg = 'Numeric input required.';
      }
    }

    if (!inputValid) {
      isValid = false;
      input.classList.add('input-error');
      
      const hint = document.createElement('span');
      hint.className = 'input-error-hint';
      hint.style.color = '#ef4444';
      hint.style.fontSize = '0.75rem';
      hint.style.marginTop = '4px';
      hint.style.display = 'block';
      hint.style.fontWeight = '600';
      hint.innerText = errorMsg;
      input.parentElement.appendChild(hint);

      if (!firstInvalidInput) firstInvalidInput = input;
    }
  });

  if (!isValid) {
    showToast("Please fix highlighted errors before submitting.", "danger", "Validation Error");
    if (firstInvalidInput) firstInvalidInput.focus();
  }

  return isValid;
}

/**
 * Standardized Name Formatter: First Name, Middle Name, Last Name, Suffix
 */
function formatFullName(firstName, middleName = '', lastName = '', suffix = '') {
  const parts = [firstName, middleName, lastName, suffix].map(p => (p || '').trim()).filter(Boolean);
  return parts.join(' ');
}

/**
 * Standardized Audit Timestamp Formatter: MM-DD-YYYY HH:MM:SS
 */
function formatAuditTimestamp(dateInput) {
  if (!dateInput) return 'N/A';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${mm}-${dd}-${yyyy} ${hh}:${min}:${ss}`;
}


/**
 * System-Wide Automatic Form Input Capitalization Enforcement
 * Capitalizes word inputs (First Name, Last Name, Titles, Addresses, Remarks)
 */
document.addEventListener('blur', function (e) {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
    if (e.target.type === 'text' || e.target.tagName === 'TEXTAREA') {
      if (e.target.value && !e.target.classList.contains('no-capitalize') && e.target.type !== 'password' && e.target.type !== 'email') {
        e.target.value = e.target.value.replace(/\b\w/g, char => char.toUpperCase());
      }
    }
  }
}, true);

/**
 * Auto-format Philippine Phone Numbers to +63-917-555-0123
 */
window.formatPHPhoneNumber = function(value) {
  if (!value) return '';
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('63')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  digits = digits.slice(0, 10);
  if (digits.length === 0) return '';

  let result = '+63-';
  if (digits.length <= 3) {
    result += digits;
  } else if (digits.length <= 6) {
    result += digits.slice(0, 3) + '-' + digits.slice(3);
  } else {
    result += digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
  }
  return result;
};

/**
 * System-Wide Real-Time Input Type Enforcement & Formatting (Alpha, Numeric, PH Phone)
 */
document.addEventListener('input', function (e) {
  if (!e.target || e.target.tagName !== 'INPUT') return;

  const target = e.target;
  const isAlpha = target.dataset.type === 'alpha' ||
                  target.id.includes('first') ||
                  target.id.includes('last') ||
                  target.id.includes('middle') ||
                  target.id.includes('suffix') ||
                  (target.placeholder && (target.placeholder.toLowerCase().includes('first name') || target.placeholder.toLowerCase().includes('last name')));

  const isPhone = target.dataset.type === 'ph-phone' ||
                  target.type === 'tel' ||
                  target.id.includes('contact') ||
                  target.id.includes('phone') ||
                  (target.placeholder && (target.placeholder.includes('0917') || target.placeholder.includes('+63')));

  const isNumeric = target.dataset.type === 'numeric' ||
                    target.type === 'number' ||
                    isPhone;

  if (isAlpha && target.type === 'text') {
    // Letters only (strips numbers live)
    target.value = target.value.replace(/[0-9]/g, '');
    return;
  }

  if (isPhone && target.type === 'text') {
    const hasLetters = /[a-zA-Z]/.test(target.value);
    if (!hasLetters && target.value.trim() !== '') {
      target.value = formatPHPhoneNumber(target.value);
    }
    return;
  }

  if (isNumeric && target.type === 'text') {
    // Numbers only (strips letters live)
    target.value = target.value.replace(/[^0-9\+\-\s\(\)]/g, '');
  }
}, true);

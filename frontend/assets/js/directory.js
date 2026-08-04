// ===== Emergency Directory Module =====

let allContacts = [];
let activeCat   = '';
let editingId   = null;

const CAT_LABEL = {
  disaster:  'Disaster',
  fire:      'Fire',
  police:    'Police',
  medical:   'Medical',
  emergency: 'Emergency',
  other:     'Other',
};

const CAT_ICON = {
  disaster:  'shield-alert',
  fire:      'flame',
  police:    'shield',
  medical:   'heart-pulse',
  emergency: 'siren',
  other:     'phone-call',
};

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- Load ----
function showDirectorySkeletons() {
  const grid = document.getElementById('dir-grid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="dir-card cat-disaster">
      <div class="skeleton-card">
        <div style="display:flex;gap:0.85rem;align-items:center;">
          <div class="skeleton skeleton-circle" style="width:44px;height:44px;border-radius:12px;"></div>
          <div style="flex:1;">
            <div class="skeleton skeleton-title" style="width:70%;margin-bottom:6px;"></div>
            <div class="skeleton skeleton-text" style="width:40%;"></div>
          </div>
        </div>
        <div class="skeleton skeleton-text" style="width:80%;margin-top:0.5rem;"></div>
        <div class="skeleton skeleton-text" style="width:50%;"></div>
      </div>
    </div>
    <div class="dir-card cat-fire">
      <div class="skeleton-card">
        <div style="display:flex;gap:0.85rem;align-items:center;">
          <div class="skeleton skeleton-circle" style="width:44px;height:44px;border-radius:12px;"></div>
          <div style="flex:1;">
            <div class="skeleton skeleton-title" style="width:65%;margin-bottom:6px;"></div>
            <div class="skeleton skeleton-text" style="width:45%;"></div>
          </div>
        </div>
        <div class="skeleton skeleton-text" style="width:75%;margin-top:0.5rem;"></div>
        <div class="skeleton skeleton-text" style="width:55%;"></div>
      </div>
    </div>
    <div class="dir-card cat-police">
      <div class="skeleton-card">
        <div style="display:flex;gap:0.85rem;align-items:center;">
          <div class="skeleton skeleton-circle" style="width:44px;height:44px;border-radius:12px;"></div>
          <div style="flex:1;">
            <div class="skeleton skeleton-title" style="width:75%;margin-bottom:6px;"></div>
            <div class="skeleton skeleton-text" style="width:50%;"></div>
          </div>
        </div>
        <div class="skeleton skeleton-text" style="width:85%;margin-top:0.5rem;"></div>
        <div class="skeleton skeleton-text" style="width:40%;"></div>
      </div>
    </div>`;
}

let dirPagination = { currentPage: 1, pageSize: 6, filtered: [] };

// ---- Load ----
async function loadDirectory(btnEl) {
  const btn = btnEl || document.getElementById('refresh-btn');
  if (btn) btn.classList.add('spinning');
  showDirectorySkeletons();
  try {
    allContacts = await apiFetch('/directory/');
    dirPagination.filtered = [...allContacts];
    dirPagination.currentPage = 1;
    renderDirectoryPaginated();
  } catch (err) {
    console.warn('Failed to load directory:', err);
    allContacts = [];
    dirPagination.filtered = [];
    dirPagination.currentPage = 1;
    renderDirectoryPaginated();
  } finally {
    if (btn) btn.classList.remove('spinning');
  }
}

function renderDirectoryPaginated() {
  const total = dirPagination.filtered.length;
  const pageSize = dirPagination.pageSize;
  const totalPages = Math.ceil(total / pageSize) || 1;
  if (dirPagination.currentPage > totalPages) dirPagination.currentPage = totalPages;
  if (dirPagination.currentPage < 1) dirPagination.currentPage = 1;

  const start = (dirPagination.currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageData = dirPagination.filtered.slice(start, end);

  renderDirectory(pageData);
  updateDirPaginationBar(total, total === 0 ? 0 : start + 1, end, dirPagination.currentPage, totalPages);
}

function updateDirPaginationBar(total, startDisplay, endDisplay, currentPage, totalPages) {
  const info = document.getElementById('dir-pagination-info');
  if (info) {
    if (total === 0) {
      info.textContent = 'Showing 0 of 0 contacts';
    } else {
      info.textContent = `Showing ${startDisplay} to ${endDisplay} of ${total} contacts`;
    }
  }

  const prevBtn = document.getElementById('dir-btn-prev');
  const nextBtn = document.getElementById('dir-btn-next');
  if (prevBtn) prevBtn.disabled = (currentPage <= 1);
  if (nextBtn) nextBtn.disabled = (currentPage >= totalPages);

  const container = document.getElementById('dir-page-numbers');
  if (container) {
    let pagesHtml = '';
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
        if (p === 2 && currentPage > 4) pagesHtml += `<span style="padding:0 .2rem;color:var(--text-muted);">...</span>`;
        else if (p === totalPages - 1 && currentPage < totalPages - 3) pagesHtml += `<span style="padding:0 .2rem;color:var(--text-muted);">...</span>`;
        continue;
      }
      pagesHtml += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToDirPage(${p})">${p}</button>`;
    }
    container.innerHTML = pagesHtml;
  }

  const pagEl = document.getElementById('dir-pagination');
  if (pagEl) {
    pagEl.style.display = total === 0 ? 'none' : 'flex';
  }
}

function changeDirPageSize(val) {
  dirPagination.pageSize = parseInt(val, 10);
  dirPagination.currentPage = 1;
  renderDirectoryPaginated();
}

function prevDirPage() {
  if (dirPagination.currentPage > 1) {
    dirPagination.currentPage--;
    renderDirectoryPaginated();
  }
}

function nextDirPage() {
  const totalPages = Math.ceil(dirPagination.filtered.length / dirPagination.pageSize) || 1;
  if (dirPagination.currentPage < totalPages) {
    dirPagination.currentPage++;
    renderDirectoryPaginated();
  }
}

function goToDirPage(p) {
  dirPagination.currentPage = p;
  renderDirectoryPaginated();
}

// ---- Render ----
function renderDirectory(data) {
  const grid = document.getElementById('dir-grid');
  const user = getUser();
  const canEdit = user && ['admin','officer'].includes(user.role);

  if (!data.length) {
    grid.innerHTML = `<div class="dir-empty">No contacts found.</div>`;
    lucide.createIcons();
    return;
  }

  grid.innerHTML = data.map(c => {
    const catClass = `cat-${c.category || 'other'}`;
    const icon     = CAT_ICON[c.category] || 'phone-call';
    const label    = CAT_LABEL[c.category] || c.category;

    return `
    <div class="dir-card ${catClass}">
      <div class="dir-card-top">
        <div class="dir-icon">
          <i data-lucide="${icon}"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div class="dir-name">${escHtml(c.name)}</div>
          <div class="dir-agency">${escHtml(c.agency)}</div>
          <div class="dir-badge">
            <i data-lucide="${icon}" style="width:9px;height:9px;"></i>
            ${label}
          </div>
        </div>
        ${canEdit ? `
        <div style="display:flex;gap:.3rem;flex-shrink:0;">
          <button class="action-btn" title="Edit" onclick='openEditModal(${JSON.stringify(c).replace(/"/g,"&quot;")})'>
            <i data-lucide="pencil"></i>
          </button>
          <button class="action-btn action-btn-danger" title="Delete" onclick="deleteContact('${c.id}')">
            <i data-lucide="trash-2"></i>
          </button>
        </div>` : ''}
      </div>

      <div class="dir-card-numbers">
        <div class="dir-number-row">
          <i data-lucide="phone"></i>
          <span class="dir-number">${escHtml(c.hotline)}</span>
        </div>
        ${c.secondary_number ? `
        <div class="dir-number-row">
          <i data-lucide="phone-forwarded"></i>
          <span class="dir-number-secondary">${escHtml(c.secondary_number)}</span>
        </div>` : ''}
        ${c.email ? `
        <div class="dir-number-row">
          <i data-lucide="mail"></i>
          <span class="dir-number-secondary">${escHtml(c.email)}</span>
        </div>` : ''}
      </div>

      <div class="dir-card-footer">
        <div class="dir-address">
          <i data-lucide="map-pin"></i>
          <span>${c.address ? escHtml(c.address) : '—'}</span>
        </div>
        ${c.available_24h ? `
        <span class="dir-24h">
          <i data-lucide="clock" style="width:10px;height:10px;"></i> 24/7
        </span>` : ''}
      </div>

      <div class="dir-card-actions">
        <a href="tel:${escHtml(c.hotline.replace(/[^0-9+]/g,''))}" class="dir-call-btn">
          <i data-lucide="phone-call"></i> Call
        </a>
        ${c.secondary_number ? `
        <a href="tel:${escHtml(c.secondary_number.replace(/[^0-9+]/g,''))}" class="dir-call-btn" style="flex:.6;">
          <i data-lucide="phone"></i> Alt
        </a>` : ''}
      </div>
    </div>`;
  }).join('');

  lucide.createIcons();
}

// ---- Filter ----
function setCatFilter(cat, btn) {
  activeCat = cat;
  document.querySelectorAll('.tab-bar .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterDirectory();
}

function filterDirectory() {
  const search = (document.getElementById('dir-search')?.value || '').toLowerCase();
  dirPagination.filtered = allContacts.filter(c =>
    (!activeCat || c.category === activeCat) &&
    (!search ||
      c.name.toLowerCase().includes(search) ||
      c.agency.toLowerCase().includes(search) ||
      c.hotline.toLowerCase().includes(search) ||
      (c.address||'').toLowerCase().includes(search))
  );
  dirPagination.currentPage = 1;
  renderDirectoryPaginated();
}

// ---- Add / Edit Modal (2-Step Wizard) ----
let currentContactWizardStep = 1;

function setContactWizardStep(step) {
  currentContactWizardStep = step;
  for (let i = 1; i <= 2; i++) {
    const pane = document.getElementById(`contact-pane-${i}`);
    const indicator = document.getElementById(`contact-wizard-indicator-${i}`);
    const line = document.getElementById(`contact-wizard-line-${i}`);

    if (pane) pane.classList.toggle('active', i === step);
    if (indicator) {
      indicator.classList.toggle('active', i === step);
      indicator.classList.toggle('completed', i < step);
    }
    if (line) {
      line.classList.toggle('active', i < step);
    }
  }

  const prevBtn   = document.getElementById('contact-btn-prev');
  const nextBtn   = document.getElementById('contact-btn-next');
  const submitBtn = document.getElementById('contact-submit-btn');

  if (prevBtn) prevBtn.style.visibility = step === 1 ? 'hidden' : 'visible';
  if (nextBtn) nextBtn.style.display = step === 2 ? 'none' : 'inline-flex';
  if (submitBtn) submitBtn.style.display = step === 2 ? 'inline-flex' : 'none';

  if (step === 2) {
    updateContactCardPreview();
  }

  lucide.createIcons();
}

function goToContactWizardStep(targetStep) {
  const errEl = document.getElementById('contact-error');
  if (errEl) errEl.style.display = 'none';

  if (targetStep < currentContactWizardStep) {
    setContactWizardStep(targetStep);
    return;
  }

  if (currentContactWizardStep === 1) {
    const nameEl    = document.getElementById('c-name');
    const agencyEl  = document.getElementById('c-agency');
    const hotlineEl = document.getElementById('c-hotline');

    const name    = nameEl?.value.trim();
    const agency  = agencyEl?.value.trim();
    const hotline = hotlineEl?.value.trim();

    let isValid = true;
    let firstInvalid = null;

    if (!name) {
      if (nameEl) nameEl.classList.add('is-invalid');
      isValid = false;
      if (!firstInvalid) firstInvalid = nameEl;
    }
    if (!agency) {
      if (agencyEl) agencyEl.classList.add('is-invalid');
      isValid = false;
      if (!firstInvalid) firstInvalid = agencyEl;
    }
    if (!hotline) {
      if (hotlineEl) hotlineEl.classList.add('is-invalid');
      isValid = false;
      if (!firstInvalid) firstInvalid = hotlineEl;
    }

    if (!isValid) {
      showToast('Please fill out all required fields highlighted in red.', 'danger', 'Validation Required');
      if (firstInvalid) firstInvalid.focus();
      return;
    }
  }

  setContactWizardStep(targetStep);
}

function nextContactWizardStep() {
  if (currentContactWizardStep < 2) {
    goToContactWizardStep(currentContactWizardStep + 1);
  }
}

function prevContactWizardStep() {
  if (currentContactWizardStep > 1) {
    goToContactWizardStep(currentContactWizardStep - 1);
  }
}

function updateContactCardPreview() {
  const container = document.getElementById('contact-summary-content');
  if (!container) return;

  const name     = document.getElementById('c-name')?.value.trim() || 'Office / Contact Name';
  const agency   = document.getElementById('c-agency')?.value.trim() || 'Responding Agency';
  const category = document.getElementById('c-category')?.value || 'disaster';
  const hotline  = document.getElementById('c-hotline')?.value.trim() || 'Hotline Number';
  const secondary = document.getElementById('c-secondary')?.value.trim();
  const address  = document.getElementById('c-address')?.value.trim() || 'No street address provided';
  const email    = document.getElementById('c-email')?.value.trim();
  const is24h    = document.getElementById('c-24h')?.value === 'true';

  const catClass = `cat-${category}`;
  const icon     = CAT_ICON[category] || 'phone-call';
  const label    = CAT_LABEL[category] || category;

  container.innerHTML = `
    <div class="dir-card ${catClass}" style="box-shadow:none;">
      <div class="dir-card-top">
        <div class="dir-icon">
          <i data-lucide="${icon}"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div class="dir-name">${escHtml(name)}</div>
          <div class="dir-agency">${escHtml(agency)}</div>
          <div class="dir-badge">
            <i data-lucide="${icon}" style="width:9px;height:9px;"></i>
            ${label}
          </div>
        </div>
      </div>

      <div class="dir-card-numbers">
        <div class="dir-number-row">
          <i data-lucide="phone"></i>
          <span class="dir-number">${escHtml(hotline)}</span>
        </div>
        ${secondary ? `
        <div class="dir-number-row">
          <i data-lucide="phone-forwarded"></i>
          <span class="dir-number-secondary">${escHtml(secondary)}</span>
        </div>` : ''}
        ${email ? `
        <div class="dir-number-row">
          <i data-lucide="mail"></i>
          <span class="dir-number-secondary">${escHtml(email)}</span>
        </div>` : ''}
      </div>

      <div class="dir-card-footer">
        <div class="dir-address">
          <i data-lucide="map-pin"></i>
          <span>${escHtml(address)}</span>
        </div>
        ${is24h ? `
        <span class="dir-24h">
          <i data-lucide="clock" style="width:10px;height:10px;"></i> 24/7
        </span>` : ''}
      </div>
    </div>
  `;

  lucide.createIcons();
}

function openContactModal() {
  editingId = null;
  document.getElementById('contact-modal-title').innerHTML = '<i data-lucide="phone-call"></i> Add Emergency Contact (Step-by-Step Wizard)';
  document.getElementById('contact-submit-label').textContent = 'Save Contact';
  document.getElementById('contact-id').value = '';
  ['c-name','c-agency','c-hotline','c-secondary','c-address','c-email','c-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('c-category').value = 'disaster';
  document.getElementById('c-24h').value = 'true';
  document.getElementById('c-order').value = '0';
  document.getElementById('contact-error').style.display = 'none';

  setContactWizardStep(1);
  document.getElementById('contact-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function openEditModal(contact) {
  editingId = contact.id;
  document.getElementById('contact-modal-title').innerHTML = '<i data-lucide="pencil"></i> Edit Contact Details';
  document.getElementById('contact-submit-label').textContent = 'Save Changes';
  document.getElementById('contact-id').value          = contact.id;
  document.getElementById('c-name').value              = contact.name;
  document.getElementById('c-agency').value            = contact.agency;
  document.getElementById('c-category').value          = contact.category;
  document.getElementById('c-hotline').value           = contact.hotline;
  document.getElementById('c-secondary').value         = contact.secondary_number || '';
  document.getElementById('c-address').value           = contact.address || '';
  document.getElementById('c-email').value             = contact.email || '';
  document.getElementById('c-notes').value             = contact.notes || '';
  document.getElementById('c-24h').value               = contact.available_24h ? 'true' : 'false';
  document.getElementById('c-order').value             = contact.sort_order || 0;
  document.getElementById('contact-error').style.display = 'none';

  setContactWizardStep(1);
  document.getElementById('contact-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeContactModal() {
  document.getElementById('contact-modal-overlay').classList.remove('active');
  editingId = null;
  currentContactWizardStep = 1;
}

function closeContactModalOutside(e) {
  if (e.target === document.getElementById('contact-modal-overlay')) closeContactModal();
}

async function submitContact() {
  const errorEl = document.getElementById('contact-error');
  errorEl.style.display = 'none';

  const nameEl    = document.getElementById('c-name');
  const agencyEl  = document.getElementById('c-agency');
  const hotlineEl = document.getElementById('c-hotline');

  const name     = nameEl ? nameEl.value.trim() : '';
  const agency   = agencyEl ? agencyEl.value.trim() : '';
  const category = document.getElementById('c-category').value;
  const hotline  = hotlineEl ? hotlineEl.value.trim() : '';

  let isValid = true;
  let firstInvalid = null;

  if (!name) {
    if (nameEl) nameEl.classList.add('is-invalid');
    isValid = false;
    if (!firstInvalid) firstInvalid = nameEl;
  }
  if (!agency) {
    if (agencyEl) agencyEl.classList.add('is-invalid');
    isValid = false;
    if (!firstInvalid) firstInvalid = agencyEl;
  }
  if (!hotline) {
    if (hotlineEl) hotlineEl.classList.add('is-invalid');
    isValid = false;
    if (!firstInvalid) firstInvalid = hotlineEl;
  }

  if (!isValid) {
    showToast('Please fill out all required fields highlighted in red.', 'danger', 'Validation Required');
    setContactWizardStep(1);
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  const body = {
    name, agency, category, hotline,
    secondary_number: document.getElementById('c-secondary').value.trim() || null,
    address:          document.getElementById('c-address').value.trim()   || null,
    email:            document.getElementById('c-email').value.trim()     || null,
    notes:            document.getElementById('c-notes').value.trim()     || null,
    available_24h:    document.getElementById('c-24h').value === 'true',
    sort_order:       parseInt(document.getElementById('c-order').value) || 0,
  };

  try {
    if (editingId) {
      await apiFetch(`/directory/${editingId}`, { method:'PATCH', body: JSON.stringify(body) });
      showToast("Contact details updated!", "success", "Contact Saved");
    } else {
      await apiFetch('/directory/', { method:'POST', body: JSON.stringify(body) });
      showToast("New contact added to directory!", "success", "Contact Saved");
    }
    closeContactModal();
    await loadDirectory();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
}

async function deleteContact(id) {
  confirmAction({
    title: 'Delete Directory Contact',
    message: 'Are you sure you want to delete this emergency contact? This action cannot be undone.',
    confirmText: 'Delete Contact',
    cancelText: 'Cancel',
    type: 'danger',
    icon: 'trash-2',
    onConfirm: async () => {
      try {
        await apiFetch(`/directory/${id}`, { method: 'DELETE' });
        showToast("Directory contact removed successfully.", "info", "Contact Deleted");
        await loadDirectory();
      } catch (err) {
        showToast(err.message || 'Delete failed', 'danger', 'Error');
      }
    }
  });
}

// Global Listener to clear invalid highlight when user starts typing/selecting
document.addEventListener('input', function(e) {
  if (e.target && e.target.classList.contains('is-invalid')) {
    e.target.classList.remove('is-invalid');
  }
});
document.addEventListener('change', function(e) {
  if (e.target && e.target.classList.contains('is-invalid')) {
    e.target.classList.remove('is-invalid');
  }
});

// ===== Evacuation Center Module =====

let allCenters = [];
let filteredCenters = [];
let currentEvacPage = 1;
let evacPageSize = 6;
let editingId = null;
let occCapacity = 0;

// ---- Status helpers ----

const STATUS_BADGE = {
  available:     '<span class="badge badge-green"><i data-lucide="check-circle" style="width:11px;height:11px;margin-right:2px;"></i> Available</span>',
  near_capacity: '<span class="badge badge-yellow"><i data-lucide="alert-circle" style="width:11px;height:11px;margin-right:2px;"></i> Near Capacity</span>',
  full:          '<span class="badge badge-orange"><i data-lucide="shield-alert" style="width:11px;height:11px;margin-right:2px;"></i> Full</span>',
  closed:        '<span class="badge badge-red"><i data-lucide="x-circle" style="width:11px;height:11px;margin-right:2px;"></i> Closed</span>',
  maintenance:   '<span class="badge" style="background:rgba(148,163,184,0.15);color:#94a3b8;border:1px solid rgba(148,163,184,0.3);"><i data-lucide="wrench" style="width:11px;height:11px;margin-right:2px;"></i> Maintenance</span>',
};

const STATUS_BAR_GRADIENT = {
  available:     'linear-gradient(90deg, #10b981, #34d399)',
  near_capacity: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
  full:          'linear-gradient(90deg, #ef4444, #f87171)',
  closed:        'linear-gradient(90deg, #64748b, #94a3b8)',
  maintenance:   'linear-gradient(90deg, #64748b, #94a3b8)',
};

function capacityPercent(occupancy, capacity) {
  if (!capacity) return 0;
  return Math.min(100, Math.round((occupancy / capacity) * 100));
}

// Returns the display status — upgrades 'available' to 'near_capacity' when 80–99%
function effectiveStatus(c) {
  if (c.status === 'maintenance' || c.status === 'closed') return c.status;
  const pct = capacityPercent(c.current_occupancy, c.capacity);
  if (c.status === 'available' && pct >= 80 && pct < 100) return 'near_capacity';
  return c.status;
}

// Renders a resource availability chip
function resourceChip(icon, label, available) {
  const color   = available ? '#34d399' : '#64748b';
  const bg      = available ? 'rgba(16, 185, 129, 0.14)' : 'rgba(100, 116, 139, 0.08)';
  const border  = available ? 'rgba(16, 185, 129, 0.35)' : 'rgba(100, 116, 139, 0.18)';
  const opacity = available ? '1' : '0.5';
  return `<span style="display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .55rem;border-radius:99px;font-size:.68rem;font-weight:700;background:${bg};border:1px solid ${border};color:${color};opacity:${opacity};">
    <i data-lucide="${icon}" style="width:11px;height:11px;"></i> ${label}
  </span>`;
}

// ---- Load & Render ----

function showEvacuationSkeletons() {
  const sumIds = ['sum-total', 'sum-available', 'sum-full', 'sum-evacuees', 'sum-capacity'];
  sumIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="skeleton skeleton-stat-num"></span>';
  });

  const grid = document.getElementById('evac-grid');
  if (grid) {
    grid.innerHTML = `
      <div class="evac-card">
        <div class="skeleton-card">
          <div class="skeleton skeleton-title" style="width:65%;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-text" style="width:40%;margin-bottom:12px;"></div>
          <div class="skeleton skeleton-title" style="width:100%;height:16px;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-text" style="width:50%;"></div>
        </div>
      </div>
      <div class="evac-card">
        <div class="skeleton-card">
          <div class="skeleton skeleton-title" style="width:70%;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-text" style="width:45%;margin-bottom:12px;"></div>
          <div class="skeleton skeleton-title" style="width:100%;height:16px;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-text" style="width:55%;"></div>
        </div>
      </div>`;
  }
}

const FALLBACK_CENTERS = [
  {
    id: "evac-1",
    name: "Tambulilid Covered Court",
    address: "Sitio Tambulilid, Brgy Linao, Ormoc City",
    latitude: 11.0235, longitude: 124.5885,
    capacity: 350, current_occupancy: 45, status: "available",
    facilities: "Clean Water, Generator Power, Medical First Aid Kits, Sleeping Mats",
    contact_person: "Brgy Capt. Ramirez", contact_number: "0917-123-4567",
    has_water: true, has_electricity: true, has_first_aid: true, has_food: false, has_sanitation: true,
    status_remarks: "45 evacuees from Sitio 2 coastal. Water supply stable. Generator running."
  },
  {
    id: "evac-2",
    name: "Linao Elementary School Gymnasium",
    address: "Main Street, Brgy Linao, Ormoc City",
    latitude: 11.0145, longitude: 124.5905,
    capacity: 500, current_occupancy: 0, status: "available",
    facilities: "Restrooms, Emergency Community Kitchen, Triage Room",
    contact_person: "Principal V. Torres", contact_number: "0918-987-6543",
    has_water: true, has_electricity: false, has_first_aid: true, has_food: true, has_sanitation: true,
    status_remarks: null
  },
  {
    id: "evac-3",
    name: "Barangay Multi-Purpose Complex",
    address: "Barangay Center, Brgy Linao, Ormoc City",
    latitude: 11.0168, longitude: 124.5918,
    capacity: 150, current_occupancy: 150, status: "full",
    facilities: "Command Operations Desk, Solar Power System, Radio Communications",
    contact_person: "Kagawad B. Flores", contact_number: "0920-555-8899",
    has_water: true, has_electricity: true, has_first_aid: true, has_food: false, has_sanitation: false,
    status_remarks: "AT FULL CAPACITY. Divert all incoming evacuees to Tambulilid or Linao School."
  }
];

async function loadCenters(btnEl) {
  const btn = btnEl || document.getElementById('refresh-btn');
  if (btn) btn.classList.add('spinning');
  showEvacuationSkeletons();
  try {
    allCenters = await apiFetch('/evacuation-centers/');
    renderSummary(allCenters);
    currentEvacPage = 1;
    renderCards(allCenters);
  } catch (err) {
    console.warn('Backend unavailable, using fallback evacuation centers:', err);
    allCenters = [...FALLBACK_CENTERS];
    renderSummary(allCenters);
    currentEvacPage = 1;
    renderCards(allCenters);
  } finally {
    if (btn) btn.classList.remove('spinning');
  }
}

function renderSummary(data) {
  const activeList = data.filter(c => !c.is_archived && c.status !== 'archived');
  const archivedList = data.filter(c => c.is_archived || c.status === 'archived');

  document.getElementById('sum-total').textContent     = activeList.length;
  document.getElementById('sum-available').textContent = activeList.filter(c => c.status === 'available').length;
  document.getElementById('sum-full').textContent      = activeList.filter(c => c.status === 'full').length;
  document.getElementById('sum-evacuees').textContent  = activeList.reduce((a, c) => a + (c.current_occupancy || 0), 0);
  document.getElementById('sum-capacity').textContent  = activeList.reduce((a, c) => a + (c.capacity || 0), 0);

  const archBadge = document.getElementById('archived-evac-count');
  if (archBadge) archBadge.textContent = archivedList.length;
}

function renderCards(data) {
  filteredCenters = data || [];
  const grid = document.getElementById('evac-grid');
  const user = getUser();
  const canEdit = user && ['admin', 'officer'].includes(user.role);

  if (!filteredCenters.length) {
    grid.innerHTML = `<p class="evac-empty">No evacuation centers found.</p>`;
    const infoEl = document.getElementById('evac-pagination-info');
    if (infoEl) infoEl.textContent = 'Showing 0 of 0 centers';
    const numContainer = document.getElementById('evac-page-numbers');
    if (numContainer) numContainer.innerHTML = '';
    const prevBtn = document.getElementById('evac-btn-prev');
    const nextBtn = document.getElementById('evac-btn-next');
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    lucide.createIcons();
    return;
  }

  // Pagination bounds calculation
  const totalItems = filteredCenters.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / evacPageSize));
  if (currentEvacPage > totalPages) currentEvacPage = totalPages;
  if (currentEvacPage < 1) currentEvacPage = 1;

  const startIndex = (currentEvacPage - 1) * evacPageSize;
  const endIndex = Math.min(startIndex + evacPageSize, totalItems);
  const pageSlice = filteredCenters.slice(startIndex, endIndex);

  // Update pagination info & controls
  const infoEl = document.getElementById('evac-pagination-info');
  if (infoEl) infoEl.textContent = `Showing ${startIndex + 1}–${endIndex} of ${totalItems} centers`;

  const prevBtn = document.getElementById('evac-btn-prev');
  const nextBtn = document.getElementById('evac-btn-next');
  if (prevBtn) prevBtn.disabled = (currentEvacPage === 1);
  if (nextBtn) nextBtn.disabled = (currentEvacPage === totalPages);

  const numContainer = document.getElementById('evac-page-numbers');
  if (numContainer) {
    let pBtns = '';
    for (let p = 1; p <= totalPages; p++) {
      pBtns += `<button class="page-btn ${p === currentEvacPage ? 'active' : ''}" onclick="goToEvacPage(${p})">${p}</button>`;
    }
    numContainer.innerHTML = pBtns;
  }

  grid.innerHTML = pageSlice.map(c => {
    const pct       = capacityPercent(c.current_occupancy, c.capacity);
    const effStatus = effectiveStatus(c);
    const barGradient = STATUS_BAR_GRADIENT[effStatus] || STATUS_BAR_GRADIENT.available;

    return `
    <div class="evac-card">
      <div class="evac-card-header">
        <div>
          <div class="evac-card-name">${escHtml(c.name)}</div>
          <div class="evac-card-address">${c.address ? escHtml(c.address) : '—'}</div>
        </div>
        ${STATUS_BADGE[effStatus] || STATUS_BADGE[c.status] || c.status}
      </div>

      ${effStatus === 'near_capacity' ? `
      <div style="margin:0 1.25rem .5rem;padding:.45rem .75rem;background:rgba(249,168,37,.12);border:1px solid rgba(249,168,37,.35);border-radius:8px;font-size:.75rem;color:#fde047;display:flex;align-items:center;gap:.4rem;">
        <i data-lucide="triangle-alert" style="width:13px;height:13px;flex-shrink:0;color:#f59e0b;"></i>
        Near capacity — consider routing evacuees to another center.
      </div>` : ''}

      <div class="evac-cap-section">
        <div class="evac-cap-row">
          <span class="evac-cap-label">Occupancy Status</span>
          <span class="evac-cap-value">${c.current_occupancy} / ${c.capacity}</span>
        </div>
        <div class="cap-bar-track">
          <div class="cap-bar-fill" style="width:${pct}%; background:${barGradient};"></div>
        </div>
        <div class="evac-cap-pct">${pct}% occupied</div>
      </div>

      <div class="evac-card-meta">
        <div class="evac-meta-item">
          <i data-lucide="map-pin" style="width:13px;height:13px;"></i>
          ${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}
        </div>
        ${c.contact_person ? `
        <div class="evac-meta-item">
          <i data-lucide="phone" style="width:13px;height:13px;"></i>
          ${escHtml(c.contact_person)}${c.contact_number ? ' · ' + escHtml(c.contact_number) : ''}
        </div>` : ''}
        ${c.facilities ? `
        <div class="evac-meta-item">
          <i data-lucide="package" style="width:13px;height:13px;"></i>
          ${escHtml(c.facilities)}
        </div>` : ''}
        <!-- Resource availability indicators -->
        <div class="evac-resource-indicators">
          ${resourceChip('droplets',   'Water',       c.has_water)}
          ${resourceChip('zap',        'Electricity',  c.has_electricity)}
          ${resourceChip('cross',      'First Aid',    c.has_first_aid)}
          ${resourceChip('utensils',   'Food Packs',   c.has_food)}
          ${resourceChip('toilet',     'Sanitation',   c.has_sanitation)}
        </div>
        ${c.status_remarks ? `
        <div class="evac-meta-item" style="margin-top:.3rem;padding:.45rem .65rem;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.22);border-radius:8px;color:var(--text-main);font-size:.75rem;align-items:flex-start;">
          <i data-lucide="message-square" style="width:13px;height:13px;flex-shrink:0;margin-top:.1rem;color:#60a5fa;"></i>
          <span>${escHtml(c.status_remarks)}</span>
        </div>` : ''}
      </div>

      <div class="evac-card-actions">
        <button class="btn btn-primary evac-action-primary" onclick="openOccupancyModal('${c.id}', '${escHtml(c.name)}', ${c.current_occupancy}, ${c.capacity}, '${c.status}')">
          <i data-lucide="users" style="width:14px;height:14px;"></i> Update Occupancy
        </button>

        <div class="evac-card-actions-row" style="gap:.4rem;">
          <button class="btn btn-outline-sm" onclick="openTrackingModal('${c.id}', '${escHtml(c.name)}', 'during')" style="font-size:.72rem;padding:.3rem .55rem;gap:.3rem;">
            <i data-lucide="clipboard-list" style="width:13px;height:13px;"></i> Evacuee Manifest
          </button>
          <button class="btn btn-outline-sm" onclick="openTrackingModal('${c.id}', '${escHtml(c.name)}', 'history')" style="font-size:.72rem;padding:.3rem .55rem;gap:.3rem;">
            <i data-lucide="history" style="width:13px;height:13px;"></i> History &amp; Audit
          </button>
          ${canEdit ? `
          <div class="evac-action-icons">
            <button class="action-btn" title="Edit Center" onclick="openEditModal(${JSON.stringify(c).replace(/"/g, '&quot;')})">
              <i data-lucide="pencil"></i>
            </button>
            ${(c.status === 'archived' || c.is_archived) ? `
            <button class="action-btn action-btn-success" title="Unarchive / Restore Center" onclick="unarchiveCenter('${c.id}')">
              <i data-lucide="rotate-ccw"></i>
            </button>` : `
            <button class="action-btn action-btn-warning" title="Archive Center" onclick="archiveCenter('${c.id}')">
              <i data-lucide="archive"></i>
            </button>`}
          </div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  lucide.createIcons();
}

function prevEvacPage() {
  if (currentEvacPage > 1) {
    currentEvacPage--;
    renderCards(filteredCenters);
  }
}

function nextEvacPage() {
  const totalPages = Math.ceil(filteredCenters.length / evacPageSize);
  if (currentEvacPage < totalPages) {
    currentEvacPage++;
    renderCards(filteredCenters);
  }
}

function goToEvacPage(page) {
  currentEvacPage = page;
  renderCards(filteredCenters);
}

function changeEvacPageSize(size) {
  evacPageSize = parseInt(size) || 6;
  currentEvacPage = 1;
  renderCards(filteredCenters);
}

let evacViewMode = 'active';

function setEvacViewMode(mode) {
  evacViewMode = mode;
  const activeTab = document.getElementById('tab-evac-active');
  const archivedTab = document.getElementById('tab-evac-archived');
  const toggleBtn = document.getElementById('btn-toggle-archived');

  if (activeTab) activeTab.classList.toggle('active', mode === 'active');
  if (archivedTab) archivedTab.classList.toggle('active', mode === 'archived');

  if (toggleBtn) {
    if (mode === 'archived') {
      toggleBtn.classList.add('active');
      toggleBtn.innerHTML = `<i data-lucide="building-2"></i> View Active Centers`;
    } else {
      toggleBtn.classList.remove('active');
      toggleBtn.innerHTML = `<i data-lucide="archive"></i> Archived Vault`;
    }
  }

  const statusSel = document.getElementById('filter-status');
  if (statusSel) {
    statusSel.value = mode === 'archived' ? 'archived' : '';
  }

  filterCenters();
  lucide.createIcons();
}

function toggleArchivedView() {
  setEvacViewMode(evacViewMode === 'archived' ? 'active' : 'archived');
}

function filterCenters() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const status = document.getElementById('filter-status').value;

  const filtered = allCenters.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search)
      || (c.address || '').toLowerCase().includes(search);
    const isArchived = c.is_archived || c.status === 'archived';
    
    let matchStatus = true;
    if (!status) {
      matchStatus = !isArchived;
    } else if (status === 'archived') {
      matchStatus = isArchived;
    } else {
      matchStatus = (c.status === status) && !isArchived;
    }
    return matchSearch && matchStatus;
  });

  currentEvacPage = 1;
  renderCards(filtered);
}

// ---- Add / Edit Modal ----

function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').innerHTML = '<i data-lucide="house"></i> Add Evacuation Center';
  document.getElementById('modal-submit-label').textContent = 'Save Center';
  document.getElementById('center-form').reset();
  document.getElementById('center-id').value = '';
  document.getElementById('center-error').style.display = 'none';
  document.getElementById('occupancy-group').style.display = 'none';
  document.getElementById('modal-overlay').classList.add('active');
  lucide.createIcons();
}

function openEditModal(center) {
  editingId = center.id;
  document.getElementById('modal-title').innerHTML = '<i data-lucide="pencil"></i> Edit Evacuation Center';
  document.getElementById('modal-submit-label').textContent = 'Save Changes';
  document.getElementById('center-id').value     = center.id;
  document.getElementById('c-name').value         = center.name;
  document.getElementById('c-address').value      = center.address || '';
  document.getElementById('c-lat').value           = center.latitude;
  document.getElementById('c-lng').value           = center.longitude;
  document.getElementById('c-capacity').value      = center.capacity;
  document.getElementById('c-occupancy').value     = center.current_occupancy;
  document.getElementById('c-contact-person').value = center.contact_person || '';
  document.getElementById('c-contact-number').value = center.contact_number || '';
  document.getElementById('center-error').style.display = 'none';
  document.getElementById('occupancy-group').style.display = 'block';
  document.getElementById('modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.getElementById('center-form').reset();
  editingId = null;
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

async function submitCenter() {
  const errorEl = document.getElementById('center-error');
  errorEl.style.display = 'none';

  const name          = document.getElementById('c-name').value.trim();
  const address       = document.getElementById('c-address').value.trim();
  const lat           = parseFloat(document.getElementById('c-lat').value);
  const lng           = parseFloat(document.getElementById('c-lng').value);
  const capacity      = parseInt(document.getElementById('c-capacity').value);
  const occupancy     = parseInt(document.getElementById('c-occupancy').value) || 0;
  const contactPerson = document.getElementById('c-contact-person').value.trim();
  const contactNumber = document.getElementById('c-contact-number').value.trim();

  if (!name || isNaN(lat) || isNaN(lng) || isNaN(capacity) || capacity < 1) {
    showToast('Please fill in all required fields correctly.', 'danger', 'Validation Required');
    return;
  }

  // Auto-status logic based on occupancy %
  const pct = capacityPercent(occupancy, capacity);
  let autoStatus = 'available';
  if (pct >= 100) autoStatus = 'full';

  try {
    if (editingId) {
      await apiFetch(`/evacuation-centers/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name, address: address || null,
          latitude: lat, longitude: lng, capacity,
          current_occupancy: occupancy,
          status: autoStatus,
          contact_person: contactPerson || null,
          contact_number: contactNumber || null,
        }),
      });
      showToast("Evacuation center updated!", "success", "Changes Saved");
    } else {
      await apiFetch('/evacuation-centers/', {
        method: 'POST',
        body: JSON.stringify({
          name, address: address || null,
          latitude: lat, longitude: lng, capacity,
          contact_person: contactPerson || null,
          contact_number: contactNumber || null,
        }),
      });
      showToast("Evacuation center added successfully!", "success", "Center Created");
    }
    closeModal();
    await loadCenters();
  } catch (err) {
    showToast(err.message, 'danger', 'Save Failed');
  }
}

// ---- Archive ----

function archiveCenter(id) {
  confirmAction({
    title: "Archive Evacuation Center?",
    message: "Are you sure you want to archive this evacuation center record?",
    confirmText: "Archive Center",
    type: "primary",
    icon: "archive",
    onConfirm: async () => {
      try {
        await apiFetch(`/evacuation-centers/${id}`, { method: 'DELETE' });
        showToast("Evacuation center archived", "info", "Center Archived");
        await loadCenters();
      } catch (err) {
        const target = allCenters.find(c => c.id === id);
        if (target) {
          target.is_archived = true;
          target.status = 'archived';
          showToast("Evacuation center archived", "info", "Center Archived");
          filterCenters();
        } else {
          showToast('Archive failed: ' + err.message, "danger", "Error");
        }
      }
    }
  });
}

function unarchiveCenter(id) {
  confirmAction({
    title: "Unarchive Evacuation Center?",
    message: "Restore this evacuation center back to active status?",
    confirmText: "Restore Center",
    type: "info",
    icon: "rotate-ccw",
    onConfirm: async () => {
      try {
        await apiFetch(`/evacuation-centers/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ is_archived: false, status: 'available' })
        });
        showToast("Evacuation center restored to active status", "success", "Center Restored");
        await loadCenters();
      } catch (err) {
        const target = allCenters.find(c => c.id === id);
        if (target) {
          target.is_archived = false;
          target.status = 'available';
          showToast("Evacuation center restored to active status", "success", "Center Restored");
          filterCenters();
        }
      }
    }
  });
}

// ---- Occupancy Modal ----

function openOccupancyModal(id, name, occupancy, capacity, currentStatus) {
  occCapacity = capacity;
  document.getElementById('occ-center-id').value   = id;
  document.getElementById('occ-center-name').textContent = name;
  document.getElementById('occ-value').value        = occupancy;
  document.getElementById('occ-status').value       = currentStatus;
  document.getElementById('occ-error').style.display = 'none';

  // Pre-fill remarks if center data has it
  const center = allCenters.find(c => c.id === id);
  const remarksEl = document.getElementById('occ-remarks');
  if (remarksEl) remarksEl.value = center?.status_remarks || '';

  // Pre-fill resource checkboxes
  if (center) {
    const setChk = (elId, val) => { const el = document.getElementById(elId); if (el) el.checked = !!val; };
    setChk('occ-has-water',       center.has_water);
    setChk('occ-has-electricity', center.has_electricity);
    setChk('occ-has-first-aid',   center.has_first_aid);
    setChk('occ-has-food',        center.has_food);
    setChk('occ-has-sanitation',  center.has_sanitation);
  }

  updateOccPreview();
  document.getElementById('occupancy-modal-overlay').classList.add('active');
  document.getElementById('occ-value').oninput = updateOccPreview;
  lucide.createIcons();
}

function updateOccPreview() {
  const val = parseInt(document.getElementById('occ-value').value) || 0;
  const pct = capacityPercent(val, occCapacity);
  document.getElementById('occ-preview-bar').style.width = pct + '%';
  document.getElementById('occ-preview-bar').style.background =
    pct >= 100 ? 'var(--danger)' : pct >= 80 ? '#f9a825' : 'var(--success)';
  document.getElementById('occ-preview-label').textContent = `${val} / ${occCapacity}`;

  // Auto-suggest status
  const statusEl = document.getElementById('occ-status');
  if (pct >= 100) statusEl.value = 'full';
  else if (pct >= 80) statusEl.value = 'available'; // near_capacity is a display state, not a DB state
  else if (statusEl.value === 'full') statusEl.value = 'available';
}

function closeOccupancyModal() {
  document.getElementById('occupancy-modal-overlay').classList.remove('active');
}

function closeOccupancyModalOutside(e) {
  if (e.target === document.getElementById('occupancy-modal-overlay')) closeOccupancyModal();
}

async function submitOccupancy() {
  const id        = document.getElementById('occ-center-id').value;
  const occupancy = parseInt(document.getElementById('occ-value').value);
  const occStatus = document.getElementById('occ-status').value;
  const remarks   = document.getElementById('occ-remarks')?.value.trim() || null;
  const errorEl   = document.getElementById('occ-error');

  if (isNaN(occupancy) || occupancy < 0) {
    showToast('Please enter a valid occupancy number.', 'danger', 'Invalid Occupancy');
    return;
  }

  const payload = { current_occupancy: occupancy, status: occStatus };
  if (remarks !== null) payload.status_remarks = remarks;

  // Resource availability checkboxes
  const chkIds = {
    has_water:       'occ-has-water',
    has_electricity: 'occ-has-electricity',
    has_first_aid:   'occ-has-first-aid',
    has_food:        'occ-has-food',
    has_sanitation:  'occ-has-sanitation',
  };
  Object.entries(chkIds).forEach(([field, elId]) => {
    const el = document.getElementById(elId);
    if (el) payload[field] = el.checked;
  });

  try {
    await apiFetch(`/evacuation-centers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    closeOccupancyModal();
    showToast("Occupancy level updated successfully!", "success", "Occupancy Saved");
    await loadCenters();
  } catch (err) {
    showToast(err.message, 'danger', 'Update Failed');
  }
}

// ---- Delete ----

function deleteCenter(id) {
  confirmAction({
    title: "Delete Evacuation Center?",
    message: "Are you sure you want to remove this evacuation center record? This action cannot be undone.",
    confirmText: "Delete Center",
    type: "primary",
    icon: "trash-2",
    onConfirm: async () => {
      try {
        await apiFetch(`/evacuation-centers/${id}`, { method: 'DELETE' });
        showToast("Evacuation center removed", "info", "Center Deleted");
        await loadCenters();
      } catch (err) {
        showToast('Delete failed: ' + err.message, "danger", "Error");
      }
    }
  });
}

// ---- Util ----

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =============================================
// Evacuation Tracking Modal
// =============================================

let currentTrackingCenterId = null;
let currentTrackingPhase    = 'during';

function switchTrackingPhase(phase) {
  currentTrackingPhase = phase;
  ['before','during','after','history'].forEach(p => {
    const pane = document.getElementById(`phase-pane-${p}`);
    const tab  = document.getElementById(`phase-tab-${p}`);
    if (pane) pane.style.display = p === phase ? 'block' : 'none';
    if (tab)  tab.classList.toggle('active', p === phase);
  });
  const labels = {
    before:  'Phase: Before (Pre-Disaster)',
    during:  'Phase: During (Active)',
    after:   'Phase: After (Post-Disaster)',
    history: 'Historical Utilization Log',
  };
  const lbl = document.getElementById('tracking-phase-label');
  if (lbl) lbl.textContent = labels[phase] || '';

  // Show/hide save button — history tab manages its own save
  const saveBtn = document.getElementById('tracking-save-btn');
  if (saveBtn) saveBtn.style.display = phase === 'history' ? 'none' : '';

  if (phase === 'history') {
    loadHistoryLog();
  } else if (currentTrackingCenterId) {
    resetTrackingForm();
    apiFetch(`/evacuation-tracking/${currentTrackingCenterId}?phase=${phase}`)
      .then(data => { if (data && data.center_id) populateTrackingForm(data); })
      .catch(() => {});
  }
}

async function openTrackingModal(centerId, centerName, initialPhase = 'during') {
  currentTrackingCenterId = centerId;
  currentTrackingPhase    = initialPhase;

  const dirView = document.getElementById('center-directory-view');
  const wsView  = document.getElementById('center-workspace-view');
  if (dirView) dirView.style.display = 'none';
  if (wsView)  wsView.style.display  = 'block';

  const nameEl = document.getElementById('tracking-modal-center-name');
  if (nameEl) nameEl.textContent = centerName;
  
  const errEl = document.getElementById('tracking-error');
  if (errEl) errEl.style.display = 'none';

  switchTrackingPhase(initialPhase);
  resetTrackingForm();
  renderEvacManifestTable();
  try {
    const data = await apiFetch(`/evacuation-tracking/${centerId}?phase=${initialPhase}`);
    if (data && data.center_id) populateTrackingForm(data);
  } catch (_) {}

  // Scroll to top of workspace cleanly
  window.scrollTo({ top: 0, behavior: 'smooth' });
  lucide.createIcons();
}

function closeTrackingModal() {
  const dirView = document.getElementById('center-directory-view');
  const wsView  = document.getElementById('center-workspace-view');
  if (wsView)  wsView.style.display  = 'none';
  if (dirView) dirView.style.display = 'block';
  currentTrackingCenterId = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeTrackingModalOutside(e) {
  if (e.target === document.getElementById('tracking-modal-overlay')) closeTrackingModal();
}

function resetTrackingForm() {
  // Pre-Disaster (Before) Defaults
  const preStaff = document.getElementById('pre-staff-deployed'); if (preStaff) preStaff.value = 6;
  const preLevel = document.getElementById('pre-readiness-level'); if (preLevel) preLevel.value = 'ready';
  const preChk   = document.getElementById('pre-capacity-check'); if (preChk) preChk.checked = true;
  const preInv   = document.getElementById('pre-inventory-notes'); if (preInv) preInv.value = '150 sleeping mats pre-positioned. 250 disaster food packs staged in bodega. 2 first aid kits refilled.';
  const prePos   = document.getElementById('pre-resource-position'); if (prePos) prePos.value = '1000L potable water tank filled. 5kW backup generator fueled and tested. First aid station established at West Wing.';
  const bMgr     = document.getElementById('before-camp-manager'); if (bMgr) bMgr.value = 'Officer Maria Santos';
  const bContact = document.getElementById('before-camp-manager-contact'); if (bContact) bContact.value = '0917-555-0192';
  const bOff     = document.getElementById('before-assigned-official'); if (bOff) bOff.value = 'Kagawad R. Palanca';

  // During Disaster Defaults
  const pwd = document.getElementById('demo-pwd'); if (pwd) pwd.value = 4;
  const preg = document.getElementById('demo-pregnant'); if (preg) preg.value = 2;
  const child = document.getElementById('demo-children'); if (child) child.value = 28;
  const youth = document.getElementById('demo-youth'); if (youth) youth.value = 18;
  const senior = document.getElementById('demo-senior'); if (senior) senior.value = 12;
  const ip = document.getElementById('demo-ip'); if (ip) ip.value = 0;

  const rFood = document.getElementById('relief-food'); if (rFood) rFood.value = 'adequate';
  const rWater = document.getElementById('relief-water'); if (rWater) rWater.value = 'adequate';
  const rCloth = document.getElementById('relief-clothing'); if (rCloth) rCloth.value = 'limited';

  const wSys = document.getElementById('water-system'); if (wSys) wSys.value = 'operational';
  const elec = document.getElementById('electricity'); if (elec) elec.value = 'operational';
  const sig = document.getElementById('internet-signal'); if (sig) sig.value = 'good';

  const mgr = document.getElementById('camp-manager'); if (mgr) mgr.value = 'Officer Maria Santos';
  const mgrC = document.getElementById('camp-manager-contact'); if (mgrC) mgrC.value = '0917-555-0192';
  const off = document.getElementById('assigned-official'); if (off) off.value = 'Kagawad R. Palanca';
  const rem = document.getElementById('occ-remarks'); if (rem) rem.value = 'Center operating at optimal capacity. Evacuee intake stabilized.';

  // Post-Disaster (After) Defaults
  const pServed = document.getElementById('post-total-served'); if (pServed) pServed.value = 185;
  const pCond = document.getElementById('post-center-condition'); if (pCond) pCond.value = 'good';
  const pDmg = document.getElementById('post-damage-notes'); if (pDmg) pDmg.value = 'Facility structurally sound. Minor water seepage near south entrance cleaned up.';
  const pUsed = document.getElementById('post-resources-used'); if (pUsed) pUsed.value = '140 Food Packs issued, 350L Drinking Water consumed, 3 First Aid kits utilized.';
  const pRep = document.getElementById('post-replenishment-needed'); if (pRep) pRep.value = 'Restock 150 Disaster Food Packs, order 10 replacement sleeping mats, refill generator fuel tank.';
}

function populateTrackingForm(d) {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== null && val !== undefined) el.value = val; };
  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
  // Demographics
  setVal('demo-pwd', d.demo_pwd); setVal('demo-pregnant', d.demo_pregnant);
  setVal('demo-children', d.demo_children); setVal('demo-youth', d.demo_youth);
  setVal('demo-senior', d.demo_senior); setVal('demo-ip', d.demo_ip);
  // Relief
  setVal('relief-food', d.relief_food); setVal('relief-food-remarks', d.relief_food_remarks);
  setVal('relief-water', d.relief_water); setVal('relief-water-remarks', d.relief_water_remarks);
  setVal('relief-clothing', d.relief_clothing); setVal('relief-clothing-remarks', d.relief_clothing_remarks);
  // Utilities
  setVal('water-system', d.water_system); setVal('electricity', d.electricity);
  setVal('internet-signal', d.internet_signal);
  // Management
  setVal('equipment-notes', d.equipment_notes); setVal('resources-needed', d.resources_needed);
  setVal('camp-manager', d.camp_manager); setVal('camp-manager-contact', d.camp_manager_contact);
  setVal('assigned-official', d.assigned_official); setVal('occ-remarks', d.status_remarks);
  // Before fields
  setVal('pre-staff-deployed', d.pre_staff_deployed); setVal('pre-readiness-level', d.pre_readiness_level);
  setChk('pre-capacity-check', d.pre_capacity_check);
  setVal('pre-inventory-notes', d.pre_inventory_notes); setVal('pre-resource-position', d.pre_resource_position);
  setVal('before-camp-manager', d.camp_manager); setVal('before-camp-manager-contact', d.camp_manager_contact);
  setVal('before-assigned-official', d.assigned_official);
  // After fields
  setVal('post-total-served', d.post_total_served); setVal('post-center-condition', d.post_center_condition);
  setVal('post-damage-notes', d.post_damage_notes); setVal('post-resources-used', d.post_resources_used);
  setVal('post-replenishment-needed', d.post_replenishment_needed);
  // Sector breakdown
  if (d.sector_breakdown && d.sector_breakdown.length) {
    const el = document.getElementById('sector-breakdown');
    if (el) el.value = d.sector_breakdown.map(s => `${s.sector}: ${s.count}`).join('\n');
  }
}

async function submitTracking() {
  if (!currentTrackingCenterId) return;

  const errorEl = document.getElementById('tracking-error');
  errorEl.style.display = 'none';

  const getInt = id => parseInt(document.getElementById(id)?.value) || 0;
  const getStr = id => document.getElementById(id)?.value?.trim() || null;
  const getSel = id => document.getElementById(id)?.value || 'unknown';

  // Parse sector breakdown text → array
  let sectorBreakdown = [];
  const sectorRaw = getStr('sector-breakdown');
  if (sectorRaw) {
    sectorBreakdown = sectorRaw.split('\n')
      .map(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const count = parseInt(parts[1].trim());
          if (!isNaN(count)) return { sector: parts[0].trim(), count };
        }
        return null;
      })
      .filter(Boolean);
  }

  const payload = {
    center_id:        currentTrackingCenterId,
    phase:            currentTrackingPhase,
    demo_pwd:         getInt('demo-pwd'),
    demo_pregnant:    getInt('demo-pregnant'),
    demo_children:    getInt('demo-children'),
    demo_youth:       getInt('demo-youth'),
    demo_senior:      getInt('demo-senior'),
    demo_ip:          getInt('demo-ip'),
    sector_breakdown: sectorBreakdown,
    relief_food:      getSel('relief-food'),
    relief_food_remarks:    getStr('relief-food-remarks'),
    relief_water:     getSel('relief-water'),
    relief_water_remarks:   getStr('relief-water-remarks'),
    relief_clothing:  getSel('relief-clothing'),
    relief_clothing_remarks: getStr('relief-clothing-remarks'),
    water_system:     getSel('water-system'),
    electricity:      getSel('electricity'),
    internet_signal:  getSel('internet-signal'),
    equipment_notes:  getStr('equipment-notes'),
    resources_needed: getStr('resources-needed'),
    camp_manager:     currentTrackingPhase === 'before' ? getStr('before-camp-manager')     : getStr('camp-manager'),
    camp_manager_contact: currentTrackingPhase === 'before' ? getStr('before-camp-manager-contact') : getStr('camp-manager-contact'),
    assigned_official: currentTrackingPhase === 'before' ? getStr('before-assigned-official') : getStr('assigned-official'),
    // Before-phase fields
    pre_capacity_check:    document.getElementById('pre-capacity-check')?.checked || false,
    pre_staff_deployed:    getInt('pre-staff-deployed'),
    pre_readiness_level:   getSel('pre-readiness-level'),
    pre_inventory_notes:   getStr('pre-inventory-notes'),
    pre_resource_position: getStr('pre-resource-position'),
    // After-phase fields
    post_total_served:          getInt('post-total-served'),
    post_center_condition:      getSel('post-center-condition'),
    post_damage_notes:          getStr('post-damage-notes'),
    post_resources_used:        getStr('post-resources-used'),
    post_replenishment_needed:  getStr('post-replenishment-needed'),
  };

  try {
    await apiFetch(`/evacuation-tracking/${currentTrackingCenterId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    closeTrackingModal();
    showToast('Evacuation tracking record saved.', 'success', 'Tracking Saved');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
}

// =============================================
// Family & Household Evacuee Manifest Registry
// =============================================

const SEED_EVAC_MANIFESTS = {
  "evac-1": [
    { id: "fam-101", headName: "Juan Dela Cruz", contact: "0917-111-2222", sitio: "Sitio 2 Coastal", room: "Stage Left", size: 5, pwd: 1, senior: 1, infant: 0, reliefClaimed: true, registeredAt: "2026-07-29T14:30:00Z" },
    { id: "fam-102", headName: "Maria Santos", contact: "0918-333-4444", sitio: "Sitio 1 Riverside", room: "Tent A-2", size: 4, pwd: 0, senior: 0, infant: 1, reliefClaimed: true, registeredAt: "2026-07-29T15:10:00Z" },
    { id: "fam-103", headName: "Ramon Reyes", contact: "0920-555-6666", sitio: "Sitio 2 Coastal", room: "Bleacher B", size: 6, pwd: 0, senior: 2, infant: 0, reliefClaimed: false, registeredAt: "2026-07-29T16:00:00Z" }
  ],
  "evac-2": [
    { id: "fam-201", headName: "Carlos Mendoza", contact: "0919-777-8888", sitio: "Main Street", room: "Gym Stage", size: 3, pwd: 0, senior: 1, infant: 0, reliefClaimed: false, registeredAt: "2026-07-29T12:00:00Z" }
  ],
  "evac-3": [
    { id: "fam-301", headName: "Elena Flores", contact: "0921-999-0000", sitio: "Purok 3", room: "Rm 101", size: 4, pwd: 1, senior: 0, infant: 0, reliefClaimed: true, registeredAt: "2026-07-29T10:15:00Z" },
    { id: "fam-302", headName: "Pedro Alcantara", contact: "0922-123-9876", sitio: "Purok 4", room: "Rm 102", size: 5, pwd: 0, senior: 1, infant: 0, reliefClaimed: false, registeredAt: "2026-07-29T11:45:00Z" }
  ]
};

function getEvacManifests() {
  try {
    const stored = localStorage.getItem('drrm_evac_manifests');
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  localStorage.setItem('drrm_evac_manifests', JSON.stringify(SEED_EVAC_MANIFESTS));
  return SEED_EVAC_MANIFESTS;
}

function saveEvacManifests(data) {
  localStorage.setItem('drrm_evac_manifests', JSON.stringify(data));
}

function renderEvacManifestTable() {
  if (!currentTrackingCenterId) return;
  const manifests = getEvacManifests();
  let centerList = manifests[currentTrackingCenterId];
  if (!centerList || !centerList.length) {
    centerList = [
      { id: `fam-${currentTrackingCenterId}-1`, headName: "Juan Dela Cruz", contact: "0917-111-2222", sitio: "Sitio 2 Coastal", room: "Stage Left", size: 5, pwd: 1, senior: 1, infant: 0, reliefClaimed: true, registeredAt: "2026-07-29T14:30:00Z" },
      { id: `fam-${currentTrackingCenterId}-2`, headName: "Maria Santos", contact: "0918-333-4444", sitio: "Sitio 1 Riverside", room: "Tent A-2", size: 4, pwd: 0, senior: 0, infant: 1, reliefClaimed: true, registeredAt: "2026-07-29T15:10:00Z" },
      { id: `fam-${currentTrackingCenterId}-3`, headName: "Ramon Reyes", contact: "0920-555-6666", sitio: "Sitio 2 Coastal", room: "Bleacher B", size: 6, pwd: 0, senior: 2, infant: 0, reliefClaimed: false, registeredAt: "2026-07-29T16:00:00Z" }
    ];
  }
  
  const search = (document.getElementById('fam-search-input')?.value || '').toLowerCase();
  const filtered = centerList.filter(f => 
    f.headName.toLowerCase().includes(search) || 
    f.sitio.toLowerCase().includes(search) || 
    (f.room && f.room.toLowerCase().includes(search))
  );

  // Update KPIs
  const totalFamilies = centerList.length;
  const totalIndividuals = centerList.reduce((acc, f) => acc + (parseInt(f.size) || 0), 0);
  const reliefClaimed = centerList.filter(f => f.reliefClaimed).length;
  const vulnerableCount = centerList.reduce((acc, f) => acc + (f.pwd ? 1 : 0) + (f.senior ? 1 : 0) + (f.infant ? 1 : 0), 0);

  const kpiFam = document.getElementById('manifest-kpi-families');
  const kpiInd = document.getElementById('manifest-kpi-individuals');
  const kpiRel = document.getElementById('manifest-kpi-relief-claimed');
  const kpiVul = document.getElementById('manifest-kpi-vulnerable');

  if (kpiFam) kpiFam.textContent = totalFamilies;
  if (kpiInd) kpiInd.textContent = totalIndividuals;
  if (kpiRel) kpiRel.textContent = `${reliefClaimed} / ${totalFamilies}`;
  if (kpiVul) kpiVul.textContent = vulnerableCount;

  const tbody = document.getElementById('fam-manifest-tbody');
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--text-muted);">No household records found in manifest.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(f => {
    const initials = f.headName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const vulnerBadges = [];
    if (f.pwd) vulnerBadges.push('<span class="badge" style="background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);font-size:.65rem;padding:.15rem .4rem;"><i data-lucide="accessibility" style="width:10px;height:10px;"></i> PWD</span>');
    if (f.senior) vulnerBadges.push('<span class="badge" style="background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3);font-size:.65rem;padding:.15rem .4rem;"><i data-lucide="heart" style="width:10px;height:10px;"></i> Senior</span>');
    if (f.infant) vulnerBadges.push('<span class="badge" style="background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);font-size:.65rem;padding:.15rem .4rem;"><i data-lucide="baby" style="width:10px;height:10px;"></i> Infant</span>');

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:.5rem;">
            <div style="width:28px;height:28px;border-radius:50%;background:rgba(59,130,246,0.2);color:var(--primary-light);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.7rem;flex-shrink:0;">
              ${initials}
            </div>
            <div>
              <div style="font-weight:700;color:var(--text-main);">${escHtml(f.headName)}</div>
              <div style="font-size:.68rem;color:var(--text-muted);">${f.contact ? escHtml(f.contact) : 'No phone'}</div>
            </div>
          </div>
        </td>
        <td>
          <div style="font-weight:600;color:var(--text-main);">${escHtml(f.sitio)}</div>
          <div style="font-size:.68rem;color:var(--text-muted);">${f.room ? escHtml(f.room) : 'General Area'}</div>
        </td>
        <td>
          <span style="font-weight:700;color:var(--primary-light);">${f.size} Members</span>
        </td>
        <td>
          <div style="display:flex;flex-wrap:wrap;gap:.25rem;">
            ${vulnerBadges.length ? vulnerBadges.join('') : '<span style="font-size:.7rem;color:var(--text-muted);">None</span>'}
          </div>
        </td>
        <td>
          <button class="relief-status-pill ${f.reliefClaimed ? 'claimed' : 'pending'}" onclick="toggleEvacFamilyRelief('${f.id}')">
            <i data-lucide="${f.reliefClaimed ? 'check-circle' : 'clock'}" style="width:12px;height:12px;"></i>
            ${f.reliefClaimed ? 'Issued' : 'Pending'}
          </button>
        </td>
        <td style="text-align:right;">
          <button class="action-btn action-btn-warning" title="Discharge / Evacuated Home" onclick="deleteEvacFamilyRecord('${f.id}')">
            <i data-lucide="user-minus" style="width:12px;height:12px;"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

function addEvacFamilyRecord() {
  if (!currentTrackingCenterId) return;

  const headName = document.getElementById('fam-head-name')?.value?.trim();
  const sitio    = document.getElementById('fam-sitio')?.value?.trim();
  const size     = parseInt(document.getElementById('fam-size')?.value) || 1;
  const room     = document.getElementById('fam-room')?.value?.trim() || 'General Area';
  const isPwd    = document.getElementById('fam-is-pwd')?.checked ? 1 : 0;
  const isSenior = document.getElementById('fam-is-senior')?.checked ? 1 : 0;
  const isInfant = document.getElementById('fam-is-infant')?.checked ? 1 : 0;
  const reliefClaimed = document.getElementById('fam-relief-claimed')?.checked || false;

  if (!headName || !sitio) {
    showToast('Please enter Head of Family Name and Sitio / Purok', 'warning');
    return;
  }

  const manifests = getEvacManifests();
  if (!manifests[currentTrackingCenterId]) manifests[currentTrackingCenterId] = [];

  const newRecord = {
    id: 'fam-' + Date.now(),
    headName,
    sitio,
    room,
    size,
    pwd: isPwd,
    senior: isSenior,
    infant: isInfant,
    reliefClaimed,
    registeredAt: new Date().toISOString()
  };

  manifests[currentTrackingCenterId].unshift(newRecord);
  saveEvacManifests(manifests);

  // Clear inputs
  document.getElementById('fam-head-name').value = '';
  document.getElementById('fam-sitio').value = '';
  document.getElementById('fam-room').value = '';
  document.getElementById('fam-size').value = 4;
  document.getElementById('fam-is-pwd').checked = false;
  document.getElementById('fam-is-senior').checked = false;
  document.getElementById('fam-is-infant').checked = false;

  renderEvacManifestTable();
  showToast(`Registered family of ${headName} in manifest!`, 'success');
}

function toggleEvacFamilyRelief(famId) {
  if (!currentTrackingCenterId) return;
  const manifests = getEvacManifests();
  const centerList = manifests[currentTrackingCenterId] || [];
  const target = centerList.find(f => f.id === famId);
  if (target) {
    target.reliefClaimed = !target.reliefClaimed;
    saveEvacManifests(manifests);
    renderEvacManifestTable();
    showToast(`Relief pack status updated for ${target.headName}`, 'info');
  }
}

function deleteEvacFamilyRecord(famId) {
  if (!currentTrackingCenterId) return;
  if (!confirm('Discharge this family unit from the evacuation manifest?')) return;
  const manifests = getEvacManifests();
  if (manifests[currentTrackingCenterId]) {
    manifests[currentTrackingCenterId] = manifests[currentTrackingCenterId].filter(f => f.id !== famId);
    saveEvacManifests(manifests);
    renderEvacManifestTable();
    showToast('Family record updated / discharged', 'info');
  }
}

// =============================================
// Evacuation History Log
// =============================================

const RELIABILITY_LABEL = { excellent:'Excellent', good:'Good', fair:'Fair', poor:'Poor' };
const RELIABILITY_COLOR = { excellent:'#2e7d32', good:'#1a73e8', fair:'#f9a825', poor:'#d93025' };
const HIST_TYPE_LABEL   = { typhoon:'Typhoon', flood:'Flood', earthquake:'Earthquake', other:'Other' };

async function loadHistoryLog() {
  const container = document.getElementById('history-log-list');
  if (!container || !currentTrackingCenterId) return;
  container.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--text-muted);font-size:.82rem;"><i data-lucide="loader" class="spin"></i> Loading...</div>`;
  lucide.createIcons();

  try {
    const data = await apiFetch(`/evacuation-tracking/${currentTrackingCenterId}/history`);
    renderHistoryLog(data);
  } catch (_) {
    container.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--text-muted);font-size:.82rem;">Could not load history.</div>`;
  }
}

function renderHistoryLog(entries) {
  const container = document.getElementById('history-log-list');
  if (!entries || !entries.length) {
    entries = [
      {
        id: 'hist-demo-1',
        event_name: 'Super Typhoon Odette (Category 5)',
        event_type: 'typhoon',
        event_date: '2021-12-16',
        peak_occupancy: 240,
        total_served: 410,
        duration_days: 4,
        reliability_rating: 'good',
        bottlenecks: 'Drinking water refill delay on Day 2 due to flooded access roads. High evacuee influx from coastal Sitio 3.',
        structural_notes: 'Roofing and steel truss structure remained fully intact. Zero structural damage.',
        lessons_learned: 'Pre-position 2 extra 1,000L water bladders prior to Signal #3 warnings.'
      },
      {
        id: 'hist-demo-2',
        event_name: 'Monsoon Flash Flood Inundation',
        event_type: 'flood',
        event_date: '2023-01-10',
        peak_occupancy: 155,
        total_served: 230,
        duration_days: 2,
        reliability_rating: 'excellent',
        bottlenecks: 'Minor intake queue during 02:00 AM emergency arrival.',
        structural_notes: 'Perimeter drainage cleared high water volume efficiently. Facility ground floor stayed dry.',
        lessons_learned: 'Pre-assigning camp management desk staff at front entrance reduced family registration time by 50%.'
      }
    ];
  }
  container.innerHTML = entries.map(e => {
    const rColor = RELIABILITY_COLOR[e.reliability_rating] || '#1a73e8';
    const rLabel = RELIABILITY_LABEL[e.reliability_rating] || e.reliability_rating;
    return `
    <div style="border:1px solid var(--border-color);border-radius:8px;padding:.85rem 1rem;margin-bottom:.65rem;background:var(--bg-card);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.5rem;">
        <div>
          <div style="font-size:.88rem;font-weight:700;color:var(--text-main);">${escHtml(e.event_name)}</div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:.1rem;">
            ${HIST_TYPE_LABEL[e.event_type]||e.event_type} · ${e.event_date} · ${e.duration_days} day${e.duration_days!==1?'s':''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;">
          <span style="font-size:.72rem;font-weight:700;color:${rColor};background:${rColor}18;border:1px solid ${rColor}33;padding:.15rem .5rem;border-radius:99px;">${rLabel}</span>
          <button class="action-btn action-btn-danger" title="Delete" onclick="deleteHistoryLog('${e.id}')" style="padding:.25rem;">
            <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
          </button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;margin-bottom:.5rem;">
        <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:.4rem .6rem;font-size:.75rem;">
          <div style="color:var(--text-muted);font-size:.65rem;text-transform:uppercase;font-weight:700;">Peak Occupancy</div>
          <div style="font-weight:700;color:var(--text-main);">${e.peak_occupancy}</div>
        </div>
        <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:.4rem .6rem;font-size:.75rem;">
          <div style="color:var(--text-muted);font-size:.65rem;text-transform:uppercase;font-weight:700;">Total Served</div>
          <div style="font-weight:700;color:var(--text-main);">${e.total_served}</div>
        </div>
        <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:.4rem .6rem;font-size:.75rem;">
          <div style="color:var(--text-muted);font-size:.65rem;text-transform:uppercase;font-weight:700;">Duration</div>
          <div style="font-weight:700;color:var(--text-main);">${e.duration_days}d</div>
        </div>
      </div>
      ${e.bottlenecks ? `<div style="font-size:.75rem;margin-bottom:.3rem;"><span style="color:var(--text-muted);font-weight:700;">Bottlenecks:</span> ${escHtml(e.bottlenecks)}</div>` : ''}
      ${e.structural_notes ? `<div style="font-size:.75rem;margin-bottom:.3rem;"><span style="color:var(--text-muted);font-weight:700;">Structure:</span> ${escHtml(e.structural_notes)}</div>` : ''}
      ${e.lessons_learned ? `<div style="font-size:.75rem;padding:.35rem .6rem;background:rgba(59,130,246,0.07);border-radius:6px;border:1px solid rgba(59,130,246,0.2);"><span style="color:#60a5fa;font-weight:700;">Lessons:</span> ${escHtml(e.lessons_learned)}</div>` : ''}
    </div>`;
  }).join('');
  lucide.createIcons();
}

async function submitHistoryLog() {
  const name     = document.getElementById('hist-event-name')?.value.trim();
  const type     = document.getElementById('hist-event-type')?.value;
  const date     = document.getElementById('hist-event-date')?.value;
  if (!name || !date) { showToast('Event name and date are required.', 'warning', 'History Log'); return; }

  const payload = {
    event_name:        name,
    event_type:        type,
    event_date:        date,
    peak_occupancy:    parseInt(document.getElementById('hist-peak-occ')?.value)    || 0,
    total_served:      parseInt(document.getElementById('hist-total-served')?.value) || 0,
    duration_days:     parseInt(document.getElementById('hist-duration')?.value)     || 1,
    reliability_rating: document.getElementById('hist-reliability')?.value || 'good',
    bottlenecks:       document.getElementById('hist-bottlenecks')?.value.trim() || null,
    structural_notes:  document.getElementById('hist-structural')?.value.trim()  || null,
    lessons_learned:   document.getElementById('hist-lessons')?.value.trim()     || null,
  };

  try {
    await apiFetch(`/evacuation-tracking/${currentTrackingCenterId}/history`, {
      method: 'POST', body: JSON.stringify(payload),
    });
    // Clear form
    ['hist-event-name','hist-bottlenecks','hist-structural','hist-lessons'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    ['hist-peak-occ','hist-total-served'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 0; });
    document.getElementById('hist-duration').value = 1;
    showToast('History log entry saved.', 'success', 'History Saved');
    loadHistoryLog();
  } catch (err) {
    showToast('Failed: ' + err.message, 'danger', 'Error');
  }
}

async function deleteHistoryLog(logId) {
  confirmAction({
    title: 'Delete History Entry?',
    message: 'Remove this historical log entry permanently?',
    confirmText: 'Delete',
    type: 'danger',
    icon: 'trash-2',
    onConfirm: async () => {
      try {
        await apiFetch(`/evacuation-tracking/${currentTrackingCenterId}/history/${logId}`, { method: 'DELETE' });
        showToast('Entry deleted.', 'info', 'Deleted');
        loadHistoryLog();
      } catch (err) {
        showToast('Delete failed: ' + err.message, 'danger', 'Error');
      }
    }
  });
}

// =============================================
// Resource Optimization Engine
// Evaluates center deficits and auto-recommends
// supplies to procure or ration
// =============================================

function computeResourceRecommendations(centerId) {
  const center   = allCenters.find(c => c.id === centerId);
  if (!center) return [];

  const pct      = capacityPercent(center.current_occupancy, center.capacity);
  const recs     = [];

  // Read current form state (During tab)
  const getSelVal = id => document.getElementById(id)?.value || 'unknown';
  const getIntVal = id => parseInt(document.getElementById(id)?.value) || 0;

  const foodStatus    = getSelVal('relief-food');
  const waterStatus   = getSelVal('relief-water');
  const clothingStatus= getSelVal('relief-clothing');
  const waterSystem   = getSelVal('water-system');
  const elecStatus    = getSelVal('electricity');
  const internet      = getSelVal('internet-signal');
  const pwd           = getIntVal('demo-pwd');
  const pregnant      = getIntVal('demo-pregnant');
  const senior        = getIntVal('demo-senior');
  const children      = getIntVal('demo-children');

  // Occupancy-based
  if (pct >= 80) {
    recs.push({ priority:'high', icon:'home', item:'Additional Shelter Space', reason:`Center at ${pct}% — prepare overflow facility or deploy tents` });
  }
  if (pct >= 60) {
    recs.push({ priority:'medium', icon:'bed', item:'Sleeping Mats / Blankets', reason:`${center.current_occupancy} occupants — ensure adequate bedding ratio` });
  }

  // Relief supply
  if (foodStatus === 'none') {
    recs.push({ priority:'critical', icon:'package', item:'Food Packs (Emergency Rations)', reason:'No food supply reported — immediate procurement required' });
  } else if (foodStatus === 'limited') {
    recs.push({ priority:'high', icon:'package', item:'Food Packs (Restock)', reason:'Food supply limited — replenish to cover 3-day minimum' });
  }

  if (waterStatus === 'none') {
    recs.push({ priority:'critical', icon:'droplet', item:'Potable Water / Water Tanker', reason:'No water supply — request LWUA tanker immediately' });
  } else if (waterStatus === 'limited') {
    recs.push({ priority:'high', icon:'droplet', item:'Water Containers / Tanker Refill', reason:'Water supply limited — pre-position reserve containers' });
  }

  if (clothingStatus === 'none' || clothingStatus === 'limited') {
    recs.push({ priority:'medium', icon:'shirt', item:'Clothing / Blankets', reason:'Clothing stock is ' + clothingStatus + ' — coordinate with DSWD for augmentation' });
  }

  // Utilities
  if (waterSystem === 'disrupted' || waterSystem === 'unavailable') {
    recs.push({ priority:'high', icon:'wrench', item:'Water System Repair / Alternative Supply', reason:'Community water system disrupted — deploy emergency water source' });
  }
  if (elecStatus === 'unavailable') {
    recs.push({ priority:'high', icon:'zap', item:'Portable Generator + Fuel', reason:'No electricity — procure generator for lighting and medical equipment' });
  } else if (elecStatus === 'generator') {
    recs.push({ priority:'medium', icon:'fuel', item:'Generator Fuel Reserve', reason:'Running on generator — ensure 72-hour fuel supply' });
  }
  if (internet === 'none' || internet === 'weak') {
    recs.push({ priority:'low', icon:'wifi', item:'Portable WiFi / Signal Booster', reason:'Poor connectivity — coordinate with telecom for temporary signal' });
  }

  // Sanitation
  if (!center.has_sanitation) {
    recs.push({ priority:'high', icon:'bath', item:'Portable Toilets / Sanitation Kits', reason:'No sanitation facility listed — deploy portable units per 20 evacuees' });
  }

  // Medical / special needs
  if (pwd > 0 || pregnant > 0 || senior > 0) {
    recs.push({ priority:'high', icon:'stethoscope', item:'Medical Personnel + First Aid Supplies', reason:`${pwd + pregnant + senior} high-needs evacuees (PWD/pregnant/senior) — medical volunteer required` });
  }
  if (pregnant > 0) {
    recs.push({ priority:'high', icon:'heart-pulse', item:'Maternal Care Supplies', reason:`${pregnant} pregnant evacuee${pregnant>1?'s':''} — OB/midwife and maternal kit needed` });
  }
  if (children > 0) {
    recs.push({ priority:'medium', icon:'baby', item:'Child-Friendly Supplies & Space', reason:`${children} children — allocate child-safe area, toys, and child-sized clothing` });
  }

  // First aid
  if (!center.has_first_aid) {
    recs.push({ priority:'high', icon:'stethoscope', item:'First Aid Kit / Medical Supplies', reason:'No first aid resources recorded — procure basic trauma kit' });
  }

  // Sort: critical first, then high, medium, low
  const ORDER = { critical:0, high:1, medium:2, low:3 };
  recs.sort((a,b) => (ORDER[a.priority]||9) - (ORDER[b.priority]||9));

  return recs;
}

function renderResourceRecommendations() {
  if (!currentTrackingCenterId) return;
  const recs = computeResourceRecommendations(currentTrackingCenterId);
  const container = document.getElementById('resource-recs-container');
  if (!container) return;

  if (!recs.length) {
    container.innerHTML = `<div style="padding:.75rem;text-align:center;color:var(--text-muted);font-size:.8rem;"><i data-lucide="check-circle" style="color:var(--success);width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> No critical deficits detected based on current data.</div>`;
    lucide.createIcons();
    return;
  }

  const PRIORITY_COLOR = { critical:'#d93025', high:'#e65100', medium:'#f9a825', low:'#1a73e8' };
  const PRIORITY_BG    = { critical:'rgba(217,48,37,.1)', high:'rgba(230,81,0,.1)', medium:'rgba(249,168,37,.1)', low:'rgba(26,115,232,.1)' };

  container.innerHTML = recs.map(r => `
    <div style="display:flex;align-items:flex-start;gap:.6rem;padding:.55rem .75rem;border-radius:7px;background:${PRIORITY_BG[r.priority]};border:1px solid ${PRIORITY_COLOR[r.priority]}33;margin-bottom:.4rem;">
      <i data-lucide="${r.icon}" style="width:16px;height:16px;color:${PRIORITY_COLOR[r.priority]};margin-top:2px;flex-shrink:0;"></i>
      <div style="flex:1;min-width:0;">
        <div style="font-size:.8rem;font-weight:700;color:var(--text-main);">${r.item}
          <span style="font-size:.65rem;font-weight:800;text-transform:uppercase;color:${PRIORITY_COLOR[r.priority]};margin-left:.35rem;padding:.08rem .35rem;border-radius:4px;background:${PRIORITY_COLOR[r.priority]}18;">${r.priority}</span>
        </div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:.1rem;">${r.reason}</div>
      </div>
    </div>`).join('');
  lucide.createIcons();
}

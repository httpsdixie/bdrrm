// ========================================================
// SECTION 9: SYSTEM-WIDE MANUAL FALLBACK & DATA RECOVERY
// ========================================================

function openManualFallbackModal() {
  document.getElementById('manual-fallback-modal-overlay')?.classList.add('active');
  loadManualFallbackAuditLogs();
  if (window.lucide) lucide.createIcons();
}

function closeManualFallbackModal() {
  document.getElementById('manual-fallback-modal-overlay')?.classList.remove('active');
}

function closeManualFallbackModalOutside(e) {
  if (e.target.id === 'manual-fallback-modal-overlay') closeManualFallbackModal();
}

function switchManualModuleTab(module) {
  ['incident', 'dispatch', 'facility', 'evacuee'].forEach(m => {
    const pane = document.getElementById(`man-form-pane-${m}`);
    const btn = document.getElementById(`man-tab-btn-${m}`);
    if (pane) pane.style.display = m === module ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', m === module);
  });
}

// Visual type card selector for manual incident log
function selectTypeCardManual(val) {
  const select = document.getElementById('man-inc-type');
  if (select) select.value = val;
  document.querySelectorAll('#man-form-pane-incident .type-card-item').forEach(card => {
    card.classList.toggle('active', card.getAttribute('data-val') === val);
  });
}

// Visual casualty status selector for manual incident log
function selectCasualtyCardManual(val) {
  const select = document.getElementById('man-inc-casualties');
  if (select) select.value = val;
  document.querySelectorAll('#man-form-pane-incident .triage-btn-manual').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-val') === val);
  });
}

// 9.2 Incident Logbook Encoder
async function submitManualIncidentLog(event) {
  event.preventDefault();
  const type = document.getElementById('man-inc-type')?.value;
  const location = document.getElementById('man-inc-location')?.value.trim();
  const casualties = document.getElementById('man-inc-casualties')?.value;
  const desc = document.getElementById('man-inc-desc')?.value.trim();
  const occurrenceTime = document.getElementById('man-inc-timestamp')?.value;
  const officer = document.getElementById('man-inc-officer')?.value.trim() || 'Focal Person';

  if (!type || !location || !desc || !occurrenceTime) {
    showToast('Please fill in all mandatory logbook fields including occurrence timestamp.', 'warning', 'Validation Error');
    return;
  }

  try {
    const res = await apiFetch('/manual-fallback/encode-incident', {
      method: 'POST',
      body: JSON.stringify({
        incident_type: type,
        location_address: location,
        casualty_status: casualties,
        description: desc,
        actual_occurrence_timestamp: occurrenceTime,
        encoded_by_officer: officer
      })
    });

    showToast(res.message, 'success', 'Manual Record Encoded');
    event.target.reset();
    await loadManualFallbackAuditLogs();
  } catch (err) {
    showToast(err.message || 'Failed to encode manual incident log.', 'danger', 'Encoding Error');
  }
}

// 9.2 Resource Dispatch Ledger Encoder
async function submitManualDispatchLog(event) {
  event.preventDefault();
  const propNo = document.getElementById('man-dsp-propno')?.value.trim();
  const asset = document.getElementById('man-dsp-asset')?.value.trim();
  const personnel = document.getElementById('man-dsp-personnel')?.value.trim();
  const dest = document.getElementById('man-dsp-dest')?.value.trim();
  const timeOut = document.getElementById('man-dsp-timeout')?.value;
  const timeReturn = document.getElementById('man-dsp-timereturn')?.value;
  const occurrenceTime = document.getElementById('man-dsp-timestamp')?.value;
  const officer = document.getElementById('man-dsp-officer')?.value.trim() || 'Focal Person';

  if (!propNo || !asset || !personnel || !dest || !occurrenceTime) {
    showToast('Please fill in all mandatory dispatch ledger fields.', 'warning', 'Validation Error');
    return;
  }

  try {
    const res = await apiFetch('/manual-fallback/encode-dispatch', {
      method: 'POST',
      body: JSON.stringify({
        property_number: propNo,
        asset_name: asset,
        assigned_personnel: personnel,
        destination: dest,
        time_out: timeOut || occurrenceTime,
        expected_return_time: timeReturn || occurrenceTime,
        actual_occurrence_timestamp: occurrenceTime,
        encoded_by_officer: officer
      })
    });

    showToast(res.message, 'success', 'Dispatch Ledger Encoded');
    event.target.reset();
    await loadManualFallbackAuditLogs();
  } catch (err) {
    showToast(err.message || 'Failed to encode dispatch ledger.', 'danger', 'Encoding Error');
  }
}

// 9.2 Facility Audit Ledger Encoder
async function submitManualFacilityAudit(event) {
  event.preventDefault();
  const center = document.getElementById('man-fac-center')?.value.trim();
  const status = document.getElementById('man-fac-status')?.value;
  const jmc2 = document.getElementById('man-fac-jmc2')?.value.trim();
  const water = document.getElementById('man-fac-water')?.value;
  const power = document.getElementById('man-fac-power')?.value;
  const latrine = document.getElementById('man-fac-latrine')?.value;
  const occurrenceTime = document.getElementById('man-fac-timestamp')?.value;
  const officer = document.getElementById('man-fac-officer')?.value.trim() || 'Focal Person';

  if (!center || !occurrenceTime) {
    showToast('Please specify center name and occurrence timestamp.', 'warning', 'Validation Error');
    return;
  }

  try {
    const res = await apiFetch('/manual-fallback/encode-facility-audit', {
      method: 'POST',
      body: JSON.stringify({
        center_name: center,
        operational_status: status,
        jmc2_checklist_summary: jmc2 || 'Manual audit checklist verified.',
        water_status: water,
        power_status: power,
        latrine_status: latrine,
        actual_occurrence_timestamp: occurrenceTime,
        encoded_by_officer: officer
      })
    });

    showToast(res.message, 'success', 'Facility Audit Encoded');
    event.target.reset();
    await loadManualFallbackAuditLogs();
  } catch (err) {
    showToast(err.message || 'Failed to encode facility audit.', 'danger', 'Encoding Error');
  }
}

// 9.2 Manual Evacuee Logbook Encoder
async function submitManualEvacueeLog(event) {
  event.preventDefault();
  const headName = document.getElementById('man-evc-head')?.value.trim();
  const members = parseInt(document.getElementById('man-evc-members')?.value) || 1;
  const contact = document.getElementById('man-evc-contact')?.value.trim();
  const eventLink = document.getElementById('man-evc-event')?.value.trim() || 'Typhoon Kristine';
  const occurrenceTime = document.getElementById('man-evc-timestamp')?.value;
  const officer = document.getElementById('man-evc-officer')?.value.trim() || 'Focal Person';

  // Read vulnerability checkboxes
  const tags = [];
  if (document.getElementById('man-evc-infant')?.checked) tags.push('Infant');
  if (document.getElementById('man-evc-senior')?.checked) tags.push('Senior');
  if (document.getElementById('man-evc-pwd')?.checked) tags.push('PWD');
  if (document.getElementById('man-evc-pregnant')?.checked) tags.push('Pregnant/Lactating');

  if (!headName || !occurrenceTime) {
    showToast('Please specify head of family and occurrence timestamp.', 'warning', 'Validation Error');
    return;
  }

  try {
    const res = await apiFetch('/manual-fallback/encode-evacuee', {
      method: 'POST',
      body: JSON.stringify({
        family_head_name: headName,
        total_members: members,
        vulnerability_triage_tags: tags,
        contact_number: contact,
        disaster_event_link: eventLink,
        actual_occurrence_timestamp: occurrenceTime,
        encoded_by_officer: officer
      })
    });

    showToast(res.message, 'success', 'Evacuee Record Encoded');
    event.target.reset();
    await loadManualFallbackAuditLogs();
  } catch (err) {
    showToast(err.message || 'Failed to encode evacuee log.', 'danger', 'Encoding Error');
  }
}

// Audit Log Fetcher & Table Renderer
async function loadManualFallbackAuditLogs() {
  const tbody = document.getElementById('manual-audit-tbody');
  if (!tbody) return;

  try {
    const res = await apiFetch('/manual-fallback/audit-logs');
    const entries = res.entries || [];

    if (!entries.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--text-muted);">No post-event manual entries encoded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = entries.map(e => `
      <tr>
        <td>
          <span class="badge" style="background:rgba(245,158,11,0.18);color:#fbbf24;border:1px solid rgba(245,158,11,0.4);font-size:.68rem;padding:.2rem .45rem;">
            <i data-lucide="shield-alert" style="width:10px;height:10px;"></i> ${e.audit_tag}
          </span>
        </td>
        <td><strong>${e.module}</strong></td>
        <td><div style="font-weight:700;color:var(--text-main);">${e.title}</div></td>
        <td><small style="color:#fbbf24;">${new Date(e.actual_occurrence_timestamp).toLocaleString('en-PH')}</small></td>
        <td><small style="color:var(--text-muted);">${new Date(e.encoded_at).toLocaleString('en-PH')}</small></td>
        <td><span class="badge badge-green">${e.compliance_sla_24h}</span></td>
      </tr>
    `).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.warn('Manual fallback audit fetch failed:', err.message);
  }
}

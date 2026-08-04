const EVAC_FIXED_ROLES = [
  'LGU Camp Coordinator',
  'EC Camp Manager',
  'Assistant Camp Manager',
  'Administrative/Records Officer',
  'Accommodation and Maintenance Officer',
  'Food and Non-Food Item Officer',
  'Safety and Public Safety Officer',
  'Education, Sports, and Recreation Officer',
  'Logistics Officer',
  'WASH Officer',
  'Medical Officer',
  'MHPSS Officer',
  'Nutrition Officer',
];

let currentCenterId = null;
let evacuationCenters = [];

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseFloatOrNull(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const cleaned = String(value).replace(/[^0-9.+-]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIntOrNull(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const cleaned = String(value).replace(/[^0-9-]/g, '');
  const parsed = parseInt(cleaned, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function toBoolean(value) {
  return String(value).toLowerCase() === 'yes';
}

function openModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) overlay.classList.add('active');
}

function closeModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) overlay.classList.remove('active');
}

function closeModalOutside(event, overlayId) {
  if (event.target === document.getElementById(overlayId)) {
    closeModal(overlayId);
  }
}


// ─── Auto Fill ────────────────────────────────────────────────────────────────

function autoFillPart1() {
  document.getElementById('center-name').value = 'Barangay Linao Evacuation Center';
  document.getElementById('year-established').value = '2012';
  document.getElementById('capacity').value = '250';
  document.getElementById('address').value = 'Barangay Linao, Ormoc City, Leyte';
  document.getElementById('latitude').value = '11.0180';
  document.getElementById('longitude').value = '124.5920';
  document.getElementById('floor-area').value = '120 sqm';
  document.getElementById('lot-area').value = '20 x 30 m';
  document.getElementById('center-type').value = 'Covered Court';
  toggleCenterTypeOthers();
}

function autoFillPart2() {
  initPersonnelDirectory([
    { assignment: 'LGU Camp Coordinator',            first_name: 'Juan',   middle_name: 'P.', last_name: 'Dela Cruz', suffix: '',    designation: 'Barangay Captain',      office: 'Barangay Hall',       contact_details: '09171234567' },
    { assignment: 'EC Camp Manager',                 first_name: 'Maria',  middle_name: 'R.', last_name: 'Santos',    suffix: '',    designation: 'Camp Manager',          office: 'Evacuation Center',   contact_details: '09172345678' },
    { assignment: 'Assistant Camp Manager',          first_name: 'Jose',   middle_name: 'A.', last_name: 'Reyes',     suffix: 'Jr.', designation: 'Asst. Camp Manager',   office: 'Evacuation Center',   contact_details: '09173456789' },
    { assignment: 'Administrative/Records Officer',  first_name: 'Anna',   middle_name: 'L.', last_name: 'Velasco',   suffix: '',    designation: 'Records Officer',       office: 'Admin Office',        contact_details: '09174567890' },
    { assignment: 'Accommodation and Maintenance Officer', first_name: 'Carlos', middle_name: 'M.', last_name: 'Ramos', suffix: '', designation: 'Maintenance Head',     office: 'Maintenance Unit',    contact_details: '09175678901' },
    { assignment: 'Food and Non-Food Item Officer',  first_name: 'Liza',   middle_name: 'B.', last_name: 'Cruz',      suffix: '',    designation: 'Logistics Officer',     office: 'Supply Unit',         contact_details: '09176789012' },
    { assignment: 'Safety and Public Safety Officer',first_name: 'Pedro',  middle_name: 'T.', last_name: 'Reyes',     suffix: '',    designation: 'Safety Officer',        office: 'Safety Unit',         contact_details: '09177890123' },
    { assignment: 'Education, Sports, and Recreation Officer', first_name: 'Rosa', middle_name: 'C.', last_name: 'Flores', suffix: '', designation: 'Education Officer', office: 'Education Unit',     contact_details: '09178901234' },
    { assignment: 'Logistics Officer',               first_name: 'Ramon',  middle_name: 'D.', last_name: 'Lopez',     suffix: '',    designation: 'Logistics Head',        office: 'Logistics Unit',      contact_details: '09179012345' },
    { assignment: 'WASH Officer',                    first_name: 'Elena',  middle_name: 'S.', last_name: 'Garcia',    suffix: '',    designation: 'WASH Officer',          office: 'Sanitation Unit',     contact_details: '09170123456' },
    { assignment: 'Medical Officer',                 first_name: 'Dr. Rey',middle_name: 'F.', last_name: 'Mendoza',   suffix: 'MD',  designation: 'Medical Officer',       office: 'Health Station',      contact_details: '09171230000' },
    { assignment: 'MHPSS Officer',                   first_name: 'Grace',  middle_name: 'V.', last_name: 'Torres',    suffix: '',    designation: 'MHPSS Coordinator',     office: 'Psychosocial Unit',   contact_details: '09172340000' },
    { assignment: 'Nutrition Officer',               first_name: 'Carla',  middle_name: 'N.', last_name: 'Bautista',  suffix: '',    designation: 'Nutritionist',          office: 'Health Station',      contact_details: '09173450000' },
  ]);
}

function autoFillPart3() {
  populateFacilitiesChecklist({
    information_board:            { posted_visible_location: true,  description: 'Posted near the entrance and main notice board.' },
    shelter_accommodation:        { comfortable_living_space: true,  number_of_rooms: 5, modular_tents_available: true, modular_tents_count: 6 },
    management_desk:              { strategic_location: true,        description: 'Located at the camp entrance, clearly marked.' },
    community_kitchen:            { safe_clean_water: true,          easily_accessed: true, away_from_toilets: true, condition_details: 'Clean kitchen with water access and drainage.' },
    storage_area:                 { dry_hygienic: true,              protected_from_contamination: true, minimum_capacity: '20 cu.m.', maximum_capacity: '40 cu.m.' },
    water_facility:               { enough_source_for_daily_consumption: true, potable_water: true, potable_water_source: 'Bottled water and treated tap supply', non_potable_water: true, non_potable_water_source: 'Rainwater harvesting and backup tanks' },
    latrine_toilets:              { one_toilet_per_two_persons: true, gender_separation: true, garbage_bins_available: true, mhm_latirnes_for_women: true, pwd_elderly_accessible: true, lighting: true, hygiene_supplies: true, female_toilets: 4, male_toilets: 4, pwd_toilets: 1 },
    handwashing_facility:         { designed_nearby: true,           count: 3 },
    laundry_space:                { capacity_for_20_persons: true,   count: 2 },
    health_station:               { assigned_medical_staff: true,    prepositioned_medicines: true, description: 'Health station staffed with nurse and first aid supplies.' },
    breastfeeding_room:           { secured_ventilated_lighted: true, quantity: 1 },
    couples_room:                 { located_at_end: true,            description: 'Private couple\'s room at secure end of the camp.' },
    child_friendly_space:         { one_per_100_families: true,      kits_available: true, description: 'Child-friendly space equipped with play kits.' },
    women_friendly_space:         { one_per_100_families: true,      kits_available: true, description: 'Women-friendly space with privacy and support kits.' },
    prayer_room:                  { faith_appropriate_design: true,  description: 'Multi-faith prayer room available.' },
    ramp:                         { accessible_for_special_needs: true, description: 'Accessible ramp with handrails.' },
    animals_area:                 { separated_animal_area: true,     description: 'Livestock area separated from IDP sleeping areas.' },
    solid_waste_management:       { mrf: true, categorized_trash_bins: true, regular_collection_schedule: true, description: 'Waste segregation and regular collection schedule in place.' },
    power_supply:                 { enough_power: true,              backup_source: 'Generator set and solar backup' },
    others_and_structural_integrity: { compliant: true,             additional_facilities: 'Community briefing area', structural_integrity_report: 'No major structural issues observed.' },
  });
}

function autoFillPart4() {
  generateContingencyPlan();
  setPreparedApproved('prepared', { first_name: 'Rosa',  middle_name: 'M.', last_name: 'Garcia', suffix: '',   designation: 'Barangay DRRM Coordinator / Barangay Hall' });
  setPreparedApproved('approved', { first_name: 'Emilio',middle_name: 'A.', last_name: 'Lopez',  suffix: '',   designation: 'Municipal DRRM Officer / MDRRMO Office' });
}

window.autoFillPart1 = autoFillPart1;
window.autoFillPart2 = autoFillPart2;
window.autoFillPart3 = autoFillPart3;
window.autoFillPart4 = autoFillPart4;



function openPart1Modal(centerId = null) {
  currentCenterId = centerId;
  const titleEl = document.getElementById('modal-part1-title');
  const submitBtn = document.getElementById('submit-part1');

  if (centerId) {
    const center = evacuationCenters.find(c => String(c.id) === String(centerId));
    if (center) populatePart1(center);
    if (titleEl) titleEl.innerHTML = '<i data-lucide="layers"></i> Edit: Camp Management Structure';
    if (submitBtn) submitBtn.textContent = 'Save Changes';
  } else {
    resetPart1();
    if (titleEl) titleEl.innerHTML = '<i data-lucide="layers"></i> Camp Management Structure';
    if (submitBtn) submitBtn.textContent = 'Save Center';
  }
  openModal('modal-part1-overlay');
  if (window.lucide) lucide.createIcons();
}

function populatePart1(center) {
  document.getElementById('center-name').value = center.name || '';
  document.getElementById('year-established').value = center.year_established || '';
  document.getElementById('address').value = center.address || '';
  document.getElementById('floor-area').value = center.floor_area_sqm ?? '';
  document.getElementById('lot-area').value = center.lot_area || '';
  document.getElementById('capacity').value = center.capacity || '';
  document.getElementById('latitude').value = center.latitude ?? '';
  document.getElementById('longitude').value = center.longitude ?? '';

  const knownTypes = ['Barangay Hall','Chapel/Church','Covered Court','Government Building','School','Open Space','Private Building','Purpose-Built Evacuation Center'];
  const typeSelect = document.getElementById('center-type');
  const typeOthers = document.getElementById('center-type-others');
  if (knownTypes.includes(center.type)) {
    typeSelect.value = center.type;
    typeOthers.value = '';
  } else {
    typeSelect.value = 'Others';
    typeOthers.value = center.type || '';
  }
  toggleCenterTypeOthers();
}

function resetPart1() {
  document.getElementById('form-part1').reset();
  toggleCenterTypeOthers();
}

function toggleCenterTypeOthers() {
  const typeSelect = document.getElementById('center-type');
  const wrapper = document.getElementById('center-type-others-wrapper');
  if (typeSelect && wrapper) {
    wrapper.style.display = typeSelect.value === 'Others' ? 'block' : 'none';
  }
}

async function submitPart1(event) {
  if (event) event.preventDefault();

  const name = document.getElementById('center-name').value.trim();
  const address = document.getElementById('address').value.trim();
  const capacity = parseIntOrNull(document.getElementById('capacity').value) || 0;

  if (!name || !address || capacity <= 0) {
    showToast('Please fill in the center name, address, and capacity fields.', 'danger', 'Validation Required');
    return;
  }

  const yearEstablished = parseIntOrNull(document.getElementById('year-established').value);
  const floorArea = parseFloatOrNull(document.getElementById('floor-area').value);
  const lotArea = document.getElementById('lot-area').value.trim() || null;
  const latitude = parseFloatOrNull(document.getElementById('latitude').value) ?? 0.0;
  const longitude = parseFloatOrNull(document.getElementById('longitude').value) ?? 0.0;
  const typeSelect = document.getElementById('center-type').value;
  const typeOthers = document.getElementById('center-type-others').value.trim();
  const finalType = typeSelect === 'Others' ? (typeOthers || 'Others') : typeSelect;

  const payload = { name, address, latitude, longitude, capacity, year_established: yearEstablished, floor_area_sqm: floorArea, lot_area: lotArea, type: finalType };

  try {
    if (currentCenterId) {
      await apiFetch(`/evacuation-centers/${currentCenterId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      showToast('Center updated successfully.', 'success', 'Saved');
    } else {
      const result = await apiFetch('/evacuation-centers/', { method: 'POST', body: JSON.stringify(payload) });
      currentCenterId = result?.id || null;
      showToast('Evacuation center created successfully.', 'success', 'Created');
    }
    closeModal('modal-part1-overlay');
    await loadEvacuationCenters();
  } catch (err) {
    showToast(err.message || 'Failed to save center.', 'danger', 'Save Error');
  }
}


// ─── Personnel Directory ──────────────────────────────────────────────

function openPart2Modal(centerId) {
  currentCenterId = centerId;
  const center = evacuationCenters.find(c => String(c.id) === String(centerId));
  const nameEl = document.getElementById('personnel-center-name');
  if (nameEl) nameEl.textContent = center?.name || 'this center';
  initPersonnelDirectory(center?.personnel_directory || []);
  openModal('modal-part2-overlay');
  if (window.lucide) lucide.createIcons();
}

function getPersonnelDirectoryData() {
  const rows = Array.from(document.querySelectorAll('#personnel-table-body tr.personnel-row'));
  return rows.map(row => ({
    assignment: row.querySelector('.personnel-assignment')?.value?.trim() || row.querySelector('.personnel-fixed-role')?.textContent?.trim() || '',
    first_name: row.querySelector('.personnel-first-name')?.value.trim() || '',
    middle_name: row.querySelector('.personnel-middle-name')?.value.trim() || '',
    last_name: row.querySelector('.personnel-last-name')?.value.trim() || '',
    suffix: row.querySelector('.personnel-suffix')?.value.trim() || '',
    designation: row.querySelector('.personnel-designation')?.value.trim() || '',
    office: row.querySelector('.personnel-office')?.value.trim() || '',
    contact_details: row.querySelector('.personnel-contact')?.value.trim() || '',
  })).filter(p => p.assignment || p.first_name || p.last_name);
}

function addPersonnelRow(person = {}, isFixed = false) {
  const tbody = document.getElementById('personnel-table-body');
  if (!tbody) return;
  const row = document.createElement('tr');
  row.className = 'personnel-row';
  row.dataset.fixed = isFixed ? 'true' : 'false';

  const assignmentValue = escHtml(person.assignment || '');
  const assignmentCell = isFixed
    ? `<span class="personnel-fixed-role">${assignmentValue}</span>`
    : `<input type="text" class="personnel-assignment" value="${assignmentValue}" placeholder="Custom role" />`;
  const removeButton = isFixed
    ? ''
    : `<button type="button" class="btn btn-outline-sm" onclick="removePersonnelRow(this)" style="padding:.2rem .5rem;">Remove</button>`;

  row.innerHTML = `
    <td>${assignmentCell}</td>
    <td><input type="text" class="personnel-first-name" value="${escHtml(person.first_name || '')}" placeholder="First name" /></td>
    <td><input type="text" class="personnel-middle-name" value="${escHtml(person.middle_name || '')}" placeholder="Middle name" /></td>
    <td><input type="text" class="personnel-last-name" value="${escHtml(person.last_name || '')}" placeholder="Last name" /></td>
    <td><input type="text" class="personnel-suffix" value="${escHtml(person.suffix || '')}" placeholder="Suffix" /></td>
    <td><input type="text" class="personnel-designation" value="${escHtml(person.designation || '')}" placeholder="Designation" /></td>
    <td><input type="text" class="personnel-office" value="${escHtml(person.office || '')}" placeholder="Office" /></td>
    <td><input type="text" class="personnel-contact" value="${escHtml(person.contact_details || '')}" placeholder="Mobile / Phone" /></td>
    <td style="text-align:center;">${removeButton}</td>
  `;
  tbody.appendChild(row);
}

function removePersonnelRow(button) {
  const row = button.closest('tr');
  if (row) row.remove();
}

function initPersonnelDirectory(personnel = []) {
  const tbody = document.getElementById('personnel-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  const existingMap = {};
  personnel.forEach(p => { if (p.assignment) existingMap[p.assignment] = p; });
  EVAC_FIXED_ROLES.forEach(role => addPersonnelRow({ assignment: role, ...existingMap[role] }, true));
  personnel.filter(p => !EVAC_FIXED_ROLES.includes(p.assignment || '')).forEach(p => addPersonnelRow(p, false));
}

async function submitPart2() {
  if (!currentCenterId) {
    showToast('No center selected.', 'danger', 'Error');
    return;
  }
  const personnelDirectory = getPersonnelDirectoryData();
  try {
    await apiFetch(`/evacuation-centers/${currentCenterId}`, {
      method: 'PATCH',
      body: JSON.stringify({ personnel_directory: personnelDirectory }),
    });
    showToast('Personnel directory saved successfully.', 'success', 'Saved');
    closeModal('modal-part2-overlay');
    await loadEvacuationCenters();
  } catch (err) {
    showToast(err.message || 'Failed to save personnel.', 'danger', 'Save Error');
  }
}


// ─── Standard Camp Facilities ─────────────────────────────────────────

function openPart3Modal(centerId) {
  currentCenterId = centerId;
  const center = evacuationCenters.find(c => String(c.id) === String(centerId));
  const nameEl = document.getElementById('facilities-center-name');
  if (nameEl) nameEl.textContent = center?.name || 'this center';
  populateFacilitiesChecklist(center?.facilities_checklist || {});
  openModal('modal-part3-overlay');
  if (window.lucide) lucide.createIcons();
}

function buildFacilitiesChecklist() {
  const getYesNo = id => toBoolean(document.getElementById(id)?.value || 'no');
  const getText = id => document.getElementById(id)?.value.trim() || null;
  const getNumber = id => parseIntOrNull(document.getElementById(id)?.value);
  return {
    information_board: { posted_visible_location: getYesNo('info-board-posted'), description: getText('info-board-description') },
    shelter_accommodation: { comfortable_living_space: getYesNo('shelter-living-space'), number_of_rooms: getNumber('shelter-number-rooms'), modular_tents_available: getYesNo('shelter-modular-tents'), modular_tents_count: getNumber('shelter-modular-tents-count') },
    management_desk: { strategic_location: getYesNo('desk-strategic-location'), description: getText('desk-description') },
    community_kitchen: { safe_clean_water: getYesNo('kitchen-safe-water'), easily_accessed: getYesNo('kitchen-accessible'), away_from_toilets: getYesNo('kitchen-away-from-toilets'), condition_details: getText('kitchen-condition') },
    storage_area: { dry_hygienic: getYesNo('storage-dry-hygienic'), protected_from_contamination: getYesNo('storage-protected'), minimum_capacity: getText('storage-min-capacity'), maximum_capacity: getText('storage-max-capacity') },
    water_facility: { enough_source_for_daily_consumption: getYesNo('water-enough-daily'), potable_water: getYesNo('water-potable'), potable_water_source: getText('water-potable-source'), non_potable_water: getYesNo('water-non-potable'), non_potable_water_source: getText('water-non-potable-source') },
    latrine_toilets: { one_toilet_per_two_persons: getYesNo('latrine-capacity-criteria'), gender_separation: getYesNo('latrine-gender-separation'), garbage_bins_available: getYesNo('latrine-garbage-bins'), mhm_latirnes_for_women: getYesNo('latrine-mhm'), pwd_elderly_accessible: getYesNo('latrine-pwd-elderly'), lighting: getYesNo('latrine-lighting'), hygiene_supplies: getYesNo('latrine-hygiene-supplies'), female_toilets: getNumber('latrine-female-count'), male_toilets: getNumber('latrine-male-count'), pwd_toilets: getNumber('latrine-pwd-count') },
    handwashing_facility: { designed_nearby: getYesNo('handwashing-nearby'), count: getNumber('handwashing-count') },
    laundry_space: { capacity_for_20_persons: getYesNo('laundry-capacity'), count: getNumber('laundry-count') },
    health_station: { assigned_medical_staff: getYesNo('health-assigned-staff'), prepositioned_medicines: getYesNo('health-medicines'), description: getText('health-description') },
    breastfeeding_room: { secured_ventilated_lighted: getYesNo('breastfeeding-secured'), quantity: getNumber('breastfeeding-quantity') },
    couples_room: { located_at_end: getYesNo('couples-room-located-at-end'), description: getText('couples-room-description') },
    child_friendly_space: { one_per_100_families: getYesNo('cfs-one-per-100'), kits_available: getYesNo('cfs-kits'), description: getText('cfs-description') },
    women_friendly_space: { one_per_100_families: getYesNo('wfs-one-per-100'), kits_available: getYesNo('wfs-kits'), description: getText('wfs-description') },
    prayer_room: { faith_appropriate_design: getYesNo('prayer-room-design'), description: getText('prayer-room-description') },
    ramp: { accessible_for_special_needs: getYesNo('ramp-accessible'), description: getText('ramp-description') },
    animals_area: { separated_animal_area: getYesNo('animals-area-separated'), description: getText('animals-area-description') },
    solid_waste_management: { mrf: getYesNo('waste-mrf'), categorized_trash_bins: getYesNo('waste-trash-bins'), regular_collection_schedule: getYesNo('waste-collection-schedule'), description: getText('waste-description') },
    power_supply: { enough_power: getYesNo('power-enough'), backup_source: getText('power-backup-source') },
    others_and_structural_integrity: { compliant: getYesNo('others-structural-compliant'), additional_facilities: getText('others-additional-facilities'), structural_integrity_report: getText('others-structural-report') },
  };
}

function populateFacilitiesChecklist(data = {}) {
  const setYesNo = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ? 'yes' : 'no'; };
  const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };

  setYesNo('info-board-posted', data.information_board?.posted_visible_location); setValue('info-board-description', data.information_board?.description);
  setYesNo('shelter-living-space', data.shelter_accommodation?.comfortable_living_space); setValue('shelter-number-rooms', data.shelter_accommodation?.number_of_rooms ?? ''); setYesNo('shelter-modular-tents', data.shelter_accommodation?.modular_tents_available); setValue('shelter-modular-tents-count', data.shelter_accommodation?.modular_tents_count ?? '');
  setYesNo('desk-strategic-location', data.management_desk?.strategic_location); setValue('desk-description', data.management_desk?.description);
  setYesNo('kitchen-safe-water', data.community_kitchen?.safe_clean_water); setYesNo('kitchen-accessible', data.community_kitchen?.easily_accessed); setYesNo('kitchen-away-from-toilets', data.community_kitchen?.away_from_toilets); setValue('kitchen-condition', data.community_kitchen?.condition_details);
  setYesNo('storage-dry-hygienic', data.storage_area?.dry_hygienic); setYesNo('storage-protected', data.storage_area?.protected_from_contamination); setValue('storage-min-capacity', data.storage_area?.minimum_capacity); setValue('storage-max-capacity', data.storage_area?.maximum_capacity);
  setYesNo('water-enough-daily', data.water_facility?.enough_source_for_daily_consumption); setYesNo('water-potable', data.water_facility?.potable_water); setValue('water-potable-source', data.water_facility?.potable_water_source); setYesNo('water-non-potable', data.water_facility?.non_potable_water); setValue('water-non-potable-source', data.water_facility?.non_potable_water_source);
  setYesNo('latrine-capacity-criteria', data.latrine_toilets?.one_toilet_per_two_persons); setYesNo('latrine-gender-separation', data.latrine_toilets?.gender_separation); setYesNo('latrine-garbage-bins', data.latrine_toilets?.garbage_bins_available); setYesNo('latrine-mhm', data.latrine_toilets?.mhm_latirnes_for_women); setYesNo('latrine-pwd-elderly', data.latrine_toilets?.pwd_elderly_accessible); setYesNo('latrine-lighting', data.latrine_toilets?.lighting); setYesNo('latrine-hygiene-supplies', data.latrine_toilets?.hygiene_supplies); setValue('latrine-female-count', data.latrine_toilets?.female_toilets ?? ''); setValue('latrine-male-count', data.latrine_toilets?.male_toilets ?? ''); setValue('latrine-pwd-count', data.latrine_toilets?.pwd_toilets ?? '');
  setYesNo('handwashing-nearby', data.handwashing_facility?.designed_nearby); setValue('handwashing-count', data.handwashing_facility?.count ?? '');
  setYesNo('laundry-capacity', data.laundry_space?.capacity_for_20_persons); setValue('laundry-count', data.laundry_space?.count ?? '');
  setYesNo('health-assigned-staff', data.health_station?.assigned_medical_staff); setYesNo('health-medicines', data.health_station?.prepositioned_medicines); setValue('health-description', data.health_station?.description);
  setYesNo('breastfeeding-secured', data.breastfeeding_room?.secured_ventilated_lighted); setValue('breastfeeding-quantity', data.breastfeeding_room?.quantity ?? '');
  setYesNo('couples-room-located-at-end', data.couples_room?.located_at_end); setValue('couples-room-description', data.couples_room?.description);
  setYesNo('cfs-one-per-100', data.child_friendly_space?.one_per_100_families); setYesNo('cfs-kits', data.child_friendly_space?.kits_available); setValue('cfs-description', data.child_friendly_space?.description);
  setYesNo('wfs-one-per-100', data.women_friendly_space?.one_per_100_families); setYesNo('wfs-kits', data.women_friendly_space?.kits_available); setValue('wfs-description', data.women_friendly_space?.description);
  setYesNo('prayer-room-design', data.prayer_room?.faith_appropriate_design); setValue('prayer-room-description', data.prayer_room?.description);
  setYesNo('ramp-accessible', data.ramp?.accessible_for_special_needs); setValue('ramp-description', data.ramp?.description);
  setYesNo('animals-area-separated', data.animals_area?.separated_animal_area); setValue('animals-area-description', data.animals_area?.description);
  setYesNo('waste-mrf', data.solid_waste_management?.mrf); setYesNo('waste-trash-bins', data.solid_waste_management?.categorized_trash_bins); setYesNo('waste-collection-schedule', data.solid_waste_management?.regular_collection_schedule); setValue('waste-description', data.solid_waste_management?.description);
  setYesNo('power-enough', data.power_supply?.enough_power); setValue('power-backup-source', data.power_supply?.backup_source);
  setYesNo('others-structural-compliant', data.others_and_structural_integrity?.compliant); setValue('others-additional-facilities', data.others_and_structural_integrity?.additional_facilities); setValue('others-structural-report', data.others_and_structural_integrity?.structural_integrity_report);
}

async function submitPart3() {
  if (!currentCenterId) { showToast('No center selected.', 'danger', 'Error'); return; }
  const facilitiesChecklist = buildFacilitiesChecklist();
  try {
    await apiFetch(`/evacuation-centers/${currentCenterId}`, {
      method: 'PATCH',
      body: JSON.stringify({ facilities_checklist: facilitiesChecklist }),
    });
    await loadEvacuationCenters();
    closeModal('modal-part3-overlay');
    openPart4Modal(currentCenterId);
  } catch (err) {
    showToast(err.message || 'Failed to save facilities.', 'danger', 'Save Error');
  }
}


// ─── Contingency Plan & Approval ──────────────────────────────────────────────

function openPart4Modal(centerId) {
  currentCenterId = centerId;
  const center = evacuationCenters.find(c => String(c.id) === String(centerId));
  const nameEl = document.getElementById('approval-center-name');
  if (nameEl) nameEl.textContent = center?.name || 'this center';

  // Pre-fill approval fields from saved data if any
  setPreparedApproved('prepared', center?.prepared_by || {});
  setPreparedApproved('approved', center?.approved_by || {});

  // Auto-generate contingency plan from current facilities data
  generateContingencyPlan();

  // If center already has a saved contingency plan, show that instead
  if (center?.contingency_plan) {
    document.getElementById('contingency-plan').value = center.contingency_plan;
  }

  openModal('modal-part4-overlay');
  if (window.lucide) lucide.createIcons();
}

function generateContingencyPlan() {
  const checklist = buildFacilitiesChecklist();
  const problems = [];
  const push = (title, action) => { if (action) problems.push(`${title}: ${action}`); };

  if (!checklist.information_board.posted_visible_location) push('Information Board', 'Post the evacuation center information board in a clearly visible location.');
  if (!checklist.shelter_accommodation.comfortable_living_space) push('Shelter Space', 'Reconfigure or identify additional shelter space to meet 3.5 sqm per person.');
  if (!checklist.shelter_accommodation.modular_tents_available) push('Modular Tents', 'Deploy modular tents for additional sleeping capacity.');
  if (!checklist.management_desk.strategic_location) push('Camp Management Desk', 'Relocate or mark the management desk at the camp entrance or a strategic location.');
  if (!checklist.community_kitchen.safe_clean_water) push('Community Kitchen Water', 'Secure safe and clean water access to the community kitchen.');
  if (!checklist.community_kitchen.easily_accessed) push('Community Kitchen Access', 'Ensure the kitchen is easily accessible to IDPs inside the camp.');
  if (!checklist.community_kitchen.away_from_toilets) push('Kitchen Placement', 'Move the kitchen away from communal toilets and latrines.');
  if (!checklist.storage_area.dry_hygienic) push('Storage Area Conditions', 'Arrange a dry and hygienic storage area for relief items.');
  if (!checklist.storage_area.protected_from_contamination) push('Storage Protection', 'Protect storage against weather, pests, and contamination.');
  if (!checklist.water_facility.enough_source_for_daily_consumption) push('Daily Water Supply', 'Arrange enough water sources to meet the daily needs of IDPs.');
  if (!checklist.water_facility.potable_water) push('Potable Water', 'Provide a potable water source and document the water source.');
  if (!checklist.water_facility.non_potable_water) push('Non-Potable Water', 'Provide a non-potable water source for cleaning and sanitation.');
  if (!checklist.latrine_toilets.one_toilet_per_two_persons) push('Toilet Capacity', 'Add latrine or toilet units to meet the required 1:2 ratio.');
  if (!checklist.latrine_toilets.gender_separation) push('Gender Separation', 'Provide separate toilets for men and women.');
  if (!checklist.latrine_toilets.garbage_bins_available) push('Special Needs Hygiene', 'Place garbage bins, especially for persons with special needs.');
  if (!checklist.latrine_toilets.mhm_latirnes_for_women) push('MHM Facilities', 'Designate latrines for menstrual hygiene management with proper covers.');
  if (!checklist.latrine_toilets.pwd_elderly_accessible) push('PWD/Elderly Access', 'Create at least one toilet accessible to PWDs and elderly.');
  if (!checklist.latrine_toilets.lighting) push('Latrine Lighting', 'Install proper night lighting for toilets and bathing areas.');
  if (!checklist.latrine_toilets.hygiene_supplies) push('Hygiene Supplies', 'Preposition soap and cleaning kits at hygiene facilities.');
  if (!checklist.handwashing_facility.designed_nearby) push('Handwashing Facility', 'Place handwashing stations within 10m of camp facilities.');
  if (!checklist.laundry_space.capacity_for_20_persons) push('Laundry Space', 'Ensure laundry facilities can support 20 persons at once.');
  if (!checklist.health_station.assigned_medical_staff) push('Health Station Staffing', 'Assign medical staff and coordinate with P/C/M/HO.');
  if (!checklist.health_station.prepositioned_medicines) push('Medical Supplies', 'Stock medicines and first-aid supplies in the health station.');
  if (!checklist.breastfeeding_room.secured_ventilated_lighted) push('Breastfeeding Room', 'Prepare a secured, ventilated, and well-lit breastfeeding room.');
  if (!checklist.couples_room.located_at_end) push('Couples Room', 'Locate the couple\'s room at a secure end part of the camp.');
  if (!checklist.child_friendly_space.one_per_100_families) push('Child-Friendly Space', 'Provide one child-friendly space for every 100 families.');
  if (!checklist.child_friendly_space.kits_available) push('CFS Kits', 'Prepare CFS kits with toys, art supplies, and educational materials.');
  if (!checklist.women_friendly_space.one_per_100_families) push('Women-Friendly Space', 'Provide one women-friendly space for every 100 families.');
  if (!checklist.women_friendly_space.kits_available) push('WFS Kits', 'Prepare WFS kits with mats, curtains, logbooks, and seating.');
  if (!checklist.prayer_room.faith_appropriate_design) push('Prayer Room', 'Design a prayer room that reflects the faith and beliefs of IDPs.');
  if (!checklist.ramp.accessible_for_special_needs) push('Ramp Access', 'Install a ramp suitable for persons with special needs.');
  if (!checklist.animals_area.separated_animal_area) push('Animals Area', 'Set up a separate livestock area away from IDP accommodation.');
  if (!checklist.solid_waste_management.mrf) push('Solid Waste Management', 'Establish a materials recovery facility.');
  if (!checklist.solid_waste_management.categorized_trash_bins) push('Waste Segregation', 'Provide adequate trash bins by waste category.');
  if (!checklist.solid_waste_management.regular_collection_schedule) push('Waste Collection', 'Create a regular trash collection schedule.');
  if (!checklist.power_supply.enough_power) push('Power Supply', 'Ensure enough power is available to run the camp.');

  const planArea = document.getElementById('contingency-plan');
  if (!planArea) return;
  planArea.value = problems.length
    ? problems.map((item, i) => `${i + 1}. ${item}`).join('\n')
    : 'All standard camp facilities appear compliant. No additional corrective actions are currently identified.';
}

function extractPreparedApproved(idPrefix) {
  const firstName = document.getElementById(`${idPrefix}-first-name`)?.value.trim() || null;
  const middleName = document.getElementById(`${idPrefix}-middle-name`)?.value.trim() || null;
  const lastName = document.getElementById(`${idPrefix}-last-name`)?.value.trim() || null;
  const suffix = document.getElementById(`${idPrefix}-suffix`)?.value.trim() || null;
  const designation = document.getElementById(`${idPrefix}-designation`)?.value.trim() || null;
  if (!firstName && !middleName && !lastName && !suffix && !designation) return null;
  return { first_name: firstName, middle_name: middleName, last_name: lastName, suffix, designation };
}

function setPreparedApproved(idPrefix, value = {}) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set(`${idPrefix}-first-name`, value.first_name);
  set(`${idPrefix}-middle-name`, value.middle_name);
  set(`${idPrefix}-last-name`, value.last_name);
  set(`${idPrefix}-suffix`, value.suffix);
  set(`${idPrefix}-designation`, value.designation);
}

async function submitPart4() {
  if (!currentCenterId) { showToast('No center selected.', 'danger', 'Error'); return; }
  const contingencyPlan = document.getElementById('contingency-plan').value.trim() || null;
  const preparedBy = extractPreparedApproved('prepared');
  const approvedBy = extractPreparedApproved('approved');

  try {
    await apiFetch(`/evacuation-centers/${currentCenterId}`, {
      method: 'PATCH',
      body: JSON.stringify({ contingency_plan: contingencyPlan, prepared_by: preparedBy, approved_by: approvedBy }),
    });
    showToast('Evacuation center finalized successfully.', 'success', 'Finalized');
    closeModal('modal-part4-overlay');
    await loadEvacuationCenters();
  } catch (err) {
    showToast(err.message || 'Failed to finalize center.', 'danger', 'Save Error');
  }
}


// ─── View Modal (read-only summary) ──────────────────────────────────────────

function openViewModal(centerId) {
  const center = evacuationCenters.find(c => String(c.id) === String(centerId));
  if (!center) { showToast('Center data not found.', 'danger', 'Error'); return; }

  document.getElementById('view-center-title').textContent = center.name || 'Center Profile';
  document.getElementById('view-modal-body').innerHTML = buildViewHTML(center);
  openModal('modal-view-overlay');
  if (window.lucide) lucide.createIcons();
}

function yn(val) {
  if (val === true)  return '<span style="color:#4ade80;font-weight:700;">✔ Yes</span>';
  if (val === false) return '<span style="color:#f87171;font-weight:700;">✘ No</span>';
  return '<span style="color:#94a3b8;">—</span>';
}
function val(v)   { return v ? escHtml(String(v)) : '<span style="color:#94a3b8;">—</span>'; }
function sec(title, content) {
  return `<div style="margin-bottom:1.5rem;">
    <h4 style="margin:0 0 .75rem;font-size:.95rem;color:#93c5fd;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:.4rem;">${title}</h4>
    ${content}
  </div>`;
}
function row2(label, value) {
  return `<div style="display:grid;grid-template-columns:180px 1fr;gap:.4rem .75rem;margin-bottom:.4rem;font-size:.88rem;">
    <span style="color:#94a3b8;">${label}</span><span>${value}</span>
  </div>`;
}

function buildViewHTML(c) {
  const f = c.facilities_checklist || {};
  const p = c.personnel_directory || [];
  const prep = c.prepared_by || {};
  const appr = c.approved_by || {};

  // ── Part 1
  let part1 = row2('Name', val(c.name))
    + row2('Type', val(c.type))
    + row2('Address', val(c.address))
    + row2('Capacity', val(c.capacity))
    + row2('Year Established', val(c.year_established))
    + row2('Floor Area', val(c.floor_area_sqm))
    + row2('Lot Area', val(c.lot_area))
    + row2('Coordinates', c.latitude ? `${c.latitude}, ${c.longitude}` : '<span style="color:#94a3b8;">—</span>');

  // ── Part 2 personnel table
  let personnelRows = '';
  if (p.length) {
    personnelRows = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:.82rem;">
      <thead><tr style="background:rgba(15,23,42,0.9);">
        <th style="padding:.5rem .6rem;color:#94a3b8;text-align:left;border:1px solid rgba(255,255,255,0.08);">Role</th>
        <th style="padding:.5rem .6rem;color:#94a3b8;text-align:left;border:1px solid rgba(255,255,255,0.08);">Name</th>
        <th style="padding:.5rem .6rem;color:#94a3b8;text-align:left;border:1px solid rgba(255,255,255,0.08);">Designation</th>
        <th style="padding:.5rem .6rem;color:#94a3b8;text-align:left;border:1px solid rgba(255,255,255,0.08);">Office</th>
        <th style="padding:.5rem .6rem;color:#94a3b8;text-align:left;border:1px solid rgba(255,255,255,0.08);">Contact</th>
      </tr></thead><tbody>`;
    p.forEach(person => {
      const fullName = [person.first_name, person.middle_name, person.last_name, person.suffix].filter(Boolean).join(' ');
      personnelRows += `<tr>
        <td style="padding:.45rem .6rem;border:1px solid rgba(255,255,255,0.06);color:#60a5fa;font-weight:600;">${escHtml(person.assignment || '')}</td>
        <td style="padding:.45rem .6rem;border:1px solid rgba(255,255,255,0.06);">${escHtml(fullName) || '<span style="color:#94a3b8;">—</span>'}</td>
        <td style="padding:.45rem .6rem;border:1px solid rgba(255,255,255,0.06);">${val(person.designation)}</td>
        <td style="padding:.45rem .6rem;border:1px solid rgba(255,255,255,0.06);">${val(person.office)}</td>
        <td style="padding:.45rem .6rem;border:1px solid rgba(255,255,255,0.06);">${val(person.contact_details)}</td>
      </tr>`;
    });
    personnelRows += '</tbody></table></div>';
  } else {
    personnelRows = '<span style="color:#94a3b8;font-size:.88rem;">No personnel assigned yet.</span>';
  }

  // ── Part 3 facilities (compact grid)
  const facItems = [
    ['Information Board', yn(f.information_board?.posted_visible_location), val(f.information_board?.description)],
    ['Shelter (3.5sqm/person)', yn(f.shelter_accommodation?.comfortable_living_space), `${val(f.shelter_accommodation?.number_of_rooms)} rooms`],
    ['Modular Tents', yn(f.shelter_accommodation?.modular_tents_available), `${val(f.shelter_accommodation?.modular_tents_count)} tents`],
    ['Camp Management Desk', yn(f.management_desk?.strategic_location), val(f.management_desk?.description)],
    ['Community Kitchen', yn(f.community_kitchen?.safe_clean_water), val(f.community_kitchen?.condition_details)],
    ['Storage Area', yn(f.storage_area?.dry_hygienic), `Min: ${val(f.storage_area?.minimum_capacity)} / Max: ${val(f.storage_area?.maximum_capacity)}`],
    ['Potable Water', yn(f.water_facility?.potable_water), val(f.water_facility?.potable_water_source)],
    ['Non-Potable Water', yn(f.water_facility?.non_potable_water), val(f.water_facility?.non_potable_water_source)],
    ['Toilets (1:2 ratio)', yn(f.latrine_toilets?.one_toilet_per_two_persons), `F: ${val(f.latrine_toilets?.female_toilets)} / M: ${val(f.latrine_toilets?.male_toilets)} / PWD: ${val(f.latrine_toilets?.pwd_toilets)}`],
    ['Gender-Separated Toilets', yn(f.latrine_toilets?.gender_separation), ''],
    ['MHM Latrines', yn(f.latrine_toilets?.mhm_latirnes_for_women), ''],
    ['PWD/Elderly Access', yn(f.latrine_toilets?.pwd_elderly_accessible), ''],
    ['Handwashing Facility', yn(f.handwashing_facility?.designed_nearby), `${val(f.handwashing_facility?.count)} units`],
    ['Laundry Space', yn(f.laundry_space?.capacity_for_20_persons), `${val(f.laundry_space?.count)} units`],
    ['Health Station', yn(f.health_station?.assigned_medical_staff), val(f.health_station?.description)],
    ['Breastfeeding Room', yn(f.breastfeeding_room?.secured_ventilated_lighted), `${val(f.breastfeeding_room?.quantity)} unit(s)`],
    ['Couple\'s Room', yn(f.couples_room?.located_at_end), val(f.couples_room?.description)],
    ['Child-Friendly Space', yn(f.child_friendly_space?.one_per_100_families), val(f.child_friendly_space?.description)],
    ['Women-Friendly Space', yn(f.women_friendly_space?.one_per_100_families), val(f.women_friendly_space?.description)],
    ['Prayer Room', yn(f.prayer_room?.faith_appropriate_design), val(f.prayer_room?.description)],
    ['Ramp (PWD Access)', yn(f.ramp?.accessible_for_special_needs), val(f.ramp?.description)],
    ['Animals Area', yn(f.animals_area?.separated_animal_area), val(f.animals_area?.description)],
    ['Solid Waste / MRF', yn(f.solid_waste_management?.mrf), val(f.solid_waste_management?.description)],
    ['Power Supply', yn(f.power_supply?.enough_power), val(f.power_supply?.backup_source)],
    ['Structural Integrity', yn(f.others_and_structural_integrity?.compliant), val(f.others_and_structural_integrity?.structural_integrity_report)],
  ];

  const facilitiesTable = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:.82rem;">
    <thead><tr style="background:rgba(15,23,42,0.9);">
      <th style="padding:.5rem .6rem;color:#94a3b8;text-align:left;border:1px solid rgba(255,255,255,0.08);width:200px;">Facility Item</th>
      <th style="padding:.5rem .6rem;color:#94a3b8;text-align:center;border:1px solid rgba(255,255,255,0.08);width:70px;">Status</th>
      <th style="padding:.5rem .6rem;color:#94a3b8;text-align:left;border:1px solid rgba(255,255,255,0.08);">Details</th>
    </tr></thead><tbody>
    ${facItems.map(([label, status, detail]) => `<tr>
      <td style="padding:.4rem .6rem;border:1px solid rgba(255,255,255,0.06);">${label}</td>
      <td style="padding:.4rem .6rem;border:1px solid rgba(255,255,255,0.06);text-align:center;">${status}</td>
      <td style="padding:.4rem .6rem;border:1px solid rgba(255,255,255,0.06);color:#cbd5e1;">${detail}</td>
    </tr>`).join('')}
    </tbody></table></div>`;

  // ── Part 4
  const prepName  = [prep.first_name, prep.middle_name, prep.last_name, prep.suffix].filter(Boolean).join(' ');
  const apprName  = [appr.first_name, appr.middle_name, appr.last_name, appr.suffix].filter(Boolean).join(' ');
  let part4 = row2('Contingency Plan', c.contingency_plan
    ? `<pre style="white-space:pre-wrap;font-family:inherit;font-size:.83rem;color:#e2e8f0;margin:0;">${escHtml(c.contingency_plan)}</pre>`
    : '<span style="color:#94a3b8;">—</span>')
    + row2('Prepared By', prepName ? `${escHtml(prepName)} — ${val(prep.designation)}` : '<span style="color:#94a3b8;">—</span>')
    + row2('Approved By', apprName ? `${escHtml(apprName)} — ${val(appr.designation)}` : '<span style="color:#94a3b8;">—</span>');

  return sec('Camp Management Structure', part1)
    + sec('Personnel Directory', personnelRows)
    + sec('Standard Camp Facilities', facilitiesTable)
    + sec('Contingency Plan &amp; Approval', part4);
}

window.openViewModal = openViewModal;



let evacPg = { currentPage: 1, pageSize: 10, filtered: [] };

function getAuditScorePill(center) {
  const f = center.facilities_checklist;
  if (!f || !Object.keys(f).length) {
    return `<span class="badge badge-amber" style="display:inline-flex;align-items:center;gap:.3rem;"><i data-lucide="clock" style="width:12px;height:12px;"></i> Audit Pending</span>`;
  }
  let count = 0;
  const total = 20;
  const items = [
    f.information_board?.posted_visible_location,
    f.shelter_accommodation?.comfortable_living_space,
    f.shelter_accommodation?.modular_tents_available,
    f.management_desk?.strategic_location,
    f.community_kitchen?.safe_clean_water,
    f.storage_area?.dry_hygienic,
    f.water_facility?.potable_water,
    f.water_facility?.non_potable_water,
    f.latrine_toilets?.one_toilet_per_two_persons,
    f.handwashing_facility?.designed_nearby,
    f.laundry_space?.capacity_for_20_persons,
    f.health_station?.assigned_medical_staff,
    f.breastfeeding_room?.secured_ventilated_lighted,
    f.couples_room?.located_at_end,
    f.child_friendly_space?.one_per_100_families,
    f.women_friendly_space?.one_per_100_families,
    f.prayer_room?.faith_appropriate_design,
    f.ramp?.accessible_for_special_needs,
    f.animals_area?.separated_animal_area,
    f.solid_waste_management?.mrf
  ];
  items.forEach(v => { if (v === true) count++; });
  const pct = Math.round((count / total) * 100);
  const colorClass = pct >= 80 ? 'badge-green' : pct >= 50 ? 'badge-blue' : 'badge-amber';
  return `<span class="badge ${colorClass}" style="display:inline-flex;align-items:center;gap:.3rem;" title="${count}/${total} facility criteria met"><i data-lucide="check-circle-2" style="width:12px;height:12px;"></i> ${count}/${total} Standards (${pct}%)</span>`;
}

function getPersonnelBadge(center) {
  const p = center.personnel_directory || [];
  if (!p.length) {
    return `<span class="badge badge-amber" style="display:inline-flex;align-items:center;gap:.3rem;"><i data-lucide="user-x" style="width:12px;height:12px;"></i> Unassigned</span>`;
  }
  const filledRoles = p.filter(x => x.first_name || x.last_name).length;
  return `<span class="badge badge-blue" style="display:inline-flex;align-items:center;gap:.3rem;"><i data-lucide="users" style="width:12px;height:12px;"></i> ${filledRoles} Staff Assigned</span>`;
}

function getTypeBadge(typeStr) {
  const type = typeStr || 'Unspecified';
  let badgeStyle = 'background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.3); color:#60a5fa;';
  if (type.includes('School')) {
    badgeStyle = 'background:rgba(168,85,247,0.15); border:1px solid rgba(168,85,247,0.3); color:#c084fc;';
  } else if (type.includes('Court') || type.includes('Hall')) {
    badgeStyle = 'background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); color:#34d399;';
  } else if (type.includes('Purpose-Built')) {
    badgeStyle = 'background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.3); color:#fbbf24;';
  }
  return `<span class="badge" style="${badgeStyle} font-size:.74rem; font-weight:700; padding:.2rem .55rem; border-radius:6px; display:inline-flex; align-items:center; gap:.3rem;"><i data-lucide="building" style="width:11px;height:11px;"></i> ${escHtml(type)}</span>`;
}

function updateEvacSummary(centers = []) {
  let totalCenters = centers.length;
  let totalCapacity = 0;
  let evaluatedCount = 0;
  let staffedCount = 0;

  centers.forEach(c => {
    totalCapacity += parseInt(c.capacity, 10) || 0;
    if (c.facilities_checklist && Object.keys(c.facilities_checklist).length > 0) {
      evaluatedCount++;
    }
    if (c.personnel_directory && c.personnel_directory.length > 0) {
      const filled = c.personnel_directory.filter(p => p.first_name || p.last_name);
      if (filled.length > 0) staffedCount++;
    }
  });

  const sumTotal = document.getElementById('sum-total-centers');
  const sumCap = document.getElementById('sum-total-capacity');
  const sumEval = document.getElementById('sum-evaluated-centers');
  const sumStaff = document.getElementById('sum-staffed-centers');
  const countLabel = document.getElementById('center-count');

  if (sumTotal) sumTotal.textContent = totalCenters;
  if (sumCap) sumCap.textContent = totalCapacity.toLocaleString();
  if (sumEval) sumEval.textContent = evaluatedCount;
  if (sumStaff) sumStaff.textContent = staffedCount;
  if (countLabel) countLabel.textContent = totalCenters;
}

function filterEvacCenters() {
  const query = (document.getElementById('center-search')?.value || '').toLowerCase().trim();
  const typeFilter = document.getElementById('filter-center-type')?.value || '';
  const auditFilter = document.getElementById('filter-audit-status')?.value || '';

  evacPg.filtered = evacuationCenters.filter(c => {
    if (typeFilter && c.type !== typeFilter) return false;
    if (auditFilter === 'evaluated' && (!c.facilities_checklist || Object.keys(c.facilities_checklist).length === 0)) return false;
    if (auditFilter === 'pending' && c.facilities_checklist && Object.keys(c.facilities_checklist).length > 0) return false;

    if (query) {
      const hay = [
        c.name, c.address, c.type,
        ...(c.personnel_directory || []).map(p => `${p.first_name || ''} ${p.last_name || ''}`)
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  evacPg.currentPage = 1;
  renderEvacPaginated();
}

function renderEvacPaginated() {
  const total = evacPg.filtered.length;
  const totalPages = Math.ceil(total / evacPg.pageSize) || 1;
  if (evacPg.currentPage > totalPages) evacPg.currentPage = totalPages;
  if (evacPg.currentPage < 1) evacPg.currentPage = 1;

  const start = (evacPg.currentPage - 1) * evacPg.pageSize;
  const end = Math.min(start + evacPg.pageSize, total);

  renderEvacTable(evacPg.filtered.slice(start, end));
  renderEvacPaginationBar(total, start + 1, end, evacPg.currentPage, totalPages);
}

function renderEvacTable(data) {
  const tbody = document.getElementById('center-list-body');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:#94a3b8;"><i data-lucide="building-2" style="width:32px;height:32px;margin-bottom:.5rem;opacity:.5;display:block;margin-left:auto;margin-right:auto;"></i>No evacuation centers found matching current filters.</td></tr>';
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = data.map(center => `
    <tr onclick="openViewModal('${center.id}')" style="cursor:pointer;" title="Tap to view center profile">
      <td>
        <div style="font-weight:700; color:var(--text-main); font-size:.95rem; margin-bottom:.3rem;">${escHtml(center.name)}</div>
        <div style="display:flex; align-items:center; gap:.5rem; flex-wrap:wrap;">
          ${getTypeBadge(center.type)}
        </div>
      </td>
      <td>
        <div style="font-weight:800; font-family:'Space Grotesk',sans-serif; font-size:1.05rem; color:#f8fafc;">${(center.capacity || 0).toLocaleString()} <span style="font-size:.75rem; font-weight:600; color:#94a3b8;">IDPs</span></div>
      </td>
      <td>${getAuditScorePill(center)}</td>
      <td style="white-space:nowrap; text-align:right;">
        <div style="display:flex; gap:.35rem; justify-content:flex-end; align-items:center;">
          <button type="button" class="btn btn-outline-sm btn-icon-only" onclick="event.stopPropagation(); openPart1Modal('${center.id}')" title="Edit Setup & Coordinates" style="width:32px; height:32px; padding:0; display:inline-flex; align-items:center; justify-content:center; border-radius:8px;">
            <i data-lucide="pencil" style="width:14px;height:14px;"></i>
          </button>
          <button type="button" class="btn btn-outline-sm btn-icon-only" onclick="event.stopPropagation(); openPart2Modal('${center.id}')" title="Manage Personnel Directory" style="width:32px; height:32px; padding:0; display:inline-flex; align-items:center; justify-content:center; border-radius:8px;">
            <i data-lucide="users" style="width:14px;height:14px;"></i>
          </button>
          <button type="button" class="btn btn-outline-sm btn-icon-only" onclick="event.stopPropagation(); openPart3Modal('${center.id}')" title="Evaluate Facilities & Audit Standards" style="width:32px; height:32px; padding:0; display:inline-flex; align-items:center; justify-content:center; border-radius:8px;">
            <i data-lucide="clipboard-check" style="width:14px;height:14px;"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');

  if (window.lucide) lucide.createIcons();
}

function renderEvacPaginationBar(total, startD, endD, cur, totalPages) {
  const info = document.getElementById('evac-pagination-info');
  if (info) info.textContent = total === 0 ? 'Showing 0 of 0 entries' : `Showing ${startD} to ${endD} of ${total} entries`;

  const prev = document.getElementById('evac-btn-prev');
  const next = document.getElementById('evac-btn-next');
  if (prev) prev.disabled = cur <= 1;
  if (next) next.disabled = cur >= totalPages;

  const nums = document.getElementById('evac-page-numbers');
  if (nums) {
    let h = '';
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && Math.abs(p - cur) > 2 && p !== 1 && p !== totalPages) {
        if (p === 2 && cur > 4) h += `<span style="padding:0 .2rem;color:var(--text-muted);">…</span>`;
        else if (p === totalPages - 1 && cur < totalPages - 3) h += `<span style="padding:0 .2rem;color:var(--text-muted);">…</span>`;
        continue;
      }
      h += `<button class="page-btn ${p === cur ? 'active' : ''}" onclick="goToEvacPage(${p})">${p}</button>`;
    }
    nums.innerHTML = h;
  }

  const pagEl = document.getElementById('evac-pagination');
  if (pagEl) pagEl.style.display = total === 0 ? 'none' : 'flex';
  if (window.lucide) lucide.createIcons();
}

function changeEvacPageSize(val) { evacPg.pageSize = parseInt(val, 10); evacPg.currentPage = 1; renderEvacPaginated(); }
function prevEvacPage()          { if (evacPg.currentPage > 1) { evacPg.currentPage--; renderEvacPaginated(); } }
function nextEvacPage()          { const t = Math.ceil(evacPg.filtered.length / evacPg.pageSize) || 1; if (evacPg.currentPage < t) { evacPg.currentPage++; renderEvacPaginated(); } }
function goToEvacPage(p)         { evacPg.currentPage = p; renderEvacPaginated(); }

function resetEvacFilters() {
  const searchInput = document.getElementById('center-search');
  const typeSelect = document.getElementById('filter-center-type');
  const auditSelect = document.getElementById('filter-audit-status');
  if (searchInput) searchInput.value = '';
  if (typeSelect) typeSelect.value = '';
  if (auditSelect) auditSelect.value = '';
  filterEvacCenters();
}

function quickFilterCenterType(typeVal) {
  const typeSelect = document.getElementById('filter-center-type');
  if (typeSelect) typeSelect.value = typeVal;
  filterEvacCenters();
}

function quickFilterAuditStatus(statusVal) {
  const auditSelect = document.getElementById('filter-audit-status');
  if (auditSelect) auditSelect.value = statusVal;
  filterEvacCenters();
}

function filterFacilityCategory(cat) {
  const tabs = document.querySelectorAll('.fac-tab-btn');
  tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-cat') === cat));

  const groups = document.querySelectorAll('.checklist-group');
  groups.forEach(g => {
    if (cat === 'all' || g.getAttribute('data-cat') === cat) {
      g.style.display = 'block';
    } else {
      g.style.display = 'none';
    }
  });
}

function renderCentersList(centers = []) {
  evacuationCenters = centers;
  updateEvacSummary(centers);
  filterEvacCenters();
}

async function loadEvacuationCenters() {
  const loader = document.getElementById('center-list-loader');
  if (loader) loader.style.display = 'block';
  try {
    const centers = await API.get('/evacuation-centers/');
    renderCentersList(Array.isArray(centers) ? centers : []);
  } catch (err) {
    renderCentersList([]);
    showToast('Unable to load evacuation centers.', 'danger', 'Load Error');
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

function searchCenters() {
  filterEvacCenters();
}

// ─── Evacuation Activity Log Tab Logic ──────────────────────────────────────

let evacLogState = {
  allLogs: [],
  filtered: [],
  currentPage: 1,
  pageSize: 10
};

function switchEvacTab(tab) {
  const allBtn = document.getElementById('tab-evac-all');
  const logsBtn = document.getElementById('tab-evac-logs');
  const allPane = document.getElementById('pane-evac-all');
  const logsPane = document.getElementById('pane-evac-logs');

  if (tab === 'logs') {
    if (allBtn) allBtn.classList.remove('active');
    if (logsBtn) logsBtn.classList.add('active');
    if (allPane) allPane.style.display = 'none';
    if (logsPane) logsPane.style.display = 'block';
    loadEvacLogs();
  } else {
    if (allBtn) allBtn.classList.add('active');
    if (logsBtn) logsBtn.classList.remove('active');
    if (allPane) allPane.style.display = 'block';
    if (logsPane) logsPane.style.display = 'none';
  }
}

function loadEvacLogs() {
  const mockLogs = [
    {
      id: 'log-1',
      created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      center_name: 'Barangay Linao Evacuation Center',
      action_type: 'facility',
      action_label: 'Facilities Audit Evaluated',
      performed_by: 'Camp Manager Santos',
      details: 'Evaluated 20 standard criteria (95% compliant)'
    },
    {
      id: 'log-2',
      created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      center_name: 'Barangay Linao Evacuation Center',
      action_type: 'personnel',
      action_label: 'Personnel Directory Updated',
      performed_by: 'BDRRMC Staff Dela Cruz',
      details: 'Assigned 13 camp personnel roles'
    },
    {
      id: 'log-3',
      created_at: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
      center_name: 'Linao Central Elementary School',
      action_type: 'created',
      action_label: 'Center Registered',
      performed_by: 'Barangay DRRM Admin',
      details: 'Registered primary school center (Cap: 400 IDPs)'
    }
  ];
  evacLogState.allLogs = mockLogs;
  filterEvacLogs();
}

function filterEvacLogs() {
  const query = (document.getElementById('evac-log-search')?.value || '').toLowerCase().trim();
  const actionFilter = document.getElementById('evac-log-action-filter')?.value || '';

  evacLogState.filtered = evacLogState.allLogs.filter(log => {
    if (actionFilter && log.action_type !== actionFilter) return false;
    if (query) {
      const text = [log.center_name, log.action_label, log.performed_by, log.details].filter(Boolean).join(' ').toLowerCase();
      if (!text.includes(query)) return false;
    }
    return true;
  });

  evacLogState.currentPage = 1;
  renderEvacLogsPaginated();
}

function renderEvacLogsPaginated() {
  const total = evacLogState.filtered.length;
  const totalPages = Math.ceil(total / evacLogState.pageSize) || 1;
  if (evacLogState.currentPage > totalPages) evacLogState.currentPage = totalPages;
  if (evacLogState.currentPage < 1) evacLogState.currentPage = 1;

  const start = (evacLogState.currentPage - 1) * evacLogState.pageSize;
  const end = Math.min(start + evacLogState.pageSize, total);

  renderEvacLogTable(evacLogState.filtered.slice(start, end));
  renderEvacLogPaginationBar(total, start + 1, end, evacLogState.currentPage, totalPages);
}

function renderEvacLogTable(logs) {
  const tbody = document.getElementById('evac-log-tbody');
  if (!tbody) return;

  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:#94a3b8;"><i data-lucide="clock" style="width:32px;height:32px;margin-bottom:.5rem;opacity:.5;display:block;margin-left:auto;margin-right:auto;"></i>No activity logs recorded yet.</td></tr>';
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = logs.map(log => {
    const dt = new Date(log.created_at);
    const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    let actionBadge = `<span class="badge badge-blue">${escHtml(log.action_label)}</span>`;
    if (log.action_type === 'facility') actionBadge = `<span class="badge badge-green">${escHtml(log.action_label)}</span>`;
    else if (log.action_type === 'created') actionBadge = `<span class="badge badge-purple" style="background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);color:#c084fc;">${escHtml(log.action_label)}</span>`;
    else if (log.action_type === 'contingency') actionBadge = `<span class="badge badge-amber">${escHtml(log.action_label)}</span>`;

    return `
      <tr onclick="openEvacLogDetailModal('${log.id}')" style="cursor:pointer;" title="Click to view full activity log record">
        <td style="white-space:nowrap;">
          <div style="font-weight:700; color:#f8fafc; font-size:.85rem;">${dateStr}</div>
          <div style="font-size:.75rem; color:#64748b; margin-top:.15rem; font-family:monospace;">${timeStr}</div>
        </td>
        <td>
          <div style="font-weight:700; color:var(--text-main); font-size:.9rem;">${escHtml(log.center_name)}</div>
        </td>
        <td style="white-space:nowrap;">${actionBadge}</td>
        <td>
          <div style="font-size:.84rem; color:#e2e8f0; font-weight:600;">${escHtml(log.performed_by)}</div>
          <div style="font-size:.76rem; color:#94a3b8; margin-top:.15rem;">${escHtml(log.details)}</div>
        </td>
      </tr>`;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function openEvacLogDetailModal(id) {
  const log = evacLogState.allLogs.find(l => String(l.id) === String(id));
  if (!log) return;

  const modalBody = document.getElementById('evac-log-modal-body');
  if (!modalBody) return;

  const dt = log.created_at
    ? new Date(log.created_at).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    : '—';

  let actionBadge = `<span style="display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .8rem;border-radius:20px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.4);color:#60a5fa;font-weight:600;font-size:.8rem;"><i data-lucide="activity" style="width:13px;height:13px;"></i> ${escHtml(log.action_label)}</span>`;
  
  if (log.action_type === 'facility') {
    actionBadge = `<span style="display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .8rem;border-radius:20px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.4);color:#34d399;font-weight:600;font-size:.8rem;"><i data-lucide="check-circle" style="width:13px;height:13px;"></i> ${escHtml(log.action_label)}</span>`;
  } else if (log.action_type === 'personnel') {
    actionBadge = `<span style="display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .8rem;border-radius:20px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.4);color:#60a5fa;font-weight:600;font-size:.8rem;"><i data-lucide="users" style="width:13px;height:13px;"></i> ${escHtml(log.action_label)}</span>`;
  } else if (log.action_type === 'created') {
    actionBadge = `<span style="display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .8rem;border-radius:20px;background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.4);color:#c084fc;font-weight:600;font-size:.8rem;"><i data-lucide="plus-circle" style="width:13px;height:13px;"></i> ${escHtml(log.action_label)}</span>`;
  } else if (log.action_type === 'contingency') {
    actionBadge = `<span style="display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .8rem;border-radius:20px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);color:#fbbf24;font-weight:600;font-size:.8rem;"><i data-lucide="file-text" style="width:13px;height:13px;"></i> ${escHtml(log.action_label)}</span>`;
  }

  modalBody.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1.1rem;">
      <div style="padding:1.1rem 1.25rem;background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
        <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-weight:700;margin-bottom:.35rem;">Evacuation Operation</div>
        <div style="font-size:1.15rem;font-weight:800;color:#f8fafc;">${escHtml(log.center_name || '—')}</div>
        <div style="font-size:.78rem;color:#60a5fa;margin-top:.35rem;font-weight:600;display:flex;align-items:center;gap:.35rem;">
          <i data-lucide="shield-check" style="width:14px;height:14px;"></i> DRRM Lifecycle Audit Record
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div style="padding:.9rem 1.1rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:12px;">
          <div style="font-size:.68rem;color:#64748b;font-weight:700;margin-bottom:.45rem;text-transform:uppercase;letter-spacing:.05em;">EVENT ACTION</div>
          <div>${actionBadge}</div>
        </div>

        <div style="padding:.9rem 1.1rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:12px;">
          <div style="font-size:.68rem;color:#64748b;font-weight:700;margin-bottom:.45rem;text-transform:uppercase;letter-spacing:.05em;">AUDIT STATUS</div>
          <div>
            <span style="display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .8rem;border-radius:20px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.4);color:#60a5fa;font-weight:600;font-size:.8rem;">
              Recorded Log
            </span>
          </div>
        </div>
      </div>

      <div style="padding:.9rem 1.1rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:12px;">
        <div style="font-size:.68rem;color:#64748b;font-weight:700;margin-bottom:.35rem;text-transform:uppercase;letter-spacing:.05em;">AUDIT DESCRIPTION & NOTES</div>
        <div style="font-size:.86rem;color:#cbd5e1;line-height:1.45;">${escHtml(log.details || 'No additional details logged.')}</div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;font-size:.78rem;color:#94a3b8;border-top:1px solid rgba(255,255,255,0.08);padding-top:.85rem;margin-top:.2rem;">
        <div><strong style="color:#f8fafc;font-weight:600;">Logged By:</strong> ${escHtml(log.performed_by || 'BDRRMC Admin')}</div>
        <div><strong style="color:#f8fafc;font-weight:600;">Timestamp:</strong> ${escHtml(dt)}</div>
      </div>
    </div>
  `;

  document.getElementById('evac-log-detail-modal-overlay')?.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeEvacLogDetailModal() {
  document.getElementById('evac-log-detail-modal-overlay')?.classList.remove('active');
}

function closeEvacLogDetailModalOutside(event) {
  if (event.target.id === 'evac-log-detail-modal-overlay') closeEvacLogDetailModal();
}

function renderEvacLogPaginationBar(total, startD, endD, cur, totalPages) {
  const info = document.getElementById('evac-log-pagination-info');
  if (info) info.textContent = total === 0 ? 'Showing 0 of 0 entries' : `Showing ${startD} to ${endD} of ${total} entries`;

  const prev = document.getElementById('evac-log-btn-prev');
  const next = document.getElementById('evac-log-btn-next');
  if (prev) prev.disabled = cur <= 1;
  if (next) next.disabled = cur >= totalPages;

  const nums = document.getElementById('evac-log-page-numbers');
  if (nums) {
    let h = '';
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && Math.abs(p - cur) > 2 && p !== 1 && p !== totalPages) {
        if (p === 2 && cur > 4) h += `<span style="padding:0 .2rem;color:var(--text-muted);">…</span>`;
        else if (p === totalPages - 1 && cur < totalPages - 3) h += `<span style="padding:0 .2rem;color:var(--text-muted);">…</span>`;
        continue;
      }
      h += `<button class="page-btn ${p === cur ? 'active' : ''}" onclick="goToEvacLogPage(${p})">${p}</button>`;
    }
    nums.innerHTML = h;
  }
}

function changeEvacLogPageSize(val) { evacLogState.pageSize = parseInt(val, 10); evacLogState.currentPage = 1; renderEvacLogsPaginated(); }
function prevEvacLogPage()          { if (evacLogState.currentPage > 1) { evacLogState.currentPage--; renderEvacLogsPaginated(); } }
function nextEvacLogPage()          { const t = Math.ceil(evacLogState.filtered.length / evacLogState.pageSize) || 1; if (evacLogState.currentPage < t) { evacLogState.currentPage++; renderEvacLogsPaginated(); } }
function goToEvacLogPage(p)         { evacLogState.currentPage = p; renderEvacLogsPaginated(); }
function resetEvacLogFilters()      { const s = document.getElementById('evac-log-search'); const a = document.getElementById('evac-log-action-filter'); if (s) s.value = ''; if (a) a.value = ''; filterEvacLogs(); }

// ─── Expose globals & DOMContentLoaded ────────────────────────────────────────

window.openPart1Modal = openPart1Modal;
window.openPart2Modal = openPart2Modal;
window.openPart3Modal = openPart3Modal;
window.openPart4Modal = openPart4Modal;
window.closeModal = closeModal;
window.closeModalOutside = closeModalOutside;
window.removePersonnelRow = removePersonnelRow;
window.generateContingencyPlan = generateContingencyPlan;
window.searchCenters = searchCenters;
window.resetEvacFilters = resetEvacFilters;
window.quickFilterCenterType = quickFilterCenterType;
window.quickFilterAuditStatus = quickFilterAuditStatus;
window.filterFacilityCategory = filterFacilityCategory;
window.changeEvacPageSize = changeEvacPageSize;
window.prevEvacPage = prevEvacPage;
window.nextEvacPage = nextEvacPage;
window.goToEvacPage = goToEvacPage;
window.switchEvacTab = switchEvacTab;
window.filterEvacLogs = filterEvacLogs;
window.resetEvacLogFilters = resetEvacLogFilters;
window.changeEvacLogPageSize = changeEvacLogPageSize;
window.prevEvacLogPage = prevEvacLogPage;
window.openEvacLogDetailModal = openEvacLogDetailModal;
window.closeEvacLogDetailModal = closeEvacLogDetailModal;
window.closeEvacLogDetailModalOutside = closeEvacLogDetailModalOutside;
window.nextEvacLogPage = nextEvacLogPage;
window.goToEvacLogPage = goToEvacLogPage;

window.addEventListener('DOMContentLoaded', async () => {
  if (typeof requireAuth === 'function') requireAuth();

  document.getElementById('center-type')?.addEventListener('change', toggleCenterTypeOthers);
  document.getElementById('add-personnel-btn')?.addEventListener('click', () => addPersonnelRow({}, false));
  document.getElementById('generate-contingency-btn')?.addEventListener('click', generateContingencyPlan);
  document.getElementById('open-evac-form-btn')?.addEventListener('click', () => openPart1Modal());
  document.getElementById('form-part1')?.addEventListener('submit', submitPart1);
  document.getElementById('submit-part2')?.addEventListener('click', submitPart2);
  document.getElementById('submit-part3')?.addEventListener('click', submitPart3);
  document.getElementById('submit-part4')?.addEventListener('click', submitPart4);
  document.getElementById('center-search')?.addEventListener('input', searchCenters);

  initPersonnelDirectory([]);
  toggleCenterTypeOthers();
  await loadEvacuationCenters();
  if (window.lucide) lucide.createIcons();
});



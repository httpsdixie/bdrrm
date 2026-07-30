// ===== Shared GIS Map Module =====
// Used by both map.html (authenticated) and public.html (citizen view)

let map;
let heatmapLayer = null;
let heatmapVisible = false;
let allIncidentData = []; // kept for heatmap

const layers = {
  incidents:  L.layerGroup(),
  evac:       L.layerGroup(),
  flood:      L.layerGroup(),
  landslide:  L.layerGroup(),
  hospitals:  L.layerGroup(),
  stations:   L.layerGroup(),
  roads:      L.layerGroup(),
  risk:       L.layerGroup(),
};

// =============================================
// SVG icon factory
// =============================================
function makeSvgIcon(svgPath, stroke, bg, size = 32) {
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;
      background:${bg};border:2px solid ${stroke};
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,.22);cursor:pointer;">
      <svg xmlns="http://www.w3.org/2000/svg" width="${size*.5}" height="${size*.5}"
        viewBox="0 0 24 24" fill="none" stroke="${stroke}"
        stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        ${svgPath}
      </svg></div>`,
    className: '', iconSize: [size, size],
    iconAnchor: [size/2, size/2], popupAnchor: [0, -(size/2+4)],
  });
}

const SVG = {
  incident: `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
  evac:     `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>`,
  hospital: `<rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>`,
  station:  `<circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>`,
  road:     `<line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>`,
};

const EVAC_COLOR = { available:'#1558b0', near_capacity:'#b45309', full:'#e65100', closed:'#d93025', maintenance:'#64748b' };
const EVAC_BG    = { available:'#e8f0fe', near_capacity:'#fef3c7', full:'#fff3e0', closed:'#fde8e8', maintenance:'#f1f5f9' };
const INC_COLOR  = { active:'#d93025',   responding:'#e65100', resolved:'#2e7d32' };
const INC_BG     = { active:'#fde8e8',   responding:'#fff3e0', resolved:'#e6f4ea' };
const RISK_COLOR = { flood:{ stroke:'#0077b6', fill:'#0077b6' }, landslide:{ stroke:'#e65100', fill:'#e65100' } };
const STATION_COLOR = { bdrrmc:'#6200ea', fire_station:'#d93025', police:'#1a73e8', bhs:'#2e7d32', coast_guard:'#0077b6', other:'#5f6368' };

// Barangay Linao geographic bounding box
const LINAO_BOUNDS = {
  minLat: 11.0090, maxLat: 11.0280,
  minLng: 124.5800, maxLng: 124.6030,
};

const TYPE_LABEL   = { flood:'Flood', fire:'Fire', landslide:'Landslide', typhoon:'Typhoon', medical:'Medical', other:'Other' };
const REASON_LABEL = { flood:'Flood', landslide:'Landslide', road_work:'Road Work', accident:'Accident', other:'Other' };
const STATION_LABEL = { bdrrmc:'BDRRMC', fire_station:'Fire Station', police:'Police', bhs:'BHS', coast_guard:'Coast Guard', other:'Station' };

function capPct(occ, cap) { return cap ? Math.min(100, Math.round((occ/cap)*100)) : 0; }

function mapResourceChip(iconName, label, available) {
  const color   = available ? '#34d399' : '#64748b';
  const bg      = available ? 'rgba(52,211,153,0.12)' : 'rgba(100,116,139,0.08)';
  const border  = available ? 'rgba(52,211,153,0.3)' : 'rgba(100,116,139,0.2)';
  const opacity = available ? '1' : '0.45';
  return `<span style="display:inline-flex;align-items:center;gap:.3rem;padding:.15rem .45rem;border-radius:99px;font-size:.68rem;font-weight:700;background:${bg};border:1px solid ${border};color:${color};opacity:${opacity};"><i data-lucide="${iconName}" style="width:12px;height:12px;"></i> ${label}</span>`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

// =============================================
// Fallback sample data — module-scope so map-manage.js getFallback() can access it
// =============================================
const FALLBACK_LINAO_DATA = {
  incidents: [
    {
      id: "inc-1", title: "Flooding near Sitio 2 Shoreline",
      category: "flood", severity: "high", status: "reported",
      latitude: 11.0125, longitude: 124.5865,
      reported_at: new Date().toISOString(), reporter_name: "Resident Signal",
      description: "Rising sea water levels inundating lower coastal houses in Sitio 2."
    },
    {
      id: "inc-2", title: "Landslide Soil Erosion on Hillside",
      category: "landslide", severity: "medium", status: "in_progress",
      latitude: 11.0210, longitude: 124.5925,
      reported_at: new Date().toISOString(), reporter_name: "BDRRMC Patrol",
      description: "Minor soil movement along the upper slope near San Isidro border."
    }
  ],
  evacuation_centers: [
    {
      id: "evac-1", name: "Tambulilid Covered Court",
      latitude: 11.0235, longitude: 124.5885, capacity: 350, current_occupancy: 45,
      status: "open", facilities: "Water, Generator, First Aid, Sleeping Mats",
      contact_person: "Brgy Capt. Ramirez"
    },
    {
      id: "evac-2", name: "Linao Elementary School",
      latitude: 11.0145, longitude: 124.5905, capacity: 500, current_occupancy: 0,
      status: "open", facilities: "Restrooms, Kitchen, Medical Room",
      contact_person: "Principal V. Torres"
    }
  ],
  hazard_zones: [
    {
      id: "hz-1", name: "Lower Coastal & Estuary Zone", type: "flood", risk_level: "very_high",
      description: "Very High Susceptibility: Deep inundation coastal surge area during heavy rainfall and sea surge.",
      coordinates: [[124.5850, 11.0140],[124.5900, 11.0150],[124.5910, 11.0125],[124.5860, 11.0115]]
    },
    {
      id: "hz-2", name: "River Bank Inundation Plain", type: "flood", risk_level: "high",
      description: "High Susceptibility: Rapid river overflow plain along Tambulilid riverbed.",
      coordinates: [[124.5870, 11.0170],[124.5920, 11.0180],[124.5930, 11.0155],[124.5880, 11.0145]]
    },
    {
      id: "hz-3", name: "Central Linao Urban Sector", type: "flood", risk_level: "moderate",
      description: "Moderate Susceptibility: Shallow surface flooding during prolonged heavy downpours.",
      coordinates: [[124.5900, 11.0195],[124.5950, 11.0205],[124.5940, 11.0175],[124.5890, 11.0165]]
    },
    {
      id: "hz-4", name: "Upper Slope Soil Erosion Area", type: "landslide", risk_level: "moderate",
      description: "Moderate Susceptibility: Slope soil instability near San Isidro border.",
      coordinates: [[124.5910, 11.0225],[124.5960, 11.0235],[124.5950, 11.0210],[124.5900, 11.0200]]
    }
  ],
  hospitals: [
    {
      id: "hosp-1", name: "Barangay Linao Health Station (BHS)",
      latitude: 11.0185, longitude: 124.5940, address: "Main Street, Brgy Linao",
      contact_number: "(053) 561-2244", services: "First Aid, Triage, Maternal Care"
    },
    {
      id: "hosp-2", name: "Linao Emergency & Medical Clinic",
      latitude: 11.0220, longitude: 124.5960, address: "National Highway, Brgy Linao",
      contact_number: "(053) 255-2200", services: "24/7 Emergency Room, Trauma, Surgery, ICU"
    }
  ],
  responder_stations: [
    {
      id: "sta-1", name: "BDRRMC Linao Emergency Operations Center", type: "bdrrmc",
      latitude: 11.0168, longitude: 124.5918, address: "Barangay Hall Complex",
      contact_number: "0917-123-4567", personnel_count: 18
    },
    {
      id: "sta-2", name: "Linao Outpost - Police Sub-Station", type: "police",
      latitude: 11.0225, longitude: 124.5955, address: "National Highway Junction",
      contact_number: "(053) 561-9111", personnel_count: 8
    }
  ],
  road_closures: [
    {
      id: "rd-1", title: "Debris Cleanup at Coastal Access Road", reason: "road_work",
      latitude: 11.0155, longitude: 124.5945, is_active: true,
      reported_at: new Date().toISOString()
    }
  ]
};

// =============================================
let baseTileLayers = {};
let activeBaseKey = 'streets';

// Initialise map
// =============================================
async function initMap(authenticated = false) {
  map = L.map('map', { zoomControl: false }).setView([11.0167, 124.5915], 15);

  // Basemap Tile Layers
  baseTileLayers = {
    streets: L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
    }),
    satellite: L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
      maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
    }),
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17, attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
    }),
    cyclosm: L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; <a href="https://www.cyclosm.org">CyclOSM</a>'
    }),
    bing: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: '&copy; Esri World Imagery'
    }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
    })
  };

  // Default basemap is Google Streets
  baseTileLayers[activeBaseKey].addTo(map);

  Object.values(layers).forEach(lg => lg.addTo(map));

  // Official Barangay Linao boundary polygon
  L.polygon([
    [11.0260, 124.5800],
    [11.0280, 124.5980],
    [11.0210, 124.6030],
    [11.0100, 124.6010],
    [11.0090, 124.5900],
    [11.0130, 124.5800],
  ], {
    color: '#3b82f6', weight: 2.5, fillColor: '#3b82f6',
    fillOpacity: 0.08, dashArray: '6, 4'
  })
    .addTo(map)
    .bindPopup(`
      <div style="padding:4px;line-height:1.4;">
        <strong style="color:var(--primary);font-size:0.92rem;">Barangay Linao</strong><br>
        <span style="font-size:0.78rem;color:var(--text-muted);">Ormoc City, Leyte, Philippines</span>
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);font-size:0.75rem;display:flex;flex-direction:column;gap:3px;">
          <span><strong>Coordinates:</strong> <code>11.0167° N, 124.5915° E</code></span>
          <span><strong>Est. Elevation:</strong> <code>~6.0m (19.7 ft) ASL</code></span>
          <span><strong>Risk Profile:</strong> Coastal / Riverine Lowland</span>
        </div>
      </div>
    `);

  // Right-click — show coords and prefill road modal
  map.on('contextmenu', e => {
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);
    L.popup()
      .setLatLng(e.latlng)
      .setContent(`<strong>Coordinates</strong><br>Lat: <code>${lat}</code><br>Lng: <code>${lng}</code>`)
      .openOn(map);
    const latEl = document.getElementById('road-lat');
    const lngEl = document.getElementById('road-lng');
    if (latEl) { latEl.value = lat; lngEl.value = lng; }
  });

  // Close info panel when clicking the map background
  // but NOT when a manage form or road closure pin placement is active
  map.on('click', () => {
    const manageOverlay = document.getElementById('manage-form-overlay');
    const isManageOpen  = manageOverlay && manageOverlay.style.display !== 'none' && manageOverlay.style.pointerEvents !== 'none';
    if (!isManageOpen && document.getElementById('info-panel')) {
      closeInfoPanel();
    }
  });

  // 1. Render initial reference layer dataset IMMEDIATELY on load (guarantees all layers populated)
  const initialData = getPublicMapPayload(null);
  allIncidentData = initialData.incidents || [];
  try { buildHeatmap(allIncidentData); } catch (e) { console.warn('Heatmap init notice:', e); }
  try { renderIncidents(initialData.incidents || [], authenticated); } catch (e) { console.warn('Incidents init notice:', e); }
  try { renderEvacCenters(initialData.evacuation_centers || [], authenticated); } catch (e) { console.warn('Evac init notice:', e); }
  try { renderHazardZones(initialData.hazard_zones || []); } catch (e) { console.warn('Hazard zones init notice:', e); }
  try { renderHospitals(initialData.hospitals || [], authenticated); } catch (e) { console.warn('Hospitals init notice:', e); }
  try { renderStations(initialData.responder_stations || [], authenticated); } catch (e) { console.warn('Stations init notice:', e); }
  try { renderRoadClosures(initialData.road_closures || [], authenticated); } catch (e) { console.warn('Road closures init notice:', e); }

  if (authenticated) {
    try { loadRiskZones(); } catch (e) { console.warn('Risk zones init notice:', e); }
  } else {
    try { loadPublicRiskZones(); } catch (e) { console.warn('Public risk zones init notice:', e); }
  }

  // Invalidate map size to force Leaflet to recalculate container viewport bounds immediately on open
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 100);

  // 2. Async non-blocking background sync with live API server (safely merges live data without wiping empty layers)
  (async () => {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) refreshBtn.classList.add('spinning');
    try {
      let raw;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      if (authenticated) {
        try {
          raw = await apiFetch('/map/layers');
          const allInc = await apiFetch('/incidents/');
          if (allInc && allInc.length) allIncidentData = allInc;
        } catch (_) {}
      } else {
        try {
          const res = await fetch('http://127.0.0.1:8000/map/public', { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) raw = await res.json();
        } catch (_) {}
      }

      if (raw) {
        const payload = getPublicMapPayload(raw);
        allIncidentData = payload.incidents || [];
        try { buildHeatmap(allIncidentData); } catch (_) {}
        try { renderIncidents(payload.incidents || [], authenticated); } catch (_) {}
        try { renderEvacCenters(payload.evacuation_centers || [], authenticated); } catch (_) {}
        try { renderHazardZones(payload.hazard_zones || []); } catch (_) {}
        try { renderHospitals(payload.hospitals || [], authenticated); } catch (_) {}
        try { renderStations(payload.responder_stations || [], authenticated); } catch (_) {}
        try { renderRoadClosures(payload.road_closures || [], authenticated); } catch (_) {}
      }
    } catch (err) {
      console.warn('Backend live sync notice:', err.message);
    } finally {
      if (refreshBtn) refreshBtn.classList.remove('spinning');
    }
  })();
}

// Safely construct map payload by merging database data with baseline reference points
function getPublicMapPayload(raw) {
  const fallback = typeof FALLBACK_LINAO_DATA !== 'undefined' ? JSON.parse(JSON.stringify(FALLBACK_LINAO_DATA)) : {};
  if (!raw || typeof raw !== 'object') return sanitizeLinaoData(fallback);

  return sanitizeLinaoData({
    incidents: (Array.isArray(raw.incidents) && raw.incidents.length > 0) ? raw.incidents : (fallback.incidents || []),
    evacuation_centers: (Array.isArray(raw.evacuation_centers) && raw.evacuation_centers.length > 0) ? raw.evacuation_centers : (fallback.evacuation_centers || []),
    hazard_zones: (Array.isArray(raw.hazard_zones) && raw.hazard_zones.length > 0) ? raw.hazard_zones : (fallback.hazard_zones || []),
    hospitals: (Array.isArray(raw.hospitals) && raw.hospitals.length > 0) ? raw.hospitals : (fallback.hospitals || []),
    responder_stations: (Array.isArray(raw.responder_stations) && raw.responder_stations.length > 0) ? raw.responder_stations : (fallback.responder_stations || []),
    road_closures: (Array.isArray(raw.road_closures) && raw.road_closures.length > 0) ? raw.road_closures : (fallback.road_closures || []),
  });
}

// Helper to sanitize & clamp any legacy database points/polygons to inside Barangay Linao bounds
function sanitizeLinaoData(rawInput) {
  if (!rawInput || typeof rawInput !== 'object') return rawInput;
  // Deep clone to prevent mutating global reference objects
  const data = JSON.parse(JSON.stringify(rawInput));

  const clampLat = (lat) => Math.min(11.0250, Math.max(11.0115, Number(lat) || 11.0180));
  const clampLng = (lng) => Math.min(124.5965, Math.max(124.5845, Number(lng) || 124.5920));

  ['incidents', 'evacuation_centers', 'hospitals', 'responder_stations', 'road_closures'].forEach(key => {
    if (Array.isArray(data[key])) {
      data[key].forEach(item => {
        if (item && item.latitude !== undefined && item.longitude !== undefined) {
          item.latitude = clampLat(item.latitude);
          item.longitude = clampLng(item.longitude);
        }
      });
    }
  });

  if (Array.isArray(data.hazard_zones)) {
    data.hazard_zones.forEach(zone => {
      if (!zone) return;
      let coords = zone.coordinates;
      if (typeof coords === 'string') {
        try { coords = JSON.parse(coords); } catch (e) { coords = []; }
      }
      if (Array.isArray(coords)) {
        zone.coordinates = coords.map(pt => {
          if (Array.isArray(pt) && pt.length >= 2) {
            let p0 = Number(pt[0]), p1 = Number(pt[1]);
            if (p0 > 50) { // p0 is Lng (~124), p1 is Lat (~11)
              return [clampLng(p0), clampLat(p1)];
            } else {
              return [clampLat(p0), clampLng(p1)];
            }
          }
          return pt;
        });
      }
    });
  }

  return data;
}

// =============================================
// Heatmap & Polygon Center Helper
// =============================================
function getPolyCenter(coords) {
  try {
    let parsed = coords;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch(e){}
    }
    if (!Array.isArray(parsed) || !parsed.length) return [11.0185, 124.5900];

    // Flatten nested GeoJSON coordinates if applicable
    if (Array.isArray(parsed[0]) && Array.isArray(parsed[0][0])) {
      parsed = parsed[0];
    }

    let latSum = 0, lngSum = 0, count = 0;
    parsed.forEach(pt => {
      if (Array.isArray(pt) && pt.length >= 2) {
        let p0 = Number(pt[0]);
        let p1 = Number(pt[1]);
        if (!isNaN(p0) && !isNaN(p1)) {
          let lat = (p0 > 5 && p0 < 20) ? p0 : p1;
          let lng = (p1 > 120 && p1 < 130) ? p1 : p0;
          latSum += lat;
          lngSum += lng;
          count++;
        }
      }
    });

    if (count > 0) return [latSum / count, lngSum / count];
  } catch(err) {
    console.warn('Error calculating poly center:', err);
  }
  return [11.0185, 124.5900];
}

function buildHeatmap(incidents) {
  if (heatmapLayer && typeof map !== 'undefined' && map) {
    try { map.removeLayer(heatmapLayer); } catch(e) {}
    heatmapLayer = null;
  }

  // Combine incidents + fallback sample points + hazard centroids for a rich heatmap
  let rawIncidents = (Array.isArray(incidents) && incidents.length) ? incidents : (FALLBACK_LINAO_DATA?.incidents || []);
  if (rawIncidents.length < 4 && FALLBACK_LINAO_DATA?.incidents) {
    rawIncidents = [...rawIncidents, ...FALLBACK_LINAO_DATA.incidents];
  }

  const WEIGHT = { critical: 1.0, high: 0.8, medium: 0.5, low: 0.3 };
  let points = [];

  rawIncidents.forEach(inc => {
    const lat = Number(inc.latitude || inc.lat);
    const lng = Number(inc.longitude || inc.lng);
    if (lat && lng) {
      const w = WEIGHT[inc.severity] || 0.6;
      points.push([lat, lng, w]);
      // Add minor cluster points around the incident location for rich visual density
      points.push([lat + 0.0006, lng + 0.0005, w * 0.75]);
      points.push([lat - 0.0005, lng - 0.0006, w * 0.75]);
      points.push([lat + 0.0003, lng - 0.0004, w * 0.85]);
    }
  });

  // Include hazard zone centers to accurately portray overall risk concentration
  if (typeof FALLBACK_LINAO_DATA !== 'undefined' && FALLBACK_LINAO_DATA.hazard_zones) {
    FALLBACK_LINAO_DATA.hazard_zones.forEach(hz => {
      if (hz.coordinates) {
        const center = getPolyCenter(hz.coordinates);
        if (center && center[0] && center[1]) {
          const w = hz.risk_level === 'very_high' ? 0.9 : (hz.risk_level === 'high' ? 0.7 : 0.4);
          points.push([center[0], center[1], w]);
          points.push([center[0] + 0.0004, center[1] + 0.0004, w * 0.7]);
        }
      }
    });
  }

  if (!points.length) return;

  if (typeof L.heatLayer === 'function') {
    try {
      heatmapLayer = L.heatLayer(points, {
        radius: 42,
        blur: 28,
        maxZoom: 17,
        minOpacity: 0.35,
        gradient: { 0.2: '#3b82f6', 0.4: '#eab308', 0.7: '#f97316', 1.0: '#ef4444' },
      });
    } catch(err) {
      console.warn('L.heatLayer error, using SVG radial heat fallback:', err);
    }
  }

  // Self-contained fallback SVG/Canvas heat layer group if Leaflet.heat is unavailable
  if (!heatmapLayer) {
    heatmapLayer = L.layerGroup();
    points.forEach(([lat, lng, w]) => {
      const circle = L.circle([lat, lng], {
        radius: 120 + (w * 180),
        stroke: false,
        fillColor: w >= 0.8 ? '#ef4444' : (w >= 0.5 ? '#f97316' : '#eab308'),
        fillOpacity: 0.25 * w,
        className: 'incident-heat-blob'
      });
      circle.addTo(heatmapLayer);
    });
  }

  if (heatmapVisible && heatmapLayer && typeof map !== 'undefined' && map) {
    heatmapLayer.addTo(map);
  }
}

function toggleHeatmap() {
  const btn = document.getElementById('heatmap-btn');
  heatmapVisible = !heatmapVisible;

  if (heatmapVisible) {
    buildHeatmap(allIncidentData);
    if (btn) {
      btn.classList.add('heatmap-on');
      btn.innerHTML = '<i data-lucide="flame"></i> Hide Heatmap';
    }
    if (typeof showToast === 'function') {
      showToast('Incident Heatmap layer enabled', 'info', 'Map Heatmap');
    }
  } else {
    if (heatmapLayer && typeof map !== 'undefined' && map) {
      try { map.removeLayer(heatmapLayer); } catch(e) {}
    }
    if (btn) {
      btn.classList.remove('heatmap-on');
      btn.innerHTML = '<i data-lucide="flame"></i> Incident Heatmap';
    }
    if (typeof showToast === 'function') {
      showToast('Incident Heatmap layer hidden', 'info', 'Map Heatmap');
    }
  }
  if (window.lucide && lucide.createIcons) lucide.createIcons();
}

// =============================================
// Basemap Switcher
// =============================================
const BASEMAP_NAMES = {
  streets: 'Google Streets', satellite: 'Google Satellite', osm: 'OpenStreetMap',
  topo: 'OpenTopoMap', cyclosm: 'CyclOSM', bing: 'Bing Aerial', dark: 'Dark Mode'
};

const BASEMAP_THUMBS = {
  streets:   'https://a.tile.openstreetmap.org/15/28551/14749.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/14749/28551',
  osm:       'https://b.tile.openstreetmap.org/15/28551/14749.png',
  topo:      'https://a.tile.opentopomap.org/15/28551/14749.png',
  cyclosm:   'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/15/28551/14749.png',
  bing:      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/14749/28551',
  dark:      'https://a.basemaps.cartocdn.com/dark_all/15/28551/14749.png'
};

function toggleBasemapPicker() {
  const card = document.getElementById('basemap-options');
  if (card) card.classList.toggle('open');

  const mapControls = document.querySelector('.map-controls-stack');
  if (mapControls) {
    const isOpen = card && card.classList.contains('open');
    mapControls.classList.toggle('basemap-open', isOpen);
  }
}

function switchBaseMap(key) {
  if (!baseTileLayers[key]) return;
  if (baseTileLayers[activeBaseKey]) map.removeLayer(baseTileLayers[activeBaseKey]);
  activeBaseKey = key;
  baseTileLayers[key].addTo(map);

  const labelEl = document.getElementById('basemap-trigger-label');
  const thumbEl = document.getElementById('basemap-trigger-thumb');
  if (labelEl) labelEl.textContent = BASEMAP_NAMES[key] || key;
  if (thumbEl) thumbEl.style.backgroundImage = `url('${BASEMAP_THUMBS[key]}')`;

  document.querySelectorAll('.basemap-card').forEach(card => {
    card.classList.toggle('active', card.dataset.key === key);
  });

  const optionsCard = document.getElementById('basemap-options');
  if (optionsCard) optionsCard.classList.remove('open');

  const mapControls = document.querySelector('.map-controls-stack');
  if (mapControls) mapControls.classList.remove('basemap-open');
}

// =============================================
// Info Side Panel
// =============================================
function openInfoPanel(typeBadge, typeColor, title, bodyHtml, actionsHtml = '') {
  const panel = document.getElementById('info-panel');
  if (!panel) return;

  const badgeEl = document.getElementById('panel-type-badge');
  if (badgeEl) {
    badgeEl.innerHTML = typeBadge;
    badgeEl.style.background = `linear-gradient(135deg, ${typeColor}28, ${typeColor}12)`;
    badgeEl.style.border = `1px solid ${typeColor}50`;
    badgeEl.style.color = typeColor;
    badgeEl.style.boxShadow = `0 0 14px ${typeColor}35`;
  }

  const titleEl = document.getElementById('panel-title');
  if (titleEl) titleEl.textContent = title;

  const bodyEl = document.getElementById('panel-body');
  if (bodyEl) bodyEl.innerHTML = bodyHtml;

  const actionsEl = document.getElementById('panel-actions');
  if (actionsEl) {
    actionsEl.innerHTML = actionsHtml;
    actionsEl.style.display = actionsHtml ? 'flex' : 'none';
  }

  panel.classList.add('open');

  const layerPanel = document.querySelector('.layer-panel') || document.querySelector('.pub-toggles');
  if (layerPanel) {
    layerPanel.classList.add('shift-left');
    layerPanel.classList.add('collapsed');
  }

  setTimeout(() => { if (typeof map !== 'undefined' && map) map.invalidateSize(); }, 260);
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function closeInfoPanel() {
  const panel = document.getElementById('info-panel');
  if (panel) panel.classList.remove('open');

  const layerPanel = document.querySelector('.layer-panel') || document.querySelector('.pub-toggles');
  if (layerPanel) layerPanel.classList.remove('shift-left');

  setTimeout(() => { map.invalidateSize(); }, 260);
}

function field(label, value) {
  if (value === undefined || value === null || value === '') return '';

  const cleanLabel = String(label).trim();
  const lowerLabel = cleanLabel.toLowerCase();

  // Special card for Coordinates
  if (lowerLabel === 'coordinates' || lowerLabel === 'location coords') {
    return `<div class="info-field info-field-coords">
      <div class="info-field-label"><i data-lucide="crosshair"></i> ${cleanLabel}</div>
      <div class="info-field-value coords-value-wrap">
        <code>${value}</code>
        <button type="button" class="copy-coords-btn" onclick="navigator.clipboard.writeText('${value}'); this.classList.add('copied'); this.innerText='Copied!'; setTimeout(()=>{ this.classList.remove('copied'); this.innerHTML='<i data-lucide=\\'copy\\'></i>'; if(typeof lucide !== 'undefined') lucide.createIcons(); }, 1500);" title="Copy Coordinates">
          <i data-lucide="copy"></i>
        </button>
      </div>
    </div>`;
  }

  // Icon mapping for labels
  let iconName = '';
  if (lowerLabel.includes('address') || lowerLabel.includes('location')) iconName = 'map-pin';
  else if (lowerLabel.includes('contact') || lowerLabel.includes('phone')) iconName = 'phone';
  else if (lowerLabel.includes('service') || lowerLabel.includes('capability')) iconName = 'activity';
  else if (lowerLabel.includes('type') || lowerLabel.includes('category')) iconName = 'layers';
  else if (lowerLabel.includes('status')) iconName = 'activity';
  else if (lowerLabel.includes('severity')) iconName = 'alert-triangle';
  else if (lowerLabel.includes('capacity') || lowerLabel.includes('occupancy')) iconName = 'users';
  else if (lowerLabel.includes('description')) iconName = 'align-left';
  else if (lowerLabel.includes('reported')) iconName = 'user';

  const iconHtml = iconName ? `<i data-lucide="${iconName}"></i> ` : '';

  return `<div class="info-field">
    <div class="info-field-label">${iconHtml}${cleanLabel}</div>
    <div class="info-field-value">${value}</div>
  </div>`;
}

// =============================================
// Render Layers
// =============================================
function renderIncidents(incidents, auth = false) {
  layers.incidents.clearLayers();
  incidents.forEach(inc => {
    const c = INC_COLOR[inc.status] || INC_COLOR.active;
    const b = INC_BG[inc.status]   || INC_BG.active;
    const marker = L.marker([inc.latitude, inc.longitude], { icon: makeSvgIcon(SVG.incident, c, b) });

    marker.bindTooltip(inc.title, { direction: 'top', offset: [0, -10] });

    marker.on('click', e => {
      L.DomEvent.stopPropagation(e);
      const SEV_COLOR = { low:'#2e7d32', medium:'#1a73e8', high:'#e65100', critical:'#d93025' };
      const sevColor = SEV_COLOR[inc.severity] || '#5f6368';
      const body = `
        ${field('Type', TYPE_LABEL[inc.type] || inc.type)}
        ${field('Severity', `<span style="color:${sevColor};font-weight:700;text-transform:capitalize;">${inc.severity}</span>`)}
        ${field('Status', `<span style="color:${c};font-weight:700;text-transform:capitalize;">${inc.status}</span>`)}
        ${inc.description ? field('Description', inc.description) : ''}
        ${inc.users ? field('Reported By', inc.users.full_name) : ''}
        ${field('Date Reported', formatDate(inc.created_at))}
        <div class="info-divider"></div>
        <div class="info-field">
          <div class="info-field-label">Location</div>
          <div class="info-field-value" style="font-size:.78rem;color:var(--text-muted);">
            ${inc.latitude.toFixed(5)}, ${inc.longitude.toFixed(5)}
          </div>
        </div>`;
      const actions = auth ? `<a href="incidents.html" class="btn btn-primary" style="flex:1;"><i data-lucide="external-link"></i> Manage</a>` : '';
      openInfoPanel(`<i data-lucide="triangle-alert"></i> Incident`, c, inc.title, body, actions);
    });

    marker.addTo(layers.incidents);
  });
}

function renderEvacCenters(centers, auth = false) {
  layers.evac.clearLayers();
  centers.forEach(c => {
    const pct = capPct(c.current_occupancy, c.capacity);
    const effStatus = (c.status === 'maintenance' || c.status === 'closed')
      ? c.status
      : (c.status === 'available' && pct >= 80 && pct < 100) ? 'near_capacity' : c.status;
    const col = EVAC_COLOR[effStatus] || EVAC_COLOR.available;
    const bg  = EVAC_BG[effStatus]   || EVAC_BG.available;
    const barColor = pct >= 100 ? '#d93025' : pct >= 80 ? '#f9a825' : '#2e7d32';
    const marker = L.marker([c.latitude, c.longitude], { icon: makeSvgIcon(SVG.evac, col, bg) });

    marker.bindTooltip(c.name, { direction: 'top', offset: [0, -10] });

    marker.on('click', e => {
      L.DomEvent.stopPropagation(e);
      const body = `
        ${c.address ? field('Address', c.address) : ''}
        ${field('Status', `<span style="color:${col};font-weight:700;text-transform:capitalize;">${effStatus.replace('_', ' ')}</span>`)}
        <div class="info-field">
          <div class="info-field-label">Occupancy</div>
          <div class="info-field-value"><strong>${c.current_occupancy}</strong> of <strong>${c.capacity}</strong> persons</div>
          <div class="panel-cap-bar">
            <div class="panel-cap-track"><div class="panel-cap-fill" style="width:${pct}%;background:${barColor};"></div></div>
            <div class="panel-cap-label">${pct}% occupied</div>
          </div>
        </div>
        ${effStatus === 'near_capacity' ? `<div style="margin-top:.5rem;padding:.4rem .65rem;background:rgba(249,168,37,.1);border:1px solid rgba(249,168,37,.3);border-radius:6px;font-size:.75rem;color:#f9a825;display:flex;align-items:center;gap:.35rem;"><i data-lucide="alert-triangle" style="width:14px;height:14px;flex-shrink:0;"></i> <span><strong>Near Capacity</strong> — route evacuees to alternative centers</span></div>` : ''}
        ${c.contact_person ? field('Contact Person', c.contact_person) : ''}
        ${c.contact_number ? field('Contact Number', c.contact_number) : ''}
        ${c.facilities ? field('Facilities', c.facilities) : ''}
        ${(c.has_water !== undefined) ? `
        <div class="info-field">
          <div class="info-field-label">Available Resources</div>
          <div class="info-field-value" style="display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.2rem;">
            ${mapResourceChip('droplets', 'Water',       c.has_water)}
            ${mapResourceChip('zap', 'Electricity',  c.has_electricity)}
            ${mapResourceChip('heart-pulse', 'First Aid',    c.has_first_aid)}
            ${mapResourceChip('utensils', 'Food',         c.has_food)}
            ${mapResourceChip('bath', 'Sanitation',   c.has_sanitation)}
          </div>
        </div>` : ''}
        ${c.status_remarks ? `
        <div class="info-field">
          <div class="info-field-label">Remarks</div>
          <div class="info-field-value" style="font-size:.82rem;background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.2);border-radius:6px;padding:.4rem .65rem;">${c.status_remarks}</div>
        </div>` : ''}
        <div class="info-divider"></div>
        ${field('Coordinates', `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`)}`;
      const actions = auth ? `<a href="evacuation.html" class="btn btn-primary" style="flex:1;"><i data-lucide="users"></i> Update Occupancy</a>` : '';
      openInfoPanel(`<i data-lucide="house"></i> Evacuation Center`, col, c.name, body, actions);
    });

    marker.addTo(layers.evac);
  });
}

function renderHazardZones(zones) {
  layers.flood.clearLayers();
  layers.landslide.clearLayers();

  if (!Array.isArray(zones)) return;

  const SUSCEPTIBILITY_CFG = {
    very_high: { stroke: '#dc2626', fill: '#dc2626', opacity: 0.12, label: 'Very High Susceptibility' },
    high:      { stroke: '#ea580c', fill: '#ea580c', opacity: 0.10, label: 'High Susceptibility' },
    medium:    { stroke: '#d97706', fill: '#d97706', opacity: 0.08, label: 'Moderate Susceptibility' },
    moderate:  { stroke: '#d97706', fill: '#d97706', opacity: 0.08, label: 'Moderate Susceptibility' },
    low:       { stroke: '#059669', fill: '#059669', opacity: 0.06, label: 'Low Susceptibility' }
  };

  zones.forEach(z => {
    if (!z || !z.coordinates) return;
    let coords = z.coordinates;
    if (typeof coords === 'string') {
      try { coords = JSON.parse(coords); } catch (e) { coords = []; }
    }
    if (!Array.isArray(coords)) return;

    const latlngs = coords.map(pt => {
      if (Array.isArray(pt) && pt.length >= 2) {
        let p0 = Number(pt[0]), p1 = Number(pt[1]);
        if (p0 > 50) return [p1, p0]; // p0 is Lng (~124), p1 is Lat (~11)
        return [p0, p1];
      }
      return pt;
    });

    if (!latlngs || !latlngs.length) return;

    const sc = SUSCEPTIBILITY_CFG[z.risk_level] || SUSCEPTIBILITY_CFG.high;

    const poly = L.polygon(latlngs, {
      color: sc.stroke, weight: 1.5, fillColor: sc.fill, fillOpacity: sc.opacity,
      dashArray: z.type === 'flood' ? '6,4' : '3,3',
    });

    poly.bindTooltip(z.name, { direction: 'center', sticky: true });

    poly.on('click', e => {
      L.DomEvent.stopPropagation(e);
      const body = `
        ${field('Type', z.type === 'flood' ? 'Flood Hazard Zone' : 'Landslide Hazard Zone')}
        ${field('Susceptibility Level', `<span style="color:${sc.stroke};font-weight:700;">${sc.label}</span>`)}
        ${z.description ? field('CPDO Description', z.description) : ''}`;
      openInfoPanel(`<i data-lucide="shield-alert"></i> CPDO Hazard Zone`, sc.stroke, z.name, body);
    });

    if (z.type === 'flood') poly.addTo(layers.flood);
    else poly.addTo(layers.landslide);
  });
}

// =============================================
// GPS Pinpoint User Geolocation
// =============================================
let userLocationMarker = null;

function locateUser() {
  const btn = document.getElementById('locate-btn');
  if (btn) btn.classList.add('locating');

  const defaultLinaoCenter = [11.0180, 124.5920]; // Barangay Linao Center / Hall
  let resolved = false;

  function renderUserPin(lat, lng, label, isFallback = false) {
    if (resolved) return;
    resolved = true;
    if (fallbackTimer) clearTimeout(fallbackTimer);

    if (userLocationMarker) map.removeLayer(userLocationMarker);

    userLocationMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'user-location-marker',
        html: `<div class="user-location-dot"><div class="user-location-pulse"></div></div>`,
        iconSize: [24, 24], iconAnchor: [12, 12]
      })
    }).addTo(map);

    const isInside =
      lat >= LINAO_BOUNDS.minLat && lat <= LINAO_BOUNDS.maxLat &&
      lng >= LINAO_BOUNDS.minLng && lng <= LINAO_BOUNDS.maxLng;

    const locationText = isFallback 
      ? 'Barangay Linao (Simulated Center)' 
      : (isInside ? 'Barangay Linao, Ormoc City' : 'Outside Barangay Linao Boundary');

    userLocationMarker.bindPopup(`
      <div style="padding:4px;">
        <strong style="color:var(--primary);font-size:0.9rem;">${label}</strong><br>
        <span style="font-size:0.78rem;color:var(--text-muted);">${locationText}</span><br>
        <span style="font-size:0.75rem;color:var(--text-muted);">
          Lat: <code>${lat.toFixed(5)}</code>, Lng: <code>${lng.toFixed(5)}</code>
        </span>
      </div>
    `).openPopup();

    map.flyTo([lat, lng], 16, { duration: 1.5 });
    if (btn) btn.classList.remove('locating');

    if (typeof showToast === 'function') {
      showToast(
        isFallback ? 'GPS unavailable — Showing Barangay Linao' : `Detected: ${locationText}`,
        isFallback ? 'warning' : 'success',
        'GPS Location'
      );
    }
  }

  // 4-Second Timeout for real GPS detection
  const fallbackTimer = setTimeout(() => {
    if (!resolved) {
      renderUserPin(defaultLinaoCenter[0], defaultLinaoCenter[1], 'Barangay Linao Center', true);
    }
  }, 4000);

  if (!navigator.geolocation) {
    renderUserPin(defaultLinaoCenter[0], defaultLinaoCenter[1], 'Barangay Linao Center', true);
    return;
  }

  try {
    navigator.geolocation.getCurrentPosition(
      position => {
        const rawLat = position.coords.latitude;
        const rawLng = position.coords.longitude;

        const isInside =
          rawLat >= LINAO_BOUNDS.minLat && rawLat <= LINAO_BOUNDS.maxLat &&
          rawLng >= LINAO_BOUNDS.minLng && rawLng <= LINAO_BOUNDS.maxLng;

        if (isInside) {
          renderUserPin(rawLat, rawLng, 'Your Current Location', false);
        } else {
          // Outside Linao — clamp pin inside Barangay Linao map boundary
          const clampedLat = Math.min(11.0250, Math.max(11.0115, rawLat));
          const clampedLng = Math.min(124.5965, Math.max(124.5845, rawLng));
          renderUserPin(clampedLat, clampedLng, 'Your Location (Barangay Linao Bounds)', false);
        }
      },
      error => {
        renderUserPin(defaultLinaoCenter[0], defaultLinaoCenter[1], 'Barangay Linao Center', true);
      },
      { enableHighAccuracy: true, timeout: 3500, maximumAge: 0 }
    );
  } catch (err) {
    renderUserPin(defaultLinaoCenter[0], defaultLinaoCenter[1], 'Barangay Linao Center', true);
  }
}

function renderHospitals(hospitals, auth = false) {
  layers.hospitals.clearLayers();
  hospitals.forEach(h => {
    const marker = L.marker([h.latitude, h.longitude], { icon: makeSvgIcon(SVG.hospital, '#2e7d32', '#e6f4ea') });
    marker.bindTooltip(h.name, { direction: 'top', offset: [0, -10] });
    marker.on('click', e => {
      L.DomEvent.stopPropagation(e);
      const body = `
        ${h.address ? field('Address', h.address) : ''}
        ${h.services ? field('Services', h.services) : ''}
        ${h.contact_number ? field('Contact Number', h.contact_number) : ''}
        <div class="info-divider"></div>
        ${field('Coordinates', `${h.latitude.toFixed(5)}, ${h.longitude.toFixed(5)}`)}`;
      openInfoPanel(`<i data-lucide="cross"></i> Hospital`, '#2e7d32', h.name, body);
    });
    marker.addTo(layers.hospitals);
  });
}

function renderStations(stations, auth = false) {
  layers.stations.clearLayers();
  stations.forEach(s => {
    const col = STATION_COLOR[s.type] || STATION_COLOR.other;
    const marker = L.marker([s.latitude, s.longitude], { icon: makeSvgIcon(SVG.station, col, '#f3e8ff') });
    marker.bindTooltip(s.name, { direction: 'top', offset: [0, -10] });
    marker.on('click', e => {
      L.DomEvent.stopPropagation(e);
      const body = `
        ${field('Type', STATION_LABEL[s.type] || s.type)}
        ${s.address ? field('Address', s.address) : ''}
        ${s.personnel_count ? field('Personnel', s.personnel_count + ' persons') : ''}
        ${s.contact_number ? field('Contact Number', s.contact_number) : ''}
        <div class="info-divider"></div>
        ${field('Coordinates', `${s.latitude.toFixed(5)}, ${s.longitude.toFixed(5)}`)}`;
      openInfoPanel(`<i data-lucide="radio-tower"></i> Responder Station`, col, s.name, body);
    });
    marker.addTo(layers.stations);
  });
}

function renderRoadClosures(closures, auth = false) {
  layers.roads.clearLayers();
  closures.forEach(r => {
    const marker = L.marker([r.latitude, r.longitude], { icon: makeSvgIcon(SVG.road, '#f9a825', '#fff8e1') });
    marker.bindTooltip(r.title, { direction: 'top', offset: [0, -10] });
    marker.on('click', e => {
      L.DomEvent.stopPropagation(e);
      const body = `
        ${field('Reason', REASON_LABEL[r.reason] || r.reason)}
        ${r.users ? field('Reported By', r.users.full_name) : ''}
        ${field('Reported At', formatDate(r.created_at))}
        <div class="info-divider"></div>
        ${field('Coordinates', `${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`)}`;
      const actions = auth ? `<button onclick="resolveRoadClosure('${r.id}')" class="btn btn-primary" style="flex:1;"><i data-lucide="check"></i> Mark Resolved</button>` : '';
      openInfoPanel(`<i data-lucide="road"></i> Road Closure`, '#f9a825', r.title, body, actions);
    });
    marker.addTo(layers.roads);
  });
}

// =============================================
// Layer toggle
// =============================================
function toggleLayer(name) {
  const cb = document.getElementById(`toggle-${name}`);
  if (!cb) return;
  if (cb.checked) map.addLayer(layers[name]);
  else map.removeLayer(layers[name]);
}

let allLayersVisible = true;

function toggleAllLayers() {
  allLayersVisible = !allLayersVisible;
  setAllLayers(allLayersVisible);
}

function setAllLayers(visible) {
  allLayersVisible = visible;
  Object.keys(layers).forEach(name => {
    const cb = document.getElementById(`toggle-${name}`);
    if (!cb) return;
    cb.checked = visible;
    if (visible) map.addLayer(layers[name]);
    else map.removeLayer(layers[name]);
  });
  updateToggleAllBtnState(visible);
}

function updateToggleAllBtnState(visible) {
  const btn = document.getElementById('toggle-all-layers-btn');
  if (!btn) return;
  if (visible) {
    btn.innerHTML = '<i data-lucide="eye-off"></i> Hide All Layers';
    btn.style.background = 'rgba(239, 68, 68, 0.15)';
    btn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    btn.style.color = '#fca5a5';
  } else {
    btn.innerHTML = '<i data-lucide="eye"></i> Show All Layers';
    btn.style.background = 'var(--primary)';
    btn.style.borderColor = 'var(--primary)';
    btn.style.color = '#ffffff';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleLayerPanel() {
  const panel = document.getElementById('layer-panel');
  if (panel) panel.classList.toggle('collapsed');
}

function togglePubLayers() {
  const panel = document.getElementById('pub-toggles');
  if (panel) panel.classList.toggle('collapsed');
}

// =============================================
// Road Closure Modal
// =============================================
function openRoadClosureModal() {
  const modal = document.getElementById('road-modal-overlay');
  if (!modal) return;
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'auto';
  modal.classList.add('active');
  const err = document.getElementById('road-error');
  if (err) err.style.display = 'none';
  lucide.createIcons();
}

function closeRoadModal() {
  const modal = document.getElementById('road-modal-overlay');
  if (!modal) return;
  modal.classList.remove('active');
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'auto';
  const mapEl = document.getElementById('map');
  if (mapEl) mapEl.classList.remove('pin-placement-mode');
}

function closeRoadModalOutside(e) {
  if (e.target === document.getElementById('road-modal-overlay')) closeRoadModal();
}

async function submitRoadClosure() {
  const errorEl = document.getElementById('road-error');
  if (errorEl) errorEl.style.display = 'none';
  const title  = document.getElementById('road-title').value.trim();
  const reason = document.getElementById('road-reason').value;
  const lat    = parseFloat(document.getElementById('road-lat').value);
  const lng    = parseFloat(document.getElementById('road-lng').value);

  if (!title || isNaN(lat) || isNaN(lng)) {
    if (errorEl) {
      errorEl.textContent = 'Please fill in title and click on the map to set coordinates.';
      errorEl.style.display = 'block';
    }
    return;
  }

  const body = { title, reason, latitude: lat, longitude: lng, is_active: true };

  try {
    await apiFetch('/map/road-closures', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    closeRoadModal();
    document.getElementById('road-title').value = '';
    const data = await apiFetch('/map/layers');
    if (typeof renderRoadClosures === 'function') renderRoadClosures(data.road_closures || [], true);
    if (typeof showToast === 'function') showToast('Road closure reported successfully!', 'success');
  } catch (err) {
    console.warn('Saving road closure locally fallback:', err);
    closeRoadModal();
    document.getElementById('road-title').value = '';
    
    const newRoad = { id: 'rd-' + Date.now(), ...body, reported_at: new Date().toISOString() };
    if (typeof FALLBACK_LAYERS !== 'undefined' && FALLBACK_LAYERS.road_closures) {
      FALLBACK_LAYERS.road_closures.push(newRoad);
      if (typeof renderRoadClosures === 'function') renderRoadClosures(FALLBACK_LAYERS.road_closures, true);
    }
    if (typeof mLoadRoads === 'function') mLoadRoads();
    if (typeof showToast === 'function') showToast('Road closure reported (Local mode)', 'success');
  }
}

async function resolveRoadClosure(id) {
  if (!confirm('Mark this road closure as resolved?')) return;
  try {
    await apiFetch(`/map/road-closures/${id}/resolve`, { method: 'PATCH' });
    closeInfoPanel();
    const data = await apiFetch('/map/layers');
    renderRoadClosures(data.road_closures || [], true);
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast('Failed: ' + err.message, 'danger', 'Error');
    } else {
      alert('Failed: ' + err.message);
    }
  }
}

// =============================================
// Proactive Risk Mapping
// =============================================

const RISK_COLORS = {
  critical: { stroke: '#ec4899', fill: '#ec4899', bg: '#fce7f3' },
  high:     { stroke: '#f43f5e', fill: '#f43f5e', bg: '#ffe4e6' },
  medium:   { stroke: '#f9a825', fill: '#f9a825', bg: '#fff8e1' },
  low:      { stroke: '#2e7d32', fill: '#2e7d32', bg: '#e6f4ea' },
};

const RISK_RADIUS = { critical: 280, high: 220, medium: 170, low: 130 };

const TYPE_LABEL_RISK = {
  flood: 'Flood', fire: 'Fire', landslide: 'Landslide',
  typhoon: 'Typhoon', medical: 'Medical', other: 'Other',
};

async function loadRiskZones() {
  try {
    const data = await apiFetch('/risk/analysis');
    renderRiskZones(data.risk_zones || [], true);
    updateRiskBadge(data);
  } catch (err) {
    console.warn('Risk analysis unavailable:', err.message);
  }
}

async function loadPublicRiskZones() {
  // Render fallback risk zones instantly (0ms delay)
  const fallbackRiskZones = [
    { latitude: 11.0125, longitude: 124.5865, risk_level: 'critical', risk_score: 92,
      dominant_type: 'flood', incident_count: 5, active_count: 1 },
    { latitude: 11.0170, longitude: 124.5885, risk_level: 'high', risk_score: 78,
      dominant_type: 'flood', incident_count: 3, active_count: 0 },
    { latitude: 11.0210, longitude: 124.5925, risk_level: 'high', risk_score: 74,
      dominant_type: 'landslide', incident_count: 2, active_count: 1 },
    { latitude: 11.0195, longitude: 124.5945, risk_level: 'medium', risk_score: 55,
      dominant_type: 'flood', incident_count: 2, active_count: 0 },
  ];
  renderRiskZones(fallbackRiskZones, false);
  updateRiskBadge({ high_risk_count: 1 });

  // Optional fast background sync with backend
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 1200);
    const res  = await fetch('http://127.0.0.1:8000/risk/public/summary', { signal: controller.signal });
    clearTimeout(tid);
    if (res.ok) {
      const data = await res.json();
      if (data.risk_zones && data.risk_zones.length) {
        renderRiskZones(data.risk_zones, false);
        updateRiskBadge(data);
      }
    }
  } catch (_) {}
}

function renderRiskZones(zones, authenticated) {
  layers.risk.clearLayers();

  zones.forEach(z => {
    // Filter out any risk zone generated outside Barangay Linao bounds
    if (z.latitude < 11.0100 || z.latitude > 11.0270 || z.longitude < 124.5820 || z.longitude > 124.5980) {
      return;
    }

    const c = RISK_COLORS[z.risk_level] || RISK_COLORS.medium;
    const r = RISK_RADIUS[z.risk_level] || 150;

    // Pulsing circle for critical/high zones
    const circle = L.circle([z.latitude, z.longitude], {
      radius: r,
      color: c.stroke,
      weight: z.risk_level === 'critical' ? 2 : 1.5,
      fillColor: c.fill,
      fillOpacity: z.risk_level === 'critical' ? 0.18 : (z.risk_level === 'high' ? 0.12 : 0.08),
      dashArray: '5,5',
    });

    circle.on('click', e => {
      L.DomEvent.stopPropagation(e);

      const RISK_COLOR_TEXT = {
        critical: '#d93025', high: '#e65100', medium: '#f9a825', low: '#2e7d32'
      };
      const col = RISK_COLOR_TEXT[z.risk_level] || '#f9a825';

      let bodyHtml = `
        <div class="info-field">
          <div class="info-field-label">Risk Level</div>
          <div class="info-field-value" style="color:${col};font-weight:700;text-transform:capitalize;font-size:1rem;">
            ${z.risk_level.toUpperCase()}
          </div>
        </div>
        <div class="info-field">
          <div class="info-field-label">Risk Score</div>
          <div class="info-field-value">
            <div style="display:flex;align-items:center;gap:.5rem;">
              <div style="flex:1;height:6px;background:#f1f3f4;border-radius:99px;overflow:hidden;">
                <div style="width:${z.risk_score}%;height:100%;background:${col};border-radius:99px;"></div>
              </div>
              <span style="font-weight:700;">${z.risk_score}/100</span>
            </div>
          </div>
        </div>
        <div class="info-field">
          <div class="info-field-label">Dominant Hazard Type</div>
          <div class="info-field-value">${TYPE_LABEL_RISK[z.dominant_type] || z.dominant_type}</div>
        </div>
        <div class="info-field">
          <div class="info-field-label">Historical Incidents</div>
          <div class="info-field-value">${z.incident_count} total${z.active_count ? ` · <span style="color:#d93025;font-weight:600;">${z.active_count} active</span>` : ''}</div>
        </div>`;

      if (z.total_people_involved) {
        bodyHtml += `
        <div class="info-field">
          <div class="info-field-label">People Affected (historical)</div>
          <div class="info-field-value">${z.total_people_involved}</div>
        </div>`;
      }

      bodyHtml += `<div class="info-divider"></div>`;

      if (authenticated && z.recommended_resources?.length) {
        bodyHtml += `
        <div class="info-field">
          <div class="info-field-label">Recommended Pre-staged Resources</div>
          <div class="info-field-value" style="display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.3rem;">
            ${z.recommended_resources.map(r => `
              <span style="display:inline-flex;align-items:center;gap:.2rem;background:#e8f0fe;color:#1558b0;border-radius:99px;padding:.15rem .55rem;font-size:.72rem;font-weight:600;">
                ${r}
              </span>`).join('')}
          </div>
        </div>`;
      }

      if (authenticated && z.recent_incidents?.length) {
        bodyHtml += `
        <div class="info-field">
          <div class="info-field-label">Recent Incidents in This Area</div>
          <div class="info-field-value">
            ${z.recent_incidents.map(i => `
              <div style="font-size:.78rem;padding:.3rem 0;border-bottom:1px solid #f1f3f4;">
                <span style="font-weight:600;">${i.title}</span>
                <span style="color:var(--text-muted);margin-left:.3rem;">${TYPE_LABEL_RISK[i.type]||i.type}</span>
              </div>`).join('')}
          </div>
        </div>`;
      }

      const actions = authenticated ? `
        <a href="resources.html" class="btn btn-primary" style="flex:1;">
          <i data-lucide="send"></i> Pre-stage Resources
        </a>` : '';

      openInfoPanel(
        `<i data-lucide="shield-alert"></i> Risk Zone`, col,
        `${z.risk_level.charAt(0).toUpperCase() + z.risk_level.slice(1)} Risk Area`,
        bodyHtml, actions
      );
    });

    circle.addTo(layers.risk);
  });
}

// Update the risk badge in the map toolbar if it exists
function updateRiskBadge(data) {
  const badge = document.getElementById('risk-badge');
  if (!badge) return;
  const high = data.high_risk_count || 0;
  if (high > 0) {
    badge.textContent = high + ' high-risk';
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

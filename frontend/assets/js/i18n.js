// ========================================================
// SECTION 11.3: LANGUAGE ACCESSIBILITY & INCLUSIVITY (CEBUANO)
// ========================================================

const I18N_DICTIONARY = {
  ceb: {
    "Command Center": "Sentro sa Pagdumala",
    "Dashboard Overview": "Pagtutuok sa Sentro",
    "Dashboard": "Talaan sa Impormasyon",
    "GIS Map": "Mapa sa Risk ug GIS",
    "Field Operations": "Mga Aksyon sa Lapok",
    "Incidents": "Mga Disgrasya ug Inundasyon",
    "Evacuation Centers": "Bakwitans / Shelters",
    "Total Evacuees": "Talaan sa mga Bakwit",
    "Resources": "Mga Kagamitan ug Rescuers",
    "Resources Deployed": "Gipakatap nga Gamit",
    "Active Incidents": "Nahitabo nga Disgrasya",
    "Management": "Pagdumala ug Auditing",
    "Reports": "Ripor ug Analitika",
    "Directory": "Direktoryo sa Emergencia",
    "Report Incident": "I-report ang Disgrasya",
    "Update Occupancy": "I-update ang Pamilya sa Bakwitan",
    "Dispatch Resource": "Ipadala ang Kagamitan",
    "Open GIS Map": "Ablihan ang GIS Mapa",
    "Emergency Hotlines": "Mga Numero sa Emergencia",
    "Last updated:": "Katapusang gi-update:",
    "Barangay DRRM": "DRRM sa Barangay Linao"
  },
  en: {
    "Command Center": "Command Center",
    "Dashboard Overview": "Dashboard Overview",
    "Dashboard": "Dashboard",
    "GIS Map": "GIS Map",
    "Field Operations": "Field Operations",
    "Incidents": "Incidents",
    "Evacuation Centers": "Evacuation Centers",
    "Total Evacuees": "Total Evacuees",
    "Resources": "Resources",
    "Resources Deployed": "Resources Deployed",
    "Active Incidents": "Active Incidents",
    "Management": "Management",
    "Reports": "Reports",
    "Directory": "Directory",
    "Report Incident": "Report Incident",
    "Update Occupancy": "Update Occupancy",
    "Dispatch Resource": "Dispatch Resource",
    "Open GIS Map": "Open GIS Map",
    "Emergency Hotlines": "Emergency Hotlines",
    "Last updated:": "Last updated:",
    "Barangay DRRM": "Barangay DRRM"
  }
};

function currentLang() {
  return localStorage.getItem('drrm_lang') || 'en';
}

function setLanguage(lang) {
  localStorage.setItem('drrm_lang', lang);
  applyTranslations();
  updateLangToggleBtn();
}

function toggleLanguage() {
  const next = currentLang() === 'en' ? 'ceb' : 'en';
  setLanguage(next);
}

function applyTranslations() {
  const lang = currentLang();
  const dict = I18N_DICTIONARY[lang];
  if (!dict) return;

  // Translate elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });

  // Auto-translate sidebar nav items safely without removing SVG / i icons
  document.querySelectorAll('.sidebar nav a, .sidebar .brand span, .topbar-left h2, .nav-section-label').forEach(el => {
    const icon = el.querySelector('i, svg');
    let textNode = null;
    el.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
        textNode = node;
      }
    });

    const rawText = textNode ? textNode.textContent.trim() : el.textContent.trim();
    if (rawText && dict[rawText]) {
      if (textNode) {
        textNode.textContent = ' ' + dict[rawText];
      } else if (icon) {
        el.innerHTML = '';
        el.appendChild(icon);
        el.appendChild(document.createTextNode(' ' + dict[rawText]));
      } else {
        el.textContent = dict[rawText];
      }
    }
  });

  if (window.lucide) lucide.createIcons();
}

function updateLangToggleBtn() {
  const btn = document.getElementById('lang-toggle-btn');
  if (btn) {
    const lang = currentLang();
    btn.innerHTML = lang === 'en' 
      ? '<span style="font-weight:800;color:#60a5fa;">EN</span> / CEB' 
      : 'EN / <span style="font-weight:800;color:#34d399;">CEB (Visayan)</span>';
  }
}

// Data Privacy Consent Notice (Section 11.1)
// NOTE: Consent banner removed per request — record acceptance to avoid re-showing UI
function checkDataPrivacyNotice() {
  try {
    localStorage.setItem('privacy_consent_accepted', '1');
  } catch (e) {
    // ignore storage errors
  }
}

function acceptPrivacyNotice() {
  // kept for compatibility but no longer needed
  try {
    localStorage.setItem('privacy_consent_accepted', '1');
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
  applyTranslations();
  updateLangToggleBtn();
  checkDataPrivacyNotice();
});

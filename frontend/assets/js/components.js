// ===== Shared Component Loader (Single Source of Truth) =====

(function() {
  function renderSidebar() {
    const sidebarEl = document.querySelector('.sidebar') || document.getElementById('sidebar-container');
    if (!sidebarEl) return;

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    const NAV_ITEMS = [
      {
        section: 'Command Center',
        icon: 'compass',
        items: [
          { label: 'Dashboard', href: 'dashboard.html', icon: 'layout-dashboard' },
          { label: 'GIS Map', href: 'map.html', icon: 'map' },
        ]
      },
      {
        section: 'Field Operations',
        icon: 'shield-alert',
        items: [
          { label: 'Incidents', href: 'incidents.html', icon: 'triangle-alert' },
          { label: 'Evacuation Centers', href: 'evacuation.html', icon: 'house' },
          { label: 'Resources', href: 'resources.html', icon: 'truck' },
        ]
      },
      {
        section: 'Management',
        icon: 'settings-2',
        items: [
          { label: 'Reports', href: 'reports.html', icon: 'file-bar-chart' },
          { label: 'Public Portal', href: 'landing.html', icon: 'globe' },
        ]
      }
    ];

    let navHtml = `
      <a href="landing.html" class="brand" style="text-decoration:none;color:inherit;">
        <i data-lucide="shield-alert" class="brand-icon"></i>
        <div>
          <h2>Barangay DRRM</h2>
          <span>Linao, Ormoc City</span>
        </div>
      </a>
      <nav>
    `;

    NAV_ITEMS.forEach((sec, idx) => {
      if (idx > 0) navHtml += `<div class="nav-section-divider"></div>`;
      navHtml += `<div class="nav-section-label"><i data-lucide="${sec.icon}"></i> ${sec.section}</div>`;
      
      sec.items.forEach(item => {
        const isActive = (currentPath === item.href) ? 'class="active"' : '';
        const customStyle = item.style ? `style="${item.style}"` : '';
        navHtml += `<a href="${item.href}" ${isActive} ${customStyle}><i data-lucide="${item.icon}"></i> ${item.label}</a>`;
      });
    });

    navHtml += `
      </nav>
      <div class="sidebar-footer">
        <div>Barangay DRRM v1.0</div>
        <div style="font-size:.65rem;color:var(--text-muted);margin-top:.2rem;">
          <span style="color:var(--primary);cursor:pointer;text-decoration:underline;" onclick="if(typeof showPrivacyPolicyModal==='function') showPrivacyPolicyModal();">Terms &amp; RA 10173 Privacy</span>
        </div>
      </div>
    `;

    sidebarEl.innerHTML = navHtml;
  }

  function init() {
    renderSidebar();
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

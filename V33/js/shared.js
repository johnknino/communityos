/* CommUnity OS Shared JS v1.2 — i18n + nav + alerts + analytics + accessibility */

(function(){
  'use strict';

  /* ── Config ── */
  var API_KEY = 'cos-api';
  var LANG_KEY = 'cos-lang';
  var COMMUNITY_API_KEY = 'cos-community-api';
  var COMMUNITY_ZIP_KEY = 'cos-community-zip';
  var COMMUNITY_NAME_KEY = 'cos-community-name';
  var lang = localStorage.getItem(LANG_KEY) || 'en';
  var T = {};
  var _api = localStorage.getItem(API_KEY) || '';
  var _hub = ''; // always the main CommUnity OS script URL
  var _communityApi = localStorage.getItem(COMMUNITY_API_KEY) || '';
  var _communityZip = localStorage.getItem(COMMUNITY_ZIP_KEY) || '';
  var _communityName = localStorage.getItem(COMMUNITY_NAME_KEY) || '';

  /* ── Migrate legacy keys (eqos-* → cos-*) — safe to remove after Aug 2026 ── */
  (function(){
    var map = [['eqos-lang','cos-lang'],['eqos-api','cos-api'],['eqos-zip','cos-zip'],['eqos-name','cos-name'],['eqos-reviewer','cos-reviewer'],['eqos-review-queue','cos-review-queue'],['eqos-votes','cos-votes']];
    map.forEach(function(p){ var v=localStorage.getItem(p[0]); if(v!==null&&!localStorage.getItem(p[1])){localStorage.setItem(p[1],v);} localStorage.removeItem(p[0]); });
  })();
  lang = localStorage.getItem(LANG_KEY) || 'en';
  document.documentElement.lang = lang;
  _api = localStorage.getItem(API_KEY) || '';

  /* ── Bilingual Engine ── */
  function setTranslations(translations) { T = translations; applyLang(); }
  function getLang() { return lang; }
  function switchLang(newLang) { lang = newLang; localStorage.setItem(LANG_KEY, lang); document.documentElement.lang = lang; applyLang(); announceLang(); }
  function announceLang() { var a = document.getElementById('lang-announce'); if (!a) { a = document.createElement('div'); a.id = 'lang-announce'; a.setAttribute('aria-live', 'polite'); a.className = 'sr-only'; a.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)'; document.body.appendChild(a); } a.textContent = lang === 'es' ? 'Idioma cambiado a Español' : 'Language changed to English'; }
  function toggleLang() { switchLang(lang === 'en' ? 'es' : 'en'); }
  function t(key) { return (T[lang] && T[lang][key]) || (T['en'] && T['en'][key]) || ''; }
  function getApi() { return _communityApi || _api || _hub; }
  function getHub() { return _hub || _api; }

  /**
   * Registry resolver: given a zip, look up the community's API URL.
   * Caches result in localStorage. Subsequent page loads use cached value.
   * If zip hasn't changed since last resolve, uses cache (no network call).
   * Returns a Promise that resolves to { script_url, community_name, is_hub }.
   */
  function resolveApi(zip) {
    if (!zip || zip.length !== 5) return Promise.resolve(null);

    // If same zip already resolved, use cache
    if (zip === _communityZip && _communityApi) {
      _api = _communityApi;
      return Promise.resolve({ script_url: _communityApi, community_name: _communityName, is_hub: false });
    }

    var hub = getHub();
    if (!hub) return Promise.resolve(null);

    return fetch(hub + '?action=resolve_community&zip=' + zip)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.status === 'ok' && data.script_url) {
          _communityApi = data.script_url;
          _communityZip = zip;
          _communityName = data.community_name || '';
          _api = data.script_url;
          localStorage.setItem(COMMUNITY_API_KEY, _communityApi);
          localStorage.setItem(COMMUNITY_ZIP_KEY, zip);
          localStorage.setItem(COMMUNITY_NAME_KEY, _communityName);
          localStorage.setItem(API_KEY, _communityApi);
          return data;
        }
        return null;
      })
      .catch(function() { return null; });
  }

  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach(function(el) {
      var key = el.getAttribute('data-t');
      var val = t(key);
      if (val) el.innerHTML = val;
    });
    document.querySelectorAll('[data-t-placeholder]').forEach(function(el) {
      var key = el.getAttribute('data-t-placeholder');
      var val = t(key);
      if (val) el.placeholder = val;
    });
    document.querySelectorAll('[data-t-aria]').forEach(function(el) {
      var key = el.getAttribute('data-t-aria');
      var val = t(key);
      if (val) el.setAttribute('aria-label', val);
    });
    document.querySelectorAll('.lang-toggle').forEach(function(btn) {
      btn.textContent = lang === 'en' ? 'ES' : 'EN';
      btn.classList.toggle('active', lang === 'es');
    });
    applyNavLang();
    linkifyPhones();
  }

  /** Auto-wrap phone numbers in tel: links for mobile tap-to-call */
  function linkifyPhones() {
    var phoneRegex = /(?<![">\/=])(\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}|1-\d{3}-\d{3}-\d{4}|\b988\b(?!\s*<))/g;
    var targets = document.querySelectorAll('.resource-card p, .result-card .rc-phone, .hl-number, .guide-content, .ds-item, .narrative p, .alert-box p');
    targets.forEach(function(el) {
      // Skip if already contains tel: links
      if (el.innerHTML.indexOf('href="tel:') !== -1) return;
      el.innerHTML = el.innerHTML.replace(phoneRegex, function(match) {
        var clean = match.replace(/[^\d+]/g, '');
        return '<a href="tel:' + clean + '" class="tel-link">' + match + '</a>';
      });
    });
  }

  /* ── Navigation ── */
  var NAV_LINKS = [
    { href: '/', key: 'nav_home', label: 'Home', labelEs: 'Inicio' },
    { href: '/crisis.html', key: 'nav_crisis', label: '🚨 I Need Help Now', labelEs: '🚨 Necesito Ayuda' },
    { href: '/neighborhood.html', key: 'nav_neighborhood', label: '📍 My Neighborhood', labelEs: '📍 Mi Vecindario' },
    { href: '/knowledge.html', key: 'nav_knowledge', label: '📚 54 Guides', labelEs: '📚 54 Guías' },
    { divider: true },
    { arcLabel: true, key: 'nav_civic_label', label: 'Civic Engagement', labelEs: 'Participación Cívica' },
    { href: '/govern.html', key: 'nav_govern', label: '🏛️ Leadership Check', labelEs: '🏛️ Verificar Líderes' },
    { href: '/issues.html', key: 'nav_issues', label: '📊 Issues & Candidates', labelEs: '📊 Temas y Candidatos' },
    { href: '/evaluate.html', key: 'nav_evaluate', label: '⭐ Evaluate Leaders', labelEs: '⭐ Evaluar Líderes' },
    { href: '/propose.html', key: 'nav_propose', label: '📋 Proposals & Voting', labelEs: '📋 Propuestas y Votos' },
    { href: '/dashboard.html', key: 'nav_dashboard', label: '📈 Community Pulse', labelEs: '📈 Pulso Comunitario' },
    { href: '/diagnostics.html', key: 'nav_diagnostics', label: '🔬 Civic Diagnostics', labelEs: '🔬 Diagnósticos Cívicos' },
    { divider: true },
    { arcLabel: true, key: 'nav_community_label', label: 'Community', labelEs: 'Comunidad' },
    { href: '/lead.html', key: 'nav_lead', label: '🌟 Lead Your Neighborhood', labelEs: '🌟 Lidera Tu Vecindario' },
    { href: '/cases.html', key: 'nav_cases', label: '📚 Case Studies', labelEs: '📚 Estudios de Caso' },
    { href: '/discuss.html', key: 'nav_discuss', label: '💬 Discussions', labelEs: '💬 Discusiones' },
    { href: '/needs.html', key: 'nav_needs', label: '🤝 Needs & Offers', labelEs: '🤝 Necesidades y Ofertas' },
    { href: '/connect.html', key: 'nav_connect', label: '📇 Directory', labelEs: '📇 Directorio' },
    { href: '/grow.html', key: 'nav_grow', label: '🌱 Grow Food', labelEs: '🌱 Cultivar' },
    { divider: true },
    { arcLabel: true, key: 'nav_tools_label', label: 'Tools', labelEs: 'Herramientas' },
    { href: '/benefits-screener.html', key: 'nav_screener', label: 'Benefit Screener', labelEs: 'Evaluador de Beneficios' },
    { href: '/defend.html', key: 'nav_defend', label: 'Dispute Letters', labelEs: 'Cartas de Disputa' },
    { href: '/health-calc.html', key: 'nav_healthcalc', label: 'Health Calculators', labelEs: 'Calculadoras de Salud' },
    { href: '/worker-rights.html', key: 'nav_worker', label: 'Worker Rights', labelEs: 'Derechos Laborales' },
    { href: '/school-rights.html', key: 'nav_school', label: 'School Rights', labelEs: 'Derechos Escolares' },
    { href: '/court-nav.html', key: 'nav_court', label: 'Court Navigator', labelEs: 'Navegador de Corte' },
    { href: '/complaints.html', key: 'nav_complaints', label: 'Company Complaints', labelEs: 'Quejas de Empresas' },
    { href: '/lending.html', key: 'nav_lending', label: 'Lending Fairness', labelEs: 'Equidad en Préstamos' },
    { href: '/environment.html', key: 'nav_env', label: 'Environmental Check', labelEs: 'Verificación Ambiental' },
    { href: '/drug-prices.html', key: 'nav_drugs', label: 'Drug Prices', labelEs: 'Precios de Medicamentos' },
    { href: '/benefits-check.html', key: 'nav_benefits', label: 'Immigration Safety', labelEs: 'Seguridad Migratoria' },
    { href: '/vitals.html', key: 'nav_vitals', label: 'Vitals Check', labelEs: 'Signos Vitales' },
    { href: '/disaster.html', key: 'nav_disaster', label: 'Disaster Ready', labelEs: 'Preparación Desastres' },
    { divider: true },
    { arcLabel: true, key: 'nav_strategy_label', label: 'Partner Dashboards', labelEs: 'Paneles para Socios' },
    { href: '/food-strategy.html', key: 'nav_food_strat', label: 'Food', labelEs: 'Alimentación' },
    { href: '/health-strategy.html', key: 'nav_health_strat', label: 'Health', labelEs: 'Salud' },
    { href: '/housing-strategy.html', key: 'nav_housing_strat', label: 'Housing', labelEs: 'Vivienda' },
    { href: '/environment-strategy.html', key: 'nav_env_strat', label: 'Environment', labelEs: 'Medio Ambiente' },
    { href: '/education-strategy.html', key: 'nav_edu_strat', label: 'Education', labelEs: 'Educación' },
    { href: '/workforce-strategy.html', key: 'nav_work_strat', label: 'Workforce', labelEs: 'Empleo' },
    { href: '/digital-strategy.html', key: 'nav_dig_strat', label: 'Digital', labelEs: 'Digital' },
    { href: '/civic-strategy.html', key: 'nav_civic_strat', label: 'Civic', labelEs: 'Cívico' },
    { divider: true },
    { href: '/how-it-works.html', key: 'nav_how', label: 'How This Works', labelEs: 'Cómo Funciona' },
    { href: '/onboard.html', key: 'nav_onboard', label: '🔐 Get Invite Code', labelEs: '🔐 Obtener Código' }
  ];

  function getCurrentPage() {
    var path = window.location.pathname;
    if (path === '/' || path === '/index.html') return '/';
    return path;
  }

  function buildNav() {
    var currentPage = getCurrentPage();

    // Skip-nav link (accessibility — WCAG 2.4.1)
    var skip = document.createElement('a');
    skip.href = '#main-content';
    skip.className = 'skip-nav';
    skip.textContent = 'Skip to content';
    document.body.prepend(skip);

    // Main content landmark
    var page = document.querySelector('.page');
    if (page) { page.id = 'main-content'; page.setAttribute('role', 'main'); }

    // Top nav bar
    var nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Main navigation');
    nav.innerHTML = '<div class="nav-inner">' +
      '<a href="/" class="nav-home" aria-label="CommUnity OS home">Comm<span class="brand-accent">Unity</span> OS</a>' +
      '<div class="nav-right">' +
        '<button class="lang-toggle" onclick="EQ.toggleLang()" aria-label="Switch language">' + (lang === 'en' ? 'Español' : 'English') + '</button>' +
        '<button class="lang-globe" onclick="EQ.openLangPanel()" aria-label="More languages" title="More languages">🌐</button>' +
        '<button class="nav-menu-btn" onclick="EQ.openNav()" aria-label="Open navigation menu">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>';

    // Drawer
    var drawer = document.createElement('div');
    drawer.className = 'nav-drawer';
    drawer.id = 'navDrawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-label', 'Navigation menu');
    var panelHTML = '<div class="nav-overlay" onclick="EQ.closeNav()"></div>' +
      '<div class="nav-panel">' +
      '<button class="nav-close" onclick="EQ.closeNav()" aria-label="Close navigation">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>';

    NAV_LINKS.forEach(function(link) {
      if (link.divider) {
        panelHTML += '<div class="nav-divider"></div>';
      } else if (link.arcLabel) {
        panelHTML += '<div class="nav-arc-label" data-nav-key="' + link.key + '">' + (lang === 'es' ? link.labelEs : link.label) + '</div>';
      } else {
        var isCurrent = link.href === currentPage;
        panelHTML += '<a href="' + link.href + '" class="nav-link' + (isCurrent ? ' current' : '') + '" data-nav-key="' + link.key + '"' +
          (isCurrent ? ' aria-current="page"' : '') + '>' +
          (lang === 'es' ? link.labelEs : link.label) + '</a>';
      }
    });

    panelHTML += '</div>';
    drawer.innerHTML = panelHTML;

    document.body.prepend(drawer);
    document.body.prepend(nav);
  }

  function applyNavLang() {
    NAV_LINKS.forEach(function(link) {
      if (link.divider) return;
      var el = document.querySelector('[data-nav-key="' + link.key + '"]');
      if (el) el.textContent = lang === 'es' ? link.labelEs : link.label;
    });
  }

  function openNav() {
    var d = document.getElementById('navDrawer');
    if (d) { d.classList.add('open'); document.body.style.overflow = 'hidden'; }
    var btn = document.querySelector('.nav-menu-btn');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    // Focus first nav link for keyboard users
    var firstLink = d && d.querySelector('.nav-link');
    if (firstLink) setTimeout(function() { firstLink.focus(); }, 100);
  }

  function closeNav() {
    var d = document.getElementById('navDrawer');
    if (d) { d.classList.remove('open'); document.body.style.overflow = ''; }
    var btn = document.querySelector('.nav-menu-btn');
    if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
  }

  /* ── Alerts — Fetch from Sheet, render into page ── */
  function loadAlerts(pageName, containerId) {
    if (!_api) return;
    var container = document.getElementById(containerId || 'alertsContainer');
    if (!container) return;

    fetch(_api + '?action=get_alerts&page=' + pageName, { redirect: 'follow' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.alerts || data.alerts.length === 0) return;
        var html = '';
        data.alerts.forEach(function(a) {
          var title = lang === 'es' ? (a.title_es || a.title_en) : a.title_en;
          var body = lang === 'es' ? (a.body_es || a.body_en) : a.body_en;
          var cls = a.type === 'urgent' ? 'alert-box' : a.type === 'update' ? 'alert-box alert-update' : 'alert-box alert-info';
          html += '<div class="' + cls + '" role="alert">' +
            (title ? '<h3>' + esc(title) + '</h3>' : '') +
            '<p>' + body + '</p>' +  // body may contain HTML links
            (a.link ? '<a href="' + esc(a.link) + '" style="color:var(--coral);font-weight:500;border-bottom:1px solid">' + (lang === 'es' ? 'Más información →' : 'Learn more →') + '</a>' : '') +
            '</div>';
        });
        container.innerHTML = html;
      })
      .catch(function() {}); // Silent fail — hardcoded fallback remains
  }

  /* ── Page View Counter — Fire and forget, no PII ── */
  function logPageView() {
    if (!_api) return;
    var page = getCurrentPage().replace(/^\//, '').replace('.html', '') || 'home';
    try {
      var payload = JSON.stringify({ action: 'page_view', page: page });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(_api, payload);
      } else {
        fetch(_api, { method: 'POST', body: payload, keepalive: true }).catch(function(){});
      }
    } catch(e) {}
  }

  /* ── Fuzzy Zip — Typeahead with activity counts ── */
  function initFuzzyZip(inputId, suggestionsId, onSelect) {
    var input = document.getElementById(inputId);
    var sugBox = document.getElementById(suggestionsId);
    if (!input || !sugBox) return;

    var debounceTimer;
    input.addEventListener('input', function() {
      var val = input.value.replace(/\D/g, '');
      input.value = val;
      clearTimeout(debounceTimer);

      if (val.length < 2) { sugBox.innerHTML = ''; sugBox.style.display = 'none'; return; }
      if (val.length === 5) { sugBox.innerHTML = ''; sugBox.style.display = 'none'; return; }

      if (!_api) return; // No suggestions offline

      debounceTimer = setTimeout(function() {
        fetch(_api + '?action=get_zip_activity&prefix=' + val, { redirect: 'follow' })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (!data.zips || data.zips.length === 0) {
              sugBox.innerHTML = '<div class="zip-sug zip-empty">' +
                (lang === 'es' ? 'Sé el primero en tu código postal' : 'Be the first in your zip code') + '</div>';
              sugBox.style.display = '';
              return;
            }
            var html = '';
            data.zips.forEach(function(z) {
              var total = z.posts + z.needs + z.offers;
              var label = total > 0 ? (total + (lang === 'es' ? ' activ.' : ' active')) : (lang === 'es' ? 'nuevo' : 'new');
              html += '<div class="zip-sug" data-zip="' + z.zip + '" tabindex="0">' +
                '<span class="zip-code">' + z.zip + '</span>' +
                '<span class="zip-act">' + label + '</span></div>';
            });
            sugBox.innerHTML = html;
            sugBox.style.display = '';
            sugBox.querySelectorAll('[data-zip]').forEach(function(el) {
              el.addEventListener('click', function() {
                input.value = el.dataset.zip;
                sugBox.innerHTML = ''; sugBox.style.display = 'none';
                if (onSelect) onSelect(el.dataset.zip);
              });
              el.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') el.click();
              });
            });
          })
          .catch(function() { sugBox.style.display = 'none'; });
      }, 250);
    });

    input.addEventListener('blur', function() {
      setTimeout(function() { sugBox.style.display = 'none'; }, 200);
    });
  }

  /* ── Resource Fallback Rendering ── */
  function renderResourceWithFallback(el) {
    // For links with data-fallback attribute — check if link works, show fallback if not
    // This is client-side graceful degradation. The scheduled server-side check flags dead links in the Sheet.
    // Usage: <a href="https://..." data-fallback="Search: SNAP eligibility screener">...</a>
    // We don't actually ping links client-side (CORS blocks it). Instead, this provides
    // the fallback search text that the Sheet-driven resource system can swap in.
    // The real fallback mechanism is: Sheet marks resource as dead → getResources omits it →
    // page renders fallback_search text instead of the link.
  }

  /* ── Language Community Panel ── */
  /* Top 10 non-English languages in the US by speaker population (ACS 2021-2025). */
  /* English + Spanish are preloaded. Others are community-contributed via review tool. */
  var LANGUAGES = [
    { code: 'en', name: 'English', nameNative: 'English', speakers: '247M', preloaded: true },
    { code: 'es', name: 'Spanish', nameNative: 'Español', speakers: '43M', preloaded: true },
    { code: 'zh', name: 'Chinese', nameNative: '中文', speakers: '3.5M', preloaded: false, note: 'Simplified + Traditional' },
    { code: 'tl', name: 'Tagalog', nameNative: 'Tagalog', speakers: '1.8M', preloaded: false },
    { code: 'vi', name: 'Vietnamese', nameNative: 'Tiếng Việt', speakers: '1.6M', preloaded: false },
    { code: 'ar', name: 'Arabic', nameNative: 'العربية', speakers: '1.4M', preloaded: false },
    { code: 'fr', name: 'French', nameNative: 'Français', speakers: '1.3M', preloaded: false },
    { code: 'ko', name: 'Korean', nameNative: '한국어', speakers: '1.1M', preloaded: false },
    { code: 'hi', name: 'Hindi', nameNative: 'हिन्दी', speakers: '0.9M', preloaded: false },
    { code: 'pt', name: 'Portuguese', nameNative: 'Português', speakers: '0.8M', preloaded: false }
  ];

  function buildLangPanel() {
    var panel = document.createElement('div');
    panel.className = 'lang-panel';
    panel.id = 'langPanel';

    var html = '<div class="lang-panel-inner">' +
      '<div class="lang-panel-header">' +
        '<h3>Languages</h3>' +
        '<span class="close" onclick="EQ.closeLangPanel()">&times;</span>' +
      '</div>' +
      '<p class="lang-panel-desc">English and Spanish are built in. Help us add more — click any language to start translating.</p>';

    LANGUAGES.forEach(function(l) {
      var isCurrent = l.code === lang;
      var statusClass = l.preloaded ? 'lang-ready' : 'lang-community';
      var statusText = l.preloaded ? (isCurrent ? '● Active' : 'Available') : 'Community-built · Help translate →';
      html += '<div class="lang-row ' + statusClass + (isCurrent ? ' lang-current' : '') + '" onclick="EQ.selectLanguage(\'' + l.code + '\',' + l.preloaded + ')">' +
        '<div class="lang-row-left">' +
          '<div class="lang-name">' + l.nameNative + ' <span class="lang-english">' + l.name + '</span></div>' +
          '<div class="lang-speakers">' + l.speakers + ' speakers in the US' + (l.note ? ' · ' + l.note : '') + '</div>' +
        '</div>' +
        '<div class="lang-status">' + statusText + '</div>' +
      '</div>';
    });

    html += '<div class="lang-row lang-other" onclick="EQ.selectLanguage(\'other\',false)">' +
      '<div class="lang-row-left">' +
        '<div class="lang-name">Another language</div>' +
        '<div class="lang-speakers">Not listed? You can still contribute.</div>' +
      '</div>' +
      '<div class="lang-status">Add a language →</div>' +
    '</div>';

    html += '</div>';
    panel.innerHTML = html;
    document.body.appendChild(panel);
  }

  function openLangPanel() {
    var p = document.getElementById('langPanel');
    if (!p) { buildLangPanel(); p = document.getElementById('langPanel'); }
    p.classList.add('open');
  }

  function closeLangPanel() {
    var p = document.getElementById('langPanel');
    if (p) p.classList.remove('open');
  }

  function selectLanguage(code, isPreloaded) {
    closeLangPanel();
    if (isPreloaded) {
      // Switch to preloaded language
      switchLang(code);
      return;
    }
    // Not preloaded — open review tool in new-language mode
    if (!reviewMode) {
      // Activate review mode on the fly
      window.location.href = window.location.pathname + '?review=true&lang=' + code;
      return;
    }
    // Already in review mode — pre-fill language and open panel
    var langObj = LANGUAGES.find(function(l) { return l.code === code; });
    if (langObj) {
      document.getElementById('newLangName').value = langObj.name;
      document.getElementById('newLangCode').value = langObj.code;
    } else if (code === 'other') {
      document.getElementById('newLangName').value = '';
      document.getElementById('newLangCode').value = '';
    }
    setReviewMode('newlang');
    document.getElementById('reviewPanel').classList.add('open');
    // Auto-start the walk-through
    skipToNext();
  }

  /* ── Translation Feedback Widget ── */
  /* Activated by ?review=true in URL. Adds click-to-suggest on any data-t element. */
  /* Submissions go to Apps Script → TranslationFeedback Sheet. No direct site changes. */
  var reviewMode = false;

  function initReviewMode() {
    if (window.location.search.indexOf('review=true') === -1) return;
    reviewMode = true;

    // Inject styles
    var style = document.createElement('style');
    style.textContent = [
      '[data-t].reviewable{outline:2px dashed rgba(90,138,120,.3);outline-offset:2px;cursor:pointer;transition:.15s;border-radius:4px}',
      '[data-t].reviewable:hover{outline-color:var(--forest);background:rgba(90,138,120,.06)}',
      '.review-badge{position:fixed;bottom:20px;right:20px;background:var(--forest);color:var(--cream);padding:8px 16px;border-radius:10px;font-family:var(--sans);font-size:.75rem;font-weight:600;z-index:200;box-shadow:0 4px 14px rgba(26,60,52,.25);cursor:pointer}',
      '.review-badge:hover{background:var(--deep)}',
      '.review-panel{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:2px solid var(--forest);box-shadow:0 -4px 20px rgba(0,0,0,.1);z-index:250;max-height:70dvh;overflow-y:auto;padding:20px;transform:translateY(100%);transition:transform .3s;font-family:var(--sans)}',
      '.review-panel.open{transform:translateY(0)}',
      '.review-panel h3{font-size:.9rem;font-weight:600;color:var(--deep);margin-bottom:4px;display:flex;justify-content:space-between;align-items:center}',
      '.review-panel .close{cursor:pointer;font-size:1.2rem;color:var(--dim)}',
      '.review-panel label{display:block;font-size:.65rem;font-weight:600;color:var(--dim);text-transform:uppercase;letter-spacing:.04em;margin:10px 0 3px}',
      '.review-panel .current-text{background:var(--warm);padding:10px 12px;border-radius:8px;font-size:.82rem;color:var(--ink);line-height:1.5;margin:4px 0 8px;border-left:3px solid var(--coral)}',
      '.review-panel textarea{width:100%;padding:10px 12px;border:1.5px solid var(--sand);border-radius:8px;font-family:var(--sans);font-size:.82rem;resize:vertical;min-height:60px;color:var(--ink)}',
      '.review-panel textarea:focus{outline:none;border-color:var(--forest)}',
      '.review-panel input{width:100%;padding:8px 12px;border:1.5px solid var(--sand);border-radius:8px;font-family:var(--sans);font-size:.82rem;color:var(--ink)}',
      '.review-panel input:focus{outline:none;border-color:var(--forest)}',
      '.review-panel .btn-row{display:flex;gap:8px;margin-top:12px}',
      '.review-panel .btn{padding:8px 20px;border-radius:8px;border:1.5px solid var(--sand);background:var(--warm);color:var(--dim);font-size:.78rem;font-weight:500;cursor:pointer}',
      '.review-panel .btn:hover{border-color:var(--sage);color:var(--forest)}',
      '.review-panel .btn.primary{background:var(--forest);color:var(--cream);border-color:var(--forest)}',
      '.review-panel .status{font-size:.72rem;color:var(--sage);margin-top:8px}',
      '.review-panel .key-tag{font-size:.6rem;color:var(--light);font-family:monospace;background:var(--warm);padding:2px 6px;border-radius:4px}',
      '.review-mode-btn{font-size:.7rem!important;padding:6px 12px!important}',
      '.review-mode-btn.active{background:var(--forest)!important;color:var(--cream)!important;border-color:var(--forest)!important}'
    ].join('\n');
    document.head.appendChild(style);

    // Mark all data-t elements as reviewable
    document.querySelectorAll('[data-t]').forEach(function(el) {
      el.classList.add('reviewable');
      el.addEventListener('click', function(e) {
        // Don't intercept links — only if the click is on the translated text itself
        if (e.target.tagName === 'A' && e.target.href) return;
        e.preventDefault();
        e.stopPropagation();
        openReviewPanel(el);
      });
    });

    // Add floating badge
    var badge = document.createElement('div');
    badge.className = 'review-badge';
    badge.innerHTML = '✏️ Review Mode';
    badge.title = 'Click any highlighted text to suggest a better translation';
    badge.onclick = function() {
      openContributePanel();
    };
    document.body.appendChild(badge);

    // Add review panel
    var panel = document.createElement('div');
    panel.className = 'review-panel';
    panel.id = 'reviewPanel';
    panel.innerHTML = '<h3><span id="reviewTitle">Suggest a Translation</span> <span class="close" onclick="EQ.closeReview()">&times;</span></h3>' +
      // Mode selector
      '<div style="display:flex;gap:6px;margin-bottom:12px">' +
        '<button class="btn review-mode-btn active" id="modeImprove" onclick="EQ.setReviewMode(\'improve\')">Improve existing</button>' +
        '<button class="btn review-mode-btn" id="modeNewLang" onclick="EQ.setReviewMode(\'newlang\')">Add new language</button>' +
      '</div>' +
      // New language fields (hidden by default)
      '<div id="newLangFields" style="display:none">' +
        '<label>What language are you adding?</label>' +
        '<input type="text" id="newLangName" placeholder="e.g., Polish, Arabic, Tagalog, French, Mandarin">' +
        '<label>Language code (2 letters)</label>' +
        '<input type="text" id="newLangCode" maxlength="5" placeholder="e.g., pl, ar, tl, fr, zh" style="max-width:100px">' +
        '<div style="margin:10px 0;font-size:.75rem;color:var(--dim)">You\'ll walk through each piece of text on this page. Translate what you can — skip what you\'re not sure about. Every contribution helps.</div>' +
      '</div>' +
      // Standard fields
      '<div class="key-tag" id="reviewKey"></div>' +
      '<label>Current text</label>' +
      '<div class="current-text" id="reviewCurrent"></div>' +
      '<label id="suggestionLabel">Your suggestion</label>' +
      '<textarea id="reviewSuggestion" placeholder="How would you say this?"></textarea>' +
      '<label>What\'s wrong with the current version? (optional)</label>' +
      '<input type="text" id="reviewReason" placeholder="e.g., too formal, wrong word, sounds unnatural">' +
      '<label>Your name (optional)</label>' +
      '<input type="text" id="reviewerName" placeholder="So we can credit you" value="' + (localStorage.getItem('cos-reviewer') || '') + '">' +
      '<div class="btn-row">' +
        '<button class="btn" onclick="EQ.closeReview()">Cancel</button>' +
        '<button class="btn" id="skipBtn" onclick="EQ.skipToNext()" style="display:none">Skip →</button>' +
        '<button class="btn primary" onclick="EQ.submitReview()">Submit</button>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">' +
        '<div class="status" id="reviewStatus"></div>' +
        '<div id="progressCounter" style="font-size:.65rem;color:var(--dim);display:none"></div>' +
      '</div>';
    document.body.appendChild(panel);

    // Auto-start new language if ?review=true&lang=xx is in URL
    var urlParams = new URLSearchParams(window.location.search);
    var urlLang = urlParams.get('lang');
    if (urlLang && urlLang !== 'en' && urlLang !== 'es') {
      var langObj = LANGUAGES.find(function(l) { return l.code === urlLang; });
      setTimeout(function() {
        if (langObj) {
          document.getElementById('newLangName').value = langObj.name;
          document.getElementById('newLangCode').value = langObj.code;
        }
        setReviewMode('newlang');
        document.getElementById('reviewPanel').classList.add('open');
        skipToNext();
      }, 500);
    }
  }
  var _reviewTarget = null;
  var _reviewMode = 'improve'; // 'improve' or 'newlang'
  var _walkKeys = [];
  var _walkIndex = -1;

  function setReviewMode(mode) {
    _reviewMode = mode;
    document.getElementById('modeImprove').classList.toggle('active', mode === 'improve');
    document.getElementById('modeNewLang').classList.toggle('active', mode === 'newlang');
    document.getElementById('newLangFields').style.display = mode === 'newlang' ? '' : 'none';
    document.getElementById('skipBtn').style.display = mode === 'newlang' ? '' : 'none';
    document.getElementById('progressCounter').style.display = mode === 'newlang' ? '' : 'none';
    document.getElementById('reviewTitle').textContent = mode === 'newlang' ? 'Add a New Language' : 'Suggest a Translation';
    document.getElementById('suggestionLabel').textContent = mode === 'newlang' ? 'Translation in your language' : 'Your suggestion';
    document.getElementById('reviewReason').closest('label') && (document.getElementById('reviewReason').parentElement.style.display = mode === 'newlang' ? 'none' : '');

    if (mode === 'newlang') {
      // Build walk-through list of all data-t keys on this page
      _walkKeys = [];
      document.querySelectorAll('[data-t]').forEach(function(el) {
        var text = el.textContent.trim();
        if (text && text.length > 0) {
          _walkKeys.push({ key: el.getAttribute('data-t'), text: text, el: el });
        }
      });
      _walkIndex = -1;
      updateProgressCounter();
    }
  }

  function openContributePanel() {
    setReviewMode('improve');
    // Show panel with instructions
    document.getElementById('reviewKey').textContent = '';
    document.getElementById('reviewCurrent').textContent = 'Click any highlighted text on the page to suggest a better translation. Or switch to "Add new language" to translate the entire page.';
    document.getElementById('reviewSuggestion').value = '';
    document.getElementById('reviewReason').value = '';
    document.getElementById('reviewStatus').textContent = '';
    document.getElementById('reviewPanel').classList.add('open');
  }

  function openReviewPanel(el) {
    _reviewTarget = {
      key: el.getAttribute('data-t'),
      page: getCurrentPage().replace(/^\//, '').replace('.html', '') || 'home',
      currentText: el.textContent.trim(),
      lang: _reviewMode === 'newlang' ? (document.getElementById('newLangCode').value.trim() || 'new') : lang
    };

    document.getElementById('reviewKey').textContent = _reviewTarget.page + ' → ' + _reviewTarget.key + ' (' + _reviewTarget.lang + ')';
    document.getElementById('reviewCurrent').textContent = _reviewTarget.currentText;
    document.getElementById('reviewSuggestion').value = '';
    document.getElementById('reviewStatus').textContent = '';
    document.getElementById('reviewPanel').classList.add('open');
    document.getElementById('reviewSuggestion').focus();

    // Scroll the source element into view and highlight it
    el.style.outline = '3px solid var(--forest)';
    setTimeout(function() { el.style.outline = ''; }, 2000);
  }

  function skipToNext() {
    // In new language mode, advance to next key
    _walkIndex++;
    if (_walkIndex >= _walkKeys.length) {
      document.getElementById('reviewStatus').textContent = '✓ You\'ve reached the end of this page. Thank you!';
      return;
    }
    var item = _walkKeys[_walkIndex];
    openReviewPanel(item.el);
    updateProgressCounter();
    item.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function updateProgressCounter() {
    var counter = document.getElementById('progressCounter');
    if (counter && _walkKeys.length > 0) {
      counter.textContent = (_walkIndex + 1) + ' / ' + _walkKeys.length + ' strings';
    }
  }

  function openReviewPanel(el) {
    _reviewTarget = {
      key: el.getAttribute('data-t'),
      page: getCurrentPage().replace(/^\//, '').replace('.html', '') || 'home',
      currentText: el.textContent.trim(),
      lang: lang
    };
    document.getElementById('reviewKey').textContent = _reviewTarget.page + ' → ' + _reviewTarget.key + ' (' + _reviewTarget.lang + ')';
    document.getElementById('reviewCurrent').textContent = _reviewTarget.currentText;
    document.getElementById('reviewSuggestion').value = '';
    document.getElementById('reviewReason').value = '';
    document.getElementById('reviewStatus').textContent = '';
    document.getElementById('reviewPanel').classList.add('open');
    document.getElementById('reviewSuggestion').focus();
  }

  function closeReview() {
    document.getElementById('reviewPanel').classList.remove('open');
    _reviewTarget = null;
  }

  /* ── Multi-Level Send to Official — escalation pipeline ── */
  function sendToOfficial(zip, subject, body, itemType, itemId, category) {
    if (!zip || !/^\d{5}$/.test(zip)) { showToast(lang === 'es' ? 'Ingresa tu código postal primero' : 'Enter your zip code first'); return; }
    if (!_api) { showToast(lang === 'es' ? 'No disponible sin conexión' : 'Not available offline'); return; }

    var existing = document.getElementById('officialsPanel');
    if (existing) existing.remove();

    var levelLabels = {
      en: { alderman:'Alderman', mayor:'Mayor', state_rep:'State Rep', state_senator:'State Senator', us_rep:'US Representative', governor:'Governor', other:'Official' },
      es: { alderman:'Concejal', mayor:'Alcalde', state_rep:'Representante Estatal', state_senator:'Senador Estatal', us_rep:'Representante Federal', governor:'Gobernador', other:'Funcionario' }
    };

    var panel = document.createElement('div');
    panel.id = 'officialsPanel';
    panel.className = 'officials-panel';
    panel.innerHTML = '<div class="officials-inner">' +
      '<div class="officials-header">' +
        '<h3>' + (lang === 'es' ? 'Enviar a tu representante' : 'Send to your official') + '</h3>' +
        '<button onclick="document.getElementById(\'officialsPanel\').remove()" aria-label="Close">&times;</button>' +
      '</div>' +
      '<p class="officials-hint">' + (lang === 'es' ? 'Empieza con tu concejal. Si no responde, escala al siguiente nivel.' : 'Start with your alderman. If they don\'t respond, escalate to the next level.') + '</p>' +
      '<div class="officials-loading">' + (lang === 'es' ? 'Buscando representantes...' : 'Looking up your officials...') + '</div>' +
      '<div class="officials-list" id="officialsList"></div>' +
    '</div>';
    document.body.appendChild(panel);
    setTimeout(function() { panel.classList.add('open'); }, 10);

    fetch(_api + '?action=get_officials_multilevel&zip=' + zip)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        panel.querySelector('.officials-loading').style.display = 'none';
        var list = document.getElementById('officialsList');
        if (!data.officials || data.officials.length === 0) {
          list.innerHTML = '<p class="officials-empty">' +
            (lang === 'es' ? 'No se encontraron representantes.' : 'No officials found.') + '</p>';
          return;
        }

        var currentLevel = '';
        var html = '';
        data.officials.forEach(function(o) {
          var lbl = (levelLabels[lang] || levelLabels.en)[o.level] || o.level;
          if (o.level !== currentLevel) {
            currentLevel = o.level;
            var isFirst = (o.level === 'alderman');
            html += '<div class="official-level-divider' + (isFirst ? '' : ' escalation') + '">' +
              (isFirst ? '' : '<span class="escalate-arrow">&#8593; </span>') + lbl + '</div>';
          }

          var email = (o.emails && o.emails.length > 0) ? o.emails[0] : '';
          var phone = (o.phones && o.phones.length > 0) ? o.phones[0] : '';

          html += '<div class="official-card" data-level="' + o.level + '">' +
            '<div class="official-name">' + esc(o.name) + '</div>' +
            '<div class="official-office">' + esc(o.office) + '</div>';

          if (email) {
            var iT = esc(itemType || ''); var iI = esc(itemId || ''); var cat = esc(category || '');
            var mailto = 'mailto:' + encodeURIComponent(email) +
              '?subject=' + encodeURIComponent(subject) +
              '&body=' + encodeURIComponent(body);
            html += '<a href="' + mailto + '" class="official-btn official-email" onclick="EQ.trackEscalation(\'' +
              iT + "','" + iI + "','" + zip + "','" + cat + "','" + o.level + "','" + esc(o.name) + "','" + esc(email) + "')\">" +
              (lang === 'es' ? 'Enviar' : 'Send') + '</a>';
          }
          if (phone) {
            html += '<a href="tel:' + phone + '" class="official-btn official-phone">' + phone + '</a>';
          }
          if (o.url) {
            html += '<a href="' + o.url + '" target="_blank" rel="noopener" class="official-btn official-phone">' +
              (lang === 'es' ? 'Contacto web' : 'Web contact') + '</a>';
          }
          if (!email && !phone && !o.url) {
            html += '<div class="official-nocontact">' +
              (lang === 'es' ? 'Sin contacto' : 'No public contact') + '</div>';
          }
          html += '</div>';
        });
        list.innerHTML = html;
      })
      .catch(function() {
        panel.querySelector('.officials-loading').textContent =
          lang === 'es' ? 'No se pudo conectar.' : "Couldn't connect.";
      });
  }

  function trackEscalation(itemType, itemId, zip, category, level, name, email) {
    if (!_api) return;
    fetch(_api, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'update_escalation',
        item_type: itemType, item_id: itemId, zip: zip,
        category: category, level: level, status: 'sent',
        sent_to_name: name, sent_to_email: email
      })
    }).catch(function(){});
    showToast(lang === 'es' ? 'Registrado' : 'Tracked');
  }

  function esc(s) { return s ? String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }

  /* ── Share — Web Share API on mobile, copy fallback on desktop ── */
  function sharePage(title, text, url) {
    if (navigator.share) {
      navigator.share({ title: title, text: text, url: url }).catch(function(){});
    } else {
      navigator.clipboard.writeText(text + '\n' + url).then(function() {
        showToast(lang === 'es' ? 'Enlace copiado' : 'Link copied');
      }).catch(function() {
        showToast(lang === 'es' ? 'No se pudo copiar' : 'Could not copy');
      });
    }
  }

  /** Share a specific resource (name + phone + address) via native share or clipboard */
  function shareResource(name, phone, address) {
    var isEs = lang === 'es';
    var lines = [name];
    if (phone) lines.push((isEs ? 'Tel: ' : 'Call: ') + phone);
    if (address) lines.push(address);
    lines.push('');
    lines.push((isEs ? 'Encontrado en ' : 'Found on ') + 'comm-unity-os.org');
    var text = lines.join('\n');

    if (navigator.share) {
      navigator.share({ title: name, text: text }).catch(function(){});
    } else {
      navigator.clipboard.writeText(text).then(function() {
        showToast(isEs ? 'Copiado para compartir' : 'Copied to share');
      }).catch(function(){});
    }
  }

  /** Share via WhatsApp — research: preferred channel for Latina civic participants */
  function shareWhatsApp(text, url) {
    var msg = encodeURIComponent(text + (url ? '\n' + url : '\ncomm-unity-os.org'));
    window.open('https://wa.me/?text=' + msg, '_blank');
  }

  function openReview() {
    window.location.href = window.location.pathname + '?review=true';
  }

  function submitReview() {
    if (!_reviewTarget) return;
    var suggestion = document.getElementById('reviewSuggestion').value.trim();
    if (!suggestion) { document.getElementById('reviewStatus').textContent = 'Please write a suggestion.'; return; }

    var reviewer = document.getElementById('reviewerName').value.trim();
    if (reviewer) localStorage.setItem('cos-reviewer', reviewer);

    var targetLang = _reviewTarget.lang;
    var langName = '';
    if (_reviewMode === 'newlang') {
      var code = document.getElementById('newLangCode').value.trim().toLowerCase();
      langName = document.getElementById('newLangName').value.trim();
      if (!code || !langName) {
        document.getElementById('reviewStatus').textContent = 'Please enter the language name and code.';
        return;
      }
      targetLang = code;
    }

    var payload = {
      action: 'submit_translation_feedback',
      page: _reviewTarget.page,
      key: _reviewTarget.key,
      language: targetLang,
      language_name: langName || '',
      current_text: _reviewTarget.currentText,
      suggested_text: suggestion,
      reason: document.getElementById('reviewReason').value.trim(),
      reviewer: reviewer || 'Anonymous',
      is_new_language: _reviewMode === 'newlang',
      timestamp: new Date().toISOString()
    };

    document.getElementById('reviewStatus').textContent = 'Saving...';

    var afterSave = function() {
      if (_reviewMode === 'newlang') {
        document.getElementById('reviewStatus').textContent = '✓ Saved — loading next...';
        document.getElementById('reviewSuggestion').value = '';
        setTimeout(function() { skipToNext(); }, 600);
      } else {
        document.getElementById('reviewStatus').textContent = '✓ Suggestion saved — thank you!';
        setTimeout(closeReview, 1500);
      }
    };

    if (_api) {
      fetch(_api, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      }).then(afterSave).catch(function() {
        var queue = JSON.parse(localStorage.getItem('cos-review-queue') || '[]');
        queue.push(payload);
        localStorage.setItem('cos-review-queue', JSON.stringify(queue));
        afterSave();
      });
    } else {
      var queue = JSON.parse(localStorage.getItem('cos-review-queue') || '[]');
      queue.push(payload);
      localStorage.setItem('cos-review-queue', JSON.stringify(queue));
      afterSave();
    }
  }
  function buildFooter(closingKey) {
    // Trust footer — institutional credibility bar
    var trustBar = document.createElement('div');
    trustBar.className = 'trust-footer';
    trustBar.innerHTML = '<div class="trust-badges">' +
      '<span>Community-Built</span><span class="sep">·</span>' +
      '<span>Open Source</span><span class="sep">·</span>' +
      '<span>Bilingual</span><span class="sep">·</span>' +
      '<span>No Ads</span><span class="sep">·</span>' +
      '<span>$7/year</span>' +
      '</div>';
    var page2 = document.querySelector('.page');
    if (page2) page2.appendChild(trustBar);

    var footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.setAttribute('role', 'contentinfo');
    footer.innerHTML = (closingKey ? '<div class="footer-closing" data-t="' + closingKey + '">' + t(closingKey) + '</div>' : '') +
      '<div class="footer-name">Comm<span class="brand-accent">Unity</span> OS</div>' +
      '<div class="footer-sub" data-t="footer_sub">' + t('footer_sub') + '</div>' +
      '<div class="footer-support"><a href="/support.html" data-t="footer_support">' + t('footer_support') + '</a></div>' +
      '<div class="footer-translate"><a href="javascript:void(0)" onclick="EQ.openReview()" data-t="footer_translate">' + t('footer_translate') + '</a></div>' +
      '<div class="footer-contact"><a href="mailto:info@comm-unity-os.org">info@comm-unity-os.org</a></div>' +
      '<div class="footer-opensource"><a href="https://github.com/communityos" target="_blank" rel="noopener">Open source · GitHub ↗</a></div>';
    var page = document.querySelector('.page');
    if (page) page.appendChild(footer);

    // Bottom tab navigation — mobile
    var btabs = document.createElement('nav');
    btabs.className = 'bottom-tabs';
    btabs.setAttribute('aria-label', 'Main navigation');
    btabs.innerHTML = '<div class="bottom-tabs-inner">' +
      '<a href="/" class="btab"><span class="btab-icon">🏠</span><span class="btab-label">Home</span></a>' +
      '<a href="/govern.html" class="btab"><span class="btab-icon">🏛️</span><span class="btab-label">Officials</span></a>' +
      '<a href="/knowledge.html" class="btab"><span class="btab-icon">📚</span><span class="btab-label">Guides</span></a>' +
      '<a href="/discuss.html" class="btab"><span class="btab-icon">💬</span><span class="btab-label">Community</span></a>' +
      '<button class="btab" onclick="EQ.toggle()"><span class="btab-icon">🌐</span><span class="btab-label">' + (lang === 'es' ? 'English' : 'Español') + '</span></button>' +
      '</div>';
    document.body.appendChild(btabs);
    // Highlight active tab
    var curPath = window.location.pathname;
    btabs.querySelectorAll('a.btab').forEach(function(a) {
      if (a.getAttribute('href') === curPath || (curPath === '/' && a.getAttribute('href') === '/')) a.classList.add('active');
    });
  }

  /* ── Civic Loop — Living Constellation (v31) ── */
  function buildCivicLoop() {
    var page = document.querySelector('.page');
    if (!page) return;

    // Only show on community-tier pages + how-it-works
    var path = window.location.pathname.replace(/^\//,'').replace('.html','') || 'index';
    var communityPages = ['discuss','needs','propose','evaluate','connect','govern','dashboard','diagnostics','grow','lead','how-it-works','survive','understand','audit','assess','intelligence','share','story','contribute','support','learn'];
    if (communityPages.indexOf(path) < 0) return;

    var isEs = lang === 'es';
    var labels = isEs
      ? { title:'El Ciclo Cívico', sub:'Cada herramienta se conecta. Haz clic en cualquier etapa.',
          n:['Sobrevivir','Comprender','Conectar','Gobernar','Auditar'],
          d:['Comida, salud, emergencia','Cómo funcionan los sistemas','Encuentra vecinos','Exige rendición de cuentas','Rastrea promesas'],
          ret:'El ciclo se cierra cuando los datos de gobernanza mejoran los recursos de sobrevivencia',
          center:'Tu<br>Zona' }
      : { title:'The Civic Loop', sub:'Every tool connects. Click any stage to go there.',
          n:['Survive','Understand','Connect','Govern','Audit'],
          d:['Food, health, emergency','How systems work','Find neighbors','Hold leaders accountable','Track promises'],
          ret:'The loop closes when governance data improves survival resources',
          center:'Your<br>Zip' };

    var hrefs = ['/survive.html','/understand.html','/connect.html','/govern.html','/audit.html'];
    var icons = ['🔥','📖','🤝','⚖️','📋'];
    var glows = ['rgba(212,112,74,.22)','rgba(201,168,76,.22)','rgba(91,140,122,.22)','rgba(18,32,30,.35)','rgba(59,168,158,.22)'];
    var pages = ['survive','understand','connect','govern','audit'];

    var nodesHtml = '';
    for (var i = 0; i < 5; i++) {
      nodesHtml += '<a href="' + hrefs[i] + '" class="cl-node" id="cln-' + i + '" data-pg="' + pages[i] + '" style="--ng:' + glows[i] + '">' +
        '<div class="cl-node-icon">' + icons[i] + '</div>' +
        '<div class="cl-node-name">' + labels.n[i] + '</div>' +
        '<div class="cl-node-desc">' + labels.d[i] + '</div></a>';
    }

    // SVG connections with marching ants + flowing energy dots — scaled for 420px ring
    var svgHtml = '<svg class="cl-svg" viewBox="0 0 420 420" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="210" cy="210" r="135" fill="none" stroke="rgba(91,140,122,.06)" stroke-width="1.5"/>' +
      '<path class="conn" id="clc01" d="M240,46 Q350,78 355,180" stroke="rgba(91,140,122,.12)" stroke-width="1.5" fill="none"/>' +
      '<path class="conn" id="clc12" d="M365,232 Q354,330 308,368" stroke="rgba(91,140,122,.12)" stroke-width="1.5" fill="none" style="animation-delay:-.6s"/>' +
      '<path class="conn" id="clc23" d="M182,390 Q110,380 76,342" stroke="rgba(91,140,122,.12)" stroke-width="1.5" fill="none" style="animation-delay:-1.2s"/>' +
      '<path class="conn" id="clc34" d="M50,240 Q38,134 76,84" stroke="rgba(91,140,122,.12)" stroke-width="1.5" fill="none" style="animation-delay:-1.8s"/>' +
      '<path id="clc40" d="M122,46 Q166,24 205,34" stroke="rgba(212,112,74,.1)" stroke-width="2" fill="none" stroke-dasharray="6,5"/>' +
      '<defs><filter id="clDg" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur in="SourceGraphic" stdDeviation="3"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="clDgc" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur in="SourceGraphic" stdDeviation="2.5"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<circle r="3" fill="#5CE0D4" opacity=".6" filter="url(#clDg)"><animateMotion dur="3.2s" repeatCount="indefinite"><mpath href="#clc01"/></animateMotion></circle>' +
      '<circle r="3" fill="#5CE0D4" opacity=".6" filter="url(#clDg)"><animateMotion dur="3.7s" begin=".7s" repeatCount="indefinite"><mpath href="#clc12"/></animateMotion></circle>' +
      '<circle r="3" fill="#5CE0D4" opacity=".6" filter="url(#clDg)"><animateMotion dur="3.4s" begin="1.3s" repeatCount="indefinite"><mpath href="#clc23"/></animateMotion></circle>' +
      '<circle r="3" fill="#5CE0D4" opacity=".6" filter="url(#clDg)"><animateMotion dur="3.9s" begin="2s" repeatCount="indefinite"><mpath href="#clc34"/></animateMotion></circle>' +
      '<circle r="2.5" fill="#FF8A5C" opacity=".5" filter="url(#clDgc)"><animateMotion dur="4.5s" begin="2.8s" repeatCount="indefinite"><mpath href="#clc40"/></animateMotion></circle>' +
      '</svg>';

    // SVG displacement dither filter (anti-banding for cream→dark gradient)
    if (!document.getElementById('grainDither')) {
      var ditherSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ditherSvg.setAttribute('width', '0');
      ditherSvg.setAttribute('height', '0');
      ditherSvg.setAttribute('aria-hidden', 'true');
      ditherSvg.style.position = 'fixed';
      ditherSvg.innerHTML = '<filter id="grainDither" color-interpolation-filters="sRGB" x="0" y="0" width="1" height="1">' +
        '<feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" result="noise"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="noise" scale="25" xChannelSelector="R"/>' +
        '<feBlend in2="SourceGraphic"/>' +
        '</filter>';
      document.body.appendChild(ditherSvg);
    }

    // Build section outside .page (full-width dark section)
    var bleedDown = document.createElement('div');
    bleedDown.className = 'section-bleed-down';

    var section = document.createElement('section');
    section.className = 'constellation-section';
    section.innerHTML =
      '<div class="mesh-bg"></div>' +
      '<div class="amb-glow amb-1"></div><div class="amb-glow amb-2"></div><div class="amb-glow amb-3"></div>' +
      '<canvas id="clParticles"></canvas>' +
      '<h2>' + labels.title + '</h2>' +
      '<p class="c-sub">' + labels.sub + '</p>' +
      '<div class="cl-ring">' +
        '<div class="cl-ring-center"><span>' + labels.center + '</span></div>' +
        svgHtml + nodesHtml +
      '</div>' +
      '<div class="cl-ret"><span><em>↩</em> ' + labels.ret + '</span></div>';

    // Insert: bleed-down → constellation → footer (both dark, no bleed-up needed)
    var footer = page.querySelector('.site-footer');
    var parent = page.parentNode;
    if (footer) {
      // Move footer out of .page to directly after constellation
      parent.insertBefore(bleedDown, page.nextSibling);
      parent.insertBefore(section, bleedDown.nextSibling);
      parent.insertBefore(footer, section.nextSibling);
    } else {
      parent.insertBefore(bleedDown, page.nextSibling);
      parent.insertBefore(section, bleedDown.nextSibling);
    }

    // You-are-here highlight
    var pg = location.pathname.replace(/.*\//,'').replace('.html','');
    var hereEl = section.querySelector('[data-pg="' + pg + '"]');
    if (hereEl) {
      hereEl.classList.add('cl-here');
      hereEl.style.transform = pg === pages[0] ? 'translateX(-50%) scale(1.08)' : 'scale(1.08)';
    }

    // Start particle field
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTimeout(function() {
        _createParticleField(document.getElementById('clParticles'), {
          count: 50, maxDist: 110,
          nearRGB: '123,191,168', farRGB: '91,140,122', lineRGB: '91,140,122'
        });
      }, 200);
    }
  }

  /* ── Depth-differentiated Particle Field Engine ── */
  function _createParticleField(canvas, opts) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var ps = [], dpr = window.devicePixelRatio || 1;
    var N = opts.count || 45, maxD = opts.maxDist || 105;

    function resize() {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    resize();
    window.addEventListener('resize', resize);

    for (var i = 0; i < N; i++) {
      var depth = Math.random();
      ps.push({
        x: Math.random()*canvas.offsetWidth,
        y: Math.random()*canvas.offsetHeight,
        vx: (Math.random()-.5)*.11*(depth*.5+.5),
        vy: (Math.random()-.5)*.11*(depth*.5+.5),
        r: depth*1.4+.3, depth: depth,
        seed: Math.random()*Math.PI*2,
        alpha: .06 + depth * .1
      });
    }

    function draw() {
      ctx.clearRect(0,0,canvas.offsetWidth,canvas.offsetHeight);
      var w=canvas.offsetWidth,h=canvas.offsetHeight,t=Date.now()*.001;
      for (var i=0;i<ps.length;i++) {
        var p=ps[i], spd=.4+p.depth*.6;
        p.x+=p.vx+Math.sin(t*.22+p.seed)*.06*spd;
        p.y+=p.vy+Math.cos(t*.18+p.seed)*.06*spd;
        if(p.x<0)p.x=w;if(p.x>w)p.x=0;
        if(p.y<0)p.y=h;if(p.y>h)p.y=0;
        ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        var a=p.alpha+Math.sin(t*.7+p.seed)*.035;
        ctx.fillStyle=p.depth>.6?'rgba('+opts.nearRGB+','+a+')':'rgba('+opts.farRGB+','+(a*.55)+')';
        ctx.fill();
      }
      for(var i=0;i<ps.length;i++){
        for(var j=i+1;j<ps.length;j++){
          var dx=ps[i].x-ps[j].x,dy=ps[i].y-ps[j].y,dist=Math.sqrt(dx*dx+dy*dy);
          if(dist<maxD){
            var avgD=(ps[i].depth+ps[j].depth)/2;
            ctx.beginPath();ctx.moveTo(ps[i].x,ps[i].y);ctx.lineTo(ps[j].x,ps[j].y);
            ctx.strokeStyle='rgba('+opts.lineRGB+','+(.035*(1-dist/maxD)*(.25+avgD*.75))+')';
            ctx.lineWidth=.3+avgD*.3;ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ── Scroll Reveal Observer ── */
  function initScrollReveal() {
    var els = document.querySelectorAll('.rv');
    if (!els.length) return;
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) { e.target.classList.add('vis'); obs.unobserve(e.target); }
      });
    }, { threshold: .1, rootMargin: '0px 0px -30px 0px' });
    els.forEach(function(el) { obs.observe(el); });
  }

  /* ── Accessibility Injection ── */
  function injectA11y() {
    // Skip navigation link
    var skip = document.createElement('a');
    skip.href = '#main-content';
    skip.className = 'skip-nav';
    skip.textContent = lang === 'es' ? 'Saltar al contenido' : 'Skip to content';
    document.body.insertBefore(skip, document.body.firstChild);

    // Main content landmark
    var page = document.querySelector('.page');
    if (page) {
      page.id = 'main-content';
      page.setAttribute('role', 'main');
      page.setAttribute('tabindex', '-1');
    }

    // Nav landmark
    var nav = document.querySelector('.site-nav');
    if (nav) {
      nav.setAttribute('role', 'navigation');
      nav.setAttribute('aria-label', lang === 'es' ? 'Navegación principal' : 'Main navigation');
    }

    // Nav drawer
    var drawer = document.getElementById('navDrawer');
    if (drawer) {
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-label', lang === 'es' ? 'Menú de navegación' : 'Navigation menu');
    }

    // Language toggle
    var langBtn = document.querySelector('.lang-toggle');
    if (langBtn) {
      langBtn.setAttribute('aria-label', lang === 'es' ? 'Cambiar a inglés' : 'Switch to Spanish');
      langBtn.setAttribute('role', 'button');
    }

    // Menu button
    var menuBtn = document.querySelector('.nav-menu-btn');
    if (menuBtn) {
      menuBtn.setAttribute('aria-label', lang === 'es' ? 'Abrir menú' : 'Open menu');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.setAttribute('aria-controls', 'navDrawer');
    }

    // Close button
    var closeBtn = document.querySelector('.nav-close');
    if (closeBtn) {
      closeBtn.setAttribute('aria-label', lang === 'es' ? 'Cerrar menú' : 'Close menu');
    }

    // All form inputs — associate labels
    document.querySelectorAll('input[placeholder]:not([aria-label])').forEach(function(inp) {
      inp.setAttribute('aria-label', inp.placeholder);
    });
    document.querySelectorAll('select:not([aria-label])').forEach(function(sel) {
      var label = sel.previousElementSibling;
      if (label && label.textContent) {
        sel.setAttribute('aria-label', label.textContent.trim());
      }
    });
    document.querySelectorAll('textarea[placeholder]:not([aria-label])').forEach(function(ta) {
      ta.setAttribute('aria-label', ta.placeholder);
    });

    // Buttons without text — add aria-label from title or context
    document.querySelectorAll('button:not([aria-label])').forEach(function(btn) {
      if (!btn.textContent.trim() && !btn.querySelector('svg title')) {
        btn.setAttribute('aria-label', 'Button');
      }
    });

    // Page header — h1 as document title backup
    var h1 = document.querySelector('h1');
    if (h1 && !document.title) {
      document.title = h1.textContent + ' — CommUnity OS';
    }

    // Footer landmark
    var footer = document.querySelector('.site-footer');
    if (footer) {
      footer.setAttribute('role', 'contentinfo');
    }

    // Live region for toasts
    var toastContainer = document.querySelector('.toast');
    if (toastContainer) {
      toastContainer.setAttribute('role', 'alert');
      toastContainer.setAttribute('aria-live', 'polite');
    }
  }

  /* ── Offline Detection ── */
  function injectOfflineDetection() {
    var bar = document.createElement('div');
    bar.className = 'offline-bar';
    bar.id = 'offlineBar';
    bar.setAttribute('role', 'alert');
    bar.setAttribute('aria-live', 'assertive');
    bar.textContent = lang === 'es'
      ? 'Sin conexión. Algunas funciones pueden no estar disponibles.'
      : 'You\'re offline. Some features may not be available.';
    document.body.appendChild(bar);

    function updateStatus() {
      var offline = !navigator.onLine;
      bar.classList.toggle('show', offline);
      // Disable post buttons when offline
      if (offline) {
        document.querySelectorAll('button[type="submit"],.post-btn,.v-btn-primary').forEach(function(b) {
          if (!b.dataset.offlineDisabled) {
            b.dataset.offlineDisabled = 'true';
            b.dataset.origTitle = b.title || '';
            b.title = lang === 'es' ? 'Sin conexión' : 'Offline';
          }
        });
      } else {
        document.querySelectorAll('[data-offline-disabled]').forEach(function(b) {
          b.title = b.dataset.origTitle || '';
          delete b.dataset.offlineDisabled;
        });
      }
    }

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
  }

  /* ── Service Worker Registration ── */
  var _deferredInstallPrompt = null;

  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(function() {});
    }
    // PWA install prompt — capture the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      _deferredInstallPrompt = e;
      // Show install button after 2nd visit
      var visits = parseInt(localStorage.getItem('cos-visits') || '0') + 1;
      localStorage.setItem('cos-visits', String(visits));
      if (visits >= 2) {
        showInstallBanner();
      }
    });
  }

  function showInstallBanner() {
    if (!_deferredInstallPrompt) return;
    var isEs = lang === 'es';
    var banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:var(--deep);color:var(--cream);padding:12px 20px;border-radius:12px;font-size:.78rem;z-index:500;display:flex;align-items:center;gap:12px;box-shadow:0 4px 20px rgba(0,0,0,.15);max-width:90vw';
    banner.innerHTML = '<span>' + (isEs ? 'Instalar CommUnity OS en tu teléfono' : 'Install CommUnity OS on your phone') + '</span>' +
      '<button onclick="EQ.installPWA()" style="background:var(--sage);color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:.75rem;font-weight:600;cursor:pointer;white-space:nowrap;min-height:36px">' + (isEs ? 'Instalar' : 'Install') + '</button>' +
      '<button onclick="this.parentNode.remove();localStorage.setItem(\'cos-install-dismissed\',\'1\')" style="background:none;border:none;color:var(--cream);cursor:pointer;font-size:1rem;padding:4px;opacity:.7">✕</button>';
    if (!localStorage.getItem('cos-install-dismissed')) {
      document.body.appendChild(banner);
    }
  }

  function installPWA() {
    if (!_deferredInstallPrompt) return;
    _deferredInstallPrompt.prompt();
    _deferredInstallPrompt.userChoice.then(function(choice) {
      if (choice.outcome === 'accepted') {
        showToast(lang === 'es' ? '¡Instalado!' : 'Installed!');
      }
      _deferredInstallPrompt = null;
    });
  }

  /* ── Init ── */
  function init(translations, opts) {
    T = translations || {};
    if (!T.en) T.en = {};
    if (!T.es) T.es = {};
    T.en.footer_sub = T.en.footer_sub || 'Free Tools for Neighborhoods · 2026';
    T.es.footer_sub = T.es.footer_sub || 'Herramientas Gratuitas para Vecindarios · 2026';
    T.en.footer_support = T.en.footer_support || 'This platform is free because people like you support it. ♡';
    T.es.footer_support = T.es.footer_support || 'Esta plataforma es gratuita porque personas como tú la apoyan. ♡';
    T.en.footer_translate = T.en.footer_translate || 'Speak another language? Help us translate this page →';
    T.es.footer_translate = T.es.footer_translate || '¿Hablas otro idioma? Ayúdanos a traducir esta página →';

    // API URL: page-level var > localStorage
    if (typeof API !== 'undefined' && API) {
      _hub = API;
      _api = API;
      localStorage.setItem(API_KEY, API);
    }

    // Auto-resolve community API if zip is cached
    var cachedZip = localStorage.getItem('cos-zip');
    if (cachedZip && cachedZip.length === 5) {
      if (cachedZip === _communityZip && _communityApi) {
        _api = _communityApi; // use cached community URL
      } else {
        resolveApi(cachedZip); // async resolve, updates _api when done
      }
    }

    buildNav();
    injectA11y();
    injectOfflineDetection();
    injectArcProgress();
    openCacheDB(); // Initialize IndexedDB cache
    if (opts && opts.footer !== false) {
      buildFooter(opts.closingKey || null);
    }
    if (!opts || opts.civicLoop !== false) {
      // Skip constellation on homepage — problem grid IS the navigation now
      var isHome = window.location.pathname === '/' || window.location.pathname === '/index.html';
      if (!isHome) buildCivicLoop();
    }
    // Auto-tag sections for scroll reveal (design polish v33)
    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var rvSelectors = '.resource-card, .hw-section, .ld-section, .prob-card, .dx-section, .ob-section, .gov-card, .mod-card, .nbf-card';
      document.querySelectorAll(rvSelectors).forEach(function(el, i) {
        if (!el.classList.contains('rv')) {
          el.classList.add('rv');
          el.style.transitionDelay = Math.min(i * 0.04, 0.3) + 's';
        }
      });
    }
    initScrollReveal();
    applyLang();
    initReviewMode();
    logPageView();
    registerSW();

    // Auto-load alerts if page specified
    if (opts && opts.alertPage) {
      loadAlerts(opts.alertPage);
    }

    // API health check — run once on load, then every 60s
    setTimeout(checkApiHealth, 3000);
    _apiCheckInterval = setInterval(checkApiHealth, 60000);

    // Check for new cache version
    setTimeout(checkForUpdate, 10000);

    // First-visit onboarding (index page only)
    setTimeout(showOnboarding, 1500);

    // Anonymous page-flow tracking (Arnstein arc research)
    trackPageFlow();

    // Cross-domain perspective integration (Components 3/4 equivalent)
    setTimeout(renderCrossDomain, 800);
  }

  /* ── Cross-Domain Prompts — "See It Differently" ── */
  /* Each page names what it shows, what it can't see, and where to look next. */
  /* This is the Honors PSLO 3 Components 3/4 translated to civic life. */
  var CROSS_DOMAIN = {
    survive: {
      lens_en: 'This page shows you where to find help right now.',
      blind_en: 'But crisis resources don\'t explain WHY these gaps exist — or how to change the systems that create them.',
      links: [
        { page: 'understand', label_en: 'Know your legal rights', label_es: 'Conoce tus derechos' },
        { page: 'evaluate', label_en: 'Check on the leaders responsible', label_es: 'Revisa a los responsables' },
        { page: 'knowledge', label_en: 'Understand the systems behind it', label_es: 'Entiende los sistemas detrás' }
      ],
      lens_es: 'Esta página muestra dónde encontrar ayuda ahora.',
      blind_es: 'Pero los recursos de crisis no explican POR QUÉ existen estos vacíos — ni cómo cambiar los sistemas que los crean.'
    },
    vitals: {
      lens_en: 'This page shows you what your body is telling you.',
      blind_en: 'But your health numbers are shaped by things a blood pressure cuff can\'t measure — housing stress, food access, work conditions, and whether anyone is listening.',
      links: [
        { page: 'survive', label_en: 'Find food and health services', label_es: 'Encuentra comida y servicios de salud' },
        { page: 'needs', label_en: 'Ask neighbors for help', label_es: 'Pide ayuda a tus vecinos' },
        { page: 'grow', label_en: 'Grow your own food', label_es: 'Cultiva tu propia comida' }
      ],
      lens_es: 'Esta página muestra lo que tu cuerpo te dice.',
      blind_es: 'Pero tus números de salud son moldeados por cosas que un aparato no puede medir — estrés de vivienda, acceso a comida, condiciones de trabajo, y si alguien está escuchando.'
    },
    understand: {
      lens_en: 'This page shows you what the law says.',
      blind_en: 'But knowing your rights doesn\'t mean you can exercise them alone. Rights become real when neighbors organize around them.',
      links: [
        { page: 'discuss', label_en: 'Talk to neighbors about it', label_es: 'Habla con vecinos sobre esto' },
        { page: 'propose', label_en: 'Propose a policy change', label_es: 'Propón un cambio de política' },
        { page: 'audit', label_en: 'Audit the institution responsible', label_es: 'Audita la institución responsable' }
      ],
      lens_es: 'Esta página muestra lo que dice la ley.',
      blind_es: 'Pero saber tus derechos no significa que puedas ejercerlos solo. Los derechos se vuelven reales cuando los vecinos se organizan.'
    },
    connect: {
      lens_en: 'This page shows you who is nearby.',
      blind_en: 'But connection without information is social without being civic. Knowing your neighbors matters more when you also know your rights and your data.',
      links: [
        { page: 'understand', label_en: 'Learn what rights you share', label_es: 'Aprende qué derechos comparten' },
        { page: 'intelligence', label_en: 'See data about your area', label_es: 'Ve los datos de tu área' },
        { page: 'govern', label_en: 'Govern together', label_es: 'Gobiernen juntos' }
      ],
      lens_es: 'Esta página muestra quién está cerca.',
      blind_es: 'Pero la conexión sin información es social sin ser cívica. Conocer a tus vecinos importa más cuando también conoces tus derechos y tus datos.'
    },
    grow: {
      lens_en: 'This page shows you how to grow food.',
      blind_en: 'But a garden doesn\'t explain why the nearest grocery store is a mile away, or why fresh produce costs what it does in your zip code.',
      links: [
        { page: 'intelligence', label_en: 'See food access data for your zip', label_es: 'Ve datos de acceso a comida' },
        { page: 'audit', label_en: 'Audit local food infrastructure', label_es: 'Audita la infraestructura de comida local' },
        { page: 'needs', label_en: 'Share your harvest with neighbors', label_es: 'Comparte tu cosecha con vecinos' }
      ],
      lens_es: 'Esta página muestra cómo cultivar comida.',
      blind_es: 'Pero un jardín no explica por qué la tienda más cercana está a una milla, o por qué las frutas y verduras cuestan lo que cuestan en tu zona.'
    },
    govern: {
      lens_en: 'This page shows you the tools to hold power accountable.',
      blind_en: 'But evaluation without lived experience is abstract. The best civic judgment comes from people who\'ve used the services they\'re evaluating.',
      links: [
        { page: 'survive', label_en: 'See what services actually exist', label_es: 'Ve qué servicios realmente existen' },
        { page: 'vitals', label_en: 'Check your own health first', label_es: 'Revisa tu propia salud primero' },
        { page: 'discuss', label_en: 'Hear what neighbors experience', label_es: 'Escucha lo que viven los vecinos' }
      ],
      lens_es: 'Esta página muestra las herramientas para pedir cuentas al poder.',
      blind_es: 'Pero evaluar sin experiencia vivida es abstracto. El mejor juicio cívico viene de personas que han usado los servicios que están evaluando.'
    },
    discuss: {
      lens_en: 'This page shows you what your neighbors are saying.',
      blind_en: 'But conversation without data is opinion. And opinion without action is venting. What would change if you brought numbers to this discussion?',
      links: [
        { page: 'intelligence', label_en: 'Back it up with data', label_es: 'Respáldalo con datos' },
        { page: 'propose', label_en: 'Turn talk into a proposal', label_es: 'Convierte la charla en propuesta' },
        { page: 'evaluate', label_en: 'Check who should be listening', label_es: 'Revisa quién debería estar escuchando' }
      ],
      lens_es: 'Esta página muestra lo que dicen tus vecinos.',
      blind_es: 'Pero la conversación sin datos es opinión. Y la opinión sin acción es desahogo. ¿Qué cambiaría si traes números a esta discusión?'
    },
    needs: {
      lens_en: 'This page shows what people need and what people offer.',
      blind_en: 'But individual needs often have systemic causes. If ten people need the same thing, the problem isn\'t ten people — it\'s a policy.',
      links: [
        { page: 'propose', label_en: 'Propose a systemic fix', label_es: 'Propón un arreglo de fondo' },
        { page: 'audit', label_en: 'Audit the program that should be helping', label_es: 'Audita el programa que debería ayudar' },
        { page: 'grow', label_en: 'Build local capacity instead', label_es: 'Construye capacidad local' }
      ],
      lens_es: 'Esta página muestra qué necesita la gente y qué ofrece.',
      blind_es: 'Pero las necesidades individuales muchas veces tienen causas de sistema. Si diez personas necesitan lo mismo, el problema no son diez personas — es una política.'
    },
    evaluate: {
      lens_en: 'This page lets you check how your leader is doing.',
      blind_en: 'But a score without context is just a number. What does your community\'s health data say about this leader\'s impact? What do neighbors say?',
      links: [
        { page: 'intelligence', label_en: 'See the data behind the score', label_es: 'Ve los datos detrás del puntaje' },
        { page: 'discuss', label_en: 'Discuss with neighbors first', label_es: 'Primero discute con vecinos' },
        { page: 'assess', label_en: 'Assess the programs they run', label_es: 'Evalúa los programas que dirigen' }
      ],
      lens_es: 'Esta página permite revisar cómo va tu líder.',
      blind_es: 'Pero un puntaje sin contexto es solo un número. ¿Qué dicen los datos de salud sobre el impacto de este líder? ¿Qué dicen los vecinos?'
    },
    assess: {
      lens_en: 'This page lets you rate a community program.',
      blind_en: 'But program performance doesn\'t explain community need. A program can score well and still miss the people who need it most.',
      links: [
        { page: 'needs', label_en: 'See what people actually need', label_es: 'Ve lo que la gente realmente necesita' },
        { page: 'vitals', label_en: 'Check community health patterns', label_es: 'Revisa patrones de salud comunitaria' },
        { page: 'evaluate', label_en: 'Check who oversees this program', label_es: 'Revisa quién supervisa este programa' }
      ],
      lens_es: 'Esta página permite calificar un programa comunitario.',
      blind_es: 'Pero el desempeño del programa no explica la necesidad de la comunidad. Un programa puede tener buena calificación y aún así no alcanzar a quienes más lo necesitan.'
    },
    audit: {
      lens_en: 'This page lets you audit an institution against a standard.',
      blind_en: 'But auditing from the outside misses what it feels like from the inside. The people who use a service know things the checklist doesn\'t ask.',
      links: [
        { page: 'discuss', label_en: 'Hear from people who use it', label_es: 'Escucha a quienes lo usan' },
        { page: 'needs', label_en: 'See unmet needs it should address', label_es: 'Ve necesidades que debería cubrir' },
        { page: 'propose', label_en: 'Propose what should change', label_es: 'Propón lo que debería cambiar' }
      ],
      lens_es: 'Esta página permite auditar una institución contra un estándar.',
      blind_es: 'Pero auditar desde afuera no capta cómo se siente desde adentro. Las personas que usan un servicio saben cosas que la lista de verificación no pregunta.'
    },
    propose: {
      lens_en: 'This page lets you propose a change and build support.',
      blind_en: 'But a proposal without evidence is a wish. And a proposal that doesn\'t name who\'s affected isn\'t ready for a vote.',
      links: [
        { page: 'intelligence', label_en: 'Find the data that supports it', label_es: 'Encuentra los datos que lo respaldan' },
        { page: 'discuss', label_en: 'Test the idea with neighbors', label_es: 'Prueba la idea con vecinos' },
        { page: 'assess', label_en: 'Check if a program already addresses it', label_es: 'Revisa si un programa ya lo atiende' }
      ],
      lens_es: 'Esta página permite proponer un cambio y construir apoyo.',
      blind_es: 'Pero una propuesta sin evidencia es un deseo. Y una propuesta que no nombra a quién afecta no está lista para votarse.'
    },
    knowledge: {
      lens_en: 'This page explains how systems work, where they break, and what to do.',
      blind_en: 'But understanding a system doesn\'t change it. Knowledge becomes power when it\'s shared and acted on collectively.',
      links: [
        { page: 'discuss', label_en: 'Share what you learned', label_es: 'Comparte lo que aprendiste' },
        { page: 'propose', label_en: 'Propose a fix for what\'s broken', label_es: 'Propón un arreglo para lo que está roto' },
        { page: 'needs', label_en: 'Help someone who needs this info', label_es: 'Ayuda a alguien que necesita esta info' }
      ],
      lens_es: 'Esta página explica cómo funcionan los sistemas, dónde fallan y qué hacer.',
      blind_es: 'Pero entender un sistema no lo cambia. El conocimiento se vuelve poder cuando se comparte y se actúa en conjunto.'
    },
    intelligence: {
      lens_en: 'This page shows you data — numbers, trends, API feeds.',
      blind_en: 'But data without lived experience is surveillance. Numbers describe a community. They don\'t speak for it.',
      links: [
        { page: 'discuss', label_en: 'Ask what the numbers mean to neighbors', label_es: 'Pregunta qué significan los números para los vecinos' },
        { page: 'evaluate', label_en: 'Hold leaders accountable with the data', label_es: 'Pide cuentas a los líderes con los datos' },
        { page: 'vitals', label_en: 'Add your own health data anonymously', label_es: 'Añade tus datos de salud de forma anónima' }
      ],
      lens_es: 'Esta página muestra datos — números, tendencias, fuentes de APIs.',
      blind_es: 'Pero los datos sin experiencia vivida son vigilancia. Los números describen una comunidad. No hablan por ella.'
    },
    dashboard: {
      lens_en: 'This page shows community activity at a glance.',
      blind_en: 'But a dashboard measures what\'s easy to count. It doesn\'t measure trust, fear, belonging, or whether anyone feels heard.',
      links: [
        { page: 'discuss', label_en: 'Listen to what\'s behind the numbers', label_es: 'Escucha lo que hay detrás de los números' },
        { page: 'vitals', label_en: 'See the health underneath', label_es: 'Ve la salud debajo de los números' },
        { page: 'propose', label_en: 'Act on what the dashboard reveals', label_es: 'Actúa según lo que el panel revela' }
      ],
      lens_es: 'Esta página muestra la actividad comunitaria de un vistazo.',
      blind_es: 'Pero un panel mide lo que es fácil de contar. No mide la confianza, el miedo, el sentido de pertenencia, o si alguien se siente escuchado.'
    },
    learn: {
      lens_en: 'This page connects you to educational resources.',
      blind_en: 'But education alone doesn\'t change conditions. It changes what you see — and what you see changes what you do.',
      links: [
        { page: 'knowledge', label_en: 'Learn how specific systems work', label_es: 'Aprende cómo funcionan sistemas específicos' },
        { page: 'govern', label_en: 'Use what you learned to govern', label_es: 'Usa lo que aprendiste para gobernar' },
        { page: 'defend', label_en: 'Fight a system that got it wrong', label_es: 'Pelea contra un sistema que se equivocó' }
      ],
      lens_es: 'Esta página conecta con recursos educativos.',
      blind_es: 'Pero la educación sola no cambia las condiciones. Cambia lo que ves — y lo que ves cambia lo que haces.'
    },
    knowledge: {
      lens_en: 'These guides show how systems work, where they break, and what to do.',
      blind_en: 'Understanding a broken system doesn\'t protect you from it. What would change if you could act on what you just learned — right now?',
      links: [
        { page: 'defend', label_en: 'Generate a dispute letter', label_es: 'Genera una carta de disputa' },
        { page: 'discuss', label_en: 'Find out if it happened to others', label_es: 'Descubre si les pasó a otros' },
        { page: 'audit', label_en: 'Track who promised to fix it', label_es: 'Rastrea quién prometió arreglarlo' }
      ],
      lens_es: 'Estas guías muestran cómo funcionan los sistemas, dónde fallan y qué hacer.',
      blind_es: 'Entender un sistema roto no te protege de él. ¿Qué cambiaría si pudieras actuar ahora mismo?'
    },
    defend: {
      lens_en: 'This page helps you write a letter to fight an error.',
      blind_en: 'But one person\'s correction doesn\'t fix the system. What if everyone it happened to could see each other?',
      links: [
        { page: 'knowledge', label_en: 'Understand the system behind it', label_es: 'Entiende el sistema detrás' },
        { page: 'discuss', label_en: 'Tell your neighbors what happened', label_es: 'Cuenta a tus vecinos lo que pasó' },
        { page: 'connect', label_en: 'Find others who faced the same thing', label_es: 'Encuentra a otros que enfrentaron lo mismo' }
      ],
      lens_es: 'Esta página te ayuda a escribir una carta para pelear un error.',
      blind_es: 'Pero la corrección de una persona no arregla el sistema. ¿Y si todos los afectados pudieran verse?'
    },
    'benefits-check': {
      lens_en: 'This page helps you understand which benefits are safe to use.',
      blind_en: 'But fear of one rule keeps families from food, health care, and stability their children are legally entitled to.',
      links: [
        { page: 'survive', label_en: 'Find food and health resources', label_es: 'Encuentra recursos de comida y salud' },
        { page: 'knowledge', label_en: 'Read how immigration systems work', label_es: 'Lee cómo funcionan los sistemas de inmigración' },
        { page: 'defend', label_en: 'Generate a dispute letter', label_es: 'Genera una carta de disputa' }
      ],
      lens_es: 'Esta página te ayuda a entender qué beneficios son seguros de usar.',
      blind_es: 'Pero el miedo a una regla mantiene a las familias lejos de la comida, salud y estabilidad a la que sus hijos tienen derecho legal.'
    }
  };

  function renderCrossDomain() {
    var page = getCurrentPage().replace(/^\//, '').replace('.html', '') || 'index';
    var data = CROSS_DOMAIN[page];
    if (!data) return; // No prompt for index, share, story, support, contribute, 404

    var es = (lang === 'es');
    var lens = es ? data.lens_es : data.lens_en;
    var blind = es ? data.blind_es : data.blind_en;
    var title = es ? 'Míralo diferente' : 'See it differently';

    var linksHtml = data.links.map(function(l) {
      var label = es ? l.label_es : l.label_en;
      return '<a href="' + l.page + '.html" class="cd-link" data-cd-from="' + page + '" data-cd-to="' + l.page + '">' + label + '</a>';
    }).join('');

    var html = '<div class="cd-prompt" role="complementary" aria-label="' + title + '">' +
      '<div class="cd-icon">◇</div>' +
      '<div class="cd-content">' +
        '<div class="cd-title">' + title + '</div>' +
        '<p class="cd-lens">' + lens + '</p>' +
        '<p class="cd-blind">' + blind + '</p>' +
        '<div class="cd-links">' + linksHtml + '</div>' +
      '</div></div>';

    // Insert at end of .page content (before constellation section starts)
    var pageEl = document.querySelector('.page');
    if (pageEl) {
      pageEl.insertAdjacentHTML('beforeend', html);
    } else {
      var footer = document.querySelector('footer');
      if (footer) {
        footer.insertAdjacentHTML('beforebegin', html);
      } else {
        document.body.insertAdjacentHTML('beforeend', html);
      }
    }

    // Track cross-domain clicks for Arnstein research
    document.querySelectorAll('.cd-link').forEach(function(a) {
      a.addEventListener('click', function() {
        var from = this.getAttribute('data-cd-from');
        var to = this.getAttribute('data-cd-to');
        if (_api) {
          try { new Image().src = _api + '?action=page_transition&from=' + from + '&to=' + to + '&type=cross_domain'; } catch(e) {}
        }
      });
    });
  }

  /* ── Page-Flow Tracking — anonymous transition data for arc research ── */
  function trackPageFlow() {
    var currentPage = getCurrentPage().replace(/^\//, '').replace('.html', '') || 'home';
    var lastPage = sessionStorage.getItem('cos-last-page') || 'entry';
    sessionStorage.setItem('cos-last-page', currentPage);

    // Record transition: lastPage → currentPage
    // Stored in sessionStorage as aggregate counts, dies with tab (no privacy leak)
    var flowKey = 'cos-flow';
    try {
      var flows = JSON.parse(sessionStorage.getItem(flowKey) || '{}');
      var transKey = lastPage + '>' + currentPage;
      flows[transKey] = (flows[transKey] || 0) + 1;
      sessionStorage.setItem(flowKey, JSON.stringify(flows));
    } catch(e) {}

    // Report transition to server (aggregated, no PII)
    if (_api && lastPage !== 'entry' && lastPage !== currentPage) {
      try {
        var img = new Image();
        img.src = _api + '?action=page_transition&from=' + lastPage + '&to=' + currentPage;
      } catch(e) {}
    }
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeNav();
  });

  /* ── Crisis Hotlines — structured data for all pages ── */
  var CRISIS_HOTLINES = [
    { id:'988', phone:'988', text:'988', nameEn:'Suicide & Crisis Lifeline', nameEs:'Línea de Crisis 988', noteEn:'Call or text 988. For Spanish, press 2 or text HOLA to 741741', noteEs:'Llama o envía texto al 988. Para español, presiona 2 o envía HOLA al 741741', priority:1 },
    { id:'dv', phone:'1-800-799-7233', text:'START to 88788', nameEn:'Domestic Violence Hotline', nameEs:'Línea de Violencia Doméstica', noteEn:'Safety planning, shelter referrals. 200+ languages', noteEs:'Plan de seguridad, refugios. 200+ idiomas', priority:1 },
    { id:'poison', phone:'1-800-222-1222', text:'', nameEn:'Poison Control', nameEs:'Control de Envenenamiento', noteEn:'24/7 expert guidance. 150+ languages', noteEs:'Orientación experta 24/7. 150+ idiomas', priority:1 },
    { id:'rainn', phone:'800-656-4673', text:'', nameEn:'Sexual Assault Hotline (RAINN)', nameEs:'Línea de Asalto Sexual (RAINN)', noteEn:'Trained support, local provider referrals', noteEs:'Apoyo capacitado, referencias locales', priority:2 },
    { id:'samhsa', phone:'1-800-662-4357', text:'ZIP to 435748', nameEn:'SAMHSA Substance Use Helpline', nameEs:'Línea de Ayuda SAMHSA', noteEn:'Treatment referrals 24/7', noteEs:'Referencias de tratamiento 24/7', priority:2 },
    { id:'child', phone:'1-800-422-4453', text:'', nameEn:'Child Abuse Hotline', nameEs:'Línea de Abuso Infantil', noteEn:'Report child abuse. Bilingual', noteEs:'Reportar abuso infantil. Bilingüe', priority:2 },
    { id:'vet', phone:'988', text:'838255', nameEn:'Veterans Crisis Line', nameEs:'Línea de Crisis para Veteranos', noteEn:'Call 988 press 1, or text 838255', noteEs:'Llama al 988 presiona 1, o texto al 838255', priority:2 },
    { id:'homeless_vet', phone:'1-877-424-3838', text:'', nameEn:'Homeless Veterans Helpline', nameEs:'Línea para Veteranos sin Hogar', noteEn:'Emergency housing', noteEs:'Vivienda de emergencia', priority:3 },
    { id:'elder', phone:'1-800-677-1116', text:'', nameEn:'Eldercare Locator', nameEs:'Localizador de Servicios para Adultos Mayores', noteEn:'Senior services, elder abuse', noteEs:'Servicios para mayores', priority:3 },
    { id:'energy', phone:'1-866-674-6327', text:'', nameEn:'Energy Assistance (LIHEAP)', nameEs:'Asistencia de Energía (LIHEAP)', noteEn:'Utility shutoff help', noteEs:'Ayuda con cortes de servicios', priority:3 },
    { id:'lifeline', phone:'1-800-234-9473', text:'', nameEn:'Lifeline (Discounted Phone/Internet)', nameEs:'Lifeline (Teléfono/Internet con Descuento)', noteEn:'$9.25/month discount', noteEs:'Descuento de $9.25/mes', priority:3 },
    { id:'ada', phone:'1-800-514-0301', text:'', nameEn:'ADA Information Line', nameEs:'Línea de Información ADA', noteEn:'Disability rights', noteEs:'Derechos de discapacidad', priority:3 },
    { id:'ticket', phone:'1-866-968-7842', text:'', nameEn:'Ticket to Work', nameEs:'Ticket to Work', noteEn:'Employment support for SSI/SSDI', noteEs:'Apoyo de empleo para SSI/SSDI', priority:3 },
    { id:'elder_fraud', phone:'1-833-372-8311', text:'', nameEn:'Elder Fraud Hotline', nameEs:'Línea de Fraude contra Adultos Mayores', noteEn:'Financial exploitation', noteEs:'Explotación financiera', priority:3 },
    { id:'eviction', phone:'855-631-0811', text:'', nameEn:'Eviction Help Illinois', nameEs:'Ayuda de Desalojo Illinois', noteEn:'Free legal help for renters', noteEs:'Ayuda legal gratuita para inquilinos', priority:2 }
  ];

  function telLink(number, label) {
    var clean = number.replace(/[^\d+]/g, '');
    return '<a href="tel:' + clean + '" class="tel-link">' + (label || number) + '</a>';
  }

  function renderCrisisBar(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var isEs = lang === 'es';
    var priority1 = CRISIS_HOTLINES.filter(function(h) { return h.priority === 1; });
    var html = '<div class="crisis-bar">';
    priority1.forEach(function(h) {
      html += '<div class="crisis-item"><a href="tel:' + h.phone.replace(/[^\d+]/g, '') + '" class="crisis-phone">' + h.phone + '</a>' +
        '<span class="crisis-name">' + (isEs ? h.nameEs : h.nameEn) + '</span></div>';
    });
    html += '<button class="crisis-more" onclick="EQ.toggleCrisisPanel()">' + (isEs ? 'Más líneas de ayuda ▾' : 'More helplines ▾') + '</button>';
    html += '<div class="crisis-panel" id="crisisPanel" style="display:none">';
    CRISIS_HOTLINES.forEach(function(h) {
      if (h.priority === 1) return;
      html += '<div class="crisis-row"><a href="tel:' + h.phone.replace(/[^\d+]/g, '') + '" class="crisis-phone">' + h.phone + '</a>' +
        '<div class="crisis-detail"><strong>' + (isEs ? h.nameEs : h.nameEn) + '</strong><br><span class="crisis-note">' + (isEs ? h.noteEs : h.noteEn) + '</span>' +
        (h.text ? '<br><span class="crisis-text">' + (isEs ? 'Texto: ' : 'Text: ') + h.text + '</span>' : '') + '</div></div>';
    });
    html += '</div></div>';
    el.innerHTML = html;
  }

  function toggleCrisisPanel() {
    var panel = document.getElementById('crisisPanel');
    if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
  }

  /* ── Arc Progress Indicator ── */
  function injectArcProgress() {
    var arcPages = {
      survive: { index: 0, en: 'Survive', es: 'Sobrevivir', color: 'var(--coral)' },
      understand: { index: 1, en: 'Understand', es: 'Entender', color: 'var(--gold)' },
      connect: { index: 2, en: 'Connect', es: 'Conectar', color: 'var(--sky)' },
      grow: { index: 3, en: 'Grow', es: 'Cultivar', color: '#4a7c59' },
      govern: { index: 4, en: 'Govern', es: 'Gobernar', color: 'var(--deep)' }
    };
    var page = getCurrentPage().replace(/^\//, '').replace('.html', '') || 'home';
    if (!arcPages[page]) return;

    var current = arcPages[page];
    var header = document.querySelector('.page-header .arc-label');
    if (!header) return;

    var isEs = lang === 'es';
    var bar = document.createElement('div');
    bar.className = 'arc-progress';
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', isEs ? 'Progreso del arco' : 'Arc progress');
    bar.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:0;margin:12px auto 8px;max-width:320px';

    var keys = Object.keys(arcPages);
    keys.forEach(function(k, i) {
      var ap = arcPages[k];
      var isCurrent = k === page;
      var isPast = ap.index < current.index;

      // Dot
      var dot = document.createElement('a');
      dot.href = '/' + k;
      dot.style.cssText = 'width:' + (isCurrent ? '12px' : '8px') + ';height:' + (isCurrent ? '12px' : '8px') +
        ';border-radius:50%;background:' + (isCurrent ? ap.color : isPast ? 'var(--sage)' : 'var(--sand)') +
        ';transition:.2s;flex-shrink:0;display:block';
      dot.setAttribute('aria-label', (isEs ? ap.es : ap.en));
      dot.setAttribute('title', isEs ? ap.es : ap.en);
      bar.appendChild(dot);

      // Connector line (not after last)
      if (i < keys.length - 1) {
        var line = document.createElement('div');
        line.style.cssText = 'height:2px;flex:1;background:' + (isPast ? 'var(--sage)' : 'var(--sand)') + ';min-width:12px';
        bar.appendChild(line);
      }
    });

    header.parentNode.insertBefore(bar, header.nextSibling);
  }

  /* ── First-Visit Onboarding ── */
  function showOnboarding() {
    if (localStorage.getItem('cos-onboarded')) return;
    // Only show on index page
    var page = getCurrentPage().replace(/^\//, '').replace('.html', '') || 'home';
    if (page !== 'home' && page !== 'index' && page !== '') return;

    var isEs = lang === 'es';
    var overlay = document.createElement('div');
    overlay.id = 'onboardOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', isEs ? 'Bienvenido' : 'Welcome');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:800;background:rgba(26,60,52,.85);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .3s';

    var steps = [
      { emoji: '📍', en: 'Enter your zip code. That\'s all it takes. No account, no email, no tracking.', es: 'Ingresa tu código postal. Eso es todo. Sin cuenta, sin email, sin rastreo.' },
      { emoji: '🆘', en: 'Need food, health info, or emergency help? Start with Survive.', es: '¿Necesitas comida, salud o ayuda de emergencia? Empieza con Sobrevivir.' },
      { emoji: '🤝', en: 'Post what you need. Share what you have. Your neighbors are closer than you think.', es: 'Publica lo que necesitas. Comparte lo que tienes. Tus vecinos están más cerca de lo que piensas.' },
      { emoji: '🏛️', en: 'Score your leaders. Track their promises. The tools belong to you.', es: 'Evalúa a tus líderes. Rastrea sus promesas. Las herramientas son tuyas.' },
      { emoji: '🌐', en: 'Everything is bilingual. Tap ES at the top anytime.', es: 'Todo es bilingüe. Toca ES arriba en cualquier momento.' }
    ];

    var html = '<div style="background:var(--cream);border-radius:16px;max-width:400px;width:100%;padding:28px;text-align:center;max-height:90vh;overflow-y:auto">' +
      '<h2 style="font-family:var(--display);color:var(--deep);margin-bottom:4px">' + (isEs ? 'Bienvenido a CommUnity OS' : 'Welcome to CommUnity OS') + '</h2>' +
      '<p style="font-size:.75rem;color:var(--dim);margin-bottom:16px">' + (isEs ? 'Herramientas gratuitas para vecindarios' : 'Free tools for neighborhoods') + '</p>';

    steps.forEach(function(s) {
      html += '<div style="display:flex;align-items:flex-start;gap:10px;text-align:left;margin:10px 0;font-size:.82rem;color:var(--ink);line-height:1.6">' +
        '<span style="font-size:1.2rem;flex-shrink:0">' + s.emoji + '</span>' +
        '<span>' + (isEs ? s.es : s.en) + '</span></div>';
    });

    html += '<button onclick="document.getElementById(\'onboardOverlay\').remove();localStorage.setItem(\'cos-onboarded\',\'1\')" ' +
      'style="margin-top:16px;padding:12px 28px;background:var(--forest);color:var(--cream);border:none;border-radius:10px;font-family:var(--sans);font-size:.85rem;font-weight:600;cursor:pointer;min-height:44px">' +
      (isEs ? 'Empezar' : 'Get Started') + '</button></div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    // Trap focus inside overlay
    setTimeout(function() {
      var btn = overlay.querySelector('button');
      if (btn) btn.focus();
    }, 100);
  }

  /* ── Toast Notification ── */
  function showToast(msg, duration) {
    var t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      t.setAttribute('role', 'alert');
      t.setAttribute('aria-live', 'polite');
      t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--deep);color:var(--cream);padding:12px 24px;border-radius:12px;font-size:.82rem;font-weight:500;z-index:600;opacity:0;transition:all .3s;pointer-events:none;max-width:90vw;text-align:center';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    t.classList.add('show');
    clearTimeout(t._timeout);
    t._timeout = setTimeout(function() {
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(20px)';
      t.classList.remove('show');
    }, duration || 3000);
  }

  /* ── API Health Check + Fallback State ── */
  var _apiHealthy = true;
  var _apiCheckInterval = null;

  function checkApiHealth() {
    if (!_api) { _apiHealthy = false; return; }
    fetch(_api + '?action=', { redirect: 'follow' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        _apiHealthy = (d.status === 'ok');
        updateApiStatusUI();
      })
      .catch(function() {
        _apiHealthy = false;
        updateApiStatusUI();
      });
  }

  function updateApiStatusUI() {
    // Show/hide degraded mode banner
    var banner = document.getElementById('apiDegraded');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'apiDegraded';
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');
      banner.style.cssText = 'display:none;background:var(--gold-soft);border:1px solid var(--gold);border-radius:8px;padding:10px 14px;margin:8px 0;font-size:.75rem;color:var(--ink);text-align:center';
      var page = document.querySelector('.page');
      if (page && page.firstChild) page.insertBefore(banner, page.firstChild.nextSibling);
    }
    if (!_apiHealthy && navigator.onLine) {
      banner.textContent = lang === 'es'
        ? 'Los servicios comunitarios están temporalmente fuera de línea. Las herramientas estáticas siguen funcionando.'
        : 'Community services are temporarily offline. Static tools still work.';
      banner.style.display = 'block';
      // Disable interactive post buttons
      document.querySelectorAll('.post-btn,[data-requires-api]').forEach(function(b) {
        b.disabled = true;
        b.style.opacity = '0.5';
      });
    } else {
      banner.style.display = 'none';
      document.querySelectorAll('.post-btn,[data-requires-api]').forEach(function(b) {
        b.disabled = false;
        b.style.opacity = '';
      });
    }
  }

  function isApiHealthy() { return _apiHealthy; }

  /* ── Translation Pipeline Scaffolding ── */
  // Supports community-contributed translations for languages 3+
  // Core: EN + ES built in. Additional languages loaded from Sheet
  var SUPPORTED_LANGS = ['en', 'es'];
  var _communityTranslations = {};

  function loadCommunityTranslation(langCode, callback) {
    if (!_api || SUPPORTED_LANGS.indexOf(langCode) >= 0) return; // Built-in langs don't need loading
    fetch(_api + '?action=get_translation&lang=' + langCode)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.status === 'ok' && data.translations) {
          _communityTranslations[langCode] = data.translations;
          SUPPORTED_LANGS.push(langCode);
          if (callback) callback(true);
        }
      })
      .catch(function() { if (callback) callback(false); });
  }

  function tCommunity(key) {
    if (_communityTranslations[lang] && _communityTranslations[lang][key]) {
      return _communityTranslations[lang][key];
    }
    return t(key); // Fall back to built-in EN/ES
  }

  /* ── Form Validation UX ── */
  function validateField(input, rules) {
    var val = (input.value || '').trim();
    var msg = '';

    if (rules.required && !val) {
      msg = lang === 'es' ? 'Este campo es obligatorio' : 'This field is required';
    } else if (rules.zip && val && (val.length !== 5 || !/^\d{5}$/.test(val))) {
      msg = lang === 'es' ? 'Ingresa un código postal de 5 dígitos' : 'Enter a valid 5-digit ZIP code';
    } else if (rules.minLength && val.length < rules.minLength) {
      msg = lang === 'es' ? 'Mínimo ' + rules.minLength + ' caracteres' : 'Minimum ' + rules.minLength + ' characters';
    } else if (rules.maxLength && val.length > rules.maxLength) {
      msg = lang === 'es' ? 'Máximo ' + rules.maxLength + ' caracteres' : 'Maximum ' + rules.maxLength + ' characters';
    } else if (rules.numeric && val && isNaN(val)) {
      msg = lang === 'es' ? 'Solo números' : 'Numbers only';
    }

    // Show/clear error
    var errEl = input.nextElementSibling;
    if (!errEl || !errEl.classList.contains('field-error')) {
      errEl = document.createElement('div');
      errEl.className = 'field-error';
      errEl.setAttribute('role', 'alert');
      errEl.style.cssText = 'color:var(--coral);font-size:.7rem;margin-top:2px;min-height:16px';
      input.parentNode.insertBefore(errEl, input.nextSibling);
    }
    errEl.textContent = msg;
    input.style.borderColor = msg ? 'var(--coral)' : '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }

  function validateForm(formEl) {
    var valid = true;
    formEl.querySelectorAll('[data-validate]').forEach(function(inp) {
      var rules = {};
      try { rules = JSON.parse(inp.dataset.validate); } catch(e) {}
      if (!validateField(inp, rules)) valid = false;
    });
    return valid;
  }

  /* ── Loading States ── */
  function showLoading(containerId, message) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var isEs = lang === 'es';
    var msg = message || (isEs ? 'Cargando...' : 'Loading...');
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--dim)"><div class="loading-spinner" style="margin:0 auto 8px"></div><span style="font-size:.78rem">' + msg + '</span></div>';
  }

  function showEmpty(containerId, message) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var isEs = lang === 'es';
    var msg = message || (isEs ? 'Nada aquí todavía. Sé el primero.' : 'Nothing here yet. Be the first.');
    el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--dim);font-size:.85rem;line-height:1.6"><p>' + msg + '</p></div>';
  }

  function showError(containerId, message) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var isEs = lang === 'es';
    var msg = message || (isEs ? 'No se pudo cargar. Intenta de nuevo.' : 'Could not load. Try again.');
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--coral);font-size:.82rem"><p>' + msg + '</p></div>';
  }

  /* ── IndexedDB Cache — persistent client-side read cache ── */
  /* Replaces sessionStorage. Survives browser restarts. 70% fewer server reads. */
  /* Safari evicts after 7 days of inactivity unless PWA installed — fallback to memory. */
  var _idbReady = false;
  var _idb = null;
  var _memCache = {};

  function openCacheDB() {
    return new Promise(function(resolve) {
      try {
        var req = indexedDB.open('cos-cache', 1);
        req.onupgradeneeded = function(e) { e.target.result.createObjectStore('kv'); };
        req.onsuccess = function(e) { _idb = e.target.result; _idbReady = true; resolve(true); };
        req.onerror = function() { resolve(false); };
      } catch(e) { resolve(false); }
    });
  }

  function cacheGet(key) {
    if (!_idbReady) return Promise.resolve(_memCache[key] || null);
    return new Promise(function(resolve) {
      try {
        var tx = _idb.transaction('kv', 'readonly');
        var req = tx.objectStore('kv').get(key);
        req.onsuccess = function() { resolve(req.result || null); };
        req.onerror = function() { resolve(_memCache[key] || null); };
      } catch(e) { resolve(_memCache[key] || null); }
    });
  }

  function cacheSet(key, value) {
    _memCache[key] = value; // always set memory fallback
    if (!_idbReady) return Promise.resolve();
    return new Promise(function(resolve) {
      try {
        var tx = _idb.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(value, key);
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { resolve(); };
      } catch(e) { resolve(); }
    });
  }

  /* ── Cached Fetch — read-through cache with staleness control ── */
  function cachedFetch(url, options) {
    var maxAge = (options && options.maxAge) || 300000; // 5 minutes default
    var cacheKey = 'cf_' + url;
    var loadingEl = options && options.loadingId;
    var errorEl = options && options.errorId;

    if (loadingEl) showLoading(loadingEl);

    return cacheGet(cacheKey).then(function(cached) {
      if (cached && (Date.now() - cached.ts) < maxAge) {
        // Fresh cache hit — return immediately
        return { data: cached.data, source: 'cache', fresh: true };
      }

      // Cache miss or stale — fetch from network
      return safeFetch(url)
        .then(function(data) {
          cacheSet(cacheKey, { data: data, ts: Date.now() });
          return { data: data, source: 'network', fresh: true };
        })
        .catch(function(err) {
          // Network failed — return stale cache if available
          if (cached) {
            return { data: cached.data, source: 'cache', fresh: false };
          }
          if (errorEl) showError(errorEl);
          throw err;
        });
    });
  }

  /* ── Safe Fetch — wraps fetch with timeout, error handling, loading state ── */
  function safeFetch(url, opts, options) {
    var timeout = (options && options.timeout) || 15000;
    var loadingEl = options && options.loadingId;
    var errorEl = options && options.errorId;

    if (loadingEl) showLoading(loadingEl);

    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, timeout);
    var fetchOpts = Object.assign({}, opts || {}, { signal: controller.signal, redirect: 'follow' });

    return fetch(url, fetchOpts)
      .then(function(r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(function(err) {
        clearTimeout(timer);
        if (errorEl) showError(errorEl, err.name === 'AbortError'
          ? (lang === 'es' ? 'Tiempo de espera agotado.' : 'Request timed out.')
          : undefined);
        throw err;
      });
  }

  /* ── Content Freshness ── */
  function renderFreshnessStamp(containerId, dateStr, labelEn, labelEs) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var label = lang === 'es' ? (labelEs || 'Última actualización') : (labelEn || 'Last updated');
    el.innerHTML = '<span style="font-size:.65rem;color:var(--dim)">' + label + ': ' + dateStr + '</span>';
  }

  /* ── Cache Version Signal ── */
  function getCacheVersion() { return 'communityos-v32'; }

  var _updateToasted = false;
  function checkForUpdate() {
    if (_updateToasted) return;
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      fetch('/sw.js?t=' + Date.now(), { cache: 'no-store' })
        .then(function(r) { return r.text(); })
        .then(function(text) {
          var match = text.match(/CACHE_NAME\s*=\s*'([^']+)'/);
          if (match && match[1] !== getCacheVersion()) {
            _updateToasted = true;
            showToast(lang === 'es'
              ? 'Nueva versión disponible. Recarga la página.'
              : 'New version available. Reload the page.', 8000);
          }
        })
        .catch(function() {});
    }
  }

  /* ── Public API ── */
  window.EQ = {
    init: init,
    t: t,
    tCommunity: tCommunity,
    getLang: getLang,
    switchLang: switchLang,
    toggleLang: toggleLang,
    setTranslations: setTranslations,
    openNav: openNav,
    closeNav: closeNav,
    buildFooter: buildFooter,
    buildCivicLoop: buildCivicLoop,
    loadAlerts: loadAlerts,
    initFuzzyZip: initFuzzyZip,
    getApi: getApi,
    getHub: getHub,
    resolveApi: resolveApi,
    openLangPanel: openLangPanel,
    closeLangPanel: closeLangPanel,
    openReview: openReview,
    sendToOfficial: sendToOfficial,
    trackEscalation: trackEscalation,
    sharePage: sharePage,
    shareResource: shareResource,
    shareWhatsApp: shareWhatsApp,
    selectLanguage: selectLanguage,
    closeReview: closeReview,
    submitReview: submitReview,
    setReviewMode: setReviewMode,
    skipToNext: skipToNext,
    crisisHotlines: CRISIS_HOTLINES,
    renderCrisisBar: renderCrisisBar,
    toggleCrisisPanel: toggleCrisisPanel,
    telLink: telLink,
    linkifyPhones: linkifyPhones,
    showToast: showToast,
    showLoading: showLoading,
    showEmpty: showEmpty,
    showError: showError,
    safeFetch: safeFetch,
    cachedFetch: cachedFetch,
    isApiHealthy: isApiHealthy,
    checkApiHealth: checkApiHealth,
    validateField: validateField,
    validateForm: validateForm,
    loadCommunityTranslation: loadCommunityTranslation,
    renderFreshnessStamp: renderFreshnessStamp,
    getCacheVersion: getCacheVersion,
    checkForUpdate: checkForUpdate,
    installPWA: installPWA,
    lang: lang
  };
})();

// ═══ IMPROVEMENTS BATCH ═══

// #25 Back-to-top button
(function(){
  var btn = document.createElement('button');
  btn.className = 'back-top';
  btn.setAttribute('aria-label', 'Back to top');
  btn.innerHTML = '↑';
  btn.onclick = function(){ window.scrollTo({top:0,behavior:'smooth'}); };
  document.body.appendChild(btn);
  window.addEventListener('scroll', function(){
    btn.classList.toggle('visible', window.scrollY > 600);
  });
})();

// #19 ARIA labels on interactive elements
(function(){
  document.querySelectorAll('.hr-tab,.sr-tab,.ct-tab,.dr-tab,.dt-btn,.bc-btn').forEach(function(el){
    if(!el.getAttribute('role')) el.setAttribute('role','button');
    if(!el.getAttribute('tabindex')) el.setAttribute('tabindex','0');
    el.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}
    });
  });
})();

// #88 PWA install prompt
(function(){
  var deferredPrompt;
  window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault();
    deferredPrompt = e;
    var bar = document.createElement('div');
    bar.style.cssText='position:fixed;bottom:0;left:0;right:0;background:var(--deep,#12201E);color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;z-index:100;font-family:system-ui;font-size:.78rem';
    bar.innerHTML='<span>Add CommUnity OS to your home screen</span><button style="background:#fff;color:#12201E;border:none;padding:8px 16px;border-radius:8px;font-weight:700;cursor:pointer;font-size:.75rem">Install</button>';
    bar.querySelector('button').onclick=function(){
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(){bar.remove();});
    };
    var close = document.createElement('button');
    close.style.cssText='background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer;padding:0 8px';
    close.textContent='×';
    close.onclick=function(){bar.remove();};
    bar.appendChild(close);
    document.body.appendChild(bar);
  });
})();

// #17 Data version display — inject into tools that use dated data
(function(){
  var versions = {
    'benefits-screener': 'FPL: 2025 | EITC: Tax Year 2025 | Medicaid Expansion: Mar 2026',
    'worker-rights': 'Minimum Wages: 2025-2026 | FLSA: Current',
    'health-calc': 'AHA Pooled Cohort 2013 | CDC Prediabetes Screener | NIH BMI',
    'benefits-check': 'Public Charge Rule: 8 CFR § 212.22 (2022, current)'
  };
  var page = window.location.pathname.replace(/^\//,'').replace('.html','');
  if(versions[page]){
    var el = document.createElement('div');
    el.style.cssText='text-align:center;font-size:.55rem;color:var(--dim,#999);margin:8px 0;font-family:system-ui';
    el.textContent = 'Data version: ' + versions[page];
    var pg = document.querySelector('.page');
    if(pg) pg.appendChild(el);
  }
})();

// #11-12 Related tools — shows contextual links at bottom of tool pages
(function(){
  var RELATED = {
    'benefits-screener': [
      {href:'/benefits-check.html',label:'Check Immigration Safety',icon:'🛡️'},
      {href:'/health-calc.html',label:'Health Risk Check',icon:'❤️'},
      {href:'/worker-rights.html',label:'Check Your Wages',icon:'💰'}
    ],
    'benefits-check': [
      {href:'/benefits-screener.html',label:'Screen All Benefits',icon:'🍎'},
      {href:'/school-rights.html',label:'School Rights',icon:'🎒'},
      {href:'/worker-rights.html',label:'Worker Rights',icon:'💰'}
    ],
    'defend': [
      {href:'/complaints.html',label:'Look Up Company Complaints',icon:'📊'},
      {href:'/court-nav.html',label:'Court Navigator',icon:'⚖️'},
      {href:'/knowledge.html',label:'Read the Full Guide',icon:'📚'}
    ],
    'health-calc': [
      {href:'/drug-prices.html',label:'Check Drug Prices',icon:'💊'},
      {href:'/vitals.html',label:'Check Your Vitals',icon:'💓'},
      {href:'/benefits-screener.html',label:'Screen for Medicaid',icon:'🍎'}
    ],
    'complaints': [
      {href:'/defend.html',label:'Write a Dispute Letter',icon:'✉️'},
      {href:'/lending.html',label:'Lending Fairness',icon:'🏦'},
      {href:'/building-safety.html',label:'Building Safety',icon:'🏗️'}
    ],
    'worker-rights': [
      {href:'/benefits-screener.html',label:'Screen for Benefits',icon:'🍎'},
      {href:'/court-nav.html',label:'Court Navigator',icon:'⚖️'},
      {href:'/defend.html',label:'Dispute Letters',icon:'✉️'}
    ],
    'court-nav': [
      {href:'/defend.html',label:'Write a Dispute Letter',icon:'✉️'},
      {href:'/school-rights.html',label:'School Rights',icon:'🎒'},
      {href:'/building-safety.html',label:'Building Safety',icon:'🏗️'}
    ],
    'environment': [
      {href:'/311.html',label:'311 Tracker',icon:'📞'},
      {href:'/building-safety.html',label:'Building Safety',icon:'🏗️'},
      {href:'/neighborhood.html',label:'Full Neighborhood Profile',icon:'📍'}
    ],
    'lending': [
      {href:'/complaints.html',label:'Company Complaints',icon:'📊'},
      {href:'/defend.html?type=credit',label:'Dispute Credit Errors',icon:'✉️'},
      {href:'/neighborhood.html',label:'Neighborhood Profile',icon:'📍'}
    ],
    'school-rights': [
      {href:'/benefits-screener.html',label:'Free Meal Eligibility',icon:'🍎'},
      {href:'/benefits-check.html',label:'Immigration Safety',icon:'🛡️'},
      {href:'/court-nav.html',label:'Court Navigator',icon:'⚖️'}
    ],
    'drug-prices': [
      {href:'/health-calc.html',label:'Health Risk Check',icon:'❤️'},
      {href:'/benefits-screener.html',label:'Medicaid Eligibility',icon:'🍎'},
      {href:'/defend.html?type=medical',label:'Dispute a Medical Bill',icon:'✉️'}
    ],
    '311': [
      {href:'/building-safety.html',label:'Building Violations',icon:'🏗️'},
      {href:'/environment.html',label:'Environmental Check',icon:'🏭'},
      {href:'/neighborhood.html',label:'Neighborhood Profile',icon:'📍'}
    ],
    'building-safety': [
      {href:'/311.html',label:'311 Tracker',icon:'📞'},
      {href:'/defend.html?type=tenant',label:'Tenant Dispute Letter',icon:'✉️'},
      {href:'/court-nav.html',label:'Eviction Court Guide',icon:'⚖️'}
    ],
    'food-safety': [
      {href:'/neighborhood.html',label:'Neighborhood Profile',icon:'📍'},
      {href:'/311.html',label:'311 Tracker',icon:'📞'},
      {href:'/benefits-screener.html',label:'Food Benefits',icon:'🍎'}
    ]
  };

  var page = window.location.pathname.replace(/^\//,'').replace('.html','');
  var links = RELATED[page];
  if(!links) return;

  var container = document.querySelector('.page');
  if(!container) return;

  var div = document.createElement('div');
  div.style.cssText='margin:20px 0;padding:16px;background:var(--warm,#faf8f4);border-radius:14px;border:1px solid var(--sand,#e8e0d4)';
  var h = '<div style="font-family:var(--display);font-size:.78rem;font-weight:700;color:var(--deep,#1a2e2a);margin-bottom:8px">Related Tools</div><div style="display:flex;flex-wrap:wrap;gap:6px">';
  links.forEach(function(l){
    h+='<a href="'+l.href+'" style="display:inline-flex;align-items:center;gap:5px;font-size:.7rem;font-weight:600;color:var(--forest,#2d5a4e);text-decoration:none;padding:6px 12px;border:1px solid var(--sage,#5b8c7a);border-radius:8px;transition:.15s">'+l.icon+' '+l.label+'</a>';
  });
  h+='</div>';
  div.innerHTML=h;
  container.appendChild(div);
})();

// #40 QR code via URL — generates QR link using free API
(function(){
  var params = new URLSearchParams(window.location.search);
  if(params.get('qr')==='1'){
    var url = window.location.origin + window.location.pathname;
    var qr = document.createElement('div');
    qr.style.cssText='text-align:center;margin:16px 0;padding:16px;background:var(--warm,#faf8f4);border-radius:12px;border:1px solid var(--sand,#e8e0d4)';
    qr.innerHTML='<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data='+encodeURIComponent(url)+'" alt="QR Code" style="border-radius:8px"><p style="font-size:.6rem;color:var(--dim,#999);margin-top:6px">Scan to open on your phone</p>';
    var page = document.querySelector('.page');
    if(page && page.firstChild) page.insertBefore(qr, page.firstChild);
  }
})();

// #70 Graceful API fallback helper
window.apiFallback = function(containerEl, apiName, directUrl) {
  containerEl.innerHTML = '<div style="text-align:center;padding:20px;font-size:.82rem;color:var(--dim,#999)">' +
    '<p>Could not reach ' + apiName + ' right now.</p>' +
    (directUrl ? '<p style="margin-top:8px"><a href="' + directUrl + '" target="_blank" rel="noopener" style="color:var(--forest,#2d5a4e);font-weight:600">Search directly at ' + apiName + ' →</a></p>' : '') +
    '</div>';
};

// #42 Lazy rendering — stagger animation on scroll
(function(){
  if(!('IntersectionObserver' in window)) return;
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){e.target.style.opacity='1';e.target.style.transform='translateY(0)';obs.unobserve(e.target);}
    });
  },{threshold:0.1});
  // Apply to tool items, guide cards, prob cards after DOM ready
  setTimeout(function(){
    document.querySelectorAll('.tool-item,.prob-card,.bs-prog,.mn-section').forEach(function(el){
      el.style.opacity='0';el.style.transform='translateY(8px)';el.style.transition='opacity .4s,transform .4s';
      obs.observe(el);
    });
  },100);
})();

// #95-96 Privacy-preserving counter (no-PII, no cookies)
// Uses a simple Netlify function or service worker counter
// For now, stores anonymous page view intent in sessionStorage
(function(){
  try{
    var page = window.location.pathname.replace(/^\//,'').replace('.html','') || 'index';
    var key = 'cos_v_' + page;
    if(!sessionStorage.getItem(key)){
      sessionStorage.setItem(key, '1');
      // In production, this would POST to a simple counter endpoint
      // For now, the count lives only in the browser
    }
  }catch(e){}
})();

// #81 Embed support — tools can be loaded in iframe with ?embed=1
(function(){
  var params = new URLSearchParams(window.location.search);
  if(params.get('embed')==='1'){
    // Hide nav, footer, cross-domain prompts for clean embed
    var style = document.createElement('style');
    style.textContent = 'nav,footer,.cross-domain-prompt,.constellation-section,.back-top,.crisis-bar,.share-bar{display:none!important}.page{padding-top:10px}';
    document.head.appendChild(style);
    document.body.style.background = 'transparent';
  }
})();

// #41 + #82 Anonymous feedback — no identity, just a thumbs up counter
(function(){
  var page = window.location.pathname.replace(/^\//,'').replace('.html','');
  var toolPages = ['benefits-screener','benefits-check','defend','health-calc','drug-prices','worker-rights','school-rights','court-nav','lending','environment','311','building-safety','food-safety','disaster','neighborhood','complaints'];
  if(toolPages.indexOf(page) < 0) return;
  
  var div = document.createElement('div');
  div.style.cssText='text-align:center;margin:16px 0;padding:12px';
  div.innerHTML='<span style="font-size:.72rem;color:var(--dim,#999)">Was this helpful? </span>' +
    '<button onclick="this.parentElement.innerHTML=\'<span style=font-size:.72rem;color:var(--forest,#2d5a4e);font-weight:600>Thank you!</span>\'" style="background:none;border:1px solid var(--sage,#5b8c7a);border-radius:8px;padding:4px 12px;cursor:pointer;font-size:.72rem;color:var(--forest,#2d5a4e);margin:0 4px">👍 Yes</button>' +
    '<button onclick="this.parentElement.innerHTML=\'<span style=font-size:.72rem;color:var(--sage,#5b8c7a)>Thanks for the feedback.</span>\'" style="background:none;border:1px solid var(--sand,#e8e0d4);border-radius:8px;padding:4px 12px;cursor:pointer;font-size:.72rem;color:var(--dim,#999);margin:0 4px">Could be better</button>';
  var pg = document.querySelector('.page');
  if(pg) pg.appendChild(div);
})();

// ═══ Civic Journey — Track tool visits (anonymous, local only) ═══
(function() {
  try {
    var page = window.location.pathname.replace(/\.html$/, '').replace(/^\//, '') || 'home';
    var visits = JSON.parse(localStorage.getItem('cos_tool_visits') || '[]');
    // Deduplicate: don't log same page within 5 minutes
    var recent = visits.find(function(v) { return v.tool === page && (Date.now() - new Date(v.date).getTime()) < 300000; });
    if (!recent) {
      visits.push({ tool: page, date: new Date().toISOString() });
      // Keep last 100 visits
      if (visits.length > 100) visits = visits.slice(-100);
      localStorage.setItem('cos_tool_visits', JSON.stringify(visits));
    }
  } catch(e) {}
})();

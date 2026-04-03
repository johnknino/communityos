/* CommUnity OS Shared JS v1.2 — i18n + nav + alerts + analytics + accessibility */

(function(){
  'use strict';

  /* ── Config ── */
  var API_KEY = 'eqos-api';
  var LANG_KEY = 'eqos-lang';
  var lang = localStorage.getItem(LANG_KEY) || 'en';
  var T = {};
  var _api = localStorage.getItem(API_KEY) || '';

  /* ── Bilingual Engine ── */
  function setTranslations(translations) { T = translations; applyLang(); }
  function getLang() { return lang; }
  function switchLang(newLang) { lang = newLang; localStorage.setItem(LANG_KEY, lang); applyLang(); }
  function toggleLang() { switchLang(lang === 'en' ? 'es' : 'en'); }
  function t(key) { return (T[lang] && T[lang][key]) || (T['en'] && T['en'][key]) || ''; }
  function getApi() { return _api; }

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
  }

  /* ── Navigation ── */
  var NAV_LINKS = [
    { href: '/', key: 'nav_home', label: 'Home', labelEs: 'Inicio' },
    { divider: true },
    { arcLabel: true, key: 'nav_arc', label: 'The Arc', labelEs: 'El Arco' },
    { href: '/survive.html', key: 'nav_survive', label: 'Survive', labelEs: 'Sobrevivir' },
    { href: '/understand.html', key: 'nav_understand', label: 'Understand', labelEs: 'Comprender' },
    { href: '/connect.html', key: 'nav_connect', label: 'Connect', labelEs: 'Conectar' },
    { href: '/govern.html', key: 'nav_govern', label: 'Govern', labelEs: 'Gobernar' },
    { href: '/learn.html', key: 'nav_learn', label: 'Learn', labelEs: 'Aprender' },
    { href: '/story.html', key: 'nav_story', label: 'Our Story', labelEs: 'Nuestra Historia' },
    { divider: true },
    { href: '/discuss.html', key: 'nav_discuss', label: 'Discussion Board', labelEs: 'Foro de Discusión' },
    { href: '/needs.html', key: 'nav_needs', label: 'Needs & Offers', labelEs: 'Necesidades y Ofertas' },
    { href: '/evaluate.html', key: 'nav_evaluate', label: 'Evaluate a Leader', labelEs: 'Evaluar un Líder' },
    { href: '/assess.html', key: 'nav_assess', label: 'Assess a Program', labelEs: 'Evaluar un Programa' },
    { href: '/audit.html', key: 'nav_audit', label: 'Promise Tracker', labelEs: 'Revisa Promesas' },
    { href: '/knowledge.html', key: 'nav_knowledge', label: 'Neighbor Guides', labelEs: 'Guías de Vecinos' },
    { href: '/dashboard.html', key: 'nav_dashboard', label: 'Neighborhood Check', labelEs: 'Revisa el Barrio' },
    { href: '/intelligence.html', key: 'nav_intel', label: 'Neighborhood Intelligence', labelEs: 'Inteligencia del Barrio' },
    { href: '/propose.html', key: 'nav_propose', label: 'Community Proposals', labelEs: 'Propuestas Comunitarias' },
    { href: '/share.html', key: 'nav_share', label: 'Share Your Story', labelEs: 'Comparte Tu Historia' },
    { divider: true },
    { href: '/support.html', key: 'nav_support', label: '♡ Support This Platform', labelEs: '♡ Apoya Esta Plataforma' }
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
      '<a href="/" class="nav-home" aria-label="CommUnity OS home">CommUnity OS</a>' +
      '<div class="nav-right">' +
        '<button class="lang-toggle" onclick="EQ.toggleLang()" aria-label="Switch language">' + (lang === 'en' ? 'ES' : 'EN') + '</button>' +
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
  }

  function closeNav() {
    var d = document.getElementById('navDrawer');
    if (d) { d.classList.remove('open'); document.body.style.overflow = ''; }
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
      '<input type="text" id="reviewerName" placeholder="So we can credit you" value="' + (localStorage.getItem('eqos-reviewer') || '') + '">' +
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

  function submitReview() {
    if (!_reviewTarget) return;
    var suggestion = document.getElementById('reviewSuggestion').value.trim();
    if (!suggestion) { document.getElementById('reviewStatus').textContent = 'Please write a suggestion.'; return; }

    var reviewer = document.getElementById('reviewerName').value.trim();
    if (reviewer) localStorage.setItem('eqos-reviewer', reviewer);

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
        var queue = JSON.parse(localStorage.getItem('eqos-review-queue') || '[]');
        queue.push(payload);
        localStorage.setItem('eqos-review-queue', JSON.stringify(queue));
        afterSave();
      });
    } else {
      var queue = JSON.parse(localStorage.getItem('eqos-review-queue') || '[]');
      queue.push(payload);
      localStorage.setItem('eqos-review-queue', JSON.stringify(queue));
      afterSave();
    }
  }
  function buildFooter(closingKey) {
    var footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.setAttribute('role', 'contentinfo');
    footer.innerHTML = (closingKey ? '<div class="footer-closing" data-t="' + closingKey + '">' + t(closingKey) + '</div>' : '') +
      '<div class="footer-line"></div>' +
      '<div class="footer-name">CommUnity OS</div>' +
      '<div class="footer-sub" data-t="footer_sub">' + t('footer_sub') + '</div>' +
      '<div class="footer-support"><a href="/support.html" data-t="footer_support">' + t('footer_support') + '</a></div>' +
      '<div class="footer-contact"><a href="mailto:info@comm-unity-os.org">info@comm-unity-os.org</a></div>' +
      '<div class="footer-opensource"><a href="https://github.com/communityos" target="_blank" rel="noopener">Open source · GitHub ↗</a></div>';
    var page = document.querySelector('.page');
    if (page) page.appendChild(footer);
  }

  /* ── Service Worker Registration ── */
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(function() {});
    }
  }

  /* ── Helpers ── */
  function esc(s) { return s ? String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }

  /* ── Init ── */
  function init(translations, opts) {
    T = translations || {};
    if (!T.en) T.en = {};
    if (!T.es) T.es = {};
    T.en.footer_sub = T.en.footer_sub || 'Free Tools for Neighborhoods · 2026';
    T.es.footer_sub = T.es.footer_sub || 'Herramientas Gratuitas para Vecindarios · 2026';
    T.en.footer_support = T.en.footer_support || 'This platform is free because people like you support it. ♡';
    T.es.footer_support = T.es.footer_support || 'Esta plataforma es gratuita porque personas como tú la apoyan. ♡';

    // API URL: page-level var > localStorage
    if (typeof API !== 'undefined' && API) { _api = API; localStorage.setItem(API_KEY, API); }

    buildNav();
    if (opts && opts.footer !== false) {
      buildFooter(opts.closingKey || null);
    }
    applyLang();
    initReviewMode();
    logPageView();
    registerSW();

    // Auto-load alerts if page specified
    if (opts && opts.alertPage) {
      loadAlerts(opts.alertPage);
    }
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeNav();
  });

  /* ── Public API ── */
  window.EQ = {
    init: init,
    t: t,
    getLang: getLang,
    switchLang: switchLang,
    toggleLang: toggleLang,
    setTranslations: setTranslations,
    openNav: openNav,
    closeNav: closeNav,
    buildFooter: buildFooter,
    loadAlerts: loadAlerts,
    initFuzzyZip: initFuzzyZip,
    getApi: getApi,
    openLangPanel: openLangPanel,
    closeLangPanel: closeLangPanel,
    selectLanguage: selectLanguage,
    closeReview: closeReview,
    submitReview: submitReview,
    setReviewMode: setReviewMode,
    skipToNext: skipToNext,
    lang: lang
  };
})();

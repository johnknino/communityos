/**
 * CommUnity OS — Dashboard Engine v1.0
 * Shared infrastructure for all 8 partner strategy dashboards.
 * Census ACS + CDC PLACES + domain-specific APIs → deployment brief.
 */
(function(){
  'use strict';

  var CENSUS_BASE = 'https://api.census.gov/data/2022/acs/acs5';
  var PLACES_BASE = 'https://data.cdc.gov/resource/qnzd-25i4.json';
  var ECHO_BASE = 'https://echodata.epa.gov/echo/echo_rest_services.get_facilities';
  var NPPES_BASE = 'https://npiregistry.cms.hhs.gov/api/?version=2.1';
  var GEO_BASE = 'https://api.zippopotam.us/us/';

  // Resolve proxy URL from CommunityAPI if available
  function proxyBase() {
    try { return (typeof CommunityAPI !== 'undefined' && CommunityAPI.endpoint()) ? CommunityAPI.endpoint() : ''; } catch(e) { return ''; }
  }

  // ═══ Census ACS Query ═══
  function queryCensus(zip, variables) {
    var proxy = proxyBase();
    if (proxy) {
      // Use Cloudflare Worker proxy — no CORS issues
      return fetch(proxy + '/census/' + zip).then(function(r){return r.json()}).then(function(data){
        if (data.error) return {};
        // Map proxy response back to variable-keyed format
        var result = {};
        result.B01003_001E = data.population;
        result.B19013_001E = data.median_income;
        result._proxy = data;
        return result;
      }).catch(function(){ return {}; });
    }
    var url = CENSUS_BASE + '?get=' + variables.join(',') + '&for=zip%20code%20tabulation%20area:' + zip;
    return fetch(url).then(function(r){return r.json()}).then(function(data){
      if (!data || data.length < 2) return {};
      var headers = data[0], values = data[1], result = {};
      headers.forEach(function(h,i){ result[h] = +values[i] || values[i]; });
      return result;
    }).catch(function(){ return {}; });
  }

  // ═══ CDC PLACES Query ═══
  function queryPLACES(zip, measures) {
    var proxy = proxyBase();
    if (proxy) {
      return fetch(proxy + '/cdc/' + zip).then(function(r){return r.json()}).then(function(data){
        if (data.error) return {};
        return data.measures || {};
      }).catch(function(){ return {}; });
    }
    var filter = "$where=measureid in('" + measures.join("','") + "')&locationname=" + zip;
    var url = PLACES_BASE + '?' + filter + '&$limit=50';
    return fetch(url).then(function(r){return r.json()}).then(function(data){
      var result = {};
      (data||[]).forEach(function(d){
        result[d.measureid] = {
          value: parseFloat(d.data_value) || 0,
          low: parseFloat(d.low_confidence_limit) || 0,
          high: parseFloat(d.high_confidence_limit) || 0,
          pop: d.totalpopulation || 0
        };
      });
      return result;
    }).catch(function(){ return {}; });
  }

  // ═══ EPA ECHO Query ═══
  function queryECHO(zip) {
    var url = ECHO_BASE + '?output=JSON&p_zip=' + zip + '&p_act=Y';
    return fetch(url).then(function(r){return r.json()}).then(function(data){
      var facs = (data && data.Results && data.Results.Facilities) || [];
      return {
        total: facs.length,
        violators: facs.filter(function(f){return f.CurrVioFlag==='Y'}).length,
        facilities: facs.slice(0,10)
      };
    }).catch(function(){ return {total:0,violators:0,facilities:[]}; });
  }

  // ═══ NPPES Provider Count ═══
  function queryProviders(zip, taxonomy) {
    var url = NPPES_BASE + '&postal_code=' + zip + '&enumeration_type=NPI-1&limit=200';
    if (taxonomy) url += '&taxonomy_description=' + encodeURIComponent(taxonomy);
    return fetch(url).then(function(r){return r.json()}).then(function(data){
      return { count: (data && data.result_count) || 0 };
    }).catch(function(){ return {count:0}; });
  }

  // ═══ Geo Lookup ═══
  function queryGeo(zip) {
    return fetch(GEO_BASE + zip).then(function(r){return r.json()}).then(function(d){
      var p = d.places && d.places[0] ? d.places[0] : {};
      return {
        city: p['place name']||'', state: p['state abbreviation']||'',
        lat: parseFloat(p.latitude)||0, lon: parseFloat(p.longitude)||0
      };
    }).catch(function(){ return {city:'',state:'',lat:0,lon:0}; });
  }

  // ═══ Growing Zone from Latitude ═══
  function estimateZone(lat) {
    if (lat >= 47) return '3b-4a';
    if (lat >= 44) return '4b-5a';
    if (lat >= 41) return '5b-6a';
    if (lat >= 38) return '6b-7a';
    if (lat >= 35) return '7b-8a';
    if (lat >= 32) return '8b-9a';
    if (lat >= 28) return '9b-10a';
    return '10b+';
  }

  // ═══ Need Score Calculator ═══
  function calcNeedScore(signals) {
    var score = 0;
    signals.forEach(function(s){ score += s.weight || 0; });
    if (score >= 7) return {level:'HIGH',color:'var(--coral)',css:'highlight'};
    if (score >= 3) return {level:'MODERATE',color:'var(--gold)',css:''};
    return {level:'LOW',color:'var(--forest)',css:'good'};
  }

  // ═══ Render Helpers ═══
  function pct(num, denom) { return denom > 0 ? Math.round((num/denom)*100) : 0; }
  function fmt(n) { return (n||0).toLocaleString(); }
  function money(n) { return '$' + fmt(n); }

  function statCard(value, label, cssClass) {
    return '<div class="ds-stat' + (cssClass?' '+cssClass:'') + '"><div class="ds-val">' + value + '</div><div class="ds-label">' + label + '</div></div>';
  }

  function signalRow(icon, text, weight) {
    return '<div class="ds-signal"><span class="ds-sig-icon">' + icon + '</span><div class="ds-sig-text">' + text + '</div></div>';
  }

  function sectionOpen(icon, title) {
    return '<div class="ds-section"><h3>' + icon + ' ' + title + '</h3>';
  }
  function sectionClose() { return '</div>'; }

  function briefOpen(title) {
    return '<div class="ds-brief"><h3>📋 ' + title + '</h3>';
  }
  function briefClose() { return '</div>'; }

  function actionLinks(links) {
    var h = '<div class="ds-actions">';
    links.forEach(function(l){
      var cls = l.primary ? 'ds-act-primary' : 'ds-act-secondary';
      var target = l.external ? ' target="_blank" rel="noopener"' : '';
      h += '<a href="' + l.href + '" class="' + cls + '"' + target + '>' + l.label + '</a>';
    });
    return h + '</div>';
  }

  function sourceNote(text) {
    return '<p class="ds-source">' + text + '</p>';
  }

  // ═══ Shared CSS (injected once) ═══
  function injectCSS() {
    if (document.getElementById('ds-engine-css')) return;
    var s = document.createElement('style');
    s.id = 'ds-engine-css';
    s.textContent = [
      '.ds-hero{text-align:center;padding:30px 16px 20px}',
      '.ds-hero h1{font-family:var(--display);font-size:1.3rem;font-weight:800;color:var(--deep)}',
      '.ds-hero p{font-size:.82rem;color:var(--body);line-height:1.6;max-width:480px;margin:6px auto 20px}',
      '.ds-search{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}',
      '.ds-zip{font-family:var(--display);font-size:1.3rem;font-weight:700;text-align:center;width:130px;padding:12px;border:2px solid var(--sand);border-radius:12px;background:#fff;color:var(--deep);letter-spacing:.1em}',
      '.ds-zip:focus{outline:none;border-color:var(--forest)}',
      '.ds-go{font-family:var(--display);font-size:.78rem;font-weight:700;padding:14px 22px;border-radius:10px;border:none;background:var(--forest);color:#fff;cursor:pointer}',
      '.ds-go:hover{background:var(--deep)}',
      '.ds-loading{text-align:center;padding:30px;font-size:.82rem;color:var(--dim)}',
      '.ds-section{background:var(--warm);border-radius:14px;padding:18px;margin:14px 0;border:1px solid var(--sand)}',
      '.ds-section h3{font-family:var(--display);font-size:.88rem;font-weight:700;color:var(--deep);margin-bottom:10px}',
      '.ds-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;margin:10px 0}',
      '.ds-stat{text-align:center;padding:10px 6px;background:#fff;border-radius:10px;border:1px solid var(--sand)}',
      '.ds-stat .ds-val{font-family:var(--display);font-size:1rem;font-weight:800;color:var(--deep)}',
      '.ds-stat .ds-label{font-size:.5rem;color:var(--dim);text-transform:uppercase;letter-spacing:.03em;margin-top:2px;line-height:1.3}',
      '.ds-stat.highlight{border-color:var(--coral);background:rgba(212,112,74,.03)}',
      '.ds-stat.highlight .ds-val{color:var(--coral)}',
      '.ds-stat.good{border-color:var(--sage);background:rgba(91,140,122,.03)}',
      '.ds-stat.good .ds-val{color:var(--forest)}',
      '.ds-signal{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.04);font-size:.8rem;line-height:1.6}',
      '.ds-signal:last-child{border:none}',
      '.ds-sig-icon{font-size:.9rem;flex-shrink:0;margin-top:2px}',
      '.ds-sig-text{flex:1;color:var(--body)}',
      '.ds-sig-text strong{color:var(--deep)}',
      '.ds-brief{background:rgba(91,140,122,.04);border:1.5px solid var(--sage);border-radius:14px;padding:18px;margin:16px 0}',
      '.ds-brief h3{font-family:var(--display);font-size:.92rem;font-weight:700;color:var(--forest);margin-bottom:10px}',
      '.ds-brief p{font-size:.8rem;line-height:1.7;color:var(--body);margin-bottom:6px}',
      '.ds-actions{text-align:center;margin:16px 0;display:flex;flex-wrap:wrap;gap:6px;justify-content:center}',
      '.ds-act-primary{font-size:.72rem;font-weight:600;padding:8px 16px;border-radius:8px;background:var(--forest);color:#fff;text-decoration:none}',
      '.ds-act-secondary{font-size:.72rem;font-weight:600;padding:8px 16px;border-radius:8px;border:1px solid var(--sage);color:var(--forest);text-decoration:none}',
      '.ds-source{font-size:.55rem;color:var(--dim);text-align:center;margin:16px 0;line-height:1.5}',
      '.ds-headline{font-family:var(--display);font-size:1.8rem;font-weight:800;text-align:center;margin:8px 0}',
      '.ds-headline.red{color:var(--coral)}',
      '.ds-headline.yellow{color:var(--gold)}',
      '.ds-headline.green{color:var(--forest)}',
      '@media(max-width:480px){.ds-grid{grid-template-columns:repeat(2,1fr)}.ds-stat .ds-val{font-size:.9rem}}',
      '@media print{.ds-search,.ds-go,nav,footer,.back-top,.constellation-section{display:none!important}.ds-section,.ds-brief{break-inside:avoid}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ═══ Community Profile (shared across all dashboards) ═══
  function renderProfile(zip, census, geo) {
    var pop = census.B01003_001E || 0;
    var medIncome = census.B19013_001E || 0;
    var povPop = census.B17001_002E || 0;
    var povTotal = census.B17001_001E || 0;
    var households = census.B11001_001E || 0;
    var hispanic = census.B03003_003E || 0;
    var medRent = census.B25064_001E || 0;

    var povRate = pct(povPop, povTotal);
    var hispPct = pct(hispanic, pop);
    var rentBurden = medIncome > 0 ? Math.round((medRent*12/medIncome)*100) : 0;

    var location = (geo.city ? geo.city + ', ' + geo.state : zip);

    var h = sectionOpen('📊', 'Community Profile — ' + location);
    h += '<div class="ds-grid">';
    h += statCard(fmt(pop), 'Population');
    h += statCard(fmt(households), 'Households');
    h += statCard(money(medIncome), 'Median Income');
    h += statCard(povRate + '%', 'Poverty Rate', povRate > 20 ? 'highlight' : povRate < 10 ? 'good' : '');
    h += statCard(hispPct + '%', 'Hispanic/Latino');
    h += statCard(money(medRent) + '/mo', 'Median Rent');
    h += statCard(rentBurden + '%', 'Rent/Income', rentBurden > 30 ? 'highlight' : '');
    h += '</div>';
    h += sectionClose();
    return h;
  }

  // ═══ Auto-load from URL param ═══
  function autoLoad(inputId, loadFn) {
    var p = new URLSearchParams(window.location.search);
    var z = p.get('zip');
    if (z) {
      document.getElementById(inputId).value = z;
      setTimeout(loadFn, 200);
    }
  }

  // ═══ Export ═══
  window.DashEngine = {
    queryCensus: queryCensus,
    queryPLACES: queryPLACES,
    queryECHO: queryECHO,
    queryProviders: queryProviders,
    queryGeo: queryGeo,
    estimateZone: estimateZone,
    calcNeedScore: calcNeedScore,
    pct: pct, fmt: fmt, money: money,
    statCard: statCard, signalRow: signalRow,
    sectionOpen: sectionOpen, sectionClose: sectionClose,
    briefOpen: briefOpen, briefClose: briefClose,
    actionLinks: actionLinks, sourceNote: sourceNote,
    renderProfile: renderProfile,
    autoLoad: autoLoad,
    injectCSS: injectCSS
  };

  injectCSS();
})();

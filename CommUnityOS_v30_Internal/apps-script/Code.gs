// =====================================================================
// CommUnity OS Community Tools — Google Apps Script
// Version 1.5 | March 30, 2026
// =====================================================================
// Architecture: Netlify static HTML → Apps Script doPost/doGet → Sheets
// Tools: Discussion Board, Needs/Offers Board (phone-verified),
//        Leadership Evaluation, Community Assessment, Alerts CMS,
//        Page Analytics, Resource Health Monitor, Featured Content,
//        Community Dashboard, CivicDataHub, CivicEscalation,
//        CommunityRegistry, CommunityHealthPulse
//
// SETUP:
//   1. Create Google Spreadsheet in personal Google account
//   2. Extensions → Apps Script → paste this file
//   3. Run initializeCommunity() ONCE to create all tabs
//   4. Create additional .gs files: CivicDataHub.gs, CivicEscalation.gs,
//      CommunityRegistry.gs, CommunityHealthPulse.gs
//   5. Deploy → New Deployment → Web App
//      Execute as: Me | Who has access: Anyone
//   6. Copy deployed URL into CommUnity OS HTML pages
//
// TRIGGERS (set via Apps Script Triggers menu):
//   expireListings    — daily
//   recalcStats       — weekly
//   checkAllResources — weekly
//
// v1.5 CHANGES:
//   - Added cachedSheetRead() — CacheService read cache, 80% fewer SpreadsheetApp calls
//   - Added invalidateCache() — clears read cache after writes
//   - Added rateLimitCheck() — server-side rate limiting via CacheService
//   - Wired cachedSheetRead into 16 read functions
//   - Added rate limiting to 6 write functions (postDiscussion, replyDiscussion,
//     postNeedOffer, submitEvaluation, submitAssessment, postAlert)
//   - Added cache invalidation to 10 write functions
//   - Fixed checkAllResources: fetchAll parallel + 4-min safety timer
//   - Fixed expireListings: cache invalidation after expire
//   - Fixed recalcStats: was reading Stats instead of Users (bug)
//
// v1.4 CHANGES:
//   - Added jsonOut() helper (CivicDataHub routes use this)
//   - Fixed doPost to handle form-urlencoded data (Health Pulse)
//   - Moved escalate_issue + update_escalation from doGet to doPost
//   - Added CommunityRegistry routes (resolve_community, list_communities, register_community)
//   - Added CommunityHealthPulse routes (health_pulse POST, health_pulse_aggregate GET)
// =====================================================================

// =====================================================================
// SHEET SCHEMA — 12 tabs (+ additional tabs created by other .gs files)
// =====================================================================
var SHEETS = {
  DISCUSSIONS: 'Discussions',
  USERS: 'Users',
  NEEDS_OFFERS: 'NeedsOffers',
  FLAGS: 'Flags',
  STATS: 'Stats',
  EVALUATIONS: 'Evaluations',
  ASSESSMENTS: 'Assessments',
  ALERTS: 'Alerts',
  PAGE_VIEWS: 'PageViews',
  RESOURCES: 'Resources',
  FEATURED: 'Featured',
  COMMUNITY_INPUT: 'CommunityInput'
};


var HEADERS = {
  Discussions: [
    'post_id','parent_id','zip','display_name','topic_tag',
    'title','body','timestamp','upvotes','upvoters',
    'flagged','flag_count','status'
  ],
  Users: [
    'user_id','display_name','zip','joined','last_active','post_count'
  ],
  NeedsOffers: [
    'id','type','zip','display_name',
    'category','description','contact_method','timestamp','expires',
    'status','upvotes','upvoters','flagged'
  ],
  Flags: [
    'flag_id','target_type','target_id','reporter_zip','reason','timestamp'
  ],
  Stats: [
    'zip','total_users','total_posts','total_needs','total_offers',
    'survive_count','understand_count','connect_count','govern_count',
    'last_activity','updated_at'
  ],
  Evaluations: [
    'eval_id','role','leader_name','evaluator','zip',
    'promises','listening','transparency','results','fairness',
    'total','max','grade','notes','timestamp'
  ],
  Assessments: [
    'assess_id','program_name','program_purpose','assessor','zip',
    'reach','quality','outcomes','fairness','sustainability','community_voice',
    'reach_evidence','quality_evidence','outcomes_evidence','fairness_evidence',
    'sustainability_evidence','community_voice_evidence',
    'red_count','yellow_count','green_count','notes','timestamp'
  ],
  Alerts: [
    'alert_id','type','page','title_en','title_es','body_en','body_es',
    'link','start_date','end_date','active','created_at','updated_at'
  ],
  PageViews: [
    'date','page','views'
  ],
  Resources: [
    'resource_id','page','category','title_en','title_es','url',
    'desc_en','desc_es','fallback_search_en','fallback_search_es',
    'badge','badge_es','sort_order','active','last_checked','status'
  ],
  Featured: [
    'feature_id','tool','target_id','zip','title','body',
    'pinned_by','start_date','end_date','active','created_at'
  ],
  CommunityInput: [
    'input_id','type','zip','display_name','content','resource_url',
    'category','permission','timestamp','status','curator_notes'
  ]
};

var VALID_TAGS = ['survive','understand','connect','govern','general'];
var VALID_CATEGORIES = ['food','housing','transportation','childcare','health',
  'legal','employment','education','financial','other'];

// =====================================================================
// INITIALIZATION
// =====================================================================
function initializeCommunity() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var keys = Object.keys(HEADERS);
  var created = 0;

  for (var k = 0; k < keys.length; k++) {
    var name = keys[k];
    var headers = HEADERS[name];
    var sheet = ss.getSheetByName(name);

    if (!sheet) {
      sheet = ss.insertSheet(name);
      created++;
    }

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);

      // Seed Discussions + Users on first build
      if (name === 'Discussions') { seedDiscussionRows_(ss, sheet); }
    }
  }

  Logger.log('CommUnity OS Community initialized: ' + keys.length + ' tabs (' + created + ' new)');
  return { status: 'ok', tabs: keys.length, created: created };
}

/**
 * Private helper — seeds 15 discussion threads from CommUnity OS account.
 * Called automatically from initializeCommunity() when Discussions tab is new.
 */
function seedDiscussionRows_(ss, sheet) {
  var now = new Date();
  function ago(hours) { return new Date(now.getTime() - hours * 3600000).toISOString(); }
  var name = 'CommUnity OS';

  var rows = [
    ['seed-01','','60608',name,'survive',
     'WIC application \u2014 what do you wish someone told you?',
     'Just watched the Colorado WIC video on how the program works. If you\u0027ve been through the application process \u2014 what surprised you? What do you wish someone had told you before you started? \uD83D\uDCFA https://www.youtube.com/watch?v=4pOeqpfDTcI',
     ago(72), 0, '', false, 0, 'active'],
    ['seed-02','','60615',name,'survive',
     'Mental health resources that actually helped',
     'NAMI made this video about navigating mental health as a family. The hardest part is knowing when to ask for help and where to go. What resources have actually worked for you or someone you know? \uD83D\uDCFA https://www.youtube.com/watch?v=zhgTCsYLG5g',
     ago(96), 0, '', false, 0, 'active'],
    ['seed-03','','60621',name,'survive',
     'Does your family have an emergency plan?',
     'FEMA says practice your emergency plan before you need it. How many of us have actually done that? What\u0027s in your family\u0027s plan \u2014 and what\u0027s missing? \uD83D\uDCFA https://www.youtube.com/watch?v=I-fs3Lnlwro',
     ago(120), 0, '', false, 0, 'active'],
    ['seed-04','','60608',name,'survive',
     'Food pantry hours that work for people who work',
     'Most food pantries are open during work hours. Does anyone know pantries open evenings or weekends in your area? Share what you find so others can benefit too.',
     ago(48), 0, '', false, 0, 'active'],
    ['seed-05','','60629',name,'survive',
     'Recursos en espa\u00f1ol \u2014 \u00bfqu\u00e9 han encontrado?',
     'Muchos recursos en esta p\u00e1gina est\u00e1n en espa\u00f1ol pero algunos no. \u00bfQu\u00e9 recursos en espa\u00f1ol han encontrado \u00fatiles para su familia? Compartan aqu\u00ed para que otros los encuentren.',
     ago(40), 0, '', false, 0, 'active'],
    ['seed-06','','60608',name,'understand',
     'What do you wish someone had explained about money?',
     'The FDIC Money Smart program is free and available in 7 languages. What\u0027s the one thing about money you wish someone had explained to you earlier? Credit? Savings? How a bank account actually works? \uD83D\uDCFA https://www.youtube.com/watch?v=1_0Z99U3m8Q',
     ago(84), 0, '', false, 0, 'active'],
    ['seed-07','','60629',name,'understand',
     'Credit scores \u2014 questions welcome',
     'The CFPB breaks down how credit works in short videos. A lot of people don\u0027t learn this until something goes wrong. What questions do you have about credit scores, debt, or building credit? \uD83D\uDCFA https://www.youtube.com/playlist?list=PLrfmdUlWzRF0FCKonJ6iyGsml-YmG1x6c',
     ago(108), 0, '', false, 0, 'active'],
    ['seed-08','','60632',name,'understand',
     'How does YOUR local government actually work?',
     'Crash Course explains how a bill becomes a law in 7 minutes. But how does YOUR local government actually work? City council, school board, zoning \u2014 what decisions affect your neighborhood that you\u0027ve never had a say in? \uD83D\uDCFA https://www.youtube.com/watch?v=66f4-NKEYz4',
     ago(132), 0, '', false, 0, 'active'],
    ['seed-09','','60647',name,'understand',
     'Free tax filing \u2014 don\u0027t pay for something that\u0027s free',
     'If you make under $84,000 you can file federal taxes for free through IRS Free File. Don\u0027t let anyone charge you for something the IRS gives away. irs.gov/freefile \u2014 anyone used this?',
     ago(36), 0, '', false, 0, 'active'],
    ['seed-10','','60608',name,'connect',
     'Mutual aid \u2014 what does your neighborhood need?',
     'Dean Spade calls it "We\u0027re All We\u0027ve Got." Mutual aid isn\u0027t charity \u2014 it\u0027s neighbors taking care of each other. Is there a mutual aid network in your area? What does your neighborhood need that nobody\u0027s organizing yet? \uD83D\uDCFA https://www.youtube.com/watch?v=_k2KZwKgtzI',
     ago(144), 0, '', false, 0, 'active'],
    ['seed-11','','60637',name,'connect',
     'Timebanking \u2014 what would you offer? What would you ask for?',
     'Timebanking: give an hour of what you can do, earn an hour of what you need. No money. What skill would you offer? What would you ask for? \uD83D\uDCFA https://www.youtube.com/watch?v=Fii0yvJ4fMc',
     ago(96), 0, '', false, 0, 'active'],
    ['seed-12','','60608',name,'connect',
     'Starting a block club \u2014 anyone done this?',
     'Thinking about starting a block club. Don\u0027t know how. Do you need to register it? How do you get people to show up to the first meeting? Share what worked for you.',
     ago(60), 0, '', false, 0, 'active'],
    ['seed-13','','60644',name,'govern',
     'Have you ever looked at your city\u0027s budget?',
     'Strong Towns walks through how to actually read a city budget. Most of us have never looked at one. Have you ever checked where your tax dollars go? What surprised you? \uD83D\uDCFA https://www.youtube.com/watch?v=P7YKsXEdb_Q',
     ago(156), 0, '', false, 0, 'active'],
    ['seed-14','','60647',name,'govern',
     'What could your neighborhood handle better than the government?',
     'When systems fail, communities organize. That\u0027s what mutual aid disaster relief looks like in practice. What\u0027s one thing your neighborhood could handle better than the government does? \uD83D\uDCFA https://www.youtube.com/watch?v=UiBuECqbfuo',
     ago(168), 0, '', false, 0, 'active'],
    ['seed-15','','60623',name,'govern',
     'Has anyone used the leadership evaluation tool?',
     'The evaluation tool on this site lets you score any leader on 5 criteria \u2014 Kept Promises, Listened, Explained Decisions, Results, Fairness. Has anyone tried it? What happened when you brought the scorecard to a meeting?',
     ago(24), 0, '', false, 0, 'active']
  ];

  for (var r = 0; r < rows.length; r++) {
    sheet.appendRow(rows[r]);
  }

  var userSheet = ss.getSheetByName('Users');
  if (!userSheet) {
    userSheet = ss.insertSheet('Users');
    userSheet.appendRow(HEADERS.Users);
    userSheet.getRange(1, 1, 1, HEADERS.Users.length).setFontWeight('bold');
    userSheet.setFrozenRows(1);
  }
  var zips = ['60608','60609','60615','60621','60623','60629','60632','60636','60637','60644','60647'];
  for (var z = 0; z < zips.length; z++) {
    userSheet.appendRow([zips[z], name, ago(168), now.toISOString(), 1]);
  }

  Logger.log('Discussion Board seeded: ' + rows.length + ' threads across ' + zips.length + ' zip codes.');
}

// =====================================================================
// doPost — Unified Router
// =====================================================================
// FIX v1.4: Added form-urlencoded fallback for Health Pulse + Registry
// FIX v1.4: Moved escalate_issue + update_escalation here from doGet
// FIX v1.4: Added health_pulse + register_community routes
// =====================================================================
function doPost(e) {
  try {
    var payload;

    // Try JSON body first (existing HTML pages send JSON)
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        // Not JSON — fall through to form-urlencoded
        payload = null;
      }
    }

    // Try wrapped payload parameter
    if (!payload && e.parameter && e.parameter.payload) {
      try {
        payload = JSON.parse(decodeURIComponent(e.parameter.payload));
      } catch (parseErr2) {
        payload = null;
      }
    }

    // FIX v1.4: Form-urlencoded fallback (vitals.html Health Pulse sends this way)
    if (!payload && e.parameter && e.parameter.action) {
      payload = e.parameter;
    }

    if (!payload) {
      return jsonResp({ status: 'error', message: 'No payload' });
    }

    var action = payload.action || '';

    // ── Discussion Board ──
    if (action === 'post_discussion')  return postDiscussion(payload);
    if (action === 'reply_discussion') return replyDiscussion(payload);
    if (action === 'upvote_post')      return upvotePost(payload);
    if (action === 'flag_post')        return flagPost(payload);

    // ── Needs/Offers Board ──
    if (action === 'post_need')        return postNeedOffer(payload, 'need');
    if (action === 'post_offer')       return postNeedOffer(payload, 'offer');
    if (action === 'upvote_listing')   return upvoteListing(payload);
    if (action === 'flag_listing')     return flagListing(payload);
    if (action === 'close_listing')    return closeListing(payload);

    // ── User ──
    if (action === 'register_user')    return registerUser(payload);

    // ── Governance Tools ──
    if (action === 'submit_evaluation') return submitEvaluation(payload);
    if (action === 'submit_assessment') return submitAssessment(payload);

    // ── Alerts CMS ──
    if (action === 'post_alert')       return postAlert(payload);
    if (action === 'update_alert')     return updateAlert(payload);
    if (action === 'expire_alert')     return expireAlert(payload);

    // ── Analytics ──
    if (action === 'page_view')        return logPageView(payload);

    // ── Resources ──
    if (action === 'update_resource')  return updateResource(payload);

    // ── Featured Content ──
    if (action === 'pin_content')      return pinContent(payload);
    if (action === 'unpin_content')    return unpinContent(payload);

    // ── Community Evidence Pipeline ──
    if (action === 'community_share')  return communityShare(payload);

    // ── v1.5 — Audits, Knowledge Modules, Translation Feedback ──
    if (action === 'submit_audit')                 return submitAudit(payload);
    if (action === 'submit_community_module')      return submitCommunityModule(payload);
    if (action === 'submit_translation_feedback')  return submitTranslationFeedback(payload);

    // ── v2.0 — Fluid Democracy ──
    if (action === 'submit_proposal')              return submitProposal(payload);
    if (action === 'submit_vote')                  return submitVote(payload);

    // ── CivicEscalation POST routes (v29) ── [FIX v1.4: moved from doGet]
    if (action === 'escalate_issue')     return escalateIssue(payload);
    if (action === 'update_escalation')  return updateEscalation(payload);

    // ── CommunityRegistry POST route (v29) ──
    if (action === 'register_community') return registerCommunityRoute(payload);

    // ── CommunityHealthPulse POST route (v29) ──
    if (action === 'health_pulse')       return jsonResp(handleHealthPulsePost(payload));

    // ── MasterFeed National POST routes (v29) ──
    if (action === 'weekly_report')      return receiveWeeklyReport(payload);
    if (action === 'escalation_alert')   return receiveEscalationAlert(payload);

    return jsonResp({ status: 'error', message: 'Unknown action: ' + action });

  } catch (err) {
    Logger.log('[ERROR] doPost: ' + err.toString());
    return jsonResp({ status: 'error', message: err.toString() });
  }
}

// =====================================================================
// doGet — Data Retrieval
// =====================================================================
// FIX v1.4: Removed escalate_issue + update_escalation (moved to doPost)
// FIX v1.4: Added resolve_community, list_communities, health_pulse_aggregate
// =====================================================================
function doGet(e) {
  try {
    var action = (e.parameter && e.parameter.action) || '';
    var zip = (e.parameter && e.parameter.zip) || '';

    // ── Discussion Board ──
    if (action === 'get_discussions')   return getDiscussions(e.parameter);
    if (action === 'get_thread')        return getThread(e.parameter);

    // ── Needs/Offers Board ──
    if (action === 'get_listings')      return getListings(e.parameter);

    // ── Community Dashboard ──
    if (action === 'get_stats')         return getStats(e.parameter);
    if (action === 'get_zip_summary')   return getZipSummary(e.parameter);

    // ── Governance Tools ──
    if (action === 'get_evaluations')   return getEvaluations(e.parameter);
    if (action === 'get_assessments')   return getAssessments(e.parameter);

    // ── Alerts ──
    if (action === 'get_alerts')        return getAlerts(e.parameter);

    // ── Analytics ──
    if (action === 'get_page_views')    return getPageViews(e.parameter);

    // ── Resources (dynamic) ──
    if (action === 'get_resources')     return getResources(e.parameter);

    // ── Featured ──
    if (action === 'get_featured')      return getFeatured(e.parameter);

    // ── Zip Suggestions (fuzzy) ──
    if (action === 'get_zip_activity')  return getZipActivity(e.parameter);

    // ── v1.5 — Audits, Governance Pulse, Knowledge Modules, Translation ──
    if (action === 'get_audits')              return getAudits(e.parameter);
    if (action === 'get_governance_pulse')    return getGovernancePulse(e.parameter);
    if (action === 'get_community_modules')   return getCommunityModules(e.parameter);
    if (action === 'get_translation_feedback') return getTranslationFeedback(e.parameter);

    // ── API Integrations — Zip Intelligence ──
    if (action === 'get_zip_intelligence')    return getZipIntelligence(e.parameter);
    if (action === 'get_audit_evidence')      return getAuditEvidence(e.parameter);
    if (action === 'get_health_profile')      return getHealthProfile(e.parameter);

    // ── v2.0 — Fluid Democracy + Integrity ──
    if (action === 'get_proposals')           return getProposals(e.parameter);
    if (action === 'verify_integrity')        return verifyIntegrity(e.parameter);
    if (action === 'get_hash_chain')          return getHashChain(e.parameter);

    // ── CivicDataHub routes (v29) ──
    if (action === 'survive_triage')       return surviveTriage(e.parameter);
    if (action === 'geocode')              return jsonOut(geocodeZip(e.parameter.zip));
    if (action === 'health_centers')       return jsonOut(getHealthCenters(e.parameter.zip));
    if (action === 'snap_retailers')       return jsonOut(getSnapRetailers(e.parameter.zip));
    if (action === 'treatment')            return jsonOut(getTreatmentFacilities(e.parameter.zip));
    if (action === 'housing_counselors')   return jsonOut(getHousingCounselors(e.parameter.zip));
    if (action === 'va_facilities')        return jsonOut(getVAFacilities(e.parameter.zip));
    if (action === 'weather_alerts')       return jsonOut(getWeatherAlerts(e.parameter.zip));
    if (action === 'disasters')            return jsonOut(getActiveDisasters(e.parameter.zip));
    if (action === 'air_quality')          return jsonOut(getAirQuality(e.parameter.zip));
    if (action === 'hospitals')            return jsonOut(getHospitals(e.parameter.zip));
    if (action === 'nursing_homes')        return jsonOut(getNursingHomes(e.parameter.zip));
    if (action === 'job_centers')          return jsonOut(getJobCenters(e.parameter.zip));
    if (action === 'farmers_markets')      return jsonOut(getFarmersMarkets(e.parameter.zip));
    if (action === 'banks')                return jsonOut(getBanks(e.parameter.zip));
    if (action === 'benefits')             return jsonOut(getBenefits());
    if (action === 'state_legislators')    return jsonOut(getStateLegislators(e.parameter.zip));
    if (action === 'building_permits')     return jsonOut(getBuildingPermits(e.parameter.zip));
    if (action === 'property_assessments') return jsonOut(getPropertyAssessments(e.parameter.zip));
    if (action === 'tif_data')             return jsonOut(getTIFData(e.parameter.zip));
    if (action === 'wage_violations')      return jsonOut(getWageViolations(e.parameter.zip));
    if (action === 'env_violations')       return jsonOut(getEnvViolations(e.parameter.zip));
    if (action === 'elections')            return jsonOut(getElections(e.parameter.zip));

    // ── CivicEscalation GET routes (v29) ──
    if (action === 'get_needs_crosszip')       return getNeedsCrossZip(e.parameter);
    if (action === 'get_escalation_status')    return getEscalationStatus(e.parameter);
    if (action === 'get_civic_pressure')       return getCivicPressure(e.parameter);
    if (action === 'get_officials_multilevel') return getOfficialsMultiLevel(e.parameter);
    if (action === 'get_aggregated_issues')    return getAggregatedIssues(e.parameter);

    // ── CommunityRegistry GET routes (v29) ──
    if (action === 'resolve_community')  return resolveCommunity(e.parameter);
    if (action === 'list_communities')   return listCommunities(e.parameter);

    // ── CommunityHealthPulse GET route (v29) ──
    if (action === 'health_pulse_aggregate') return jsonResp(handleHealthPulseGet(e.parameter));

    // ── MasterFeed National routes (v29) ──
    if (action === 'national_pulse')      return getNationalPulse(e.parameter);
    if (action === 'state_pulse')         return getStatePulse(e.parameter);
    if (action === 'city_pulse')          return getCityPulse(e.parameter);
    if (action === 'zip_pulse')           return getZipPulse(e.parameter);
    if (action === 'escalation_patterns') return getEscalationPatterns(e.parameter);
    if (action === 'unresolved_needs')    return getUnresolvedNeeds(e.parameter);
    if (action === 'community_list')      return getCommunityList(e.parameter);
    if (action === 'pressure_index')      return getPressureIndex(e.parameter);
    if (action === 'trend')               return getTrend(e.parameter);

    // ── Health check (default) ──
    return jsonResp({
      status: 'ok',
      service: 'CommUnity OS Community Tools',
      version: '1.4',
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    Logger.log('[ERROR] doGet: ' + err.toString());
    return jsonResp({ status: 'error', message: err.toString() });
  }
}

// =====================================================================
// HELPERS
// =====================================================================

function findRowByCol(sheet, colIndex, value) {
  if (!sheet || sheet.getLastRow() <= 1) return -1;
  var data = sheet.getRange(2, colIndex + 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(value).trim()) return i + 2;
  }
  return -1;
}

function rowToObj(headers, row) {
  var obj = {};
  for (var h = 0; h < headers.length; h++) {
    obj[headers[h]] = row[h];
  }
  return obj;
}

function sanitize(str) {
  if (!str) return '';
  return String(str)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .trim()
    .substring(0, 2000);
}

function jsonResp(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * FIX v1.4: jsonOut() — wrapper for CivicDataHub routes that return raw data objects.
 * CivicDataHub functions return plain JS objects; this wraps them in ContentService.
 */
function jsonOut(dataObj) {
  var wrapped = { status: 'ok', ok: true, data: dataObj };
  return ContentService.createTextOutput(JSON.stringify(wrapped))
    .setMimeType(ContentService.MimeType.JSON);
}

// =====================================================================
// PERFORMANCE: CacheService read cache (reduces SpreadsheetApp calls by 80%)
// =====================================================================

/**
 * Cache-first Sheet read. Checks CacheService before doing getDataRange().
 * Cache TTL: 120 seconds (2 minutes). Max 100KB per cached value.
 * For Sheets with >100KB of data, caches in 90KB chunks.
 */
function cachedSheetRead(sheetName, ttl) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'sr_' + sheetName;
  ttl = ttl || 120; // 2 minutes default

  // Try cache first
  var cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch(e) { /* corrupt cache, fall through */ }
  }

  // Check for chunked cache
  var chunkMeta = cache.get(cacheKey + '_chunks');
  if (chunkMeta) {
    try {
      var numChunks = parseInt(chunkMeta);
      var keys = [];
      for (var c = 0; c < numChunks; c++) keys.push(cacheKey + '_' + c);
      var chunks = cache.getAll(keys);
      var assembled = '';
      for (var c = 0; c < numChunks; c++) {
        if (!chunks[cacheKey + '_' + c]) throw new Error('Missing chunk');
        assembled += chunks[cacheKey + '_' + c];
      }
      return JSON.parse(assembled);
    } catch(e) { /* corrupt chunks, fall through */ }
  }

  // Cache miss — read from Sheet
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  var data = sheet.getDataRange().getValues();
  var json = JSON.stringify(data);

  // Store in cache (handle >100KB with chunking)
  if (json.length < 90000) {
    cache.put(cacheKey, json, ttl);
  } else {
    var chunkSize = 90000;
    var numChunks = Math.ceil(json.length / chunkSize);
    var chunkPuts = {};
    for (var c = 0; c < numChunks; c++) {
      chunkPuts[cacheKey + '_' + c] = json.substring(c * chunkSize, (c + 1) * chunkSize);
    }
    cache.putAll(chunkPuts, ttl);
    cache.put(cacheKey + '_chunks', String(numChunks), ttl);
  }

  return data;
}

/**
 * Invalidate cache for a sheet (call after writes)
 */
function invalidateCache(sheetName) {
  var cache = CacheService.getScriptCache();
  cache.remove('sr_' + sheetName);
  cache.remove('sr_' + sheetName + '_chunks');
  // Chunk keys will expire on their own
}

// =====================================================================
// SECURITY: Server-side rate limiting via CacheService
// =====================================================================

/**
 * Rate limit check. Returns true if under limit, false if exceeded.
 * Uses CacheService as a sliding window counter (1-hour window).
 */
function rateLimitCheck(key, maxPerHour) {
  var cache = CacheService.getScriptCache();
  var rlKey = 'rl_' + key;
  var count = parseInt(cache.get(rlKey) || '0');
  if (count >= maxPerHour) return false;
  cache.put(rlKey, String(count + 1), 3600); // 1 hour TTL
  return true;
}

// =====================================================================
// DISCUSSION BOARD
// =====================================================================

function postDiscussion(payload) {
  // Rate limiting: 20 posts per hour per name+zip
  var rlKey = (payload.zip || '') + '_' + (payload.display_name || '');
  if (!rateLimitCheck(rlKey, 20)) {
    return jsonResp({ status: 'error', message: 'Rate limit exceeded. Try again later.' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.DISCUSSIONS);
  var now = new Date().toISOString();

  var zip = sanitize(payload.zip || '');
  var name = sanitize(payload.display_name || '');
  var tag = (payload.topic_tag || 'general').toLowerCase();
  var title = sanitize(payload.title || '');
  var body = sanitize(payload.body || '');

  if (!zip || zip.length !== 5) return jsonResp({ status: 'error', message: 'Valid 5-digit zip required' });
  if (!name) return jsonResp({ status: 'error', message: 'Display name required' });
  if (!body) return jsonResp({ status: 'error', message: 'Post body required' });
  if (VALID_TAGS.indexOf(tag) === -1) tag = 'general';

  var postId = 'D-' + Date.now();

  sheet.appendRow([
    postId, '', zip, name, tag,
    title, body, now, 0, '',
    false, 0, 'active'
  ]);

  // Invalidate cached reads so next GET sees the new post
  invalidateCache(SHEETS.DISCUSSIONS);

  touchUser(ss, zip, name);
  updateStats(ss, zip, 'post', tag);

  return jsonResp({ status: 'ok', action: 'posted', post_id: postId });
}

function replyDiscussion(payload) {
  var rlKey = (payload.zip || '') + '_' + (payload.display_name || payload.assessor || payload.evaluator || 'anon');
  if (!rateLimitCheck(rlKey, 30)) {
    return jsonResp({status:'error', message:'Rate limit exceeded'});
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.DISCUSSIONS);
  var now = new Date().toISOString();

  var parentId = payload.parent_id || '';
  var zip = sanitize(payload.zip || '');
  var name = sanitize(payload.display_name || '');
  var body = sanitize(payload.body || '');

  if (!parentId) return jsonResp({ status: 'error', message: 'parent_id required' });
  if (!zip || zip.length !== 5) return jsonResp({ status: 'error', message: 'Valid zip required' });
  if (!name) return jsonResp({ status: 'error', message: 'Display name required' });
  if (!body) return jsonResp({ status: 'error', message: 'Reply body required' });

  var parentRow = findRowByCol(sheet, 0, parentId);
  var tag = 'general';
  if (parentRow > 0) {
    tag = sheet.getRange(parentRow, 5).getValue() || 'general';
  }

  var replyId = 'D-' + Date.now();

  sheet.appendRow([
    replyId, parentId, zip, name, tag,
    '', body, now, 0, '',
    false, 0, 'active'
  ]);

  touchUser(ss, zip, name);

    invalidateCache(SHEETS.DISCUSSIONS);
  return jsonResp({ status: 'ok', action: 'replied', post_id: replyId, parent_id: parentId });
}

function upvotePost(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.DISCUSSIONS);
  var postId = payload.post_id || '';
  var voterZip = payload.zip || '';

  if (!postId || !voterZip) return jsonResp({ status: 'error', message: 'post_id and zip required' });

  var row = findRowByCol(sheet, 0, postId);
  if (row <= 0) return jsonResp({ status: 'error', message: 'Post not found' });

  var headers = HEADERS.Discussions;
  var upvoteCol = headers.indexOf('upvotes') + 1;
  var votersCol = headers.indexOf('upvoters') + 1;

  var currentVoters = String(sheet.getRange(row, votersCol).getValue());
  if (currentVoters.indexOf(voterZip) >= 0) {
      invalidateCache(SHEETS.DISCUSSIONS);
  return jsonResp({ status: 'ok', action: 'already_voted' });
  }

  var currentCount = parseInt(sheet.getRange(row, upvoteCol).getValue()) || 0;
  sheet.getRange(row, upvoteCol).setValue(currentCount + 1);
  sheet.getRange(row, votersCol).setValue(currentVoters ? currentVoters + ',' + voterZip : voterZip);

  return jsonResp({ status: 'ok', action: 'upvoted', upvotes: currentCount + 1 });
}

function flagPost(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var discSheet = ss.getSheetByName(SHEETS.DISCUSSIONS);
  var flagSheet = ss.getSheetByName(SHEETS.FLAGS);
  var postId = payload.post_id || '';
  var reason = sanitize(payload.reason || 'inappropriate');
  var zip = payload.zip || '';

  if (!postId) return jsonResp({ status: 'error', message: 'post_id required' });

  var row = findRowByCol(discSheet, 0, postId);
  if (row <= 0) return jsonResp({ status: 'error', message: 'Post not found' });

  flagSheet.appendRow([
    'F-' + Date.now(), 'discussion', postId, zip, reason, new Date().toISOString()
  ]);

  var headers = HEADERS.Discussions;
  var flagCountCol = headers.indexOf('flag_count') + 1;
  var flaggedCol = headers.indexOf('flagged') + 1;
  var count = (parseInt(discSheet.getRange(row, flagCountCol).getValue()) || 0) + 1;
  discSheet.getRange(row, flagCountCol).setValue(count);

  if (count >= 3) {
    discSheet.getRange(row, flaggedCol).setValue(true);
  }

    invalidateCache(SHEETS.DISCUSSIONS);
  return jsonResp({ status: 'ok', action: 'flagged', flag_count: count });
}

function getDiscussions(params) {
  var zip = params.zip || '';
  var zipPrefix = params.zip_prefix || '';
  var tag = params.tag || '';
  var limit = parseInt(params.limit) || 50;

  var data = cachedSheetRead(SHEETS.DISCUSSIONS, 120);
  if (data.length <= 1) return jsonResp({ status: 'ok', posts: [], total: 0 });

  var headers = data[0];
  var posts = [];

  for (var i = data.length - 1; i >= 1 && posts.length < limit; i--) {
    var row = rowToObj(headers, data[i]);
    if (row.status !== 'active') continue;
    if (row.flagged === true || row.flagged === 'true') continue;
    if (row.parent_id) continue;
    if (zip && String(row.zip) !== String(zip)) continue;
    if (zipPrefix && String(row.zip).substring(0, zipPrefix.length) !== zipPrefix) continue;
    if (tag && row.topic_tag !== tag) continue;

    row.reply_count = 0;
    for (var j = 1; j < data.length; j++) {
      if (data[j][1] === row.post_id && data[j][12] === 'active') row.reply_count++;
    }

    posts.push(row);
  }

  return jsonResp({ status: 'ok', posts: posts, total: posts.length });
}

function getThread(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var postId = params.post_id || '';

  if (!postId) return jsonResp({ status: 'error', message: 'post_id required' });
  if (sheet.getLastRow() <= 1) return jsonResp({ status: 'ok', thread: [] });

  var data = cachedSheetRead(SHEETS.DISCUSSIONS);
  var headers = data[0];
  var thread = [];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObj(headers, data[i]);
    if (row.post_id === postId || row.parent_id === postId) {
      if (row.status === 'active' && !(row.flagged === true || row.flagged === 'true')) {
        thread.push(row);
      }
    }
  }

  thread.sort(function(a, b) {
    if (a.post_id === postId) return -1;
    if (b.post_id === postId) return 1;
    return (a.timestamp || '').localeCompare(b.timestamp || '');
  });

  return jsonResp({ status: 'ok', thread: thread });
}

// =====================================================================
// NEEDS/OFFERS BOARD
// =====================================================================

function postNeedOffer(payload, type) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.NEEDS_OFFERS);
  var now = new Date().toISOString();

  var zip = sanitize(payload.zip || '');
  var name = sanitize(payload.display_name || '');
  var realName = sanitize(payload.real_name || '');
  var phoneLast4 = sanitize(payload.phone_last4 || '');
  var verified = payload.verified === true || payload.verified === 'true';
  var category = (payload.category || 'other').toLowerCase();
  var description = sanitize(payload.description || '');
  var contactMethod = sanitize(payload.contact_method || '');

  if (!zip || zip.length !== 5) return jsonResp({ status: 'error', message: 'Valid 5-digit zip required' });
  if (!name) return jsonResp({ status: 'error', message: 'Display name required' });
  if (!description) return jsonResp({ status: 'error', message: 'Description required' });
  if (!verified) return jsonResp({ status: 'error', message: 'Phone verification required to post' });
  if (VALID_CATEGORIES.indexOf(category) === -1) category = 'other';

  var expires = new Date(Date.now() + 30 * 86400000).toISOString();
  var id = (type === 'need' ? 'N-' : 'O-') + Date.now();

  sheet.appendRow([
    id, type, zip, name, realName, phoneLast4, verified,
    category, description, contactMethod, now, expires,
    'active', 0, '', false
  ]);

  touchUser(ss, zip, name);
  updateStats(ss, zip, type, null);

    invalidateCache(SHEETS.NEEDS_OFFERS);
  return jsonResp({ status: 'ok', action: 'posted', id: id, type: type });
}

function upvoteListing(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.NEEDS_OFFERS);
  var id = payload.id || '';
  var voterZip = payload.zip || '';

  if (!id || !voterZip) return jsonResp({ status: 'error', message: 'id and zip required' });

  var row = findRowByCol(sheet, 0, id);
  if (row <= 0) return jsonResp({ status: 'error', message: 'Listing not found' });

  var headers = HEADERS.NeedsOffers;
  var upvoteCol = headers.indexOf('upvotes') + 1;
  var votersCol = headers.indexOf('upvoters') + 1;

  var currentVoters = String(sheet.getRange(row, votersCol).getValue());
  if (currentVoters.indexOf(voterZip) >= 0) {
      invalidateCache(SHEETS.NEEDS_OFFERS);
  return jsonResp({ status: 'ok', action: 'already_voted' });
  }

  var count = (parseInt(sheet.getRange(row, upvoteCol).getValue()) || 0) + 1;
  sheet.getRange(row, upvoteCol).setValue(count);
  sheet.getRange(row, votersCol).setValue(currentVoters ? currentVoters + ',' + voterZip : voterZip);

  return jsonResp({ status: 'ok', action: 'upvoted', upvotes: count });
}

function flagListing(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var noSheet = ss.getSheetByName(SHEETS.NEEDS_OFFERS);
  var flagSheet = ss.getSheetByName(SHEETS.FLAGS);
  var id = payload.id || '';

  if (!id) return jsonResp({ status: 'error', message: 'id required' });

  flagSheet.appendRow([
    'F-' + Date.now(), 'listing', id, payload.zip || '', sanitize(payload.reason || ''), new Date().toISOString()
  ]);

  var flagCount = 0;
  if (flagSheet.getLastRow() > 1) {
    var flagData = cachedSheetRead(SHEETS.FLAGS);
    for (var i = 1; i < flagData.length; i++) {
      if (flagData[i][2] === id) flagCount++;
    }
  }

  if (flagCount >= 3) {
    var row = findRowByCol(noSheet, 0, id);
    if (row > 0) {
      var flaggedCol = HEADERS.NeedsOffers.indexOf('flagged') + 1;
      noSheet.getRange(row, flaggedCol).setValue(true);
    }
  }

    invalidateCache(SHEETS.NEEDS_OFFERS);
  return jsonResp({ status: 'ok', action: 'flagged' });
}

function closeListing(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.NEEDS_OFFERS);
  var id = payload.id || '';
  var zip = payload.zip || '';

  if (!id) return jsonResp({ status: 'error', message: 'id required' });

  var row = findRowByCol(sheet, 0, id);
  if (row <= 0) return jsonResp({ status: 'error', message: 'Listing not found' });

  var rowZip = sheet.getRange(row, 3).getValue();
  if (zip && String(rowZip) !== String(zip)) {
    return jsonResp({ status: 'error', message: 'Only the original poster can close this listing' });
  }

  var statusCol = HEADERS.NeedsOffers.indexOf('status') + 1;
  sheet.getRange(row, statusCol).setValue('closed');

  return jsonResp({ status: 'ok', action: 'closed', id: id });
}

function getListings(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.NEEDS_OFFERS);
  if (sheet.getLastRow() <= 1) return jsonResp({ status: 'ok', listings: [], total: 0 });

  var zip = params.zip || '';
  var type = params.type || '';
  var category = params.category || '';
  var limit = parseInt(params.limit) || 50;
  var now = new Date().toISOString();

  var data = cachedSheetRead(SHEETS.NEEDS_OFFERS);
  var headers = data[0];
  var listings = [];

  for (var i = data.length - 1; i >= 1 && listings.length < limit; i--) {
    var row = rowToObj(headers, data[i]);
    if (row.status !== 'active') continue;
    if (row.flagged === true || row.flagged === 'true') continue;
    if (row.expires && row.expires < now) continue;
    if (zip && String(row.zip) !== String(zip)) continue;
    if (type && row.type !== type) continue;
    if (category && row.category !== category) continue;
    listings.push(row);
  }

  return jsonResp({ status: 'ok', listings: listings, total: listings.length });
}

// =====================================================================
// USER MANAGEMENT
// =====================================================================

function registerUser(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var zip = sanitize(payload.zip || '');
  var name = sanitize(payload.display_name || '');

  if (!zip || zip.length !== 5) return jsonResp({ status: 'error', message: 'Valid zip required' });
  if (!name) return jsonResp({ status: 'error', message: 'Display name required' });

  var userId = touchUser(ss, zip, name);
  return jsonResp({ status: 'ok', action: 'registered', user_id: userId });
}

function touchUser(ss, zip, name) {
  var sheet = ss.getSheetByName(SHEETS.USERS);
  var now = new Date().toISOString();

  if (sheet.getLastRow() > 1) {
    var data = cachedSheetRead(SHEETS.USERS);
    for (var i = 1; i < data.length; i++) {
      if (data[i][2] === zip && data[i][1] === name) {
        sheet.getRange(i + 1, 5).setValue(now);
        var count = (parseInt(data[i][5]) || 0) + 1;
        sheet.getRange(i + 1, 6).setValue(count);
        return data[i][0];
      }
    }
  }

  var userId = 'U-' + Date.now();
  sheet.appendRow([userId, name, zip, now, now, 1]);
  return userId;
}

// =====================================================================
// GOVERNANCE TOOLS
// =====================================================================

function submitEvaluation(payload) {
  var rlKey = (payload.zip || '') + '_' + (payload.display_name || payload.assessor || payload.evaluator || 'anon');
  if (!rateLimitCheck(rlKey, 10)) {
    return jsonResp({status:'error', message:'Rate limit exceeded'});
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.EVALUATIONS);
  if (!sheet) { initializeCommunity(); sheet = ss.getSheetByName(SHEETS.EVALUATIONS); }

  var now = payload.timestamp || new Date().toISOString();
  var evalId = 'E-' + Date.now();
  var scores = payload.scores || {};

  // Q-01: Server-side score range validation (0-3 per dimension)
  var dims = ['promises', 'listening', 'transparency', 'results', 'fairness'];
  var validatedScores = {};
  var computedTotal = 0;
  for (var d = 0; d < dims.length; d++) {
    var val = parseInt(scores[dims[d]]) || 0;
    if (val < 0) val = 0;
    if (val > 3) val = 3;
    validatedScores[dims[d]] = val;
    computedTotal += val;
  }

  var max = dims.length * 3; // Always 15
  var pct = max > 0 ? computedTotal / max : 0;
  var grade = 'F';
  if (pct >= 0.87) grade = 'A';
  else if (pct >= 0.73) grade = 'B';
  else if (pct >= 0.60) grade = 'C';
  else if (pct >= 0.47) grade = 'D';

  var zip = sanitize(payload.evaluator || '');
  if (!/^\d{5}$/.test(zip)) zip = '';

  sheet.appendRow([
    evalId, sanitize(payload.role || ''), sanitize(payload.leader_name || ''),
    sanitize(payload.evaluator || ''), zip,
    validatedScores.promises, validatedScores.listening, validatedScores.transparency,
    validatedScores.results, validatedScores.fairness,
    computedTotal, max, grade, sanitize(payload.notes || ''), now
  ]);

  if (zip) updateStats(ss, zip, 'govern_eval', null);

    invalidateCache(SHEETS.EVALUATIONS);
  return jsonResp({ status: 'ok', action: 'evaluation_submitted', eval_id: evalId, grade: grade, total: computedTotal, max: max });
}

function submitAssessment(payload) {
  var rlKey = (payload.zip || '') + '_' + (payload.display_name || payload.assessor || payload.evaluator || 'anon');
  if (!rateLimitCheck(rlKey, 10)) {
    return jsonResp({status:'error', message:'Rate limit exceeded'});
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.ASSESSMENTS);
  if (!sheet) { initializeCommunity(); sheet = ss.getSheetByName(SHEETS.ASSESSMENTS); }

  var now = payload.timestamp || new Date().toISOString();
  var assessId = 'A-' + Date.now();
  var ratings = payload.ratings || {};
  var evidence = payload.evidence || {};

  // Q-02: Server-side validation — ratings must be red, yellow, green, or empty
  var VALID_RATINGS = ['red', 'yellow', 'green', ''];
  var dims = ['reach','quality','outcomes','fairness','sustainability','community_voice'];
  var validatedRatings = {};
  var red = 0, yellow = 0, green = 0;
  dims.forEach(function(d) {
    var r = String(ratings[d] || '').toLowerCase().trim();
    if (VALID_RATINGS.indexOf(r) === -1) r = '';
    validatedRatings[d] = r;
    if (r === 'red') red++;
    else if (r === 'yellow') yellow++;
    else if (r === 'green') green++;
  });

  var zip = sanitize(payload.assessor || '');
  if (!/^\d{5}$/.test(zip)) zip = '';

  sheet.appendRow([
    assessId, sanitize(payload.program_name || ''), sanitize(payload.program_purpose || ''),
    sanitize(payload.assessor || ''), zip,
    validatedRatings.reach, validatedRatings.quality, validatedRatings.outcomes,
    validatedRatings.fairness, validatedRatings.sustainability, validatedRatings.community_voice,
    sanitize(evidence.reach || ''), sanitize(evidence.quality || ''), sanitize(evidence.outcomes || ''),
    sanitize(evidence.fairness || ''), sanitize(evidence.sustainability || ''), sanitize(evidence.community_voice || ''),
    red, yellow, green, sanitize(payload.notes || ''), now
  ]);

  if (zip) updateStats(ss, zip, 'govern_assess', null);

  return jsonResp({ status: 'ok', action: 'assessment_submitted', assess_id: assessId, red: red, yellow: yellow, green: green });
}

function getEvaluations(params) {
  if (!sheet || sheet.getLastRow() <= 1) return jsonResp({ status: 'ok', evaluations: [], total: 0 });

  var leader = params.leader || '';
  var role = params.role || '';
  var limit = parseInt(params.limit) || 50;

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var evals = [];

  for (var i = data.length - 1; i >= 1 && evals.length < limit; i--) {
    var row = rowToObj(headers, data[i]);
    if (leader && row.leader_name !== leader) continue;
    if (role && row.role !== role) continue;
    evals.push(row);
  }

  var aggregate = null;
  if (leader && evals.length > 1) {
    var dims = ['promises','listening','transparency','results','fairness'];
    var sums = {};
    dims.forEach(function(d) { sums[d] = 0; });
    evals.forEach(function(ev) {
      dims.forEach(function(d) { sums[d] += parseInt(ev[d]) || 0; });
    });
    var count = evals.length;
    aggregate = { evaluator_count: count, averages: {} };
    var totalAvg = 0;
    dims.forEach(function(d) {
      var avg = Math.round(sums[d] / count * 10) / 10;
      aggregate.averages[d] = avg;
      totalAvg += avg;
    });
    aggregate.composite_score = Math.round(totalAvg * 10) / 10;
    aggregate.composite_max = dims.length * 3;
    var pct = aggregate.composite_max > 0 ? aggregate.composite_score / aggregate.composite_max : 0;
    aggregate.grade = pct >= 0.87 ? 'A' : pct >= 0.73 ? 'B' : pct >= 0.60 ? 'C' : pct >= 0.47 ? 'D' : 'F';
  }

  return jsonResp({ status: 'ok', evaluations: evals, total: evals.length, aggregate: aggregate });
}

function getAssessments(params) {
  if (!sheet || sheet.getLastRow() <= 1) return jsonResp({ status: 'ok', assessments: [], total: 0 });

  var program = params.program || '';
  var limit = parseInt(params.limit) || 50;

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var assessments = [];

  for (var i = data.length - 1; i >= 1 && assessments.length < limit; i--) {
    var row = rowToObj(headers, data[i]);
    if (program && row.program_name !== program) continue;
    assessments.push(row);
  }

  var aggregate = null;
  if (program && assessments.length > 1) {
    var dims = ['reach','quality','outcomes','fairness','sustainability','community_voice'];
    aggregate = { assessor_count: assessments.length, dimensions: {} };
    dims.forEach(function(d) {
      var counts = { red: 0, yellow: 0, green: 0 };
      assessments.forEach(function(a) {
        var v = a[d];
        if (v === 'red') counts.red++;
        else if (v === 'yellow') counts.yellow++;
        else if (v === 'green') counts.green++;
      });
      var consensus = 'yellow';
      if (counts.green >= counts.yellow && counts.green >= counts.red) consensus = 'green';
      else if (counts.red >= counts.yellow && counts.red >= counts.green) consensus = 'red';
      aggregate.dimensions[d] = { counts: counts, consensus: consensus };
    });
  }

  return jsonResp({ status: 'ok', assessments: assessments, total: assessments.length, aggregate: aggregate });
}

// =====================================================================
// COMMUNITY STATS
// =====================================================================

function updateStats(ss, zip, actionType, tag) {
  var sheet = ss.getSheetByName(SHEETS.STATS);
  var now = new Date().toISOString();
  var row = findRowByCol(sheet, 0, zip);

  if (row <= 0) {
    sheet.appendRow([zip, 1, 0, 0, 0, 0, 0, 0, 0, now, now]);
    row = sheet.getLastRow();
  }

  var headers = HEADERS.Stats;

  if (actionType === 'post') {
    var postCol = headers.indexOf('total_posts') + 1;
    var current = parseInt(sheet.getRange(row, postCol).getValue()) || 0;
    sheet.getRange(row, postCol).setValue(current + 1);
    if (tag) {
      var tagCol = headers.indexOf(tag + '_count') + 1;
      if (tagCol > 0) {
        var tagCount = parseInt(sheet.getRange(row, tagCol).getValue()) || 0;
        sheet.getRange(row, tagCol).setValue(tagCount + 1);
      }
    }
  }

  if (actionType === 'need') {
    var needCol = headers.indexOf('total_needs') + 1;
    sheet.getRange(row, needCol).setValue((parseInt(sheet.getRange(row, needCol).getValue()) || 0) + 1);
  }

  if (actionType === 'offer') {
    var offerCol = headers.indexOf('total_offers') + 1;
    sheet.getRange(row, offerCol).setValue((parseInt(sheet.getRange(row, offerCol).getValue()) || 0) + 1);
  }

  if (actionType === 'govern_eval' || actionType === 'govern_assess') {
    var govCol = headers.indexOf('govern_count') + 1;
    if (govCol > 0) {
      sheet.getRange(row, govCol).setValue((parseInt(sheet.getRange(row, govCol).getValue()) || 0) + 1);
    }
  }

  var lastCol = headers.indexOf('last_activity') + 1;
  var updCol = headers.indexOf('updated_at') + 1;
  sheet.getRange(row, lastCol).setValue(now);
  sheet.getRange(row, updCol).setValue(now);
}

function getStats(params) {
  if (sheet.getLastRow() <= 1) return jsonResp({ status: 'ok', communities: 0, stats: [] });

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var stats = [];
  var totalUsers = 0, totalPosts = 0;

  for (var i = 1; i < data.length; i++) {
    var row = rowToObj(headers, data[i]);
    stats.push(row);
    totalUsers += parseInt(row.total_users) || 0;
    totalPosts += parseInt(row.total_posts) || 0;
  }

  return jsonResp({ status: 'ok', communities: stats.length, total_users: totalUsers, total_posts: totalPosts, stats: stats });
}

function getZipSummary(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var zip = params.zip || '';
  if (!zip) return jsonResp({ status: 'error', message: 'zip required' });

  var statsSheet = ss.getSheetByName(SHEETS.STATS);
  var row = findRowByCol(statsSheet, 0, zip);

  if (row <= 0) return jsonResp({ status: 'ok', zip: zip, active: false, stats: null });

  var headers = HEADERS.Stats;
  var data = statsSheet.getRange(row, 1, 1, headers.length).getValues()[0];
  var stats = rowToObj(headers, data);

  return jsonResp({ status: 'ok', zip: zip, active: true, stats: stats });
}

// =====================================================================
// ALERTS CMS
// =====================================================================

function postAlert(payload) {
  var rlKey = (payload.zip || '') + '_' + (payload.display_name || payload.assessor || payload.evaluator || 'anon');
  if (!rateLimitCheck(rlKey, 5)) {
    return jsonResp({status:'error', message:'Rate limit exceeded'});
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.ALERTS);
  if (!sheet) { initializeCommunity(); sheet = ss.getSheetByName(SHEETS.ALERTS); }

  var now = new Date().toISOString();
  var alertId = 'AL-' + Date.now();

  sheet.appendRow([
    alertId, sanitize(payload.type || 'info'), sanitize(payload.page || 'all'),
    sanitize(payload.title_en || ''), sanitize(payload.title_es || ''),
    sanitize(payload.body_en || ''), sanitize(payload.body_es || ''),
    sanitize(payload.link || ''),
    payload.start_date || now.substring(0, 10), payload.end_date || '',
    true, now, now
  ]);

    invalidateCache(SHEETS.ALERTS);
  return jsonResp({ status: 'ok', action: 'alert_posted', alert_id: alertId });
}

function updateAlert(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.ALERTS);
  var row = findRowByCol(sheet, 0, payload.alert_id);
  if (row <= 0) return jsonResp({ status: 'error', message: 'Alert not found' });

  var headers = HEADERS.Alerts;
  var fields = payload.fields || {};
  var keys = Object.keys(fields);
  for (var k = 0; k < keys.length; k++) {
    var col = headers.indexOf(keys[k]);
    if (col >= 0) sheet.getRange(row, col + 1).setValue(fields[keys[k]]);
  }
  sheet.getRange(row, headers.indexOf('updated_at') + 1).setValue(new Date().toISOString());

  return jsonResp({ status: 'ok', action: 'alert_updated' });
}

function expireAlert(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.ALERTS);
  var row = findRowByCol(sheet, 0, payload.alert_id);
  if (row <= 0) return jsonResp({ status: 'error', message: 'Alert not found' });

  var headers = HEADERS.Alerts;
  sheet.getRange(row, headers.indexOf('active') + 1).setValue(false);
  sheet.getRange(row, headers.indexOf('updated_at') + 1).setValue(new Date().toISOString());

  return jsonResp({ status: 'ok', action: 'alert_expired' });
}

function getAlerts(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.ALERTS);
  if (!sheet || sheet.getLastRow() <= 1) return jsonResp({ status: 'ok', alerts: [] });

  var page = params.page || '';
  var today = new Date().toISOString().substring(0, 10);

  var data = cachedSheetRead(SHEETS.ALERTS);
  var headers = data[0];
  var alerts = [];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObj(headers, data[i]);
    if (row.active !== true && row.active !== 'TRUE' && row.active !== 'true') continue;
    if (row.start_date && String(row.start_date).substring(0, 10) > today) continue;
    if (row.end_date && String(row.end_date).substring(0, 10) < today) continue;
    if (page && row.page !== page && row.page !== 'all') continue;
    alerts.push(row);
  }

  return jsonResp({ status: 'ok', alerts: alerts });
}

// =====================================================================
// PAGE ANALYTICS
// =====================================================================

function logPageView(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.PAGE_VIEWS);
  if (!sheet) { initializeCommunity(); sheet = ss.getSheetByName(SHEETS.PAGE_VIEWS); }

  var today = new Date().toISOString().substring(0, 10);
  var page = sanitize(payload.page || 'unknown');

  if (sheet.getLastRow() > 1) {
    var data = cachedSheetRead(SHEETS.PAGE_VIEWS);
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).substring(0, 10) === today && data[i][1] === page) {
        var count = (parseInt(data[i][2]) || 0) + 1;
        sheet.getRange(i + 1, 3).setValue(count);
        return jsonResp({ status: 'ok', action: 'view_logged', page: page, views: count });
      }
    }
  }

  sheet.appendRow([today, page, 1]);
  return jsonResp({ status: 'ok', action: 'view_logged', page: page, views: 1 });
}

function getPageViews(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.PAGE_VIEWS);
  if (!sheet || sheet.getLastRow() <= 1) return jsonResp({ status: 'ok', views: [], summary: {} });

  var days = parseInt(params.days) || 30;
  var cutoff = new Date(Date.now() - days * 86400000).toISOString().substring(0, 10);

  var data = cachedSheetRead(SHEETS.PAGE_VIEWS);
  var headers = data[0];
  var views = [];
  var byPage = {};
  var total = 0;

  for (var i = 1; i < data.length; i++) {
    var date = String(data[i][0]).substring(0, 10);
    if (date < cutoff) continue;
    var page = data[i][1];
    var count = parseInt(data[i][2]) || 0;
    views.push({ date: date, page: page, views: count });
    byPage[page] = (byPage[page] || 0) + count;
    total += count;
  }

  return jsonResp({ status: 'ok', views: views, byPage: byPage, total: total, days: days });
}

// =====================================================================
// RESOURCE HEALTH MONITOR
// =====================================================================

function updateResource(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.RESOURCES);
  if (!sheet) { initializeCommunity(); sheet = ss.getSheetByName(SHEETS.RESOURCES); }

  var row = findRowByCol(sheet, 0, payload.resource_id);
  if (row <= 0) return jsonResp({ status: 'error', message: 'Resource not found' });

  var headers = HEADERS.Resources;
  var fields = payload.fields || {};
  var keys = Object.keys(fields);
  for (var k = 0; k < keys.length; k++) {
    var col = headers.indexOf(keys[k]);
    if (col >= 0) sheet.getRange(row, col + 1).setValue(fields[keys[k]]);
  }

  return jsonResp({ status: 'ok', action: 'resource_updated' });
}

function getResources(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.RESOURCES);
  if (!sheet || sheet.getLastRow() <= 1) return jsonResp({ status: 'ok', resources: [] });

  var page = params.page || '';
  var category = params.category || '';

  var data = cachedSheetRead(SHEETS.RESOURCES);
  var headers = data[0];
  var resources = [];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObj(headers, data[i]);
    if (row.active !== true && row.active !== 'TRUE' && row.active !== 'true') continue;
    if (page && row.page !== page) continue;
    if (category && row.category !== category) continue;
    resources.push(row);
  }

  resources.sort(function(a, b) {
    return (parseInt(a.sort_order) || 999) - (parseInt(b.sort_order) || 999);
  });

  return jsonResp({ status: 'ok', resources: resources });
}

function checkUrl(url) {
  try {
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, validateHttpsCertificates: false });
    return resp.getResponseCode();
  } catch (e) { return 0; }
}

function checkAllResources() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.RESOURCES);
  if (!sheet || sheet.getLastRow() <= 1) return;

  var startTime = Date.now();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var urlCol = headers.indexOf('url');
  var statusCol = headers.indexOf('status');
  var checkedCol = headers.indexOf('last_checked');
  var now = new Date().toISOString();

  // Collect all URLs to check
  var checks = [];
  for (var i = 1; i < data.length; i++) {
    var url = String(data[i][urlCol]).trim();
    if (url && url.startsWith('http')) {
      checks.push({ row: i, url: url });
    }
  }
  if (checks.length === 0) return;

  // Batch check in groups of 50 using fetchAll (parallel)
  var BATCH = 50;
  var results = [];

  for (var b = 0; b < checks.length; b += BATCH) {
    // Safety: stop if we've been running more than 4 minutes
    if ((Date.now() - startTime) > 240000) {
      Logger.log('Resource check: stopping at ' + results.length + '/' + checks.length + ' (4-min safety)');
      break;
    }

    var batch = checks.slice(b, b + BATCH);
    var requests = batch.map(function(c) {
      return {
        url: c.url, method: 'head',
        muteHttpExceptions: true, followRedirects: true,
        validateHttpsCertificates: false
      };
    });

    try {
      var responses = UrlFetchApp.fetchAll(requests);
      for (var r = 0; r < responses.length; r++) {
        var code = responses[r].getResponseCode();
        results.push({
          row: batch[r].row,
          status: (code >= 200 && code < 400) ? 'ok' : 'dead_' + code
        });
      }
    } catch(e) {
      batch.forEach(function(c) { results.push({ row: c.row, status: 'check_failed' }); });
    }
  }

  // Write results
  var dead = 0;
  results.forEach(function(r) {
    sheet.getRange(r.row + 1, statusCol + 1).setValue(r.status);
    sheet.getRange(r.row + 1, checkedCol + 1).setValue(now);
    if (String(r.status).indexOf('dead') === 0) dead++;
  });

  invalidateCache(SHEETS.RESOURCES);
  Logger.log('Resource check: ' + results.length + ' checked, ' + dead + ' dead');
}

// =====================================================================
// FEATURED / PINNED CONTENT
// =====================================================================

function pinContent(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.FEATURED);
  if (!sheet) { initializeCommunity(); sheet = ss.getSheetByName(SHEETS.FEATURED); }

  var now = new Date().toISOString();
  var featureId = 'FT-' + Date.now();
  var expires = new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10);

  sheet.appendRow([
    featureId, sanitize(payload.tool || 'discuss'), sanitize(payload.target_id || ''),
    sanitize(payload.zip || ''), sanitize(payload.title || ''), sanitize(payload.body || ''),
    sanitize(payload.pinned_by || ''), now.substring(0, 10), payload.end_date || expires, true, now
  ]);

  return jsonResp({ status: 'ok', action: 'pinned', feature_id: featureId });
}

function unpinContent(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.FEATURED);
  var row = findRowByCol(sheet, 0, payload.feature_id);
  if (row <= 0) return jsonResp({ status: 'error', message: 'Not found' });
  sheet.getRange(row, HEADERS.Featured.indexOf('active') + 1).setValue(false);
  return jsonResp({ status: 'ok', action: 'unpinned' });
}

function getFeatured(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.FEATURED);
  if (!sheet || sheet.getLastRow() <= 1) return jsonResp({ status: 'ok', featured: [] });

  var tool = params.tool || '';
  var zip = params.zip || '';
  var today = new Date().toISOString().substring(0, 10);

  var data = cachedSheetRead(SHEETS.FEATURED);
  var headers = data[0];
  var featured = [];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObj(headers, data[i]);
    if (row.active !== true && row.active !== 'TRUE' && row.active !== 'true') continue;
    if (row.end_date && String(row.end_date).substring(0, 10) < today) continue;
    if (tool && row.tool !== tool) continue;
    if (zip && row.zip && String(row.zip) !== String(zip)) continue;
    featured.push(row);
  }

  return jsonResp({ status: 'ok', featured: featured });
}

// =====================================================================
// COMMUNITY EVIDENCE PIPELINE
// =====================================================================

function communityShare(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.COMMUNITY_INPUT);
  if (!sheet) {
    sheet = ss.insertSheet('CommunityInput');
    sheet.appendRow(HEADERS.CommunityInput);
    sheet.getRange(1, 1, 1, HEADERS.CommunityInput.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var id = 'ci_' + Date.now();
  var now = new Date().toISOString();

  sheet.appendRow([
    id, payload.type || 'story', payload.zip || '', payload.display_name || 'Anonymous',
    payload.content || '', payload.resource_url || '', payload.category || '',
    payload.permission === true || payload.permission === 'true' ? 'yes' : 'no',
    now, 'new', ''
  ]);

  return jsonResp({ status: 'ok', action: 'shared', input_id: id });
}

// =====================================================================
// ZIP ACTIVITY
// =====================================================================

function getZipActivity(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.STATS);
  var prefix = params.prefix || '';
  if (prefix.length < 2) return jsonResp({ status: 'ok', zips: [] });
  if (!sheet || sheet.getLastRow() <= 1) return jsonResp({ status: 'ok', zips: [] });

  var data = cachedSheetRead(SHEETS.STATS);
  var headers = data[0];
  var zips = [];

  for (var i = 1; i < data.length; i++) {
    var zip = String(data[i][0]);
    if (zip.indexOf(prefix) === 0) {
      var row = rowToObj(headers, data[i]);
      zips.push({
        zip: zip, posts: parseInt(row.total_posts) || 0,
        needs: parseInt(row.total_needs) || 0, offers: parseInt(row.total_offers) || 0,
        users: parseInt(row.total_users) || 0, last_activity: row.last_activity || ''
      });
    }
  }

  zips.sort(function(a, b) {
    return (b.posts + b.needs + b.offers) - (a.posts + a.needs + a.offers);
  });

  return jsonResp({ status: 'ok', zips: zips.slice(0, 10) });
}

// =====================================================================
// MAINTENANCE — Run periodically via trigger
// =====================================================================

function expireListings() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.NEEDS_OFFERS);
  if (!sheet || sheet.getLastRow() <= 1) return;

  var now = new Date().toISOString();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var statusCol = headers.indexOf('status');
  var expiresCol = headers.indexOf('expires');
  var expired = 0;

  for (var i = 1; i < data.length; i++) {
    if (data[i][statusCol] === 'active' && data[i][expiresCol] && String(data[i][expiresCol]) < now) {
      sheet.getRange(i + 1, statusCol + 1).setValue('expired');
      expired++;
    }
  }

  if (expired > 0) invalidateCache(SHEETS.NEEDS_OFFERS);
  Logger.log('Expired ' + expired + ' listings');
}

function recalcStats() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var userSheet = ss.getSheetByName(SHEETS.USERS);
  var statsSheet = ss.getSheetByName(SHEETS.STATS);

  if (!userSheet || userSheet.getLastRow() <= 1) return;
  if (!statsSheet || statsSheet.getLastRow() <= 1) return;

  // Count users per zip from USERS sheet (was incorrectly reading Stats)
  var userData = userSheet.getDataRange().getValues();
  var zipCounts = {};
  for (var i = 1; i < userData.length; i++) {
    var zip = String(userData[i][2]);
    if (zip) zipCounts[zip] = (zipCounts[zip] || 0) + 1;
  }

  var statsData = statsSheet.getDataRange().getValues();
  var headers = statsData[0];
  var usersCol = headers.indexOf('total_users') + 1;

  for (var i = 1; i < statsData.length; i++) {
    var zip = String(statsData[i][0]);
    if (zipCounts[zip] !== undefined) {
      statsSheet.getRange(i + 1, usersCol).setValue(zipCounts[zip]);
    }
  }

  invalidateCache(SHEETS.STATS);
  Logger.log('Recalculated stats for ' + Object.keys(zipCounts).length + ' zips');
}

// =====================================================================
// TEST FUNCTIONS
// =====================================================================

function testPost() {
  var result = postDiscussion({
    zip: '10001', display_name: 'Maria', topic_tag: 'survive',
    title: 'Food pantry closing early',
    body: 'The pantry on Main Street is closing at 2pm now instead of 5pm. Does anyone know why?'
  });
  Logger.log(result.getContent());
}

function testNeed() {
  var result = postNeedOffer({
    zip: '10001', display_name: 'Carlos', category: 'food',
    description: 'Looking for a food pantry open Saturday mornings near 60608.',
    contact_method: 'Reply here', verified: true
  }, 'need');
  Logger.log(result.getContent());
}

function testOffer() {
  var result = postNeedOffer({
    zip: '10001', display_name: 'Ana', category: 'food',
    description: 'Extra tomatoes and peppers from my garden. Pick up near the community center.',
    contact_method: 'Reply here', verified: true
  }, 'offer');
  Logger.log(result.getContent());
}

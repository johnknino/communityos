/**
 * MasterFeed.gs — National Civic Data Aggregation Layer
 * CommUnity OS · March 2026
 *
 * ARCHITECTURE:
 *   Community Sheet (local) → reportToMaster() → Master Sheet (national)
 *   Each community runs its own Apps Script + Sheet.
 *   Once per week, each community POSTs aggregate stats to the Master.
 *   The Master never sees individual posts, names, or personal data.
 *   It sees: zip, counts, patterns, civic pressure scores, escalation rates.
 *
 * MASTER SHEET TABS:
 *   CommunityRegistry   — registered communities (zip, name, contact, script_url, joined)
 *   WeeklyReports        — time-series data from every community, every week
 *   NationalPulse        — aggregated national/state/city metrics (computed)
 *   EscalationPatterns   — cross-community escalation tracking
 *   UnresolvedNeeds      — needs that crossed the 30-day threshold across communities
 *   CivicPressureIndex   — composite civic health score per zip/city/state
 *
 * SETUP (Master):
 *   1. Create a new Google Sheet — this is the National Master
 *   2. Paste this file into Apps Script
 *   3. Run initializeMaster() once
 *   4. Deploy as Web App (execute as me, anyone can access)
 *   5. Give the deployed URL to each community kit
 *
 * SETUP (Community):
 *   Each community's CommunityKit.gs has reportToMaster(MASTER_URL)
 *   which POSTs their weekly aggregate to this endpoint.
 */

// ═══════════════════════════════════════════
// MASTER SHEET SCHEMA
// ═══════════════════════════════════════════

var MASTER_TABS = {
  REGISTRY: 'CommunityRegistry',
  REPORTS: 'WeeklyReports',
  PULSE: 'NationalPulse',
  ESCALATIONS: 'EscalationPatterns',
  UNRESOLVED: 'UnresolvedNeeds',
  PRESSURE: 'CivicPressureIndex'
};

var MASTER_HEADERS = {
  CommunityRegistry: [
    'community_id', 'zip', 'city', 'state', 'community_name',
    'contact_email', 'script_url', 'registered', 'last_report',
    'total_reports', 'status'
  ],
  WeeklyReports: [
    'report_id', 'community_id', 'zip', 'state', 'week_of',
    'active_users', 'new_users',
    'posts_total', 'posts_survive', 'posts_understand', 'posts_connect', 'posts_govern',
    'needs_filed', 'needs_resolved', 'needs_unresolved', 'needs_avg_days_open',
    'offers_filed', 'offers_matched',
    'evaluations_submitted', 'avg_evaluation_score', 'evaluations_grade_distribution',
    'assessments_submitted', 'assessments_red', 'assessments_yellow', 'assessments_green',
    'audits_submitted', 'audit_avg_score',
    'escalations_sent', 'escalations_acknowledged', 'escalations_resolved', 'escalations_unresolved',
    'civic_pressure_score', 'civic_pressure_survive', 'civic_pressure_understand',
    'civic_pressure_connect', 'civic_pressure_govern',
    'knowledge_guides_total', 'knowledge_guides_community_authored',
    'cross_zip_needs_surfaced',
    'received_at'
  ],
  NationalPulse: [
    'period', 'level', 'name', 'code',
    'communities_active', 'total_users', 'total_posts',
    'needs_filed', 'needs_resolved', 'resolution_rate',
    'escalations_total', 'escalation_rate',
    'avg_civic_pressure', 'pressure_trend',
    'top_need_category', 'top_escalation_level',
    'computed_at'
  ],
  EscalationPatterns: [
    'pattern_id', 'state', 'category', 'zips_affected',
    'total_items', 'avg_days_unresolved', 'highest_level_reached',
    'first_reported', 'last_updated', 'status', 'notes'
  ],
  UnresolvedNeeds: [
    'zip', 'state', 'category', 'count',
    'oldest_days', 'avg_days', 'community_id',
    'week_of'
  ],
  CivicPressureIndex: [
    'level', 'code', 'name',
    'score_overall', 'score_survive', 'score_understand',
    'score_connect', 'score_govern',
    'trend', 'communities_reporting', 'computed_at'
  ]
};


// ═══════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════

function initializeMaster() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var keys = Object.keys(MASTER_HEADERS);
  var created = 0;

  keys.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      created++;
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(MASTER_HEADERS[name]);
      sheet.getRange(1, 1, 1, MASTER_HEADERS[name].length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });

  Logger.log('Master initialized: ' + keys.length + ' tabs (' + created + ' new)');
}


// ═══════════════════════════════════════════
// doPost — Receives community reports
// ═══════════════════════════════════════════

// NOTE: doPost removed — routes merged into Code.gs v1.4
// Called from Code.gs doPost via masterFeedPost(payload)
function masterFeedPost(payload) {
  try {
    var action = payload.action || '';

    if (action === 'register_community')  return registerCommunity(payload);
    if (action === 'weekly_report')       return receiveWeeklyReport(payload);
    if (action === 'escalation_alert')    return receiveEscalationAlert(payload);

    return { status: 'error', message: 'Unknown MasterFeed action: ' + action };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}


// ═══════════════════════════════════════════
// doGet — National dashboards + public API
// ═══════════════════════════════════════════

// NOTE: doGet removed — routes merged into Code.gs v1.4
// Called from Code.gs doGet via masterFeedGet(params)
function masterFeedGet(params) {
  try {
    var action = (params && params.action) || '';

    if (action === 'national_pulse')      return getNationalPulse(params);
    if (action === 'state_pulse')         return getStatePulse(params);
    if (action === 'city_pulse')          return getCityPulse(params);
    if (action === 'zip_pulse')           return getZipPulse(params);
    if (action === 'escalation_patterns') return getEscalationPatterns(params);
    if (action === 'unresolved_needs')    return getUnresolvedNeeds(params);
    if (action === 'community_list')      return getCommunityList(params);
    if (action === 'pressure_index')      return getPressureIndex(params);
    if (action === 'trend')               return getTrend(params);

    return null; // Not a MasterFeed route
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}


// ═══════════════════════════════════════════
// COMMUNITY REGISTRATION
// ═══════════════════════════════════════════

function registerCommunity(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MASTER_TABS.REGISTRY);
  var now = new Date().toISOString();

  var zip = String(payload.zip || '').trim();
  var state = String(payload.state || '').trim().toUpperCase();
  if (!zip || zip.length !== 5) return jsonOut({ status: 'error', message: 'Valid zip required' });

  // Check if already registered
  if (sheet.getLastRow() > 1) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) === zip) {
        return jsonOut({ status: 'ok', action: 'already_registered', community_id: data[i][0] });
      }
    }
  }

  var communityId = 'COM-' + zip + '-' + Date.now();

  sheet.appendRow([
    communityId,
    zip,
    sanitize(payload.city || ''),
    state,
    sanitize(payload.community_name || 'Community ' + zip),
    sanitize(payload.contact_email || ''),
    sanitize(payload.script_url || ''),
    now,
    '',       // last_report
    0,        // total_reports
    'active'
  ]);

  return jsonOut({
    status: 'ok',
    action: 'registered',
    community_id: communityId,
    message: 'Community registered. Include this community_id in all weekly reports.'
  });
}


// ═══════════════════════════════════════════
// WEEKLY REPORT INTAKE
// ═══════════════════════════════════════════

function receiveWeeklyReport(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MASTER_TABS.REPORTS);
  var registry = ss.getSheetByName(MASTER_TABS.REGISTRY);
  var now = new Date().toISOString();

  var communityId = payload.community_id || '';
  var zip = String(payload.zip || '').trim();
  var state = String(payload.state || '').trim().toUpperCase();

  if (!communityId || !zip) {
    return jsonOut({ status: 'error', message: 'community_id and zip required' });
  }

  var reportId = 'RPT-' + zip + '-' + Date.now();
  var weekOf = payload.week_of || now.substring(0, 10);

  var metrics = payload.metrics || {};

  sheet.appendRow([
    reportId,
    communityId,
    zip,
    state,
    weekOf,
    // Activity
    metrics.active_users || 0,
    metrics.new_users || 0,
    // Discussion
    metrics.posts_total || 0,
    metrics.posts_survive || 0,
    metrics.posts_understand || 0,
    metrics.posts_connect || 0,
    metrics.posts_govern || 0,
    // Needs/Offers
    metrics.needs_filed || 0,
    metrics.needs_resolved || 0,
    metrics.needs_unresolved || 0,
    metrics.needs_avg_days_open || 0,
    metrics.offers_filed || 0,
    metrics.offers_matched || 0,
    // Governance
    metrics.evaluations_submitted || 0,
    metrics.avg_evaluation_score || 0,
    metrics.evaluations_grade_distribution || '',
    metrics.assessments_submitted || 0,
    metrics.assessments_red || 0,
    metrics.assessments_yellow || 0,
    metrics.assessments_green || 0,
    metrics.audits_submitted || 0,
    metrics.audit_avg_score || 0,
    // Escalation
    metrics.escalations_sent || 0,
    metrics.escalations_acknowledged || 0,
    metrics.escalations_resolved || 0,
    metrics.escalations_unresolved || 0,
    // Civic Pressure
    metrics.civic_pressure_score || 0,
    metrics.civic_pressure_survive || 0,
    metrics.civic_pressure_understand || 0,
    metrics.civic_pressure_connect || 0,
    metrics.civic_pressure_govern || 0,
    // Knowledge
    metrics.knowledge_guides_total || 0,
    metrics.knowledge_guides_community_authored || 0,
    // Cross-zip
    metrics.cross_zip_needs_surfaced || 0,
    // Timestamp
    now
  ]);

  // Update registry last_report + total_reports
  if (registry.getLastRow() > 1) {
    var regData = registry.getDataRange().getValues();
    for (var i = 1; i < regData.length; i++) {
      if (regData[i][0] === communityId) {
        registry.getRange(i + 1, 9).setValue(now);   // last_report
        registry.getRange(i + 1, 10).setValue((parseInt(regData[i][9]) || 0) + 1);
        break;
      }
    }
  }

  // Log unresolved needs if any
  if ((metrics.needs_unresolved || 0) > 0) {
    var unresolvedSheet = ss.getSheetByName(MASTER_TABS.UNRESOLVED);
    // Get category breakdown if provided
    var categories = metrics.unresolved_by_category || {};
    var cats = Object.keys(categories);
    if (cats.length > 0) {
      cats.forEach(function(cat) {
        unresolvedSheet.appendRow([
          zip, state, cat, categories[cat].count || 0,
          categories[cat].oldest_days || 0, categories[cat].avg_days || 0,
          communityId, weekOf
        ]);
      });
    } else {
      unresolvedSheet.appendRow([
        zip, state, 'mixed', metrics.needs_unresolved,
        metrics.needs_avg_days_open || 0, metrics.needs_avg_days_open || 0,
        communityId, weekOf
      ]);
    }
  }

  return jsonOut({
    status: 'ok',
    action: 'report_received',
    report_id: reportId,
    community_id: communityId
  });
}


// ═══════════════════════════════════════════
// ESCALATION ALERTS — real-time, not weekly
// ═══════════════════════════════════════════

function receiveEscalationAlert(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MASTER_TABS.ESCALATIONS);
  var now = new Date().toISOString();

  var patternId = 'ESC-' + (payload.zip || '') + '-' + Date.now();

  sheet.appendRow([
    patternId,
    String(payload.state || '').toUpperCase(),
    payload.category || 'mixed',
    payload.zips_affected || payload.zip || '',
    payload.total_items || 1,
    payload.avg_days_unresolved || 0,
    payload.highest_level || 'alderman',
    payload.first_reported || now,
    now,
    'active',
    sanitize(payload.notes || '')
  ]);

  return jsonOut({ status: 'ok', action: 'escalation_logged', pattern_id: patternId });
}


// ═══════════════════════════════════════════
// NATIONAL PULSE — computed aggregations
// ═══════════════════════════════════════════

/**
 * Weekly trigger: computeNationalPulse()
 * Reads all WeeklyReports from the past 7 days
 * Aggregates by state, by city, and nationally
 * Writes to NationalPulse + CivicPressureIndex
 */
function computeNationalPulse() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var reportsSheet = ss.getSheetByName(MASTER_TABS.REPORTS);
  var pulseSheet = ss.getSheetByName(MASTER_TABS.PULSE);
  var pressureSheet = ss.getSheetByName(MASTER_TABS.PRESSURE);

  if (reportsSheet.getLastRow() <= 1) return;

  var now = new Date();
  var weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  var period = now.toISOString().substring(0, 10);

  var data = reportsSheet.getDataRange().getValues();
  var headers = data[0];

  // Filter to last 7 days
  var recent = [];
  for (var i = 1; i < data.length; i++) {
    var receivedAt = String(data[i][headers.indexOf('received_at')]);
    if (receivedAt >= weekAgo) {
      recent.push(rowToObj(headers, data[i]));
    }
  }

  if (recent.length === 0) return;

  // Aggregate nationally
  var national = aggregateReports(recent);
  pulseSheet.appendRow([
    period, 'national', 'United States', 'US',
    national.communities, national.users, national.posts,
    national.needs_filed, national.needs_resolved, national.resolution_rate,
    national.escalations, national.escalation_rate,
    national.avg_pressure, national.pressure_trend,
    national.top_need_category, national.top_escalation_level,
    now.toISOString()
  ]);

  // Aggregate by state
  var byState = {};
  recent.forEach(function(r) {
    var st = r.state || 'Unknown';
    if (!byState[st]) byState[st] = [];
    byState[st].push(r);
  });

  // Batch write: collect all rows first, write once
  var pulseRows = [];
  var pressureRows = [];

  Object.keys(byState).forEach(function(st) {
    var stAgg = aggregateReports(byState[st]);
    pulseRows.push([
      period, 'state', st, st,
      stAgg.communities, stAgg.users, stAgg.posts,
      stAgg.needs_filed, stAgg.needs_resolved, stAgg.resolution_rate,
      stAgg.escalations, stAgg.escalation_rate,
      stAgg.avg_pressure, stAgg.pressure_trend,
      stAgg.top_need_category, stAgg.top_escalation_level,
      now.toISOString()
    ]);

    pressureRows.push([
      'state', st, st,
      stAgg.avg_pressure,
      stAgg.avg_pressure_survive, stAgg.avg_pressure_understand,
      stAgg.avg_pressure_connect, stAgg.avg_pressure_govern,
      stAgg.pressure_trend, stAgg.communities,
      now.toISOString()
    ]);
  });

  // Batch append to pulseSheet
  if (pulseRows.length > 0) {
    var pulseStart = pulseSheet.getLastRow() + 1;
    pulseSheet.getRange(pulseStart, 1, pulseRows.length, pulseRows[0].length).setValues(pulseRows);
  }

  // Batch append to pressureSheet
  if (pressureRows.length > 0) {
    var pressStart = pressureSheet.getLastRow() + 1;
    pressureSheet.getRange(pressStart, 1, pressureRows.length, pressureRows[0].length).setValues(pressureRows);
  }
  });

  // National pressure
  pressureSheet.appendRow([
    'national', 'US', 'United States',
    national.avg_pressure,
    national.avg_pressure_survive, national.avg_pressure_understand,
    national.avg_pressure_connect, national.avg_pressure_govern,
    national.pressure_trend, national.communities,
    now.toISOString()
  ]);

  Logger.log('National pulse computed: ' + recent.length + ' reports from ' + Object.keys(byState).length + ' states');
}

function aggregateReports(reports) {
  var zips = {};
  var totalUsers = 0, totalPosts = 0;
  var needsFiled = 0, needsResolved = 0;
  var escalations = 0;
  var pressureSum = 0, pressureSurvive = 0, pressureUnderstand = 0;
  var pressureConnect = 0, pressureGovern = 0;
  var categories = {};

  reports.forEach(function(r) {
    zips[r.zip] = true;
    totalUsers += parseInt(r.active_users) || 0;
    totalPosts += parseInt(r.posts_total) || 0;
    needsFiled += parseInt(r.needs_filed) || 0;
    needsResolved += parseInt(r.needs_resolved) || 0;
    escalations += parseInt(r.escalations_sent) || 0;
    pressureSum += parseFloat(r.civic_pressure_score) || 0;
    pressureSurvive += parseFloat(r.civic_pressure_survive) || 0;
    pressureUnderstand += parseFloat(r.civic_pressure_understand) || 0;
    pressureConnect += parseFloat(r.civic_pressure_connect) || 0;
    pressureGovern += parseFloat(r.civic_pressure_govern) || 0;
  });

  var n = reports.length || 1;
  var communityCount = Object.keys(zips).length;

  return {
    communities: communityCount,
    users: totalUsers,
    posts: totalPosts,
    needs_filed: needsFiled,
    needs_resolved: needsResolved,
    resolution_rate: needsFiled > 0 ? Math.round(needsResolved / needsFiled * 100) : 0,
    escalations: escalations,
    escalation_rate: needsFiled > 0 ? Math.round(escalations / needsFiled * 100) : 0,
    avg_pressure: Math.round(pressureSum / n),
    avg_pressure_survive: Math.round(pressureSurvive / n),
    avg_pressure_understand: Math.round(pressureUnderstand / n),
    avg_pressure_connect: Math.round(pressureConnect / n),
    avg_pressure_govern: Math.round(pressureGovern / n),
    pressure_trend: 'stable', // TODO: compare to previous week
    top_need_category: 'food', // TODO: compute from unresolved data
    top_escalation_level: 'alderman' // TODO: compute from escalation data
  };
}


// ═══════════════════════════════════════════
// PUBLIC DATA ENDPOINTS
// ═══════════════════════════════════════════

function getNationalPulse(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MASTER_TABS.PULSE);
  if (!sheet || sheet.getLastRow() <= 1) return jsonOut({ status: 'ok', pulse: null });

  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  // Find most recent national entry
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][1] === 'national') {
      return jsonOut({ status: 'ok', pulse: rowToObj(headers, data[i]) });
    }
  }
  return jsonOut({ status: 'ok', pulse: null });
}

function getStatePulse(params) {
  var state = (params.state || '').toUpperCase();
  if (!state) return jsonOut({ status: 'error', message: 'state required (2-letter code)' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MASTER_TABS.PULSE);
  if (!sheet || sheet.getLastRow() <= 1) return jsonOut({ status: 'ok', pulse: null });

  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][1] === 'state' && data[i][3] === state) {
      return jsonOut({ status: 'ok', pulse: rowToObj(headers, data[i]) });
    }
  }
  return jsonOut({ status: 'ok', pulse: null, message: 'No data for state ' + state });
}

function getCityPulse(params) {
  var city = params.city || '';
  if (!city) return jsonOut({ status: 'error', message: 'city required' });

  // City pulse computed from zip reports in that metro
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MASTER_TABS.REPORTS);
  if (!sheet || sheet.getLastRow() <= 1) return jsonOut({ status: 'ok', pulse: null });

  // For now, return all reports — city matching requires geocoding
  return jsonOut({ status: 'ok', message: 'City-level pulse requires zip-to-city mapping. Use state_pulse or zip_pulse.' });
}

function getZipPulse(params) {
  var zip = params.zip || '';
  if (!zip) return jsonOut({ status: 'error', message: 'zip required' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MASTER_TABS.REPORTS);
  if (!sheet || sheet.getLastRow() <= 1) return jsonOut({ status: 'ok', reports: [] });

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var reports = [];

  for (var i = data.length - 1; i >= 1 && reports.length < 12; i--) {
    if (String(data[i][2]) === zip) {
      reports.push(rowToObj(headers, data[i]));
    }
  }

  return jsonOut({ status: 'ok', zip: zip, reports: reports, total: reports.length });
}

function getEscalationPatterns(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MASTER_TABS.ESCALATIONS);
  if (!sheet || sheet.getLastRow() <= 1) return jsonOut({ status: 'ok', patterns: [] });

  var state = (params.state || '').toUpperCase();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var patterns = [];

  for (var i = data.length - 1; i >= 1 && patterns.length < 50; i--) {
    var row = rowToObj(headers, data[i]);
    if (row.status !== 'active') continue;
    if (state && row.state !== state) continue;
    patterns.push(row);
  }

  return jsonOut({ status: 'ok', patterns: patterns });
}

function getUnresolvedNeeds(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MASTER_TABS.UNRESOLVED);
  if (!sheet || sheet.getLastRow() <= 1) return jsonOut({ status: 'ok', needs: [] });

  var state = (params.state || '').toUpperCase();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var needs = [];

  for (var i = data.length - 1; i >= 1 && needs.length < 100; i--) {
    var row = rowToObj(headers, data[i]);
    if (state && row.state !== state) continue;
    needs.push(row);
  }

  return jsonOut({ status: 'ok', needs: needs });
}

function getCommunityList(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MASTER_TABS.REGISTRY);
  if (!sheet || sheet.getLastRow() <= 1) return jsonOut({ status: 'ok', communities: [] });

  var state = (params.state || '').toUpperCase();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var communities = [];

  for (var i = 1; i < data.length; i++) {
    var row = rowToObj(headers, data[i]);
    if (row.status !== 'active') continue;
    if (state && row.state !== state) continue;
    // Don't expose contact_email or script_url publicly
    communities.push({
      community_id: row.community_id,
      zip: row.zip,
      city: row.city,
      state: row.state,
      name: row.community_name,
      joined: row.registered,
      last_active: row.last_report,
      total_reports: row.total_reports
    });
  }

  return jsonOut({ status: 'ok', communities: communities, total: communities.length });
}

function getPressureIndex(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MASTER_TABS.PRESSURE);
  if (!sheet || sheet.getLastRow() <= 1) return jsonOut({ status: 'ok', index: [] });

  var level = params.level || 'state'; // national, state, zip
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var index = [];
  var seen = {};

  // Return most recent per code
  for (var i = data.length - 1; i >= 1; i--) {
    var row = rowToObj(headers, data[i]);
    if (row.level !== level) continue;
    if (seen[row.code]) continue;
    seen[row.code] = true;
    index.push(row);
  }

  // Sort by pressure score descending (worst first)
  index.sort(function(a, b) {
    return (parseInt(b.score_overall) || 0) - (parseInt(a.score_overall) || 0);
  });

  return jsonOut({ status: 'ok', level: level, index: index });
}

function getTrend(params) {
  var zip = params.zip || '';
  var state = (params.state || '').toUpperCase();
  var weeks = parseInt(params.weeks) || 12;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MASTER_TABS.REPORTS);
  if (!sheet || sheet.getLastRow() <= 1) return jsonOut({ status: 'ok', trend: [] });

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var trend = [];

  for (var i = data.length - 1; i >= 1 && trend.length < weeks; i--) {
    var row = rowToObj(headers, data[i]);
    if (zip && String(row.zip) !== zip) continue;
    if (state && row.state !== state) continue;
    trend.push({
      week_of: row.week_of,
      users: row.active_users,
      posts: row.posts_total,
      needs: row.needs_filed,
      resolved: row.needs_resolved,
      escalations: row.escalations_sent,
      pressure: row.civic_pressure_score
    });
  }

  trend.reverse(); // chronological

  return jsonOut({ status: 'ok', trend: trend });
}


// ═══════════════════════════════════════════
// HELPERS — defined in Code.gs, do not duplicate here
// rowToObj(), sanitize(), jsonOut() all live in Code.gs

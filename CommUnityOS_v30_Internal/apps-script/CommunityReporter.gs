/**
 * CommunityReporter.gs — Add to each community's Apps Script project
 * 
 * This module collects aggregate metrics from the local community Sheet
 * and reports them to the National Master Feed. No personal data leaves
 * the community. Only counts, averages, and patterns.
 *
 * SETUP:
 *   1. Paste this file into your community Apps Script project
 *   2. Set Script Properties:
 *      MASTER_URL = [deployed URL of MasterFeed.gs]
 *      COMMUNITY_ID = [from registration response]
 *      COMMUNITY_ZIP = [primary zip code]
 *      COMMUNITY_STATE = [2-letter state code]
 *   3. Add weekly trigger: reportToMaster, Monday 7-8am
 *
 * FIRST TIME:
 *   Run registerWithMaster() once to get your community_id.
 *   Then set COMMUNITY_ID in Script Properties.
 */

// NOTE: cachedSheetRead() is defined in Code.gs and shared via Apps Script global scope.
// This avoids 8 separate getDataRange().getValues() calls per report.

var REPORTER_PROPS = PropertiesService.getScriptProperties();

/**
 * One-time registration with the National Master.
 * Run this manually. Copy the community_id from the log into Script Properties.
 */
function registerWithMaster() {
  var masterUrl = REPORTER_PROPS.getProperty('MASTER_URL');
  if (!masterUrl) { Logger.log('ERROR: Set MASTER_URL in Script Properties first'); return; }

  var zip = REPORTER_PROPS.getProperty('COMMUNITY_ZIP') || '';
  var state = REPORTER_PROPS.getProperty('COMMUNITY_STATE') || '';

  var payload = {
    action: 'register_community',
    zip: zip,
    state: state,
    city: REPORTER_PROPS.getProperty('COMMUNITY_CITY') || '',
    community_name: REPORTER_PROPS.getProperty('COMMUNITY_NAME') || 'Community ' + zip,
    contact_email: REPORTER_PROPS.getProperty('COMMUNITY_EMAIL') || '',
    script_url: ScriptApp.getService().getUrl() || ''
  };

  try {
    var resp = UrlFetchApp.fetch(masterUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var result = JSON.parse(resp.getContentText());
    Logger.log('Registration result: ' + JSON.stringify(result));
    Logger.log('Set COMMUNITY_ID in Script Properties to: ' + (result.community_id || 'CHECK RESPONSE'));
  } catch(e) {
    Logger.log('Registration failed: ' + e.toString());
  }
}


/**
 * Weekly trigger: collect local metrics and POST to Master.
 * Set trigger: Monday 7-8am (after communities have a week of data)
 */
function reportToMaster() {
  var masterUrl = REPORTER_PROPS.getProperty('MASTER_URL');
  var communityId = REPORTER_PROPS.getProperty('COMMUNITY_ID');
  var zip = REPORTER_PROPS.getProperty('COMMUNITY_ZIP') || '';
  var state = REPORTER_PROPS.getProperty('COMMUNITY_STATE') || '';

  if (!masterUrl || !communityId) {
    Logger.log('Cannot report: MASTER_URL and COMMUNITY_ID required in Script Properties');
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var weekAgo = new Date(now.getTime() - 7 * 86400000);
  var weekOf = now.toISOString().substring(0, 10);

  // ── Collect metrics from local Sheets ──
  var metrics = {};

  // DISCUSSIONS
  var discData = cachedSheetRead('Discussions');
  if (discData.length > 1) {
    var weekPosts = 0, survive = 0, understand = 0, connect = 0, govern = 0;
    for (var i = 1; i < discData.length; i++) {
      var ts = String(discData[i][7]); // timestamp column
      if (ts >= weekAgo.toISOString()) {
        weekPosts++;
        var tag = discData[i][4]; // topic_tag
        if (tag === 'survive') survive++;
        else if (tag === 'understand') understand++;
        else if (tag === 'connect') connect++;
        else if (tag === 'govern') govern++;
      }
    }
    metrics.posts_total = weekPosts;
    metrics.posts_survive = survive;
    metrics.posts_understand = understand;
    metrics.posts_connect = connect;
    metrics.posts_govern = govern;
  }

  // USERS
  var userData = cachedSheetRead('Users');
  if (userData.length > 1) {
    var active = 0, newUsers = 0;
    for (var i = 1; i < userData.length; i++) {
      var lastActive = String(userData[i][4]); // last_active
      if (lastActive >= weekAgo.toISOString()) active++;
      var joined = String(userData[i][3]); // joined
      if (joined >= weekAgo.toISOString()) newUsers++;
    }
    metrics.active_users = active;
    metrics.new_users = newUsers;
  }

  // NEEDS/OFFERS
  var needsData = cachedSheetRead('NeedsOffers');
  if (needsData.length > 1) {
    var filed = 0, resolved = 0, unresolved = 0, offers = 0, matched = 0;
    var daysOpen = [], unresolvedByCat = {};
    for (var i = 1; i < needsData.length; i++) {
      var type = needsData[i][1];
      var status = needsData[i][12]; // status column (adjust if schema differs)
      var ts = String(needsData[i][10]); // timestamp
      var cat = needsData[i][7] || 'other'; // category

      if (type === 'need') {
        if (ts >= weekAgo.toISOString()) filed++;
        if (status === 'closed') resolved++;
        else if (status === 'active') {
          unresolved++;
          var posted = new Date(ts);
          var days = Math.floor((now - posted) / 86400000);
          daysOpen.push(days);
          if (!unresolvedByCat[cat]) unresolvedByCat[cat] = { count: 0, oldest_days: 0, total_days: 0 };
          unresolvedByCat[cat].count++;
          unresolvedByCat[cat].total_days += days;
          if (days > unresolvedByCat[cat].oldest_days) unresolvedByCat[cat].oldest_days = days;
        }
      }
      if (type === 'offer') {
        if (ts >= weekAgo.toISOString()) offers++;
        if (status === 'closed') matched++;
      }
    }
    metrics.needs_filed = filed;
    metrics.needs_resolved = resolved;
    metrics.needs_unresolved = unresolved;
    metrics.needs_avg_days_open = daysOpen.length > 0 ? Math.round(daysOpen.reduce(function(a,b){return a+b;},0) / daysOpen.length) : 0;
    metrics.offers_filed = offers;
    metrics.offers_matched = matched;

    // Category breakdown for unresolved
    var catBreakdown = {};
    Object.keys(unresolvedByCat).forEach(function(cat) {
      var c = unresolvedByCat[cat];
      catBreakdown[cat] = { count: c.count, oldest_days: c.oldest_days, avg_days: Math.round(c.total_days / c.count) };
    });
    metrics.unresolved_by_category = catBreakdown;
  }

  // EVALUATIONS
  var evalData = cachedSheetRead('Evaluations');
  if (evalData.length > 1) {
    var evalCount = 0, evalTotal = 0;
    var grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (var i = 1; i < evalData.length; i++) {
      var ts = String(evalData[i][14]); // timestamp
      if (ts >= weekAgo.toISOString()) {
        evalCount++;
        evalTotal += parseInt(evalData[i][10]) || 0; // total score
        var grade = String(evalData[i][12]); // grade
        if (grades[grade] !== undefined) grades[grade]++;
      }
    }
    metrics.evaluations_submitted = evalCount;
    metrics.avg_evaluation_score = evalCount > 0 ? Math.round(evalTotal / evalCount * 10) / 10 : 0;
    metrics.evaluations_grade_distribution = JSON.stringify(grades);
  }

  // ASSESSMENTS
  var assessData = cachedSheetRead('Assessments');
  if (assessData.length > 1) {
    var assessCount = 0, red = 0, yellow = 0, green = 0;
    for (var i = 1; i < assessData.length; i++) {
      var ts = String(assessData[i][21]); // timestamp
      if (ts >= weekAgo.toISOString()) {
        assessCount++;
        red += parseInt(assessData[i][17]) || 0;
        yellow += parseInt(assessData[i][18]) || 0;
        green += parseInt(assessData[i][19]) || 0;
      }
    }
    metrics.assessments_submitted = assessCount;
    metrics.assessments_red = red;
    metrics.assessments_yellow = yellow;
    metrics.assessments_green = green;
  }

  // AUDITS (CommunityAudits tab if exists)
  var auditData = cachedSheetRead('CommunityAudits');
  if (auditData.length > 1) {
    var auditCount = 0, auditScoreSum = 0;
    for (var i = 1; i < auditData.length; i++) {
      // Assumes timestamp is last column, score is somewhere accessible
      auditCount++;
      auditScoreSum += parseFloat(auditData[i][auditData[i].length - 2]) || 0;
    }
    metrics.audits_submitted = auditCount;
    metrics.audit_avg_score = auditCount > 0 ? Math.round(auditScoreSum / auditCount * 10) / 10 : 0;
  }

  // ESCALATIONS (EscalationTracker tab if exists)
  var escData = cachedSheetRead('EscalationTracker');
  if (escData.length > 1) {
    var sent = 0, acked = 0, resolved = 0, unresolved = 0;
    for (var i = 1; i < escData.length; i++) {
      sent++;
      var status = String(escData[i][5]).toLowerCase(); // status column
      if (status === 'acknowledged' || status === 'in_progress') acked++;
      else if (status === 'resolved') resolved++;
      else if (status === 'sent' || status === 'unresolved') unresolved++;
    }
    metrics.escalations_sent = sent;
    metrics.escalations_acknowledged = acked;
    metrics.escalations_resolved = resolved;
    metrics.escalations_unresolved = unresolved;
  }

  // CIVIC PRESSURE (compute simple version)
  var surviveScore = metrics.needs_unresolved > 10 ? 25 : metrics.needs_unresolved > 5 ? 50 : 75;
  var governScore = (metrics.evaluations_submitted || 0) > 0 ? 60 : 30;
  var connectScore = (metrics.active_users || 0) > 10 ? 70 : (metrics.active_users || 0) > 3 ? 50 : 20;
  var understandScore = (metrics.posts_understand || 0) > 0 ? 60 : 30;
  metrics.civic_pressure_score = Math.round((surviveScore + governScore + connectScore + understandScore) / 4);
  metrics.civic_pressure_survive = surviveScore;
  metrics.civic_pressure_understand = understandScore;
  metrics.civic_pressure_connect = connectScore;
  metrics.civic_pressure_govern = governScore;

  // KNOWLEDGE GUIDES (CommunityModules tab if exists)
  var modData_check = cachedSheetRead('CommunityModules');
  if (modData_check.length > 1) {
    metrics.knowledge_guides_total = modData_check.length - 1;
    // Count community-authored vs seeded
    var communityAuthored = 0;
    var modData = modData_check;
    for (var i = 1; i < modData.length; i++) {
      if (String(modData[i][0]).indexOf('seed') === -1) communityAuthored++;
    }
    metrics.knowledge_guides_community_authored = communityAuthored;
  }

  // CROSS-ZIP (NeedsOffers with cross-zip badge if tracked)
  metrics.cross_zip_needs_surfaced = 0; // TODO: count from cross-zip match log

  // ── Send to Master ──
  var payload = {
    action: 'weekly_report',
    community_id: communityId,
    zip: zip,
    state: state,
    week_of: weekOf,
    metrics: metrics
  };

  try {
    var resp = UrlFetchApp.fetch(masterUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var result = JSON.parse(resp.getContentText());
    Logger.log('Weekly report sent: ' + JSON.stringify(result));
  } catch(e) {
    Logger.log('Report failed: ' + e.toString());
  }
}


/**
 * Real-time escalation alert — called when escalation reaches state/federal level.
 * Fires immediately, not on weekly schedule.
 */
function alertMasterEscalation(category, totalItems, avgDays, highestLevel) {
  var masterUrl = REPORTER_PROPS.getProperty('MASTER_URL');
  if (!masterUrl) return;

  var zip = REPORTER_PROPS.getProperty('COMMUNITY_ZIP') || '';
  var state = REPORTER_PROPS.getProperty('COMMUNITY_STATE') || '';

  var payload = {
    action: 'escalation_alert',
    zip: zip,
    state: state,
    category: category,
    total_items: totalItems,
    avg_days_unresolved: avgDays,
    highest_level: highestLevel,
    notes: 'Auto-escalated from community ' + zip
  };

  try {
    UrlFetchApp.fetch(masterUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch(e) {
    Logger.log('Escalation alert failed: ' + e.toString());
  }
}

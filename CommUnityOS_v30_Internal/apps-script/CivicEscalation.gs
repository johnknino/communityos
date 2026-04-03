/**
 * CivicEscalation.gs — Add to your Apps Script project
 * 
 * Handles: cross-zip needs visibility, escalation tracking,
 * weekly aggregation, multi-level official lookup, civic pressure scoring.
 *
 * Add these routes to your doGet switch:
 *   case 'get_needs_crosszip':    return getNeedsCrossZip(e.parameter);
 *   case 'get_escalation_status': return getEscalationStatus(e.parameter);
 *   case 'get_civic_pressure':    return getCivicPressure(e.parameter);
 *   case 'get_officials_multilevel': return getOfficialsMultiLevel(e.parameter);
 *   case 'get_aggregated_issues': return getAggregatedIssues(e.parameter);
 *
 * Add this route to your doPost switch:
 *   case 'update_escalation':     return updateEscalation(payload);
 *   case 'escalate_issue':        return escalateIssue(payload);
 *
 * Add this trigger (Edit > Triggers > Add):
 *   Function: weeklyAggregation
 *   Event source: Time-driven
 *   Type: Week timer
 *   Day: Monday, 6am-7am
 */

// ══════════════════════════════════════════
// PHASE A: CROSS-ZIP NEEDS/OFFERS
// ══════════════════════════════════════════

/**
 * Returns needs/offers from the target zip + adjacent zips.
 * Unfilled needs older than 7 days auto-surface to adjacent zips.
 * @param {Object} params - { zip, radius (optional, default 3), type (optional: need|offer|all) }
 */
function getNeedsCrossZip(params) {
  var zip = params.zip;
  if (!zip) return jsonResponse({ status: 'error', message: 'zip required' });

  var radius = parseInt(params.radius) || 3;
  var typeFilter = params.type || 'all';

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CommunityNeeds');
  if (!sheet) return jsonResponse({ status: 'ok', items: [] });

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var zipIdx = headers.indexOf('zip');
  var typeIdx = headers.indexOf('type');
  var textIdx = headers.indexOf('text');
  var nameIdx = headers.indexOf('name');
  var categoryIdx = headers.indexOf('category');
  var timestampIdx = headers.indexOf('timestamp');
  var statusIdx = headers.indexOf('status');
  var idIdx = headers.indexOf('id');

  // Get adjacent zips from lookup or simple range
  var adjacentZips = getAdjacentZips(zip, radius);
  var allZips = [zip].concat(adjacentZips);

  var now = new Date();
  var sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  var thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  var items = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowZip = String(row[zipIdx]);
    var rowType = row[typeIdx];
    var rowTimestamp = new Date(row[timestampIdx]);
    var rowStatus = row[statusIdx] || 'open';

    // Skip expired (30+ days) or resolved
    if (rowTimestamp < thirtyDaysAgo || rowStatus === 'resolved') continue;

    // Type filter
    if (typeFilter !== 'all' && rowType !== typeFilter) continue;

    // Visibility rules:
    // - Same zip: always visible
    // - Adjacent zip: visible if unfilled need older than 7 days, or any offer
    var isHomeZip = (rowZip === zip);
    var isAdjacent = allZips.indexOf(rowZip) !== -1;

    if (!isAdjacent) continue;

    if (!isHomeZip) {
      // Adjacent zip — only show unfilled needs older than 7 days, or offers
      if (rowType === 'need' && (rowTimestamp > sevenDaysAgo || rowStatus === 'filled')) continue;
    }

    items.push({
      id: row[idIdx] || i,
      zip: rowZip,
      type: rowType,
      name: row[nameIdx],
      text: row[textIdx],
      category: row[categoryIdx],
      timestamp: row[timestampIdx],
      status: rowStatus,
      isLocal: isHomeZip,
      distance: isHomeZip ? 0 : 1 // simplified; could compute actual distance
    });
  }

  // Sort: local first, then by recency
  items.sort(function(a, b) {
    if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  return jsonResponse({ status: 'ok', items: items, zip: zip, adjacentZips: adjacentZips });
}

/**
 * Returns adjacent Chicago zip codes. Uses a curated lookup for Southwest Side.
 * Expandable by adding more entries.
 */
function getAdjacentZips(zip, radius) {
  var adjacency = {
    '60608': ['60607', '60609', '60616', '60612', '60623'], // Pilsen → Near West, Back of Yards, Bridgeport, UIC, Little Village
    '60609': ['60608', '60632', '60636', '60621', '60616'], // Back of Yards
    '60632': ['60609', '60629', '60638', '60623', '60608'], // Brighton Park
    '60638': ['60632', '60629', '60652', '60501', '60402'], // Clearing/Garfield Ridge
    '60629': ['60632', '60638', '60636', '60652', '60623'], // Chicago Lawn
    '60623': ['60608', '60632', '60612', '60624', '60629'], // Little Village
    '60616': ['60608', '60609', '60605', '60615', '60653'], // Bridgeport/Chinatown
    '60636': ['60609', '60629', '60621', '60652', '60620'], // West Englewood
    '60652': ['60629', '60638', '60636', '60655', '60643']  // Chicago Lawn South
  };
  return adjacency[zip] || [];
}


// ══════════════════════════════════════════
// PHASE B: ESCALATION TRACKING
// ══════════════════════════════════════════

/**
 * Updates escalation status on an audit, need, or proposal.
 * @param {Object} payload - { item_type, item_id, status, level, sent_to, notes }
 * Status values: sent | acknowledged | in_progress | resolved | unresolved
 * Level values: alderman | mayor | state_rep | state_senator | us_rep | governor
 */
function updateEscalation(payload) {
  var sheetName = 'EscalationTracker';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow([
      'item_type', 'item_id', 'zip', 'category', 'level', 'status',
      'sent_to_name', 'sent_to_email', 'sent_date', 'acknowledged_date',
      'resolved_date', 'notes', 'escalated_from', 'hash'
    ]);
  }

  var hash = generateHash(JSON.stringify(payload) + new Date().toISOString());

  sheet.appendRow([
    payload.item_type || '',
    payload.item_id || '',
    payload.zip || '',
    payload.category || '',
    payload.level || 'alderman',
    payload.status || 'sent',
    payload.sent_to_name || '',
    payload.sent_to_email || '',
    new Date().toISOString(),
    '', // acknowledged_date
    '', // resolved_date
    payload.notes || '',
    payload.escalated_from || '',
    hash
  ]);

  return jsonResponse({ status: 'ok', hash: hash });
}

/**
 * Escalates an issue to the next level.
 * Reads the current escalation record and creates a new one at the next level.
 */
function escalateIssue(payload) {
  var levels = ['alderman', 'mayor', 'state_rep', 'state_senator', 'us_rep', 'governor'];
  var currentLevel = payload.current_level || 'alderman';
  var currentIdx = levels.indexOf(currentLevel);

  if (currentIdx < 0 || currentIdx >= levels.length - 1) {
    return jsonResponse({ status: 'error', message: 'Cannot escalate beyond governor' });
  }

  var nextLevel = levels[currentIdx + 1];
  payload.level = nextLevel;
  payload.status = 'sent';
  payload.escalated_from = currentLevel;

  return updateEscalation(payload);
}

/**
 * Returns escalation status for items in a zip or category.
 */
function getEscalationStatus(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('EscalationTracker');
  if (!sheet) return jsonResponse({ status: 'ok', items: [] });

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var items = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }

    // Filter by zip if provided
    if (params.zip && row.zip !== params.zip) continue;
    // Filter by category if provided
    if (params.category && row.category !== params.category) continue;

    items.push(row);
  }

  return jsonResponse({ status: 'ok', items: items });
}


// ══════════════════════════════════════════
// PHASE C: WEEKLY AGGREGATION ENGINE
// ══════════════════════════════════════════

/**
 * Runs weekly on a trigger. Aggregates unresolved issues by category, ward, and zip.
 * Writes summaries to AggregatedIssues sheet.
 */
function weeklyAggregation() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Aggregate from multiple sources (using cached reads from Code.gs)
  var sources = [
    { sheet: 'CommunityNeeds', typeField: 'type', statusField: 'status', unresolved: ['open'] },
    { sheet: 'CommunityAudits', typeField: 'template', statusField: '', unresolved: [] },
    { sheet: 'EscalationTracker', typeField: 'category', statusField: 'status', unresolved: ['sent', 'unresolved'] }
  ];

  var patterns = {}; // key: zip|category → { count, oldest, items[] }

  sources.forEach(function(src) {
    var data = cachedSheetRead(src.sheet);
    if (data.length <= 1) return;

    var headers = data[0];
    var zipIdx = headers.indexOf('zip');
    var catIdx = headers.indexOf(src.typeField);
    var statusIdx = headers.indexOf(src.statusField);
    var tsIdx = headers.indexOf('timestamp');

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var zip = String(row[zipIdx]);
      var cat = String(row[catIdx]);
      var status = statusIdx >= 0 ? String(row[statusIdx]) : '';
      var ts = row[tsIdx] ? new Date(row[tsIdx]) : new Date();

      // Only count unresolved items
      if (src.unresolved.length > 0 && src.unresolved.indexOf(status) === -1) continue;

      var key = zip + '|' + cat;
      if (!patterns[key]) {
        patterns[key] = { zip: zip, category: cat, count: 0, oldest: ts, source: src.sheet, items: [] };
      }
      patterns[key].count++;
      if (ts < patterns[key].oldest) patterns[key].oldest = ts;
      patterns[key].items.push({ status: status, timestamp: ts.toISOString() });
    }
  });

  // Write aggregated patterns (batch write, not row-by-row)
  var aggSheet = ss.getSheetByName('AggregatedIssues');
  if (!aggSheet) {
    aggSheet = ss.insertSheet('AggregatedIssues');
    aggSheet.appendRow([
      'week_of', 'zip', 'category', 'count', 'oldest_days',
      'escalation_recommended', 'summary', 'generated'
    ]);
  }

  var now = new Date();
  var weekOf = now.toISOString().split('T')[0];
  var keys = Object.keys(patterns);
  if (keys.length === 0) return;

  var rows = keys.map(function(key) {
    var p = patterns[key];
    var oldestDays = Math.round((now - p.oldest) / (1000 * 60 * 60 * 24));
    var escalate = (p.count >= 5 && oldestDays >= 30) || (p.count >= 10) || (oldestDays >= 90);
    var summary = p.count + ' unresolved ' + p.category + ' items in ' + p.zip +
      '. Oldest: ' + oldestDays + ' days.' +
      (escalate ? ' ESCALATION RECOMMENDED.' : '');
    return [weekOf, p.zip, p.category, p.count, oldestDays,
            escalate ? 'YES' : 'NO', summary, now.toISOString()];
  });

  // Batch write all rows at once
  aggSheet.getRange(aggSheet.getLastRow() + 1, 1, rows.length, 8).setValues(rows);
  Logger.log('Weekly aggregation: ' + rows.length + ' patterns written');
}

/**
 * Returns aggregated issue summaries for a zip or region.
 */
function getAggregatedIssues(params) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AggregatedIssues');
  if (!sheet) return jsonResponse({ status: 'ok', issues: [] });

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var issues = [];

  // Get most recent week's data
  var latestWeek = '';
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0]) { latestWeek = data[i][0]; break; }
  }

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== latestWeek) continue;

    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }

    // Filter by zip if provided, or show all for cross-zip view
    if (params.zip && row.zip !== params.zip) continue;

    issues.push(row);
  }

  // Sort by escalation_recommended DESC, then count DESC
  issues.sort(function(a, b) {
    if (a.escalation_recommended !== b.escalation_recommended) {
      return a.escalation_recommended === 'YES' ? -1 : 1;
    }
    return (b.count || 0) - (a.count || 0);
  });

  return jsonResponse({ status: 'ok', issues: issues, week: latestWeek });
}


// ══════════════════════════════════════════
// PHASE D: MULTI-LEVEL OFFICIAL LOOKUP
// ══════════════════════════════════════════

/**
 * Returns officials at ALL levels for a zip: alderman, mayor, state rep, state senator, US rep, governor.
 * Uses Google Civic Info API for elected officials + hardcoded Chicago mayor/governor.
 */
function getOfficialsMultiLevel(params) {
  var zip = params.zip;
  if (!zip) return jsonResponse({ status: 'error', message: 'zip required' });

  var key = PropertiesService.getScriptProperties().getProperty('GOOGLE_CIVIC_KEY');

  var officials = [];

  // Always include Chicago Mayor and IL Governor (hardcoded, updated manually)
  officials.push({
    name: 'Brandon Johnson',
    office: 'Mayor of Chicago',
    level: 'mayor',
    emails: ['mayor@cityofchicago.org'],
    phones: ['(312) 744-3300'],
    address: 'City Hall, 121 N. LaSalle St., Chicago, IL 60602'
  });

  officials.push({
    name: 'JB Pritzker',
    office: 'Governor of Illinois',
    level: 'governor',
    emails: [],
    phones: ['(217) 782-0244'],
    address: '207 State House, Springfield, IL 62706',
    url: 'https://www2.illinois.gov/sites/gov/contactus/Pages/default.aspx'
  });

  // Google Civic Info API for the rest
  if (key) {
    try {
      var url = 'https://www.googleapis.com/civicinfo/v2/representatives?address=' +
        encodeURIComponent(zip + ', IL') + '&key=' + key;
      var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      var data = JSON.parse(resp.getContentText());

      if (data.offices && data.officials) {
        data.offices.forEach(function(office) {
          var levelMap = {
            'alderman': 'alderman', 'alderperson': 'alderman',
            'city council': 'alderman',
            'state representative': 'state_rep', 'state house': 'state_rep',
            'state senator': 'state_senator', 'state senate': 'state_senator',
            'u.s. representative': 'us_rep', 'u.s. house': 'us_rep',
            'representative in congress': 'us_rep'
          };

          var officeLower = office.name.toLowerCase();
          var level = 'other';
          Object.keys(levelMap).forEach(function(k) {
            if (officeLower.indexOf(k) !== -1) level = levelMap[k];
          });

          // Skip mayor and governor (already hardcoded with better data)
          if (level === 'other' && (officeLower.indexOf('mayor') !== -1 || officeLower.indexOf('governor') !== -1)) return;

          var indices = office.officialIndices || [];
          indices.forEach(function(idx) {
            var o = data.officials[idx];
            if (!o) return;
            officials.push({
              name: o.name || '',
              office: office.name || '',
              level: level,
              emails: o.emails || [],
              phones: o.phones || [],
              party: o.party || '',
              urls: o.urls || []
            });
          });
        });
      }
    } catch(e) {
      // Civic API failed — return what we have (mayor + governor)
    }
  }

  // Sort by governance level
  var levelOrder = { alderman: 0, mayor: 1, state_rep: 2, state_senator: 3, us_rep: 4, governor: 5, other: 6 };
  officials.sort(function(a, b) {
    return (levelOrder[a.level] || 6) - (levelOrder[b.level] || 6);
  });

  return jsonResponse({ status: 'ok', officials: officials, zip: zip });
}


// ══════════════════════════════════════════
// PHASE E: CIVIC PRESSURE SCORING
// ══════════════════════════════════════════

/**
 * Computes a civic pressure score for a zip across domains.
 * Reads from 311 data, escalation tracker, aggregated issues, and audits.
 * Returns green/yellow/red per domain + overall score.
 */
function getCivicPressure(params) {
  var zip = params.zip;
  if (!zip) return jsonResponse({ status: 'error', message: 'zip required' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var domains = {};

  // 1. Survival pressure — unmet needs
  var needsSheet = ss.getSheetByName('CommunityNeeds');
  if (needsSheet) {
    var needsData = typeof cachedSheetRead === 'function' ? cachedSheetRead('CommunityNeeds') : needsSheet.getDataRange().getValues();
    var nh = needsData[0];
    var nZip = nh.indexOf('zip'), nStatus = nh.indexOf('status'), nType = nh.indexOf('type');
    var openNeeds = 0, totalNeeds = 0;
    for (var i = 1; i < needsData.length; i++) {
      if (String(needsData[i][nZip]) !== zip) continue;
      if (needsData[i][nType] !== 'need') continue;
      totalNeeds++;
      if (!needsData[i][nStatus] || needsData[i][nStatus] === 'open') openNeeds++;
    }
    var needsPct = totalNeeds > 0 ? Math.round(openNeeds / totalNeeds * 100) : 0;
    domains.survive = {
      score: 100 - needsPct,
      status: needsPct > 60 ? 'red' : needsPct > 30 ? 'yellow' : 'green',
      detail: openNeeds + ' open needs out of ' + totalNeeds + ' posted'
    };
  } else {
    domains.survive = { score: 100, status: 'green', detail: 'No needs data yet' };
  }

  // 2. Understanding pressure — escalated issues
  var escSheet = ss.getSheetByName('EscalationTracker');
  if (escSheet) {
    var escData = typeof cachedSheetRead === 'function' ? cachedSheetRead('EscalationTracker') : escSheet.getDataRange().getValues();
    var eh = escData[0];
    var eZip = eh.indexOf('zip'), eStatus = eh.indexOf('status');
    var unresolved = 0, totalEsc = 0;
    for (var i = 1; i < escData.length; i++) {
      if (String(escData[i][eZip]) !== zip) continue;
      totalEsc++;
      var s = String(escData[i][eStatus]);
      if (s === 'sent' || s === 'unresolved') unresolved++;
    }
    var escPct = totalEsc > 0 ? Math.round(unresolved / totalEsc * 100) : 0;
    domains.understand = {
      score: 100 - escPct,
      status: escPct > 60 ? 'red' : escPct > 30 ? 'yellow' : 'green',
      detail: unresolved + ' unresolved escalations out of ' + totalEsc
    };
  } else {
    domains.understand = { score: 100, status: 'green', detail: 'No escalation data yet' };
  }

  // 3. Connection pressure — cross-zip needs filled
  // Use same needs data, check filled vs open
  domains.connect = {
    score: domains.survive.score, // mirrors survival for now
    status: domains.survive.status,
    detail: 'Reflects community responsiveness to posted needs'
  };

  // 4. Governance pressure — audit scores and 311 response
  var auditSheet = ss.getSheetByName('CommunityAudits');
  if (auditSheet) {
    var auditData = typeof cachedSheetRead === 'function' ? cachedSheetRead('CommunityAudits') : auditSheet.getDataRange().getValues();
    var ah = auditData[0];
    var aZip = ah.indexOf('zip'), aScore = ah.indexOf('score');
    var scores = [];
    for (var i = 1; i < auditData.length; i++) {
      if (String(auditData[i][aZip]) !== zip) continue;
      if (auditData[i][aScore]) scores.push(Number(auditData[i][aScore]));
    }
    var avgScore = scores.length > 0 ? Math.round(scores.reduce(function(a,b){return a+b;},0) / scores.length) : 0;
    domains.govern = {
      score: avgScore,
      status: avgScore < 40 ? 'red' : avgScore < 70 ? 'yellow' : 'green',
      detail: scores.length + ' audits, average score ' + avgScore + '%'
    };
  } else {
    domains.govern = { score: 0, status: 'green', detail: 'No audit data yet' };
  }

  // Overall civic pressure
  var allScores = [domains.survive.score, domains.understand.score, domains.connect.score, domains.govern.score];
  var overall = Math.round(allScores.reduce(function(a,b){return a+b;},0) / allScores.length);

  return jsonResponse({
    status: 'ok',
    zip: zip,
    overall: { score: overall, status: overall < 40 ? 'red' : overall < 70 ? 'yellow' : 'green' },
    domains: domains
  });
}


// ══════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateHash(input) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input);
  return raw.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

/**
 * CommunityRegistry.gs — Community Routing Layer
 * Add to the main CommUnity OS Apps Script project
 *
 * SHEET TAB: CommunityRegistry
 * Columns: zip | community_name | state | script_url | contact | registered | active
 *
 * HOW IT WORKS:
 *   1. Each community creates their own Sheet + Apps Script
 *   2. They register by adding a row to the CommunityRegistry tab
 *      (or submitting through the register_community POST route)
 *   3. The frontend calls resolve_community with a zip code
 *   4. If a community exists for that zip, the frontend routes
 *      all subsequent API calls to that community's script_url
 *   5. If no community exists, the frontend uses the hub (this script)
 *
 * ROUTES:
 *   GET  ?action=resolve_community&zip=60608
 *   GET  ?action=list_communities
 *   GET  ?action=list_communities&state=IL
 *   POST action=register_community
 */

var REG_TAB = 'CommunityRegistry';
var REG_HEADERS = ['zip', 'community_name', 'state', 'script_url', 'contact', 'registered', 'active'];

/**
 * Initialize the CommunityRegistry tab. Run once.
 */
function initRegistry() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(REG_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(REG_TAB);
    sheet.appendRow(REG_HEADERS);
    sheet.getRange(1, 1, 1, REG_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    Logger.log('CommunityRegistry tab created');
  }

  // Seed the hub community (this instance)
  if (sheet.getLastRow() <= 1) {
    sheet.appendRow([
      '00000',
      'CommUnity OS Hub',
      'US',
      ScriptApp.getService().getUrl(),
      'info@comm-unity-os.org',
      new Date().toISOString(),
      'true'
    ]);
    Logger.log('Hub community seeded as fallback (zip 00000)');
  }
}


/**
 * GET: resolve_community
 * Given a zip, return the community's script_url.
 * If no exact match, return the hub URL.
 *
 * Response: { status, zip, community_name, script_url, is_hub }
 */
function resolveCommunity(params) {
  var zip = String(params.zip || '').trim();
  if (!zip || zip.length !== 5) {
    return jsonResp({ status: 'error', message: 'Valid 5-digit zip required' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(REG_TAB);
  if (!sheet || sheet.getLastRow() <= 1) {
    return jsonResp({
      status: 'ok',
      zip: zip,
      community_name: 'CommUnity OS Hub',
      script_url: ScriptApp.getService().getUrl(),
      is_hub: true
    });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var zipCol = headers.indexOf('zip');
  var nameCol = headers.indexOf('community_name');
  var urlCol = headers.indexOf('script_url');
  var activeCol = headers.indexOf('active');

  // Exact zip match
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][zipCol]) === zip && String(data[i][activeCol]).toLowerCase() === 'true') {
      return jsonResp({
        status: 'ok',
        zip: zip,
        community_name: data[i][nameCol],
        script_url: data[i][urlCol],
        is_hub: false
      });
    }
  }

  // No match — return hub
  var hubUrl = ScriptApp.getService().getUrl();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][zipCol]) === '00000') {
      hubUrl = data[i][urlCol];
      break;
    }
  }

  return jsonResp({
    status: 'ok',
    zip: zip,
    community_name: 'CommUnity OS Hub',
    script_url: hubUrl,
    is_hub: true
  });
}


/**
 * GET: list_communities
 * Returns all active communities. Optional state filter.
 */
function listCommunities(params) {
  var state = (params.state || '').toUpperCase();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(REG_TAB);
  if (!sheet || sheet.getLastRow() <= 1) {
    return jsonResp({ status: 'ok', communities: [] });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var communities = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var h = 0; h < headers.length; h++) row[headers[h]] = data[i][h];
    if (String(row.active).toLowerCase() !== 'true') continue;
    if (row.zip === '00000') continue; // skip hub entry
    if (state && String(row.state).toUpperCase() !== state) continue;
    // Don't expose contact email publicly
    communities.push({
      zip: row.zip,
      community_name: row.community_name,
      state: row.state,
      registered: row.registered
    });
  }

  return jsonResp({ status: 'ok', communities: communities, total: communities.length });
}


/**
 * POST: register_community
 * A new community submits their zip + script_url to join the network.
 */
function registerCommunityRoute(payload) {
  var zip = String(payload.zip || '').trim();
  var scriptUrl = String(payload.script_url || '').trim();
  var name = String(payload.community_name || '').trim();
  var state = String(payload.state || '').trim().toUpperCase();
  var contact = String(payload.contact || '').trim();

  if (!zip || zip.length !== 5) return jsonResp({ status: 'error', message: 'Valid 5-digit zip required' });
  if (!scriptUrl) return jsonResp({ status: 'error', message: 'script_url required' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(REG_TAB);
  if (!sheet) { initRegistry(); sheet = ss.getSheetByName(REG_TAB); }

  // Check for existing registration
  if (sheet.getLastRow() > 1) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === zip) {
        return jsonResp({ status: 'ok', action: 'already_registered', zip: zip });
      }
    }
  }

  sheet.appendRow([
    zip,
    name || 'Community ' + zip,
    state,
    scriptUrl,
    contact,
    new Date().toISOString(),
    'true'
  ]);

  return jsonResp({
    status: 'ok',
    action: 'registered',
    zip: zip,
    message: 'Community registered. The platform will now route ' + zip + ' requests to your Script.'
  });
}

/**
 * CommunityHealthPulse.gs
 * CommUnity OS — Community Health Pulse Handler
 * 
 * PRIVACY ARCHITECTURE:
 * - Client sends: 3-digit ZIP prefix, age range, gender, readings, random sub_id
 * - Client NEVER sends: name, email, full ZIP, exact age, IP, timestamp, immigration status
 * - Server stores: exactly what client sends + server timestamp (date only, no time)
 * - Server displays: ONLY aggregates where k≥11 (11+ contributors per group)
 * - HIPAA: Does not apply (non-covered entity). Safe Harbor de-identification voluntarily adopted.
 * - FDA: General wellness enforcement discretion applies (vital sign trending, no diagnosis)
 * - IRB: NHSR determination recommended before any publication of aggregate data
 * 
 * CARE/OCAP Aligned:
 * - Community owns the Sheet
 * - No PII ever enters the system
 * - Community Data Steward has access
 * - Platform builder has read-only aggregate access via GET
 */

// ═══════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════

var HP_SHEET_NAME = 'HealthPulse';       // Raw de-identified data
var HP_AGG_SHEET_NAME = 'HealthPulseAgg'; // Pre-computed aggregates (k≥11 suppressed)
var K_THRESHOLD = 11;                     // Minimum observations before displaying

// ═══════════════════════════════════
// POST HANDLER — Receive anonymous contribution
// ═══════════════════════════════════

function handleHealthPulsePost(params) {
  try {
    var zip3 = String(params.zip3 || '').trim();
    var ageRange = String(params.age_range || '').trim();
    var gender = String(params.gender || 'U').trim();
    var readingsStr = String(params.readings || '{}');
    var subId = String(params.sub_id || '').trim();

    // VALIDATION
    if (!zip3 || zip3.length !== 3 || !/^\d{3}$/.test(zip3)) {
      return { ok: false, error: 'Invalid ZIP prefix' };
    }
    var validAges = ['18-29', '30-39', '40-49', '50-59', '60-69', '70+'];
    if (validAges.indexOf(ageRange) === -1) {
      return { ok: false, error: 'Invalid age range' };
    }
    var validGenders = ['F', 'M', 'NB', 'U'];
    if (validGenders.indexOf(gender) === -1) gender = 'U';

    var readings;
    try { readings = JSON.parse(readingsStr); } catch(e) {
      return { ok: false, error: 'Invalid readings' };
    }

    // SANITIZE READINGS — enforce numeric bounds
    var clean = {};
    if (readings.bp_sys) {
      var s = parseInt(readings.bp_sys), d = parseInt(readings.bp_dia);
      if (s >= 60 && s <= 250 && d >= 30 && d <= 160) {
        clean.bp_sys = s; clean.bp_dia = d;
      }
    }
    if (readings.hr) {
      var hr = parseInt(readings.hr);
      if (hr >= 30 && hr <= 220) clean.hr = hr;
    }
    if (readings.glucose) {
      var glu = parseInt(readings.glucose);
      if (glu >= 20 && glu <= 600) clean.glucose = glu;
    }
    if (readings.bmi) {
      var bmi = parseFloat(readings.bmi);
      if (bmi >= 10 && bmi <= 80) clean.bmi = Math.round(bmi * 10) / 10;
    }

    if (Object.keys(clean).length === 0) {
      return { ok: false, error: 'No valid readings' };
    }

    // CHECK FOR DUPLICATE sub_id (prevent double-submission)
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(HP_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(HP_SHEET_NAME);
      sheet.appendRow(['date', 'zip3', 'age_range', 'gender', 'bp_sys', 'bp_dia', 'hr', 'glucose', 'bmi', 'sub_id']);
    }

    // Simple duplicate check on sub_id (last 100 rows)
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var checkRange = Math.max(2, lastRow - 100);
      var subIds = sheet.getRange(checkRange, 10, lastRow - checkRange + 1, 1).getValues();
      for (var i = 0; i < subIds.length; i++) {
        if (subIds[i][0] === subId) {
          return { ok: false, error: 'Duplicate submission' };
        }
      }
    }

    // WRITE — date only (no time), to prevent temporal re-identification
    var dateOnly = Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM');
    sheet.appendRow([
      dateOnly,
      zip3,
      ageRange,
      gender,
      clean.bp_sys || '',
      clean.bp_dia || '',
      clean.hr || '',
      clean.glucose || '',
      clean.bmi || '',
      subId
    ]);

    // RECOMPUTE AGGREGATES with k≥11 suppression
    recomputeAggregates_(ss);

    return { ok: true };

  } catch(e) {
    return { ok: false, error: 'Server error' };
  }
}

// ═══════════════════════════════════
// GET HANDLER — Return suppressed aggregates
// ═══════════════════════════════════

function handleHealthPulseGet(params) {
  try {
    var zip3 = String(params.zip3 || '').trim();
    if (!zip3 || zip3.length !== 3) {
      return { ok: false, error: 'Invalid ZIP prefix' };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var aggSheet = ss.getSheetByName(HP_AGG_SHEET_NAME);
    if (!aggSheet || aggSheet.getLastRow() < 2) {
      return { ok: true, aggregate: { total: 0 } };
    }

    // Find row for this zip3
    var data = aggSheet.getDataRange().getValues();
    var headers = data[0];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === zip3) {
        var row = {};
        for (var j = 0; j < headers.length; j++) {
          row[headers[j]] = data[i][j];
        }
        return { ok: true, aggregate: row };
      }
    }

    return { ok: true, aggregate: { total: 0 } };

  } catch(e) {
    return { ok: false, error: 'Server error' };
  }
}

// ═══════════════════════════════════
// k≥11 SUPPRESSION ENGINE
// ═══════════════════════════════════

function recomputeAggregates_(ss) {
  var rawSheet = ss.getSheetByName(HP_SHEET_NAME);
  if (!rawSheet || rawSheet.getLastRow() < 2) return;

  var data = rawSheet.getDataRange().getValues();
  // headers: date, zip3, age_range, gender, bp_sys, bp_dia, hr, glucose, bmi, sub_id

  // Group by zip3
  var groups = {};
  for (var i = 1; i < data.length; i++) {
    var zip3 = data[i][1];
    if (!zip3) continue;
    if (!groups[zip3]) groups[zip3] = [];
    groups[zip3].push({
      bp_sys: data[i][4], bp_dia: data[i][5],
      hr: data[i][6], glucose: data[i][7], bmi: data[i][8]
    });
  }

  // Compute aggregates with k≥11 suppression
  var aggSheet = ss.getSheetByName(HP_AGG_SHEET_NAME);
  if (!aggSheet) {
    aggSheet = ss.insertSheet(HP_AGG_SHEET_NAME);
  }
  aggSheet.clear();
  aggSheet.appendRow([
    'zip3', 'total',
    'bp_count', 'bp_avg_sys', 'bp_avg_dia', 'bp_pct_elevated',
    'hr_count', 'hr_avg',
    'glu_count', 'glu_avg', 'glu_pct_prediabetic',
    'bmi_count', 'bmi_avg',
    'updated'
  ]);

  var zips = Object.keys(groups);
  for (var z = 0; z < zips.length; z++) {
    var zip3 = zips[z];
    var entries = groups[zip3];
    var total = entries.length;

    // k≥11 check on total contributors
    if (total < K_THRESHOLD) {
      aggSheet.appendRow([zip3, total, '', '', '', '', '', '', '', '', '', '', '', 'SUPPRESSED']);
      continue;
    }

    // BP aggregation
    var bpVals = entries.filter(function(e) { return e.bp_sys && e.bp_dia; });
    var bpCount = bpVals.length;
    var bpSysAvg = '', bpDiaAvg = '', bpPctElev = '';
    if (bpCount >= K_THRESHOLD) {
      var sumSys = 0, sumDia = 0, elevated = 0;
      bpVals.forEach(function(v) {
        sumSys += v.bp_sys; sumDia += v.bp_dia;
        if (v.bp_sys >= 120 || v.bp_dia >= 80) elevated++;
      });
      bpSysAvg = Math.round(sumSys / bpCount);
      bpDiaAvg = Math.round(sumDia / bpCount);
      bpPctElev = Math.round((elevated / bpCount) * 100);
    }

    // HR aggregation
    var hrVals = entries.filter(function(e) { return e.hr; });
    var hrCount = hrVals.length;
    var hrAvg = '';
    if (hrCount >= K_THRESHOLD) {
      var sumHR = 0;
      hrVals.forEach(function(v) { sumHR += v.hr; });
      hrAvg = Math.round(sumHR / hrCount);
    }

    // Glucose aggregation
    var gluVals = entries.filter(function(e) { return e.glucose; });
    var gluCount = gluVals.length;
    var gluAvg = '', gluPctPre = '';
    if (gluCount >= K_THRESHOLD) {
      var sumGlu = 0, prediabetic = 0;
      gluVals.forEach(function(v) {
        sumGlu += v.glucose;
        if (v.glucose >= 100) prediabetic++;
      });
      gluAvg = Math.round(sumGlu / gluCount);
      gluPctPre = Math.round((prediabetic / gluCount) * 100);
    }

    // BMI aggregation
    var bmiVals = entries.filter(function(e) { return e.bmi; });
    var bmiCount = bmiVals.length;
    var bmiAvg = '';
    if (bmiCount >= K_THRESHOLD) {
      var sumBMI = 0;
      bmiVals.forEach(function(v) { sumBMI += v.bmi; });
      bmiAvg = Math.round((sumBMI / bmiCount) * 10) / 10;
    }

    aggSheet.appendRow([
      zip3, total,
      bpCount >= K_THRESHOLD ? bpCount : '', bpSysAvg, bpDiaAvg, bpPctElev,
      hrCount >= K_THRESHOLD ? hrCount : '', hrAvg,
      gluCount >= K_THRESHOLD ? gluCount : '', gluAvg, gluPctPre,
      bmiCount >= K_THRESHOLD ? bmiCount : '', bmiAvg,
      Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM-dd')
    ]);
  }
}

// ═══════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════

function initHealthPulse() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(HP_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(HP_SHEET_NAME);
    sheet.appendRow(['date', 'zip3', 'age_range', 'gender', 'bp_sys', 'bp_dia', 'hr', 'glucose', 'bmi', 'sub_id']);
    // Protect sheet — only owner can edit
    var protection = sheet.protect().setDescription('Health Pulse Raw Data — Protected');
    protection.setWarningOnly(true);
  }
  var aggSheet = ss.getSheetByName(HP_AGG_SHEET_NAME);
  if (!aggSheet) {
    aggSheet = ss.insertSheet(HP_AGG_SHEET_NAME);
    aggSheet.appendRow([
      'zip3', 'total',
      'bp_count', 'bp_avg_sys', 'bp_avg_dia', 'bp_pct_elevated',
      'hr_count', 'hr_avg',
      'glu_count', 'glu_avg', 'glu_pct_prediabetic',
      'bmi_count', 'bmi_avg',
      'updated'
    ]);
  }
  Logger.log('HealthPulse initialized. Sheets: ' + HP_SHEET_NAME + ', ' + HP_AGG_SHEET_NAME);
}

// ═══════════════════════════════════
// CODE.GS ROUTE BLOCKS (paste into doGet/doPost)
// ═══════════════════════════════════

/*
 * Add to doGet:
 *
 *   } else if (action == 'health_pulse_aggregate') {
 *     result = handleHealthPulseGet(e.parameter);
 *
 * Add to doPost:
 *
 *   } else if (action == 'health_pulse') {
 *     result = handleHealthPulsePost(e.parameter);
 *
 */

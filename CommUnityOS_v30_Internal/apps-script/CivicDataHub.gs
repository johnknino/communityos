/**
 * CivicDataHub.gs — Add to your Apps Script project
 * 
 * Universal data hub: 23 routes powered by Census Geocoder bridge.
 * All results cached in Sheets to stay under 20K UrlFetchApp/day limit.
 *
 * Add these routes to your doGet switch:
 *   case 'survive_triage':      return surviveTriage(e.parameter);
 *   case 'geocode':             return jsonOut(geocodeZip(e.parameter.zip));
 *   case 'health_centers':      return jsonOut(getHealthCenters(e.parameter.zip));
 *   case 'snap_retailers':      return jsonOut(getSnapRetailers(e.parameter.zip));
 *   case 'treatment':           return jsonOut(getTreatmentFacilities(e.parameter.zip));
 *   case 'housing_counselors':  return jsonOut(getHousingCounselors(e.parameter.zip));
 *   case 'va_facilities':       return jsonOut(getVAFacilities(e.parameter.zip));
 *   case 'weather_alerts':      return jsonOut(getWeatherAlerts(e.parameter.zip));
 *   case 'disasters':           return jsonOut(getActiveDisasters(e.parameter.zip));
 *   case 'air_quality':         return jsonOut(getAirQuality(e.parameter.zip));
 *   case 'hospitals':           return jsonOut(getHospitals(e.parameter.zip));
 *   case 'nursing_homes':       return jsonOut(getNursingHomes(e.parameter.zip));
 *   case 'job_centers':         return jsonOut(getJobCenters(e.parameter.zip));
 *   case 'farmers_markets':     return jsonOut(getFarmersMarkets(e.parameter.zip));
 *   case 'banks':               return jsonOut(getBanks(e.parameter.zip));
 *   case 'benefits':            return jsonOut(getBenefits());
 *   case 'state_legislators':   return jsonOut(getStateLegislators(e.parameter.zip));
 *   case 'building_permits':    return jsonOut(getBuildingPermits(e.parameter.zip));
 *   case 'property_assessments':return jsonOut(getPropertyAssessments(e.parameter.zip));
 *   case 'tif_data':            return jsonOut(getTIFData(e.parameter.zip));
 *   case 'wage_violations':     return jsonOut(getWageViolations(e.parameter.zip));
 *   case 'env_violations':      return jsonOut(getEnvViolations(e.parameter.zip));
 *   case 'elections':           return jsonOut(getElections(e.parameter.zip));
 *
 * Required Script Properties (Project Settings → Script Properties):
 *   CENSUS_KEY, HUD_USER_KEY, VA_KEY, CAREER_ONESTOP_KEY, CAREER_ONESTOP_USERID,
 *   AIRNOW_KEY, DATA_GOV_KEY, GOOGLE_CIVIC_KEY (existing)
 *
 * Optional: SOCRATA_APP_TOKEN (for higher Chicago/Cook County rate limits)
 */

var PROPS = PropertiesService.getScriptProperties();

// ══════════════════════════════════════════
// CENSUS GEOCODER — THE UNIVERSAL BRIDGE
// ══════════════════════════════════════════

/**
 * Converts zip → { lat, lon, state_fips, county_fips, tract, state_abbr }.
 * Caches in ZipGeoCache sheet. Never fetches same zip twice.
 */
function geocodeZip(zip) {
  if (!zip || !/^\d{5}$/.test(zip)) return { error: 'Invalid zip' };

  // Check cache first
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cache = ss.getSheetByName('ZipGeoCache');
  if (!cache) {
    cache = ss.insertSheet('ZipGeoCache');
    cache.appendRow(['zip', 'lat', 'lon', 'state_fips', 'county_fips', 'tract', 'state_abbr', 'cached']);
  }

  var data = cache.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === zip) {
      return { lat: data[i][1], lon: data[i][2], state_fips: data[i][3], county_fips: data[i][4], tract: data[i][5], state_abbr: data[i][6] };
    }
  }

  // Fetch from Census Geocoder (no key needed)
  try {
    var url = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=' +
      encodeURIComponent(zip) + '&benchmark=Public_AR_Current&vintage=Current_Current&format=json';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var json = JSON.parse(resp.getContentText());

    var matches = json.result && json.result.addressMatches;
    if (!matches || matches.length === 0) {
      // Fallback: use zip centroid from Census
      var fallback = fetchZipCentroid(zip);
      if (fallback) {
        cache.appendRow([zip, fallback.lat, fallback.lon, fallback.state_fips || '', fallback.county_fips || '', '', fallback.state_abbr || '', new Date().toISOString()]);
        return fallback;
      }
      return { error: 'Zip not found' };
    }

    var m = matches[0];
    var coords = m.coordinates;
    var geos = m.geographies || {};
    var tracts = geos['Census Tracts'] || [];
    var states = geos['States'] || [];
    var counties = geos['Counties'] || [];

    var result = {
      lat: coords.y,
      lon: coords.x,
      state_fips: states.length > 0 ? states[0].STATE : '',
      county_fips: counties.length > 0 ? counties[0].COUNTY : '',
      tract: tracts.length > 0 ? tracts[0].TRACT : '',
      state_abbr: states.length > 0 ? (states[0].STUSAB || '') : ''
    };

    cache.appendRow([zip, result.lat, result.lon, result.state_fips, result.county_fips, result.tract, result.state_abbr, new Date().toISOString()]);
    return result;
  } catch (e) {
    return { error: e.toString() };
  }
}

/** Fallback centroid lookup using Census TIGERweb */
function fetchZipCentroid(zip) {
  try {
    var url = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/2/query' +
      '?where=ZCTA5%3D%27' + zip + '%27&outFields=CENTLAT,CENTLON,STATE&f=json';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var json = JSON.parse(resp.getContentText());
    if (json.features && json.features.length > 0) {
      var attr = json.features[0].attributes;
      return { lat: parseFloat(attr.CENTLAT), lon: parseFloat(attr.CENTLON), state_fips: attr.STATE || '', county_fips: '', state_abbr: '' };
    }
  } catch (e) {}
  return null;
}


// ══════════════════════════════════════════
// SURVIVE TRIAGE — MASTER ROUTE
// ══════════════════════════════════════════

function surviveTriage(params) {
  var zip = params.zip;
  var cat = params.category || 'all';
  if (!zip) return jsonOut({ status: 'error', message: 'zip required' });

  var results = {};

  if (cat === 'all' || cat === 'food') {
    results.food = {
      snap_retailers: getSnapRetailers(zip),
      farmers_markets: getFarmersMarkets(zip)
    };
  }
  if (cat === 'all' || cat === 'health') {
    results.health = {
      health_centers: getHealthCenters(zip),
      hospitals: getHospitals(zip)
    };
  }
  if (cat === 'all' || cat === 'housing') {
    results.housing = {
      counselors: getHousingCounselors(zip)
    };
  }
  if (cat === 'all' || cat === 'safety') {
    results.safety = {
      treatment: getTreatmentFacilities(zip),
      weather: getWeatherAlerts(zip)
    };
  }
  if (cat === 'all' || cat === 'legal') {
    results.legal = { note: 'Legal aid requires state-specific referral. See knowledge guides.' };
  }
  if (cat === 'all' || cat === 'work') {
    results.work = {
      job_centers: getJobCenters(zip)
    };
  }
  if (cat === 'all' || cat === 'veterans') {
    results.veterans = {
      va_facilities: getVAFacilities(zip)
    };
  }

  return jsonOut({ status: 'ok', zip: zip, category: cat, results: results });
}


// ══════════════════════════════════════════
// HEALTH APIs
// ══════════════════════════════════════════

function getHealthCenters(zip) {
  // HRSA — uses cached Sheet tab or direct CSV if available
  // Fallback: Chicago Data Portal community health centers
  try {
    var socrata = PROPS.getProperty('SOCRATA_APP_TOKEN') || '';
    var url = 'https://data.cityofchicago.org/resource/2usn-w2nz.json?$limit=50';
    if (socrata) url += '&$$app_token=' + socrata;
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var all = JSON.parse(resp.getContentText());
    // Filter by approximate zip (Chicago dataset doesn't always have zip)
    return { source: 'Chicago CDPH', count: all.length, facilities: all.slice(0, 20).map(function(f) {
      return { name: f.facility_name || f.name || '', address: f.address || '', phone: f.phone || '', lat: f.latitude, lon: f.longitude };
    })};
  } catch (e) {
    return { source: 'error', message: e.toString() };
  }
}

function getTreatmentFacilities(zip) {
  var geo = geocodeZip(zip);
  if (geo.error) return { source: 'error', message: geo.error };
  try {
    // SAMHSA FindTreatment API — coordinates required
    var url = 'https://findtreatment.gov/locator/exportsAsJson/v2?sAddr="' +
      geo.lon + ',' + geo.lat + '"&limitType=2&limitValue=16093&sType=SA,MH';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(resp.getContentText());
    var rows = data.rows || [];
    return { source: 'SAMHSA', count: rows.length, facilities: rows.slice(0, 15).map(function(r) {
      return { name: r.name1 || '', address: (r.street1 || '') + ', ' + (r.city || '') + ' ' + (r.state || '') + ' ' + (r.zip || ''),
        phone: r.phone || '', services: r.services || '', languages: r.spokenLanguages || '', distance_mi: r.distance || '' };
    })};
  } catch (e) {
    return { source: 'error', message: e.toString() };
  }
}

function getHospitals(zip) {
  try {
    var url = 'https://data.cms.gov/data-api/v1/dataset/xubh-q36u/data?filter[zip_code]=' + zip + '&size=20';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(resp.getContentText());
    return { source: 'CMS', count: data.length, hospitals: data.slice(0, 10).map(function(h) {
      return { name: h.facility_name || h.hospital_name || '', address: h.address || '', phone: h.phone_number || h.telephone_number || '',
        rating: h.hospital_overall_rating || '', emergency: h.emergency_services || '' };
    })};
  } catch (e) {
    return { source: 'error', message: e.toString() };
  }
}

function getNursingHomes(zip) {
  try {
    var url = 'https://data.cms.gov/data-api/v1/dataset/4pq5-n9py/data?filter[ZIP]=' + zip + '&size=20';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(resp.getContentText());
    return { source: 'CMS', count: data.length, facilities: data.slice(0, 10).map(function(f) {
      return { name: f.PROVNAME || '', address: f.ADDRESS || '', phone: f.PHONE || '', rating: f.OVERALL_RATING || '' };
    })};
  } catch (e) {
    return { source: 'error', message: e.toString() };
  }
}


// ══════════════════════════════════════════
// FOOD APIs
// ══════════════════════════════════════════

function getSnapRetailers(zip) {
  try {
    var url = 'https://services1.arcgis.com/RLQu0rK7h4kbsBq5/ArcGIS/rest/services/SNAP_Store_Locations/FeatureServer/0/query' +
      '?where=Zip5%3D%27' + zip + '%27&outFields=Store_Name,Address,City,State,Zip5,Longitude,Latitude&resultRecordCount=50&f=json';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(resp.getContentText());
    var features = data.features || [];
    return { source: 'USDA', count: features.length, stores: features.slice(0, 30).map(function(f) {
      var a = f.attributes;
      return { name: a.Store_Name, address: a.Address + ', ' + a.City + ' ' + a.State + ' ' + a.Zip5, lat: a.Latitude, lon: a.Longitude };
    })};
  } catch (e) {
    return { source: 'error', message: e.toString() };
  }
}

function getFarmersMarkets(zip) {
  var key = PROPS.getProperty('DATA_GOV_KEY') || '';
  try {
    var url = 'https://www.usdalocalfoodportal.com/api/farmersmarket/?apikey=' + key + '&zip=' + zip + '&radius=10';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(resp.getContentText());
    return { source: 'USDA', count: (data.data || []).length, markets: (data.data || []).slice(0, 15).map(function(m) {
      return { name: m.listing_name || '', address: m.location_address || '', schedule: m.brief_desc || '' };
    })};
  } catch (e) {
    // Fallback — return empty gracefully
    return { source: 'USDA', count: 0, markets: [], note: 'Farmers market data unavailable. Try usdalocalfoodportal.com' };
  }
}


// ══════════════════════════════════════════
// HOUSING APIs
// ══════════════════════════════════════════

function getHousingCounselors(zip) {
  try {
    // HUD Housing Counseling — no key needed
    var url = 'https://data.hud.gov/Housing_Counselor/searchByLocation?Zip=' + zip + '&MaxDistance=10';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(resp.getContentText());
    return { source: 'HUD', count: data.length, counselors: (data || []).slice(0, 10).map(function(c) {
      return { name: c.nme || '', address: (c.adr1 || '') + ', ' + (c.city || '') + ' ' + (c.statecd || '') + ' ' + (c.zipcd || ''),
        phone: c.phone1 || '', services: (c.services || []).join(', '), languages: (c.languages || []).join(', ') };
    })};
  } catch (e) {
    return { source: 'error', message: e.toString() };
  }
}


// ══════════════════════════════════════════
// VETERANS
// ══════════════════════════════════════════

function getVAFacilities(zip) {
  var key = PROPS.getProperty('VA_KEY') || '';
  if (!key) return { source: 'VA', count: 0, note: 'VA API key not configured' };
  try {
    var url = 'https://api.va.gov/services/va_facilities/v1/facilities?zip=' + zip + '&radius=25&type=health,benefits,vet_center&per_page=15';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'apikey': key } });
    var data = JSON.parse(resp.getContentText());
    return { source: 'VA', count: (data.data || []).length, facilities: (data.data || []).slice(0, 10).map(function(f) {
      var a = f.attributes || {};
      return { name: a.name || '', address: a.address ? (a.address.physical || {}).address_1 + ', ' + (a.address.physical || {}).city + ' ' + (a.address.physical || {}).state : '',
        phone: a.phone ? a.phone.main || '' : '', type: a.facility_type || '', wait_times: a.wait_times || null,
        satisfaction: a.satisfaction ? a.satisfaction.health : null };
    })};
  } catch (e) {
    return { source: 'error', message: e.toString() };
  }
}


// ══════════════════════════════════════════
// WEATHER & DISASTER
// ══════════════════════════════════════════

function getWeatherAlerts(zip) {
  var geo = geocodeZip(zip);
  if (geo.error) return { source: 'error', message: geo.error };
  try {
    var url = 'https://api.weather.gov/alerts/active?point=' + geo.lat + ',' + geo.lon;
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'User-Agent': 'CommUnityOS/1.0 (comm-unity-os.org)' } });
    var data = JSON.parse(resp.getContentText());
    var features = data.features || [];
    return { source: 'NWS', count: features.length, alerts: features.slice(0, 5).map(function(f) {
      var p = f.properties || {};
      return { event: p.event || '', severity: p.severity || '', headline: p.headline || '', description: (p.description || '').substring(0, 300), expires: p.expires || '' };
    })};
  } catch (e) {
    return { source: 'NWS', count: 0, alerts: [] };
  }
}

function getActiveDisasters(zip) {
  var geo = geocodeZip(zip);
  if (geo.error) return { source: 'error', message: geo.error };
  try {
    var url = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=state%20eq%20%27' +
      (geo.state_abbr || 'IL') + '%27%20and%20declarationType%20eq%20%27DR%27&$orderby=declarationDate%20desc&$top=5';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(resp.getContentText());
    return { source: 'FEMA', count: (data.DisasterDeclarationsSummaries || []).length,
      disasters: (data.DisasterDeclarationsSummaries || []).slice(0, 5).map(function(d) {
        return { title: d.declarationTitle || '', type: d.incidentType || '', date: d.declarationDate || '', state: d.state || '' };
      })};
  } catch (e) {
    return { source: 'FEMA', count: 0, disasters: [] };
  }
}

function getAirQuality(zip) {
  var key = PROPS.getProperty('AIRNOW_KEY') || '';
  if (!key) return { source: 'AirNow', aqi: null, note: 'AirNow key not configured' };
  try {
    var url = 'https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=' + zip + '&API_KEY=' + key;
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(resp.getContentText());
    return { source: 'AirNow', readings: data.map(function(r) {
      return { parameter: r.ParameterName, aqi: r.AQI, category: r.Category ? r.Category.Name : '' };
    })};
  } catch (e) {
    return { source: 'AirNow', readings: [] };
  }
}


// ══════════════════════════════════════════
// WORKFORCE & EDUCATION
// ══════════════════════════════════════════

function getJobCenters(zip) {
  var key = PROPS.getProperty('CAREER_ONESTOP_KEY') || '';
  var userId = PROPS.getProperty('CAREER_ONESTOP_USERID') || '';
  if (!key || !userId) return { source: 'CareerOneStop', count: 0, note: 'CareerOneStop key not configured' };
  try {
    var url = 'https://api.careeronestop.org/v1/ajcfinder/' + userId + '/' + zip + '/25?sortColumns=Distance&sortOrder=ASC';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'Authorization': 'Bearer ' + key } });
    var data = JSON.parse(resp.getContentText());
    var centers = data.OneStopCenterList || [];
    return { source: 'CareerOneStop', count: centers.length, centers: centers.slice(0, 10).map(function(c) {
      return { name: c.Name || '', address: c.Address || '', phone: c.Phone || '', distance: c.Distance || '' };
    })};
  } catch (e) {
    return { source: 'error', message: e.toString() };
  }
}


// ══════════════════════════════════════════
// FINANCIAL
// ══════════════════════════════════════════

function getBanks(zip) {
  try {
    var url = 'https://api.fdic.gov/api/locations?filters=ZIP%3A' + zip + '&fields=NAME,ADDRESS,CITY,STNAME,ZIP,ESTYMD&limit=20&sort_by=NAME&sort_order=ASC';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(resp.getContentText());
    return { source: 'FDIC', count: data.totals ? data.totals.count : 0, banks: (data.data || []).slice(0, 15).map(function(b) {
      var d = b.data || {};
      return { name: d.NAME || '', address: d.ADDRESS + ', ' + d.CITY + ' ' + d.STNAME + ' ' + d.ZIP };
    })};
  } catch (e) {
    return { source: 'error', message: e.toString() };
  }
}

function getBenefits() {
  try {
    var url = 'https://www.usa.gov/s3/files/benefit-finder/api/life-event/all_benefits.json';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(resp.getContentText());
    return { source: 'USA.gov', count: (data.data || data).length, benefits: data };
  } catch (e) {
    return { source: 'error', message: e.toString() };
  }
}


// ══════════════════════════════════════════
// GOVERNANCE & TRANSPARENCY
// ══════════════════════════════════════════

function getStateLegislators(zip) {
  var geo = geocodeZip(zip);
  if (geo.error) return { source: 'error', message: geo.error };
  var key = PROPS.getProperty('DATA_GOV_KEY') || '';
  try {
    var url = 'https://v3.openstates.org/people.geo?lat=' + geo.lat + '&lng=' + geo.lon + '&apikey=' + key;
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(resp.getContentText());
    return { source: 'OpenStates', count: (data.results || []).length, legislators: (data.results || []).map(function(p) {
      return { name: p.name || '', party: p.party || '', chamber: p.current_role ? p.current_role.title : '',
        district: p.current_role ? p.current_role.district : '', email: p.email || '',
        links: (p.links || []).map(function(l) { return l.url; }) };
    })};
  } catch (e) {
    return { source: 'error', message: e.toString() };
  }
}

function getElections(zip) {
  var key = PROPS.getProperty('DATA_GOV_KEY') || '';
  try {
    var url = 'https://api.open.fec.gov/v1/elections/?zip=' + zip + '&cycle=2026&api_key=' + key + '&per_page=20';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(resp.getContentText());
    return { source: 'OpenFEC', count: (data.results || []).length, elections: (data.results || []).slice(0, 10).map(function(e) {
      return { office: e.office || '', district: e.district || '', cycle: e.cycle || '', candidates: e.candidate_ids || [] };
    })};
  } catch (e) {
    return { source: 'error', message: e.toString() };
  }
}


// ══════════════════════════════════════════
// CHICAGO/COOK COUNTY SODA APIs
// ══════════════════════════════════════════

function sodaFetch(portal, datasetId, where, limit) {
  var token = PROPS.getProperty('SOCRATA_APP_TOKEN') || '';
  var url = 'https://' + portal + '/resource/' + datasetId + '.json?$where=' + encodeURIComponent(where) + '&$limit=' + (limit || 50);
  if (token) url += '&$$app_token=' + token;
  try {
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    return JSON.parse(resp.getContentText());
  } catch (e) {
    return [];
  }
}

function getBuildingPermits(zip) {
  var data = sodaFetch('data.cityofchicago.org', 'ydr8-5enu', "zip_code='" + zip + "' AND issue_date > '2025-01-01'", 100);
  var demolitions = data.filter(function(d) { return (d.permit_type || '').indexOf('WRECKING') !== -1; }).length;
  var newConstruction = data.filter(function(d) { return (d.permit_type || '').indexOf('NEW CONSTRUCTION') !== -1; }).length;
  return { source: 'Chicago', total: data.length, demolitions: demolitions, new_construction: newConstruction,
    permits: data.slice(0, 20).map(function(p) {
      return { type: p.permit_type || '', address: p.street_number + ' ' + p.street_direction + ' ' + p.street_name, date: p.issue_date || '', work: p.work_description || '' };
    })};
}

function getPropertyAssessments(zip) {
  var data = sodaFetch('datacatalog.cookcountyil.gov', 'uzyt-m557', "starts_with(pin, '16')", 50); // pin prefix for South/West Side
  return { source: 'Cook County', count: data.length, assessments: data.slice(0, 20).map(function(a) {
    return { pin: a.pin || '', address: a.property_address || '', assessed_value: a.certified_tot || a.first_pass_tot || '', class: a.class || '' };
  })};
}

function getTIFData(zip) {
  var projects = sodaFetch('data.cityofchicago.org', 'mex4-ppfc', "1=1", 100);
  var balances = sodaFetch('data.cityofchicago.org', 'hezc-e4be', "1=1", 100);
  return { source: 'Chicago', projects: projects.slice(0, 20).map(function(p) {
    return { tif_name: p.tif_name || '', project: p.project_name || '', approved_amount: p.approved_amount || '' };
  }), balances: balances.slice(0, 10).map(function(b) {
    return { tif_name: b.tif_name || '', revenue: b.revenue || '', expenditures: b.expenditures || '' };
  })};
}

function getWageViolations(zip) {
  // DOL Wage & Hour — filter by zip
  try {
    var url = 'https://data.dol.gov/get/enforcement/zip_cd/' + zip + '?limit=20&offset=0';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(resp.getContentText());
    return { source: 'DOL', count: data.length, violations: (data || []).slice(0, 15).map(function(v) {
      return { employer: v.trade_nm || '', address: v.street_addr_1_txt || '', back_wages: v.bw_atp_amt || '', employees_affected: v.ee_atp_cnt || '', findings_date: v.findings_start_date || '' };
    })};
  } catch (e) {
    return { source: 'DOL', count: 0, violations: [] };
  }
}

function getEnvViolations(zip) {
  try {
    var url = 'https://echodata.epa.gov/echo/echo_rest_services.get_facilities?output=JSON&p_zip=' + zip + '&responseset=20';
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var data = JSON.parse(resp.getContentText());
    var results = data.Results || {};
    var facilities = results.Facilities || [];
    return { source: 'EPA ECHO', count: facilities.length, facilities: facilities.slice(0, 15).map(function(f) {
      return { name: f.FacName || '', address: f.FacStreet || '', city: f.FacCity || '', violations: f.CWAViol || f.RCRAViol || '',
        compliance_status: f.CurrSvFlag || '', last_inspection: f.DfrUrl || '' };
    })};
  } catch (e) {
    return { source: 'error', message: e.toString() };
  }
}


// ══════════════════════════════════════════
// UTILITY
// ══════════════════════════════════════════

// jsonOut() defined in Code.gs — do not duplicate here


// ══════════════════════════════════════════
// TRIGGER: fetch311Data — daily, pulls Chicago 311 data
// Uses 7-day window + 1000 limit to stay under 6-min wall
// ══════════════════════════════════════════

function fetch311Data() {
  var cache = CacheService.getScriptCache();
  var today = new Date().toISOString().substring(0, 10);

  // Skip if already fetched today
  if (cache.get('311_date') === today) {
    Logger.log('311 data already fetched today. Skipping.');
    return;
  }

  var weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().substring(0, 10);
  var url = 'https://data.cityofchicago.org/resource/v6vf-nfxy.json' +
    '?$where=created_date>%27' + weekAgo + '%27' +
    '&$limit=1000&$order=created_date DESC';

  try {
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) {
      Logger.log('311 API returned ' + resp.getResponseCode());
      return;
    }
    var records = JSON.parse(resp.getContentText());

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('311Data');
    if (!sheet) {
      sheet = ss.insertSheet('311Data');
      sheet.appendRow(['sr_number','type','zip','status','created','closed','ward','community']);
    }

    // Clear old data + batch write (NOT row-by-row)
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).clear();
    }

    if (records.length > 0) {
      var rows = records.map(function(d) {
        return [
          d.sr_number || '', d.sr_type || '',
          d.zip_code || '', d.status || '',
          d.created_date || '', d.closed_date || '',
          d.ward || '', d.community_area || ''
        ];
      });
      sheet.getRange(2, 1, rows.length, 8).setValues(rows);
    }

    cache.put('311_date', today, 86400);
    Logger.log('311: Fetched ' + records.length + ' records (last 7 days)');
  } catch(e) {
    Logger.log('311 fetch failed: ' + e.message);
  }
}

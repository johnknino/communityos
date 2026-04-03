#!/usr/bin/env node
/**
 * CommUnity OS — Dataset Discovery Script
 * 
 * Queries the Socrata Discovery API to find open data portals and datasets
 * for a given city/state, then generates a starter community.json.
 *
 * Usage:
 *   node discover.js "Chicago" "IL"
 *   node discover.js "New York" "NY"
 *   node discover.js "Houston" "TX" --output community.json
 *
 * Requirements: Node.js 14+
 */

const https = require('https');

const SOCRATA_DISCOVERY = 'https://api.us.socrata.com/api/catalog/v1';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Known civic dataset patterns — what we're looking for
const SLOT_PATTERNS = {
  '311_requests': {
    keywords: ['311', 'service request', 'service requests'],
    description: '311 service requests',
    tool: 'Neighborhood issue tracker'
  },
  food_inspections: {
    keywords: ['food inspection', 'restaurant inspection', 'food establishment', 'health inspection'],
    description: 'Restaurant/food establishment inspections',
    tool: 'Food safety lookup'
  },
  building_violations: {
    keywords: ['building violation', 'code violation', 'code enforcement', 'building complaint'],
    description: 'Building code violations',
    tool: 'Building safety lookup'
  },
  crimes: {
    keywords: ['crimes', 'crime incidents', 'police incidents', 'offenses'],
    description: 'Crime incident reports',
    tool: 'Not displayed — available for civic analysis only',
    enabled_default: false
  },
  business_licenses: {
    keywords: ['business license', 'active business'],
    description: 'Business licenses',
    tool: 'Business lookup'
  },
  property_assessments: {
    keywords: ['property assessment', 'assessed value', 'property tax', 'parcel'],
    description: 'Property tax assessments',
    tool: 'Property tax checker'
  },
  permits: {
    keywords: ['building permit', 'construction permit'],
    description: 'Building/construction permits',
    tool: 'Permit tracker'
  },
  pothole_repairs: {
    keywords: ['pothole', 'street repair', 'road repair'],
    description: 'Pothole/street repair requests',
    tool: 'Street repair tracker'
  },
  affordable_housing: {
    keywords: ['affordable housing', 'housing units', 'section 8'],
    description: 'Affordable housing inventory',
    tool: 'Housing resource finder'
  }
};

// Known Socrata domains by city
const KNOWN_DOMAINS = {
  'Chicago,IL': 'data.cityofchicago.org',
  'New York,NY': 'data.cityofnewyork.us',
  'Los Angeles,CA': 'data.lacity.org',
  'Houston,TX': 'data.houstontx.gov',
  'Phoenix,AZ': 'www.phoenixopendata.com',
  'San Antonio,TX': 'data.sanantonio.gov',
  'San Diego,CA': 'data.sandiego.gov',
  'Dallas,TX': 'www.dallasopendata.com',
  'San Jose,CA': 'data.sanjoseca.gov',
  'Austin,TX': 'data.austintexas.gov',
  'Jacksonville,FL': 'data.coj.net',
  'Fort Worth,TX': 'data.fortworthtexas.gov',
  'San Francisco,CA': 'data.sfgov.org',
  'Seattle,WA': 'data.seattle.gov',
  'Denver,CO': 'www.denvergov.org/opendata',
  'Nashville,TN': 'data.nashville.gov',
  'Oklahoma City,OK': 'data.okc.gov',
  'Portland,OR': 'www.civicapps.org',
  'Las Vegas,NV': 'opendataportal-lasvegas.opendata.arcgis.com',
  'Louisville,KY': 'data.louisvilleky.gov',
  'Baltimore,MD': 'data.baltimorecity.gov',
  'Milwaukee,WI': 'data.milwaukee.gov',
  'Albuquerque,NM': 'www.cabq.gov/abq-data',
  'Kansas City,MO': 'data.kcmo.org',
  'Atlanta,GA': 'www.atlantaga.gov/government/open-data',
  'Raleigh,NC': 'data.raleighnc.gov',
  'Miami,FL': 'datahub-miamidade.opendata.arcgis.com',
  'Minneapolis,MN': 'opendata.minneapolismn.gov',
  'New Orleans,LA': 'data.nola.gov',
  'Detroit,MI': 'data.detroitmi.gov',
  'Boston,MA': 'data.boston.gov',
  'Philadelphia,PA': 'www.opendataphilly.org'
};

// State FIPS codes
const STATE_FIPS = {
  'AL':'01','AK':'02','AZ':'04','AR':'05','CA':'06','CO':'08','CT':'09','DE':'10',
  'FL':'12','GA':'13','HI':'15','ID':'16','IL':'17','IN':'18','IA':'19','KS':'20',
  'KY':'21','LA':'22','ME':'23','MD':'24','MA':'25','MI':'26','MN':'27','MS':'28',
  'MO':'29','MT':'30','NE':'31','NV':'32','NH':'33','NJ':'34','NM':'35','NY':'36',
  'NC':'37','ND':'38','OH':'39','OK':'40','OR':'41','PA':'42','RI':'44','SC':'45',
  'SD':'46','TN':'47','TX':'48','UT':'49','VT':'50','VA':'51','WA':'53','WV':'54',
  'WI':'55','WY':'56','DC':'11'
};

async function discoverDomain(city, state) {
  const key = `${city},${state}`;
  if (KNOWN_DOMAINS[key]) {
    return { domain: KNOWN_DOMAINS[key], source: 'known' };
  }

  // Try Socrata discovery API to find domains
  const params = new URLSearchParams({ q: `${city} ${state}`, limit: '5', only: 'datasets' });
  try {
    const data = await httpGet(`${SOCRATA_DISCOVERY}?${params.toString()}`);
    if (data.results && data.results.length > 0) {
      // Find most common domain in results
      const domains = {};
      data.results.forEach(r => {
        const d = r.metadata?.domain;
        if (d) domains[d] = (domains[d] || 0) + 1;
      });
      const best = Object.entries(domains).sort((a, b) => b[1] - a[1])[0];
      if (best) return { domain: best[0], source: 'discovered' };
    }
  } catch (e) {
    // API unavailable
  }

  return { domain: null, source: 'not_found' };
}

async function searchDatasets(domain) {
  const results = {};

  for (const [slot, pattern] of Object.entries(SLOT_PATTERNS)) {
    results[slot] = { found: false, candidates: [] };

    for (const keyword of pattern.keywords) {
      try {
        const params = new URLSearchParams({
          domains: domain,
          q: keyword,
          limit: '5',
          only: 'datasets'
        });
        const url = `${SOCRATA_DISCOVERY}?${params.toString()}`;
        const data = await httpGet(url);

        if (data.results) {
          data.results.forEach(r => {
            const id = r.resource?.id;
            const name = r.resource?.name;
            const rows = r.resource?.page_views?.page_views_total || 0;
            const updated = r.resource?.updatedAt;

            if (id && name) {
              // Check if we already have this candidate
              if (!results[slot].candidates.find(c => c.id === id)) {
                results[slot].candidates.push({
                  id, name, rows,
                  updated: updated ? updated.split('T')[0] : 'unknown',
                  keyword_match: keyword
                });
              }
            }
          });
        }
      } catch (e) {
        // Continue to next keyword
      }
    }

    // Sort by page views (popularity proxy) and pick best
    results[slot].candidates.sort((a, b) => b.rows - a.rows);
    if (results[slot].candidates.length > 0) {
      results[slot].found = true;
      results[slot].best = results[slot].candidates[0];
    }
  }

  return results;
}

function generateCommunityJson(city, state, domain, datasets) {
  const stateFips = STATE_FIPS[state] || '00';

  const openData = { platform: 'socrata', domain, app_token: '', datasets: {} };

  for (const [slot, result] of Object.entries(datasets)) {
    if (result.found) {
      openData.datasets[slot] = {
        id: result.best.id,
        enabled: SLOT_PATTERNS[slot].enabled_default !== false,
        notes: `${result.best.name} (${result.best.rows.toLocaleString()} views, updated ${result.best.updated})`
      };
    }
  }

  return {
    community_name: '',
    city,
    county: '',
    county_fips: '',
    state,
    state_fips: stateFips,
    zip_codes: [],
    languages: ['en', 'es'],
    coordinates: { lat: 0, lng: 0 },
    state_config: state,
    open_data: openData,
    property_tax: {
      platform: 'manual',
      domain: '',
      assessment_dataset: '',
      sales_dataset: '',
      appeal_board_name: '',
      appeal_board_url: '',
      appeal_success_rate: '',
      appeal_deadline_note: '',
      lookup_url: ''
    },
    organizations: {
      legal_aid: [],
      food_resources: [],
      immigration: [],
      housing: [],
      tax_help: [],
      utility_assistance: []
    },
    officials: { api: 'google_civic', api_key_env: 'GOOGLE_CIVIC_KEY', manual_fallback: [] },
    crisis: [
      { name: '988 Suicide & Crisis Lifeline', phone: '988', text: '988' },
      { name: 'National Domestic Violence Hotline', phone: '1-800-799-7233' },
      { name: '211 (local resources)', phone: '211' }
    ],
    deploy: {
      domain: '',
      netlify_site_id: '',
      version: 'v31',
      cost_per_year: '$7',
      author: ''
    }
  };
}

// ─── Main ───

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('CommUnity OS — Dataset Discovery Script');
    console.log('');
    console.log('Usage: node discover.js "City" "ST" [--output file.json]');
    console.log('');
    console.log('Examples:');
    console.log('  node discover.js "Chicago" "IL"');
    console.log('  node discover.js "Houston" "TX" --output community.json');
    console.log('');
    console.log(`Known cities: ${Object.keys(KNOWN_DOMAINS).length}`);
    process.exit(0);
  }

  const city = args[0];
  const state = args[1].toUpperCase();
  const outputIdx = args.indexOf('--output');
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;

  console.log(`\n🔍 CommUnity OS Discovery — ${city}, ${state}\n`);

  // Step 1: Find the open data portal
  console.log('Step 1: Finding open data portal...');
  const { domain, source } = await discoverDomain(city, state);

  if (!domain) {
    console.log('  ⚠ No Socrata open data portal found.');
    console.log('  → Tier 1 (national) and Tier 2 (state) tools will still work.');
    console.log('  → Tier 3 (local data) can be added manually if portal exists on another platform.');
    console.log('');

    const json = generateCommunityJson(city, state, '', {});
    json.open_data = { platform: 'none', domain: '', app_token: '', datasets: {} };

    if (outputFile) {
      const fs = require('fs');
      fs.writeFileSync(outputFile, JSON.stringify(json, null, 2));
      console.log(`  📄 Starter community.json written to ${outputFile}`);
    } else {
      console.log(JSON.stringify(json, null, 2));
    }
    return;
  }

  console.log(`  ✓ Found: ${domain} (${source})`);

  // Step 2: Search for civic datasets
  console.log('\nStep 2: Searching for civic datasets...\n');
  const datasets = await searchDatasets(domain);

  let found = 0, total = Object.keys(SLOT_PATTERNS).length;
  for (const [slot, result] of Object.entries(datasets)) {
    const pattern = SLOT_PATTERNS[slot];
    if (result.found) {
      found++;
      const best = result.best;
      const enabled = pattern.enabled_default !== false ? '✓' : '○';
      console.log(`  ${enabled} ${pattern.description}`);
      console.log(`    → ${best.id} | "${best.name}"`);
      console.log(`    → ${best.rows.toLocaleString()} views | updated ${best.updated}`);
      if (result.candidates.length > 1) {
        console.log(`    → ${result.candidates.length - 1} other candidate(s) available`);
      }
    } else {
      console.log(`  ✗ ${pattern.description} — not found`);
    }
    console.log('');
  }

  console.log(`\nSummary: ${found}/${total} dataset slots filled\n`);

  // Tier assessment
  const tierTools = {
    tier1: 'Guides (43), dispute letters, health calculators, CFPB complaints, drug pricing, HMDA lending, HRSA clinics, CDC vaccines',
    tier2: `State protections for ${state} (needs states/${state}.json)`,
    tier3: `${found} local datasets from ${domain}`
  };

  console.log('Tool availability:');
  console.log(`  Tier 1 (National): ${tierTools.tier1}`);
  console.log(`  Tier 2 (State):    ${tierTools.tier2}`);
  console.log(`  Tier 3 (Local):    ${tierTools.tier3}`);
  console.log('');

  // Step 3: Generate community.json
  const json = generateCommunityJson(city, state, domain, datasets);

  if (outputFile) {
    const fs = require('fs');
    fs.writeFileSync(outputFile, JSON.stringify(json, null, 2));
    console.log(`📄 community.json written to ${outputFile}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Fill in community_name, zip_codes, coordinates, county, county_fips');
    console.log('  2. Add local organizations (legal aid, food pantries, immigration services)');
    console.log(`  3. Create or verify states/${state}.json with state-specific rights`);
    console.log('  4. Deploy to Netlify');
  } else {
    console.log(JSON.stringify(json, null, 2));
  }
}

main().catch(console.error);

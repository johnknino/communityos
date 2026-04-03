# CommUnity OS — National Community Kit Schema

## Overview

Every CommUnity OS deployment is configured by a single `community.json` file. This file contains everything that varies between communities. Everything else — the 43 guides, the UI, the dispute letter generator, the federal API tools — is identical across all deployments.

**Three tiers:**
- **Tier 1 (National):** Works everywhere with zero configuration. Federal APIs, federal law guides, health calculators, dispute letters.
- **Tier 2 (State):** State-specific rights, protections, agencies, and contacts. One `state.json` per state. Loaded from a shared CDN or bundled.
- **Tier 3 (Local):** City/county open data endpoints, local organizations, elected officials. This is `community.json`.

## community.json

```jsonc
{
  // ─── Identity ───
  "community_name": "Back of the Yards",        // Neighborhood or community name
  "city": "Chicago",
  "county": "Cook",
  "county_fips": "17031",                        // 5-digit FIPS for HMDA/census queries
  "state": "IL",
  "state_fips": "17",
  "zip_codes": ["60608", "60609", "60632"],      // Primary zip codes served
  "languages": ["en", "es"],                     // ISO 639-1 codes
  "coordinates": {
    "lat": 41.8090,
    "lng": -87.6694
  },

  // ─── Tier 2: State Configuration ───
  "state_config": "IL",                          // References states/IL.json

  // ─── Tier 3: Local Open Data ───
  "open_data": {
    "platform": "socrata",                       // socrata | ckan | arcgis | none
    "domain": "data.cityofchicago.org",
    "app_token": "",                             // Optional — improves rate limits
    "datasets": {
      "311_requests": {
        "id": "v6vf-nfxy",
        "enabled": true,
        "notes": "7M+ records, near real-time"
      },
      "food_inspections": {
        "id": "qizy-d2wf",
        "enabled": true,
        "notes": "7/1/2018–present"
      },
      "building_violations": {
        "id": "22u3-xenr",
        "enabled": true,
        "notes": "2006–present"
      },
      "business_licenses": {
        "id": "r5kz-chrr",
        "enabled": false
      },
      "crimes": {
        "id": "ijzp-q8t2",
        "enabled": false,
        "notes": "Available but not surfaced — platform does not display crime data"
      }
    }
  },

  // ─── Property Tax ───
  "property_tax": {
    "platform": "socrata",
    "domain": "datacatalog.cookcountyil.gov",
    "assessment_dataset": "uzyt-m557",
    "sales_dataset": "wvhk-k5uv",
    "appeal_board_name": "Cook County Board of Review",
    "appeal_board_url": "https://www.cookcountyboardofreview.com",
    "appeal_success_rate": "62%",
    "appeal_deadline_note": "30 days from reassessment notice — check your township schedule",
    "lookup_url": "https://www.cookcountypropertyinfo.com"
  },

  // ─── Local Organizations ───
  "organizations": {
    "legal_aid": [
      {
        "name": "Legal Aid Chicago",
        "phone": "312-341-1070",
        "url": "https://legalaidchicago.org",
        "services": ["housing", "benefits", "immigration", "family"],
        "languages": ["en", "es", "pl", "zh"]
      },
      {
        "name": "CARPLS Legal Aid Hotline",
        "phone": "312-738-9200",
        "url": "https://www.carpls.org",
        "services": ["general", "housing", "consumer"],
        "languages": ["en", "es"]
      },
      {
        "name": "Metropolitan Tenants Organization",
        "phone": "773-292-4988",
        "url": "https://www.tenants-rights.org",
        "services": ["housing", "eviction"],
        "languages": ["en", "es"]
      }
    ],
    "food_resources": [
      {
        "name": "Greater Chicago Food Depository",
        "phone": "773-247-3663",
        "url": "https://www.chicagosfoodbank.org/find-food/",
        "type": "food_bank_network"
      }
    ],
    "immigration": [
      {
        "name": "ICIRR Multilingual Hotline",
        "phone": "1-855-435-7693",
        "url": "https://www.icirr.org",
        "languages": ["en", "es", "pl", "ko", "zh", "ar"]
      },
      {
        "name": "National Immigrant Justice Center",
        "phone": "312-660-1370",
        "url": "https://immigrantjustice.org",
        "languages": ["en", "es"]
      }
    ],
    "housing": [
      {
        "name": "Spanish Coalition for Housing",
        "phone": "773-276-7633",
        "url": "https://www.sc4housing.org",
        "languages": ["en", "es"]
      }
    ],
    "tax_help": [
      {
        "name": "Ladder Up / VITA Sites",
        "phone": "312-588-6900",
        "url": "https://www.goladderup.org",
        "season": "January–April",
        "income_limit": "$67,000"
      }
    ],
    "utility_assistance": [
      {
        "name": "CEDA (LIHEAP administrator)",
        "phone": "773-292-4988",
        "url": "https://www.cedaorg.net",
        "programs": ["LIHEAP", "weatherization", "water assistance"]
      }
    ]
  },

  // ─── Elected Officials API ───
  "officials": {
    "api": "google_civic",                       // google_civic | openstates | manual
    "api_key_env": "GOOGLE_CIVIC_KEY",           // Environment variable name
    "manual_fallback": []                         // Used when API unavailable
  },

  // ─── Crisis Resources (always visible) ───
  "crisis": [
    { "name": "988 Suicide & Crisis Lifeline", "phone": "988", "text": "988" },
    { "name": "National Domestic Violence Hotline", "phone": "1-800-799-7233" },
    { "name": "211 (local resources)", "phone": "211" },
    { "name": "ICIRR Immigration Hotline", "phone": "1-855-435-7693" }
  ],

  // ─── Deployment ───
  "deploy": {
    "domain": "comm-unity-os.org",
    "netlify_site_id": "",
    "version": "v31",
    "cost_per_year": "$7",
    "author": "Prof. Nino — 60608"
  }
}
```

## states/{STATE}.json

Each state file contains protections that apply statewide.

```jsonc
{
  "state": "IL",
  "state_name": "Illinois",

  "tenant_rights": {
    "security_deposit_limit": "1.5x monthly rent (Chicago RLTO)",
    "deposit_return_days": 30,
    "deposit_interest_required": true,
    "eviction_notice_nonpayment_days": 5,
    "eviction_notice_lease_violation_days": 10,
    "rent_control": false,
    "retaliation_protection": true,
    "eviction_sealing": true,
    "eviction_sealing_law": "735 ILCS 5/9-121",
    "eviction_sealing_note": "Court may seal records in residential eviction actions, especially dismissed cases"
  },

  "utility_protections": {
    "winter_shutoff_moratorium": true,
    "moratorium_months": ["December", "January", "February", "March"],
    "moratorium_law": "220 ILCS 5/8-206",
    "temperature_protection": true,
    "temperature_threshold_f": 32,
    "heat_threshold_f": 95,
    "medical_certificate_days": 60,
    "notice_required_days": 10,
    "complaint_agency": "Illinois Commerce Commission",
    "complaint_phone": "1-800-524-0795"
  },

  "employment": {
    "minimum_wage": 15.00,
    "minimum_wage_city_override": { "Chicago": 16.20 },
    "ban_the_box": true,
    "ban_the_box_law": "Job Opportunities for Qualified Applicants Act (820 ILCS 75)",
    "ban_the_box_threshold": 15,
    "salary_history_ban": true
  },

  "healthcare": {
    "medicaid_agency": "Illinois Department of Healthcare and Family Services",
    "medicaid_phone": "1-877-782-5565",
    "medicaid_url": "https://www.illinois.gov/hfs",
    "marketplace_url": "https://getcovered.illinois.gov",
    "insurance_commissioner": "Illinois Department of Insurance",
    "insurance_commissioner_phone": "1-866-445-5364",
    "insurance_commissioner_url": "https://insurance.illinois.gov"
  },

  "property_tax": {
    "assessment_cycle": "triennial by township (Cook County)",
    "appeal_board": "Cook County Board of Review",
    "appeal_board_url": "https://www.cookcountyboardofreview.com",
    "homestead_exemption": true,
    "senior_freeze": true,
    "veterans_exemption": true
  },

  "legal_aid": {
    "state_bar_referral": "Illinois State Bar Association",
    "state_bar_phone": "1-800-252-8908",
    "legal_aid_online": "https://www.illinoislegalaid.org",
    "legal_aid_languages": ["en", "es"]
  },

  "immigration": {
    "sanctuary_policy": true,
    "state_id_undocumented": true,
    "in_state_tuition_undocumented": true,
    "drivers_license_undocumented": true,
    "notario_fraud_law": true
  },

  "selective_service": {
    "fafsa_requirement": true,
    "state_financial_aid_requirement": true,
    "state_employment_requirement": false
  }
}
```

## How it flows

1. **User visits site** → `community.json` loads from root
2. **Guides render** → All 43 guides are universal. Action steps append local org contacts from `community.json` → `organizations`
3. **State rights load** → `states/{state}.json` populates the rights calculator, utility shutoff rules, tenant protections
4. **Local tools activate** → If `open_data.datasets.food_inspections.enabled`, the food inspection lookup tool appears. If not, that tool is hidden — no broken features
5. **National tools always work** → CFPB complaints, drug pricing, health calculators, dispute letters, HMDA data — all federal, all free, all present on every deployment

## Discovery Script

`kit/discover.js` queries the Socrata Discovery API for a given city and maps available datasets to CommUnity OS tool slots. Output: a starter `community.json` with datasets pre-filled.

```
node kit/discover.js "Chicago" "IL"
```

## Replication Steps

1. Fork `github.com/communityos/communityos`
2. Copy `kit/community-template.json` → `community.json`
3. Run `node kit/discover.js "YourCity" "ST"` to find local datasets
4. Edit `community.json` with your community name, zip codes, organizations
5. Deploy to Netlify (free tier)
6. Register a domain ($7–12/year)
7. Done. 43 guides, dispute letters, health calculators, federal tools — live.

## Community Overlay (NEW)

The `community-overlay.json` file contains only what APIs cannot provide — local food pantries, mutual aid groups, legal aid contacts, elected officials with direct numbers, and crisis contacts. Everything else (demographics, complaints, facilities, health centers, wages, benefits) is resolved automatically from the zip code at runtime.

## How the Universal Zip Resolver Works

`neighborhood.html` takes a zip code and queries:
1. **Census ACS** — demographics, income, insurance, language, housing
2. **CFPB** — consumer complaint patterns
3. **EPA ECHO** — regulated facilities and violations
4. **HRSA** — nearest free/low-cost health centers

No state configuration file needed. No manual data entry. The community overlay adds the human layer — the organizations a person would actually call.

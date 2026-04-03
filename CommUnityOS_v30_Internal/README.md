# CommUnity OS

**Free tools for neighborhoods. $7/year. No account. No tracking. Bilingual.**

[comm-unity-os.org](https://comm-unity-os.org)

---

## What this is

A civic resilience platform that helps communities find food, understand their rights, connect with neighbors, grow food, evaluate their leaders, and monitor their own health — in English and Spanish, on any phone, without creating an account.

Every tool follows the same structure: **How does this work → Where is it failing → What can you do.** The content changes. The structure never does.

## How it works

21 static HTML pages served from Netlify. One shared JavaScript file (shared.js) and one shared CSS file (shared.css) provide the bilingual engine, navigation, accessibility, offline detection, and API communication for every page. Data lives in Google Sheets, accessed through Google Apps Script. The community owns the Sheet. The platform reads it but never stores a copy.

```
Browser → Static HTML (Netlify, free)
              ↓
         shared.js → Apps Script API (Google, free)
              ↓
         Google Sheet (community-owned)
```

Total infrastructure cost: $7/year (domain registration). Everything else is free tier.

## The 21 pages

| Page | Purpose | Arc Stage |
|------|---------|-----------|
| index | Front door — zip code entry, arc overview | — |
| survive | Food, benefits, health, crisis hotlines | Survive |
| vitals | Blood pressure, heart rate, glucose — N→B→F interpretation, zero storage | Survive |
| understand | Tenant rights, employment law, money, taxes | Understand |
| connect | Find neighbors, mutual aid, secure communication | Connect |
| grow | Container garden guide — 40 plants by USDA zone | Grow |
| govern | Leadership evaluation, civic tools, fluid democracy overview | Govern |
| learn | Health, money, rights, power — structured learning paths | Learn |
| discuss | Community discussion board — threaded, tagged, moderated | Connect |
| needs | Post what you need, share what you have — 30-day expiry | Connect |
| evaluate | Score leaders on 5 criteria — printable scorecard | Govern |
| assess | Traffic-light assessment of programs — 6 dimensions | Govern |
| audit | Compare promises to evidence — accountability tool | Govern |
| dashboard | Community health dashboard — traffic lights by domain | Govern |
| intelligence | Zip code briefing — civic pressure, officials, data | Govern |
| propose | Fluid democracy — propose, vote, delegate | Govern |
| knowledge | 27 N→B→F guides — health, money, rights, power | Learn |
| story | How and why this was built | — |
| share | Share the platform with neighbors | — |
| support | Privacy policy, data governance charter, contribution info | — |
| 404 | Offline fallback and lost page handler | — |

## Running locally

1. Clone or unzip the repository
2. Serve with any static server: `python3 -m http.server 8000`
3. Open `http://localhost:8000`

The site works without the Apps Script backend — static content, guides, and tools render normally. Discussion board, needs/offers, evaluations, and assessments require the backend.

## Setting up the backend

1. Create a Google Sheet in a personal Google account
2. Open Extensions → Apps Script
3. Paste the contents of these files (in order):
   - `Code.gs` (v1.4 — master router, do this first)
   - `CivicDataHub.gs`
   - `CivicEscalation.gs`
   - `CommunityRegistry.gs`
   - `CommunityHealthPulse.gs`
   - `MasterFeed.gs`
   - `CommunityReporter.gs`
4. Run `initializeCommunity()` — creates 12 Sheet tabs with headers
5. Run `initRegistry()` — creates CommunityRegistry tab
6. Run `initHealthPulse()` — creates HealthPulse + HealthPulseAgg tabs
7. Deploy → New Deployment → Web App → Execute as: Me → Who has access: Anyone
8. Copy the deployment URL
9. In each HTML page, the `var API = '...'` line points to this URL

## Architecture decisions

**Why static HTML instead of React/Vue/Next.js?**
Because a community member can right-click → View Source and understand what the page does. Because static HTML works on a $30 phone on 3G. Because there's no build step, no node_modules, no dependency chain that can break. Because Netlify serves it for free forever.

**Why Google Sheets instead of PostgreSQL/Firebase/Supabase?**
Because the community can open the Sheet and see their own data. Because they can download it as CSV. Because they can revoke access by changing sharing settings. Because it costs nothing. Because the Data Steward doesn't need to learn SQL.

**Why Apps Script instead of a real backend?**
Because it runs for free. Because it deploys in one click. Because it doesn't need a server, a container, a CI/CD pipeline, or a credit card. Because when someone asks "who controls the backend?" the answer is "the person who owns the Google account."

**Why $7/year?**
Because the dominant cause of civic tech death is economics. If a platform costs money to run, it needs a grant. Grants expire. Platforms die. Communities lose the infrastructure they depended on. $7/year means nobody can kill it by withdrawing funding.

## The scaffold

Every tool on every page runs on the same three questions:

- **Normal** — How does this system work when it's functioning correctly?
- **Broken** — Where does it fail? What goes wrong?
- **Fix** — What can you do about it? Specific steps, phone numbers, exact words.

This structure (N→B→F) is domain-agnostic. It was derived from clinical diagnostic reasoning — it's how a physician evaluates a patient. It works identically for blood pressure, tenant rights, food access, and governance accountability. The content changes. The structure never does.

## Data governance

The platform follows CARE Principles for Indigenous Data Governance and the OCAP framework, adapted for civic use:

- **Collective Benefit** — data serves the community first
- **Authority to Control** — the community owns the Sheet, decides what to share
- **Responsibility** — platform maintains code; community maintains data
- **Ethics** — no personal data flows upward in the federation
- **Ownership** — community can revoke access in one click; platform retains nothing

Full charter: [comm-unity-os.org/support](https://comm-unity-os.org/support)

## Community Health Pulse

An opt-in feature on vitals.html that collects anonymous vitals contributions:
- Client-side anonymization: 3-digit ZIP prefix, age range, gender, readings only
- k≥11 suppression: no pattern displayed until 11+ people contribute
- Zero PII: no name, email, full ZIP, exact age, or precise timestamp
- Community-owned: aggregate Sheet accessible to Data Steward only
- HIPAA: does not apply (non-covered entity); Safe Harbor methodology adopted voluntarily

## Federation

Communities join the network by registering their Apps Script URL with the hub. Summary metrics (counts, averages, scores) flow upward. No personal data crosses the boundary. Each community can disconnect at any time by changing Sheet sharing settings.

See: `Federation_Handshake_Protocol_v1.md`

## Testing

Deploy `communityos-test-suite.html` alongside the site. Access at:
```
https://[your-domain]/communityos-test-suite.html
```
Enter site URL and Apps Script URL. Run All Tests.

## Who built this

John Nino, MD — Assistant Professor of Biology, Richard J. Daley College (City Colleges of Chicago). Assessment Coordinator, Honors College Co-Director, Faculty Council Secretary.

Platform infrastructure: NinoTech LLC (Illinois)
Fiscal sponsorship: The Hack Foundation (Hack Club, EIN: 81-2908499)

## License

Code: MIT License
Content (guides, translations, educational materials): CC BY-SA 4.0
N→B→F scaffold and "CommUnity OS" name: © NinoTech LLC

## If you're reading this because I'm not here

The platform runs without me. The Sheets hold the data. The HTML is static. Netlify serves it. The domain costs $7/year through Porkbun. The Apps Script URL doesn't change unless someone redeploys.

If you need to maintain it: the shared.js file controls navigation, bilingual engine, accessibility, offline detection, and API communication for all 21 pages. Change it once, deploy once, every page updates.

If you need to add a page: copy any existing page, change the EQ.init translations, deploy.

If you need to add a community: follow the Federation Handshake Protocol.

If you need to shut it down: delete the Netlify site. The Sheets persist independently. Communities keep their data.

The scaffold is: How does this work. Where is it failing. What can you do about it. Apply it to whatever domain you're facing. The answer will have the same shape.

# Community Data Trust Agreement

**CommUnity OS — Community Data Governance Template**
Version 1.0 | March 2026

*This agreement defines how community data is collected, stored, shared, and governed within a CommUnity OS community node. It may be adopted as-is or modified to fit local needs. Plain language is used throughout so every community member can understand the terms.*

---

## 1. Who This Agreement Is Between

**The Community** — the residents of ZIP code ________ who use the CommUnity OS platform to share information, file needs, post offers, evaluate leaders, and participate in civic life.

**The Data Steward** — the person or persons chosen by the community to manage the platform's data. The Steward is a custodian, not an owner. They maintain the Google Sheet, monitor for abuse, and ensure the platform operates according to this agreement.

**The Platform** — CommUnity OS, an open-source civic resilience platform operated by NinoTech LLC. The platform provides the code, hosting, and technical support. It does not own, sell, or control community data.

---

## 2. What Data Is Collected

The platform collects only what community members choose to share:

- **Discussion posts:** display name, zip code, topic tag, title, body text, timestamp
- **Needs and offers:** display name, zip code, category, description, contact method, timestamp
- **Evaluations:** evaluator display name, zip code, leader name, scores, notes, timestamp
- **Vitals (optional):** age range, 3-digit zip prefix, anonymous health metrics. No name, email, address, or device ID. Random sub_id prevents duplicates but cannot be traced to a person.
- **Page views:** which pages are visited (no user identity attached)

The platform does **NOT** collect: real names, email addresses, phone numbers, home addresses, IP addresses, device fingerprints, location data, browsing history, cookies, or any government-issued ID numbers.

---

## 3. Where Data Is Stored

All community data is stored in a Google Sheet owned by the Data Steward's personal Google account. The platform code (HTML, JavaScript, CSS) is hosted on Netlify or Cloudflare Pages. A Firebase read cache may store a copy of public data for faster loading; this cache is rebuilt from the Sheet and can be deleted at any time without data loss.

**The Sheet is the truth. Everything else is a copy.**

---

## 4. Who Can See the Data

- **Community members:** can see all active, non-flagged posts, needs, offers, evaluations, and assessments for their zip code and nearby zip codes.
- **The Data Steward:** can see all data including flagged content and moderation logs.
- **The Platform (NinoTech LLC):** can see aggregated, anonymized summary metrics (counts, averages, patterns) that communities choose to share upward through the federation. The Platform cannot see individual posts, names, or any data the community does not explicitly share.
- **No one else** has access unless the Data Steward grants it by changing the Sheet's sharing settings.

---

## 5. What the Data Can Be Used For

**Permitted uses:**
- Connecting community members with resources, neighbors, and civic opportunities
- Aggregating anonymous health metrics with k≥11 suppression for community health awareness
- Evaluating public officials and community programs
- Generating summary reports for community planning
- Academic research, only with community consent and IRB approval

**Prohibited uses:**
- Selling data to any third party, for any reason, ever
- Using data for advertising, marketing, or commercial targeting
- Sharing individual-level data with law enforcement without a court order
- Using health data to make decisions about individuals (insurance, employment, housing)
- Training AI models on community data without community consent

---

## 6. How the Community Controls Its Data

The community controls its data through the Data Steward. Specifically:

- **The Steward can delete any post, need, or evaluation** that violates community norms
- **The Steward can export all data** from the Google Sheet at any time (File → Download → CSV)
- **The Steward can revoke platform access** by changing the Sheet's sharing settings. This takes one click. No approval from the Platform is needed. No notice period. Immediate.
- **The Steward can move data to a different platform** by exporting the Sheet. The data format is open (CSV/JSON). No vendor lock-in.
- **The community can change Stewards** by transferring Sheet ownership in Google. The outgoing Steward must transfer within 7 days of the community's decision.

---

## 7. How Federation Works

If the community chooses to participate in the federation (connecting with other communities), the following data flows upward:

- Counts: total posts, needs, offers, evaluations
- Averages: resolution rates, pressure scores, participation rates
- Patterns: top need categories, escalation frequency
- **No names. No post content. No individual data.**

The community can leave the federation at any time by removing the MASTER_URL from its Script Properties. This takes 30 seconds. No approval needed.

---

## 8. Health Data Protections

Community Health Pulse data receives extra protection:

- **k≥11 suppression:** if fewer than 11 people in a 3-digit zip prefix contribute, no aggregate is published. This exceeds European Medicines Agency and Health Canada standards.
- **No individual records stored:** only aggregates (averages, percentages) are visible. Raw contributions are stored with random sub_ids that cannot be traced to individuals.
- **Safe Harbor methodology:** zip prefix (not full zip), age range (not exact age), year-month (not exact date). This follows the HIPAA Safe Harbor de-identification standard, adopted voluntarily.
- **No commercial use:** health data will never be sold, licensed, or shared for commercial purposes.

---

## 9. What Happens If This Agreement Is Broken

If the Data Steward violates this agreement:
- Any community member can raise the issue through the discuss or propose tools
- The community can vote to replace the Steward
- The incoming Steward receives Sheet ownership; the outgoing Steward must transfer within 7 days

If the Platform (NinoTech LLC) violates this agreement:
- The community revokes platform access (one click — change Sheet sharing)
- The community retains all its data
- The community can deploy the open-source code independently

If a community member violates community norms:
- The Steward can flag or remove their content
- Repeated violations can result in display name blocks
- No IP bans, device fingerprinting, or technical surveillance

---

## 10. How to Adopt This Agreement

1. A community member proposes adoption through propose.html
2. The community deliberates using the platform's deliberation template
3. If approved, the Data Steward signs below and posts the signed copy to support.html
4. The agreement takes effect immediately
5. Changes to the agreement require the same deliberation process

---

## Signatures

**Data Steward:**

Name: _________________________ Date: _____________

**Community Witness (optional but recommended):**

Name: _________________________ Date: _____________

---

*This document is licensed under CC BY-SA 4.0. Any community may adopt, modify, and redistribute it. Based on the CARE Principles for Indigenous Data Governance, the OCAP® principles, and the Ada Lovelace Institute's practical data trust framework.*

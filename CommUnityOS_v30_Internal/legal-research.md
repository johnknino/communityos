# CommUnity OS — Legal Research Report

**Date:** March 30, 2026
**Prepared for:** Professor John Nino / EquityOS LLC / NinoTech LLC
**Scope:** Data privacy, open source licensing, corporate structure, Illinois/Chicago compliance, governance tool liability
**Disclaimer:** This is research, not legal advice. Consult an attorney before making legal decisions. The Chicago-Kent IP clinic (Prof. Michelle Miller) is the right next step for formal review.

---

## 1. DATA PRIVACY LIABILITY

### HIPAA: Does Not Apply

CommUnity OS is not a covered entity under HIPAA. HIPAA applies only to health plans, healthcare clearinghouses, and healthcare providers who transmit health information electronically in connection with standard transactions (billing, claims). EquityOS LLC is none of these. The platform collects self-reported health metrics (blood pressure, heart rate, glucose, BMI) voluntarily from users — it does not provide healthcare, process claims, or operate as a health plan.

HHS has explicitly stated that consumer health apps collecting data directly from users, rather than on behalf of a covered entity, are not subject to HIPAA. The same heart rate reading is PHI inside a hospital portal but falls outside HIPAA when recorded in a consumer app chosen independently.

**However:** The FTC Health Breach Notification Rule (16 CFR Part 318) DOES apply to non-covered entities that collect health information. If the platform experiences a breach of health data, the FTC requires notification to affected individuals and the FTC within 60 days. This applies even though HIPAA doesn't. The platform's voluntary adoption of Safe Harbor de-identification (3-digit zip prefix, age ranges, k≥11 suppression) is a strong protective measure but doesn't eliminate FTC notification obligations in case of breach.

**Action required:** Add a statement to support.html acknowledging FTC Health Breach Notification Rule applicability. Maintain breach notification procedure in Data Steward documentation.

### CCPA/CPRA: Does Not Apply

The California Consumer Privacy Act applies only to for-profit businesses that meet at least one threshold: $26.625M+ annual revenue, buying/selling personal info of 100K+ consumers, or deriving 50%+ revenue from selling personal information. EquityOS LLC meets none of these. Additionally, CCPA explicitly does not apply to nonprofit organizations. Even if the LLC operates as a for-profit entity, revenue is $0 and no personal information is sold.

If CommUnity OS transitions to HCB fiscal sponsorship (501(c)(3) equivalent), the exemption strengthens further.

**Action required:** None for California. But note: Colorado, Connecticut, Virginia, and other state privacy laws DO apply to nonprofits in some cases. Colorado Privacy Act has no nonprofit exemption. If the platform operates nationally, monitor state-by-state privacy law expansion.

### COPPA: Low Risk, But Monitor

COPPA applies to operators of commercial websites directed at children under 13 that collect personal information. Two key exemptions protect CommUnity OS:

1. **Nonprofit exemption:** COPPA explicitly excludes nonprofit entities exempt under Section 5 of the FTC Act. If operating under HCB fiscal sponsorship (501(c)(3)), this exemption applies.
2. **No personal information collected from children:** The platform collects display names (not real names), zip codes, and optional health metrics. No email, no account, no persistent identifier tied to identity. COPPA's definition of "personal information" includes name, email, address, phone, SSN, and persistent identifiers — the platform collects none of these in a form linkable to a specific child.

**Risk factor:** The platform has no age gate. A child under 13 could enter a display name and zip code and post to the discussion board. While this is minimal personal information, the FTC has taken enforcement action against platforms that had "actual knowledge" of children's use without obtaining parental consent.

**Action required:** Add a Terms of Use statement: "This platform is intended for users 13 and older." This is not an age gate (which would trigger COPPA data collection requirements) but establishes that the site is not "directed at" children. This is standard practice for general-audience platforms.

### FERPA: Does Not Apply

FERPA applies to educational institutions receiving federal funding. CommUnity OS is not an educational institution and does not access student education records. Even though Professor Nino works at a CCC institution, the platform operates independently of CCC and does not collect student records.

---

## 2. OPEN SOURCE LICENSING

### Current Structure

- **Code:** MIT License (planned)
- **Content (guides, templates, documentation):** CC BY-SA 4.0 (planned)
- **User-submitted content (posts, needs, evaluations):** Unaddressed

### The MIT + CC BY-SA Combination

This is a well-established dual-licensing pattern. MIT covers the code (HTML, JavaScript, CSS, Apps Script). CC BY-SA 4.0 covers the written content (knowledge guides, Data Trust template, RWJF narrative, documentation). The two licenses are compatible — MIT is more permissive (allows commercial use, no share-alike requirement), while CC BY-SA requires derivative content works to maintain the same license.

**No conflict.** A developer can fork the code under MIT and create a proprietary version. But if they modify the knowledge guides, the modified guides must remain CC BY-SA. This is intentional — the code is infrastructure (should spread freely), the content is community knowledge (should stay open).

### User-Generated Content: The Gap

When a user posts a discussion, files a need, or submits an evaluation, who owns that content? Without a Terms of Use or Contributor License Agreement, the user retains full copyright over their post. This means:

- You cannot republish their post outside the platform without their permission
- You cannot include their evaluation data in a research publication without consent
- You cannot license their content to a third party
- Another community forking the platform cannot take the discussion data with them

**Action required:** Add a Terms of Use page that includes a content license grant. Recommended language: "By posting content to CommUnity OS, you grant the platform and its community a non-exclusive, royalty-free, perpetual license to display, reproduce, and distribute your content within the platform and its federated network. You retain ownership of your content and may delete it at any time." This is standard for community platforms and consistent with the CARE/OCAP governance model.

### Copyright Registration

Copyright filings were made March 6-7, 2026 (Form TX, 4 filings, $270). These protect the original authored works (CLEAR Cycle, OLP, etc.). The knowledge guides, Session Guide architecture, and N→B→F scaffold descriptions are protected as authored works. The MIT License does not waive copyright — it grants permissions while retaining ownership.

---

## 3. CORPORATE STRUCTURE AND LIABILITY

### Current: EquityOS LLC (IL SOS #1774294414921913)

An LLC provides personal liability protection — if someone sues the platform, they sue the LLC, not John Nino personally. This is the most important legal protection currently in place.

**Key concern:** The LLC is a single-member LLC. Illinois courts can "pierce the corporate veil" of a single-member LLC if the member treats LLC assets and personal assets as interchangeable. To maintain protection:

- Keep a separate bank account for the LLC
- Don't commingle personal and LLC funds
- Document LLC decisions in writing
- File the annual report with IL Secretary of State on time

### Planned: HCB Fiscal Sponsorship

Hack Club Bank provides 501(c)(3) fiscal sponsorship, meaning donations to CommUnity OS become tax-deductible without forming a separate 501(c)(3). The LLC continues to hold IP. HCB handles financial administration.

**Structure:** EquityOS LLC (IP holder) → licenses code/content under MIT/CC BY-SA → CommUnity OS project (under HCB fiscal sponsorship) → accepts donations → funds operations.

This is a clean separation: the LLC protects IP, the fiscal sponsorship enables fundraising, and the open-source licenses ensure the platform survives either entity.

**Risk factor:** If the LLC holds IP and the fiscal sponsorship project operates the platform, ensure the relationship is documented. A simple MOU between EquityOS LLC and the HCB-sponsored project clarifying that the LLC licenses the IP to the project under MIT/CC BY-SA terms is sufficient.

### Why Not 501(c)(3)?

Forming a standalone 501(c)(3) costs $2,000-5,000 in legal and filing fees, requires a board of directors, annual Form 990 filings, and ongoing compliance. HCB fiscal sponsorship provides the same tax-deductible donation capability with none of the overhead. The 501(c)(3) path makes sense only if annual donations exceed $50K or if a major funder requires it.

---

## 4. ILLINOIS AND CHICAGO COMPLIANCE

### Illinois Personal Information Protection Act (PIPA)

PIPA requires any "data collector" handling Illinois residents' personal information (defined as first name or initial + last name combined with SSN, driver's license, financial account number, or biometric data) to notify affected individuals and the IL Attorney General in case of breach.

**CommUnity OS does not collect any of the triggering data elements.** No SSN. No driver's license. No financial account numbers. No biometric data in the PIPA-defined sense (fingerprints, retina scans). Display names are self-chosen pseudonyms, not legal names.

**However:** If the Community Health Pulse ever stores identifiable health data (it currently doesn't — only aggregated metrics with random sub_ids), PIPA's medical information provision could apply.

**Action required:** None currently. Maintain the architecture decision: no real names, no financial data, no biometric identifiers. The current design sidesteps PIPA entirely.

### Illinois Biometric Information Privacy Act (BIPA)

BIPA is the strongest biometric privacy law in the country, with a private right of action and statutory damages of $1,000 per negligent violation and $5,000 per intentional violation.

**Risk factor:** The vitals.html camera PPG (heart rate from fingertip camera) captures video frames from the user's camera. BIPA defines biometric identifiers as "retina or iris scan, fingerprint, voiceprint, or scan of hand or face geometry." A fingertip camera reading for heart rate does NOT fall under BIPA's definition — it's not a fingerprint scan, it's a photoplethysmography signal measuring blood volume changes. BIPA applies to identifiers used to authenticate an individual. The PPG signal cannot identify a person.

**However:** Exercise caution. BIPA litigation is aggressive in Illinois. If the camera feature ever captures face data (even inadvertently), BIPA would apply. The current implementation only accesses the rear camera on a fingertip — ensure the UI never prompts or enables facial capture.

**Action required:** Add explicit camera permission language: "This feature uses your phone's camera to measure your heart rate from your fingertip. No images are stored, transmitted, or used for identification. The camera feed is processed locally and discarded."

### Chicago Municipal Code

No Chicago ordinance specifically regulates civic technology platforms. The Chicago Data Practices Ordinance applies to city government data practices, not private platforms. The platform's use of Chicago 311 API data and chicago.gov health inspection data is governed by the City's open data terms (generally permissive for non-commercial use).

---

## 5. GOVERNANCE TOOL LIABILITY

### The Evaluation, Assessment, and Audit Tools

evaluate.html allows residents to score public officials on five dimensions. assess.html allows scoring of community programs. audit.html allows scoring against published criteria. propose.html allows policy proposals with voting.

### Section 230 Protection

Section 230 of the Communications Decency Act provides that "no provider or user of an interactive computer service shall be treated as the publisher or speaker of any information provided by another information content provider." CommUnity OS is an interactive computer service. Evaluations, assessments, and audit scores are user-generated content.

Under three decades of case law (Zeran v. AOL, Blumenthal v. Drudge, Batzel v. Smith), platforms hosting user-generated opinions about public figures have robust immunity. The evaluation tool is functionally identical to Yelp reviews, Glassdoor ratings, or Rate My Professor — all of which are protected under Section 230.

**Key distinction:** Section 230 protects the PLATFORM from liability for user-generated content. It does NOT protect the USER who posts defamatory content. If a resident posts a false statement of fact about an alderperson (e.g., "Alderman X stole $50,000 from the ward fund"), the user could be sued for defamation. The platform cannot.

### Public Officials and Defamation

Under New York Times v. Sullivan (1964), public officials can only succeed in a defamation claim if they prove "actual malice" — that the speaker knew the statement was false or acted with reckless disregard for the truth. This is an extraordinarily high bar. Elected officials are definitionally public officials.

Opinions are not actionable as defamation. "I think the alderman is terrible" is protected speech. "The alderman scored 1 out of 3 on transparency" is a subjective evaluation — also protected. "The alderman stole money" without evidence is a potentially defamatory statement of fact.

The evaluation tool's design is protective: it uses numeric scales (0-3) with defined criteria (promises, listening, transparency, results, fairness). These are opinion-based assessments, not statements of fact. The open-text "notes" field is the only area where a user could make a factual claim that could be defamatory.

**Action required:** Add a disclaimer to the evaluation form: "Your evaluation reflects your personal experience and opinion. Do not make statements you know to be false." This doesn't provide legal immunity but establishes good faith.

### Moderation and "Good Samaritan" Protection

Section 230(c)(2) provides additional protection for platforms that moderate content in good faith. The Data Steward's ability to flag and remove content is protected under this provision. The platform cannot lose Section 230(c)(1) protection by moderating content — this is the exact problem Section 230 was designed to solve (the Stratton Oakmont v. Prodigy problem).

---

## 6. SUMMARY: RISK MATRIX

| Area | Risk Level | Status | Action Required |
|------|-----------|--------|----------------|
| HIPAA | ✅ None | Does not apply (non-covered entity) | Note FTC Breach Notification Rule |
| CCPA | ✅ None | Does not apply (under all thresholds) | Monitor state-by-state expansion |
| COPPA | ⚠️ Low | Likely exempt (no personal info, no child targeting) | Add "intended for 13+" statement |
| FERPA | ✅ None | Does not apply | None |
| Illinois PIPA | ✅ None | No triggering data collected | Maintain architecture decisions |
| Illinois BIPA | ⚠️ Low | Camera PPG is not biometric identifier | Add camera disclosure language |
| FTC Health Breach | ⚠️ Medium | Applies to health data breaches | Document breach procedure |
| Section 230 | ✅ Strong | User content protected | Maintain moderation capability |
| Defamation risk (platform) | ✅ Low | Section 230 + opinion-based design | Add evaluation disclaimer |
| Defamation risk (users) | ⚠️ Medium | Users can post false factual claims | Disclaimer + moderation |
| Open source licensing | ⚠️ Gap | User content not licensed | Add Terms of Use with content license |
| LLC protection | ⚠️ Requires maintenance | Single-member LLC | Separate accounts, annual report |
| Fiscal sponsorship | ⬜ Pending | HCB application not submitted | Submit application, draft MOU |

---

## 7. RECOMMENDED IMMEDIATE ACTIONS

**Before deployment (add to site):**
1. Terms of Use page — age statement ("intended for 13+"), content license grant, disclaimer of warranty, limitation of liability, FTC breach notification acknowledgment
2. Camera disclosure on vitals.html — "No images stored, transmitted, or used for identification"
3. Evaluation disclaimer — "Reflects personal experience and opinion"

**Before open source push:**
4. Add LICENSE file (MIT) to repository root
5. Add content license notice (CC BY-SA 4.0) to knowledge_guides.json header comment and README
6. Ensure no third-party code with incompatible licenses is included

**Before accepting donations:**
7. Submit HCB fiscal sponsorship application
8. Draft MOU between EquityOS LLC and HCB-sponsored project

**Before research publication:**
9. IRB approval (in progress — addresses human subjects consent for any data used in publications)
10. Data Trust Agreement adoption by at least one community

**Consult Chicago-Kent IP clinic (Prof. Michelle Miller) on:**
- LLC operating agreement review
- Trademark filing for "CommUnity OS" and "Normal → Broken → Fix" (~$700 Class 41)
- CBA Local 1600 IP negotiation strategy (expires July 2026)
- Review of Terms of Use before deployment

---

*This research was conducted using web-accessible legal resources including HHS.gov, FTC.gov, the California AG's office, the Illinois General Assembly (ILCS), OWASP, the Congressional Research Service, law review articles, and practitioner guides. It is not a substitute for legal counsel.*

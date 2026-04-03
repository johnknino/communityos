# CommUnity OS Research Synthesis — Six Threads, One Build

**Date:** March 30, 2026
**Method:** Web research + SMOG readability audit + Arnstein mapping + Fishkin criteria analysis
**Purpose:** Turn research findings into platform changes. Not a literature review — a build document.

---

## 1. HEALTH LITERACY — SMOG READABILITY AUDIT

### Finding
Average SMOG grade across all 27 knowledge guides: **10.1** (college sophomore level).
Target per NIH, AMA, and CDC: **6.0** (6th grade) to **8.0** (8th grade maximum).
11 of 27 guides score above 10.0 (10th grade+). Immigration guide scores 13.0.

The vitals.html N→B→F interpretations: SMOG **8.9**. Better than the guides but still above target.

### Why it matters
68% of patients find health brochures "confusing" or "very confusing." Patients who understand materials are 50% more likely to follow medical advice. 62% of minority populations find health materials not culturally relevant or easy to comprehend. 40% of parents who don't understand medication instructions administer them incorrectly.

A mother reads the blood pressure interpretation at 11pm. If she can't parse "your arteries stay narrow and blood pressure stays high — 140/90 or above — that's why it's called the silent killer" she walks away. The memory wasn't returned. It was delivered in a language she couldn't receive.

### Top offenders (polysyllabic words appearing 5+ times)
insurance (31x), disability (10x), immigration (9x), antibiotics (9x), medication (8x), emergency (7x), application (5x), authorization (2x), formulary (2x)

### Simplification map
| Complex word | Simple replacement | Syllable savings |
|---|---|---|
| medication | medicine | 1 |
| approximately | about | 4 |
| immediately | right away | 2 |
| application | form | 3 |
| assistance | help | 2 |
| authorization | approval / OK | 2-4 |
| formulary | drug list | 2 |
| equivalent | same kind | 1 |
| temporarily | for now | 3 |
| consistently | always / often | 2 |
| significantly | a lot | 3 |

### Build action
Rewrite all 27 knowledge guides targeting SMOG ≤ 7.0. Rewrite vitals.html interpretations targeting SMOG ≤ 6.0. Use short sentences (8-12 words average). Replace polysyllabic medical/legal terms with plain equivalents. Keep phone numbers and action steps unchanged. Test with SMOG calculator after revision.

**Priority: HIGHEST.** This affects every person who reads the platform. The research says 50% more people will act on the information if they can understand it.

---

## 2. CIVIC ARC VALIDATION — ARNSTEIN'S LADDER MAPPING

### Finding
Arnstein's Ladder of Citizen Participation (1969, still foundational) maps 8 rungs across 3 tiers:
- **Nonparticipation** (1-2): Manipulation, Therapy
- **Tokenism** (3-5): Informing, Consultation, Placation
- **Citizen Power** (6-8): Partnership, Delegated Power, Citizen Control

CommUnity OS arc maps to Arnstein:
| Platform Stage | Arnstein Rung | Type |
|---|---|---|
| Survive | 3. Informing | Tokenism |
| Understand | 4. Consultation (knowing rights = capacity to consult) | Tokenism |
| Connect | 6. Partnership (mutual aid = power redistribution) | Citizen Power |
| Grow | 7. Delegated Power (food sovereignty = self-governance) | Citizen Power |
| Govern | 8. Citizen Control (evaluate, audit, propose = full governance) | Citizen Power |

### Key insight
The arc doesn't just move people up the ladder — it crosses the **critical threshold** from Tokenism to Citizen Power between Understand and Connect. That's where "knowing your rights" becomes "acting with your neighbors." The Connect stage isn't just a social feature — it's the power transition.

Recent research (2025) finds digital platforms blur Arnstein's static rungs because users can access multiple levels simultaneously. This validates the platform's design: a user can check on their alderman (rung 8) the same day they search for food (rung 3). The arc isn't a prerequisite chain — it's a simultaneous capability stack.

### Build action
Add anonymous page-flow tracking (which pages are visited after which) to understand actual user journeys. Does anyone move from survive → govern? Or do they enter at connect and never visit survive? This data shapes the homepage order. No IRB required — no PII collected, only page-to-page transition counts.

**Priority: MEDIUM.** Shapes future design but doesn't change current function.

---

## 3. DELIBERATION QUALITY — FISHKIN'S FIVE CRITERIA

### Finding
James Fishkin (Stanford Deliberative Democracy Lab) defines five characteristics of legitimate deliberation:
1. **Information** — balanced briefing materials provided before deliberation
2. **Substantive Balance** — arguments from all perspectives answered
3. **Diversity** — representative sample of the affected community
4. **Conscientiousness** — participants weigh merits, not just vote preferences
5. **Equal Consideration** — all arguments considered on merits regardless of source

propose.html currently has: title, description, deadline, voting, delegation.
It's missing: briefing materials, pros/cons structure, impact analysis, expert questions.

Fishkin's research across 100+ deliberative polls in 28 countries shows deliberation with balanced briefing materials reduces polarization, increases respect for opposing views, and produces more evidence-based decisions. Without briefing materials, voting reflects existing bias, not deliberated judgment.

### Build action
Add required fields to proposal template:
- **What problem does this solve?** (problem statement — 2 sentences max)
- **Who benefits?** (who gains)
- **Who might be affected negatively?** (honest tradeoff)
- **What does it cost the community?** (resources, time, money)
- **What happens if we don't do this?** (status quo consequence)

These five fields are the briefing material. They force the proposer to think in N→B→F: what's normal (status quo), what's broken (problem), what's the fix (proposal). The scaffold is already built — the deliberation template IS the scaffold applied to community decision-making.

**Priority: HIGH.** Changes propose.html immediately. Transforms voting from opinion to deliberation.

---

## 4. COMMUNITY DATA TRUSTS — LEGAL STRUCTURE FOR SOVEREIGNTY

### Finding
The Open Data Institute (Hardinges 2020) defines data trusts as independent legal structures that manage data on behalf of communities. The Ada Lovelace Institute (2021) published practical implementation guides. Mozilla's Data Futures Lab funded pilot programs.

Current CommUnity OS governance: Data Governance Charter on support.html + Data Steward role. This is contractual (terms of use), not legal (trust agreement). The enforcement mechanism is "change Sheet sharing settings" — which works technically but has no legal backing.

### Build action
Not a code change. A document change. Draft a Community Data Trust Agreement template that any community can execute. Modeled on the Ada Lovelace practical framework. Include: data controller (community), data steward (custodian), data processor (platform), permitted uses, prohibited uses, termination procedure, dispute resolution.

This becomes a downloadable document on support.html — not a code feature.

**Priority: LOW (for build). HIGH (for grants).** RWJF, Ford Foundation, and NSF CIVIC all value formal data governance structures.

---

## 5. NETWORK EFFECTS AND BRIDGING CAPITAL

### Finding
Granovetter (1973, "The Strength of Weak Ties") demonstrated that novel information flows through weak ties (acquaintances) not strong ties (close friends). Putnam (2000, "Bowling Alone") distinguished bonding capital (within-group) from bridging capital (between-group). Zuckerman (2013, "Rewire") found civic participation requires bridging across different communities.

Current federation: cross-zip queries prioritize geographic adjacency (606xx prefix). This connects similar communities (bonding capital). Pilsen (60608, 82% Hispanic) sees Lawndale (60623, similar demographics) — not Hyde Park (60615, University of Chicago). The platform is optimizing for bonding when the research says civic capacity comes from bridging.

### Build action
Add a "complementary resource" cross-zip query alongside geographic adjacency. If 60608 has 15 unresolved food access needs and 60615 has food pantry capacity — surface that. If 60623 has legal aid requests and 60608 has a legal aid clinic — surface that. The federation should connect communities by what they need and what they offer, not just where they are.

This changes the "Nearby" tab on discuss.html and needs.html from geographic to need-based matching. Requires an additional API query: "find zips with offers matching my zip's needs."

**Priority: MEDIUM.** Requires multi-community data to test. Implementation deferred until second community joins.

---

## 6. CIVIC PARTICIPATION AND HEALTH OUTCOMES

### Finding
Robert Wood Johnson Foundation County Health Rankings: 40% of health outcomes driven by social and economic factors. Kawachi & Berkman (2000): social capital (trust, reciprocity, civic participation) independently predicts health outcomes. Kim & Kawachi (2007): community-level social capital associated with better self-rated health even after controlling for individual-level factors.

CommUnity OS bridges health information (vitals, knowledge guides) with civic participation (evaluate, propose, audit). No existing platform connects these domains. The theoretical claim: civic participation IS a health intervention because it operates through the same social determinants that drive 40% of health outcomes.

### Build action
Not a code change. A grant narrative change. The RWJF application should frame CommUnity OS as a community health intervention, not a civic technology platform. The N→B→F scaffold bridges clinical reasoning (vitals) to civic reasoning (governance) through the same diagnostic architecture. That's the dual-function claim: the platform delivers health information AND develops civic capacity, and the research says both improve health outcomes.

**Priority: HIGH (for funding). Not a build item.**

---

## IMPLEMENTATION PRIORITY

| # | Action | Changes | Impact | Effort |
|---|--------|---------|--------|--------|
| 1 | SMOG simplification of 27 guides + vitals | knowledge_guides.json, vitals.html | Highest — 50% more compliance | 3-4 hours |
| 2 | Deliberation template for propose.html | propose.html (5 new required fields) | High — transforms voting quality | 30 min |
| 3 | Page-flow tracking | shared.js (anonymous transitions) | Medium — shapes future design | 20 min |
| 4 | Community Data Trust template | support.html (downloadable doc) | Low build / High grant | 2 hours |
| 5 | Complementary resource cross-zip | needs.html, discuss.html API | Medium — requires 2+ communities | 1 hour |
| 6 | RWJF grant narrative reframing | Grant application | High funding impact | 1 hour |

---

*The research says the biggest problem isn't the platform's architecture, security, or performance.
It's that the memories are written at college level and the community reads at 6th grade.
Fix that and everything else multiplies.*

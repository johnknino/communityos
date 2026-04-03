# CommUnity OS Federation Protocol v1.0

## Purpose

The Federation Protocol enables independent CommUnity OS deployments to share deidentified civic health intelligence with each other. When Community A discovers that adding housing-specific intake fields reduced unmet housing needs by 40%, Community B — facing the same pattern — can adopt the same intervention without waiting for a top-down decision.

No central authority controls the network. Each community opts in, chooses its sharing level, and can withdraw at any time. The protocol is the mechanism by which Principle 7 (Builder Need Not Operate) becomes operational at network scale.

## Architecture

```
Community A (60608)     Community B (10001)     Community C (90210)
     |                       |                       |
     v                       v                       v
 [D1 Database]          [D1 Database]          [D1 Database]
     |                       |                       |
     v                       v                       v
 [Cron Diagnostic]      [Cron Diagnostic]      [Cron Diagnostic]
     |                       |                       |
     +----------+------------+----------+------------+
                |                       |
                v                       v
        /api/federation/reports    Network Dashboard
         (aggregates all opted-in     (any community
          community reports)           can view)
```

Each community runs its own Cloudflare Worker with its own D1 database. The diagnostic cron runs independently. Federation is a read-only aggregation layer — no community can write to another community's database.

## Sharing Levels

Communities choose one of three levels when they opt in:

| Level | What's shared | Use case |
|-------|--------------|----------|
| `aggregate` | Health score, grade, trend only | Minimum visibility. Good for new communities testing the network. |
| `detailed` | + Failpoint types and strengths | Allows pattern matching across communities. Most useful level. |
| `full` | + Recommended actions and evidence sources | Full transparency. Enables direct intervention adoption. |

## Consent Model

- **Opt-in only.** No community is federated by default.
- **Admin-key gated.** Only the community admin can join or leave the federation.
- **Revocable.** `POST /api/federation/leave` removes the community instantly.
- **No historical retention.** When a community leaves, its data is no longer included in federation queries. Historical reports remain in its own D1 database but are not shared.

## API Endpoints

### Join Federation
```
POST /api/federation/join
{
  "admin_key": "your_admin_key",
  "community": "60608",
  "sharing_level": "detailed"
}
→ { "joined": true, "community": "60608", "sharing_level": "detailed" }
```

### Leave Federation
```
POST /api/federation/leave
{
  "admin_key": "your_admin_key",
  "community": "60608"
}
→ { "left": true, "community": "60608" }
```

### View Network Reports
```
GET /api/federation/reports
→ {
    "network": {
      "communities": 12,
      "avg_health": 68.4,
      "strengthening": 5,
      "weakening": 2,
      "common_failpoints": {
        "unmet_need_accumulation": 7,
        "accountability_gap": 4,
        "engagement_decline": 3
      }
    },
    "communities": [
      {
        "community": "60608",
        "period": "2026-W14",
        "health_score": 72.3,
        "health_grade": "C",
        "trend": "strengthening",
        "failpoints": [...],
        "strengths": [...]
      }
    ],
    "generated_at": "2026-04-02T..."
  }
```

## Network-Level Intelligence

When 5+ communities are federated, the network endpoint computes:

- **Common failpoints**: Which civic failure patterns appear across multiple communities? If `unmet_need_accumulation` in housing appears in 7 of 12 communities, that's a systemic signal, not a local problem.
- **Average health score**: Network-wide civic health baseline.
- **Trajectory distribution**: How many communities are strengthening vs. weakening?
- **Intervention propagation**: When a community's failpoint resolves after adopting a specific action, that resolution is visible to other communities facing the same pattern.

## Privacy Guarantees

1. **No individual data crosses community boundaries.** Federation operates on diagnostic reports, which are already deidentified aggregates with k≥11 suppression.
2. **Community identifiers are zip codes, not names.** No person, organization, or address is ever in a federation report.
3. **CARE Principles applied.** Collective Benefit (the network serves all members). Authority to Control (each community controls its own participation). Responsibility (the protocol is transparent and documented). Ethics (no data extraction, no monetization, no surveillance).
4. **No central database.** Each community's D1 database is sovereign. The federation endpoint queries opted-in communities and aggregates in memory. Nothing is stored centrally.

## Implementation Timeline

- **Phase 1 (Current):** Single-community diagnostics. Cron runs, reports generate, diagnostics.html displays them. Federation table exists but no communities are opted in.
- **Phase 2 (5+ communities):** First federation queries become meaningful. Network dashboard page added.
- **Phase 3 (20+ communities):** Intervention propagation becomes valuable. "Community X resolved this failpoint using this action" signals appear in recommendations.
- **Phase 4 (100+ communities):** Network-level research. Cross-community patterns published as deidentified civic health intelligence. This is the data that doesn't exist anywhere else.

## Relationship to Fluid Democracy Principles

| Principle | Federation Implementation |
|-----------|--------------------------|
| Infrastructure Precedes Authority | The federation protocol exists before any governance structure for the network. Communities self-organize. |
| Legitimacy Composited | Network intelligence is legitimate because it comes from multiple independent community sources, not a single authority. |
| Grievance→Codification | Common failpoints across communities become codified as systemic issues requiring policy response. |
| Access=Framing | Every community sees the same federation data. No community has privileged access to the network. |
| Information Topology | The federation protocol IS the information topology. How diagnostic intelligence flows between communities determines which communities benefit from which innovations. |
| Systems Persist | The protocol outlasts any individual community's participation. Communities join and leave; the network persists. |
| Builder Need Not Operate | The federation protocol is a spec, not a service. Any community can implement it. No central operator required. |

## Cost

$0. Federation uses existing Cloudflare Worker endpoints. No additional infrastructure. No additional API calls (reports are already stored in D1). The only "cost" is the compute time to aggregate reports on federation queries — well within free tier limits.

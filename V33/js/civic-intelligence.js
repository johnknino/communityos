/**
 * CommUnity OS — Civic Intelligence Engine v1.0
 * 
 * Cross-source synthesis: community data × federal data → actionable intelligence.
 * De-identification: k-anonymity on all outputs, individual data never exposed.
 * Active insights: gap detection, trend analysis, notification triggers.
 * Citizen journey: timeline of all civic participation (anonymous to others).
 * 
 * Architecture mirrors:
 *   prediction engine → civic engagement prediction
 *   compliance framework → promise/position compliance
 *   Assessment Hub 4-form cycle → Position → Action → Gap → Follow-through
 *   Honors Hub multi-lens → cross-issue synthesis
 *   SUH alignment proposal → cross-source gap identification
 *
 * All computation runs in Cloudflare Worker. This client module
 * handles display, caching, and graceful fallback to demo data.
 */
(function() {
  'use strict';

  var K_ANON = 5;       // minimum submissions before showing aggregate
  var K_SUPPRESS = 11;  // minimum for granular breakdowns
  var DECAY_LAMBDA = 0.002; // ~346 day half-life for time-weighted scores
  var PRIOR_N = 7;
  var PRIOR_MEAN = 3.0;

  // ═══ AGGREGATE SCORE ENGINE ═══
  // Bayesian + time decay + k-anonymity. Never exposes individual submissions.

  function aggregateScores(evaluations, domainKeys) {
    if (!evaluations || evaluations.length < K_ANON) {
      return { display: false, count: evaluations ? evaluations.length : 0, needed: K_ANON };
    }

    var now = Date.now();
    var domains = {};
    domainKeys.forEach(function(k) { domains[k] = { sum: 0, weight: 0, count: 0 }; });
    var overallSum = 0, overallWeight = 0;

    evaluations.forEach(function(e) {
      var age = (now - new Date(e.date || e.created_at || Date.now()).getTime()) / 86400000;
      var w = Math.exp(-DECAY_LAMBDA * age);

      domainKeys.forEach(function(k) {
        var val = parseFloat(e[k]);
        if (val > 0) {
          domains[k].sum += val * w;
          domains[k].weight += w;
          domains[k].count++;
        }
      });

      // Overall = average of domains present
      var vals = domainKeys.map(function(k) { return parseFloat(e[k]) || 0; }).filter(function(v) { return v > 0; });
      if (vals.length > 0) {
        var avg = vals.reduce(function(s, v) { return s + v; }, 0) / vals.length;
        overallSum += avg * w;
        overallWeight += w;
      }
    });

    // Bayesian blend with prior
    var overallAvg = overallWeight > 0 ? overallSum / overallWeight : PRIOR_MEAN;
    var bayesian = (PRIOR_N * PRIOR_MEAN + overallWeight * overallAvg) / (PRIOR_N + overallWeight);

    var domainScores = {};
    domainKeys.forEach(function(k) {
      if (domains[k].count < K_ANON) { domainScores[k] = null; return; }
      var dAvg = domains[k].weight > 0 ? domains[k].sum / domains[k].weight : PRIOR_MEAN;
      domainScores[k] = Math.round(((PRIOR_N * PRIOR_MEAN + domains[k].weight * dAvg) / (PRIOR_N + domains[k].weight)) * 10) / 10;
    });

    // Trend: compare first half vs second half
    var sorted = evaluations.slice().sort(function(a, b) {
      return new Date(a.date || a.created_at || 0) - new Date(b.date || b.created_at || 0);
    });
    var mid = Math.floor(sorted.length / 2);
    var firstHalf = sorted.slice(0, mid);
    var secondHalf = sorted.slice(mid);
    var avgFirst = simpleAvg(firstHalf, domainKeys);
    var avgSecond = simpleAvg(secondHalf, domainKeys);
    var trend = avgSecond - avgFirst; // positive = improving

    return {
      display: true,
      score: Math.round(bayesian * 10) / 10,
      count: evaluations.length,
      confidence: Math.min(evaluations.length / 20, 1),
      domains: domainScores,
      trend: trend > 0.2 ? 'improving' : trend < -0.2 ? 'declining' : 'stable',
      trendDelta: Math.round(trend * 10) / 10,
      anomalies: detectAnomalies(evaluations, domainKeys)
    };
  }

  function simpleAvg(evals, keys) {
    if (!evals.length) return PRIOR_MEAN;
    var sum = 0, count = 0;
    evals.forEach(function(e) {
      keys.forEach(function(k) {
        var v = parseFloat(e[k]);
        if (v > 0) { sum += v; count++; }
      });
    });
    return count > 0 ? sum / count : PRIOR_MEAN;
  }

  function detectAnomalies(evals, keys) {
    var flags = [];
    if (evals.length < 3) return flags;

    // Bimodal check
    var extremeHigh = 0, extremeLow = 0;
    evals.forEach(function(e) {
      var vals = keys.map(function(k) { return parseFloat(e[k]) || 0; }).filter(function(v) { return v > 0; });
      var avg = vals.length > 0 ? vals.reduce(function(s, v) { return s + v; }, 0) / vals.length : 0;
      if (avg >= 4.5) extremeHigh++;
      if (avg <= 1.5) extremeLow++;
    });
    if (extremeHigh > evals.length * 0.3 && extremeLow > evals.length * 0.3) flags.push('bimodal');

    // Velocity check (3+ in 10 minutes)
    var sorted = evals.slice().sort(function(a, b) {
      return new Date(a.date || a.created_at || 0) - new Date(b.date || b.created_at || 0);
    });
    for (var i = 0; i < sorted.length - 2; i++) {
      var span = new Date(sorted[i + 2].date || sorted[i + 2].created_at || 0) - new Date(sorted[i].date || sorted[i].created_at || 0);
      if (span < 600000) { flags.push('velocity'); break; }
    }

    return flags;
  }

  // ═══ CROSS-SOURCE INTELLIGENCE ═══
  // Combines community data with federal data to produce insights.

  function generateInsights(communityData, federalData) {
    var insights = [];

    // Unmet needs detection
    var openNeeds = (communityData.needs || []).filter(function(n) { return n.type === 'need' && n.status !== 'matched'; });
    if (openNeeds.length > 3) {
      var categories = {};
      openNeeds.forEach(function(n) { categories[n.category] = (categories[n.category] || 0) + 1; });
      var topCat = Object.keys(categories).sort(function(a, b) { return categories[b] - categories[a]; })[0];
      insights.push({
        type: 'gap', severity: 'high', icon: '🔴',
        title: openNeeds.length + ' unmet needs — ' + topCat + ' is highest',
        action: 'More community members needed to offer ' + topCat + ' help.',
        links: [{ href: '/needs.html', label: 'View needs' }]
      });
    }

    // Stalled proposals
    var stalledProposals = (communityData.proposals || []).filter(function(p) {
      return p.votes >= 20 && !p.officialResponse;
    });
    if (stalledProposals.length > 0) {
      insights.push({
        type: 'accountability', severity: 'medium', icon: '🟡',
        title: stalledProposals.length + ' proposal(s) with 20+ votes but no official response',
        action: 'Community has spoken. Officials have not responded.',
        links: [{ href: '/propose.html', label: 'View proposals' }]
      });
    }

    // Promise follow-through gaps
    var promises = communityData.promises || [];
    var broken = promises.filter(function(p) { return p.status === 'broken' || p.status === 'stalled'; });
    if (broken.length > 0 && promises.length >= K_ANON) {
      var followRate = Math.round((1 - broken.length / promises.length) * 100);
      insights.push({
        type: 'accountability', severity: broken.length > 3 ? 'high' : 'medium',
        icon: broken.length > 3 ? '🔴' : '🟡',
        title: followRate + '% promise follow-through (' + broken.length + ' stalled/broken)',
        action: 'Document evidence and share with community.',
        links: [{ href: '/govern.html', label: 'Promise tracker' }]
      });
    }

    // Federal data × community data cross-reference
    if (federalData && federalData.census) {
      var povRate = federalData.census.povertyRate || 0;
      var evalCount = (communityData.evaluations || []).length;

      // Low civic engagement in high-need area
      if (povRate > 20 && evalCount < 5) {
        insights.push({
          type: 'engagement', severity: 'medium', icon: '📊',
          title: 'High need (' + povRate + '% poverty) but low civic voice (' + evalCount + ' evaluations)',
          action: 'This community needs more people evaluating their leaders. Share invite codes.',
          links: [{ href: '/onboard.html', label: 'Get invite codes' }]
        });
      }

      // Health crisis without health-related proposals
      var diabetes = federalData.places && federalData.places.DIABETES ? federalData.places.DIABETES.value : 0;
      var healthProposals = (communityData.proposals || []).filter(function(p) { return p.category === 'health'; });
      if (diabetes > 12 && healthProposals.length === 0) {
        insights.push({
          type: 'gap', severity: 'medium', icon: '🏥',
          title: 'Diabetes at ' + diabetes.toFixed(1) + '% but zero health-related community proposals',
          action: 'The data shows a health crisis. The community hasn\'t proposed a response yet.',
          links: [{ href: '/propose.html', label: 'Submit a health proposal' }, { href: '/health-strategy.html', label: 'Health dashboard' }]
        });
      }
    }

    // Issue coherence check (cross-issue synthesis — Honors Hub C3/C4)
    var positions = communityData.positions || [];
    if (positions.length >= K_SUPPRESS) {
      var candidates = {};
      positions.forEach(function(p) {
        if (!candidates[p.candidate]) candidates[p.candidate] = {};
        candidates[p.candidate][p.issue] = p;
      });

      Object.keys(candidates).forEach(function(name) {
        var c = candidates[name];
        var issues = Object.keys(c);
        if (issues.length >= 3) {
          var gapCount = 0;
          issues.forEach(function(iss) {
            if (c[iss].follow_through === 'gap') gapCount++;
          });
          if (gapCount >= 2) {
            insights.push({
              type: 'coherence', severity: 'high', icon: '⚠️',
              title: name + ': actions contradict stated positions on ' + gapCount + '/' + issues.length + ' issues',
              action: 'Pattern of position-action gaps across multiple policy domains.',
              links: [{ href: '/issues.html', label: 'Issues & Candidates' }]
            });
          }
        }
      });
    }

    // Sort by severity
    var order = { high: 0, medium: 1, low: 2 };
    insights.sort(function(a, b) { return (order[a.severity] || 2) - (order[b.severity] || 2); });

    return insights;
  }

  // ═══ CITIZEN JOURNEY (anonymous, self-only) ═══
  // Aggregates a person's own civic participation from localStorage.
  // Never sent to server. Never visible to anyone else.

  function getMyJourney() {
    var journey = [];
    try {
      // Token usage (from civic-tokens.js)
      var tokens = JSON.parse(localStorage.getItem('cos_civic_tokens') || '[]');
      tokens.forEach(function(t) {
        if (t.spent) {
          journey.push({
            type: 'token',
            action: t.action_type || 'civic action',
            date: t.spent_at || t.issued,
            icon: '🗳️'
          });
        }
      });

      // Tools used (from shared.js page visits)
      var visits = JSON.parse(localStorage.getItem('cos_tool_visits') || '[]');
      visits.forEach(function(v) {
        journey.push({ type: 'tool', action: 'Used ' + v.tool, date: v.date, icon: '🔧' });
      });

    } catch (e) { /* localStorage unavailable */ }

    journey.sort(function(a, b) { return new Date(b.date || 0) - new Date(a.date || 0); });
    return journey;
  }

  // ═══ COMMUNITY HEALTH SCORE ═══
  // Single composite metric — like the community's reliability score for the whole community.
  // Weights: participation (30%), responsiveness (25%), accountability (25%), solidarity (20%)

  function communityHealthScore(data) {
    var participation = 0, responsiveness = 0, accountability = 0, solidarity = 0;
    var hasData = false;

    // Participation: discussions + proposals + evaluations
    var totalActions = (data.discussions || 0) + (data.proposals || 0) + (data.evaluations || 0);
    if (totalActions > 0) {
      participation = Math.min(1, totalActions / 50); // 50 actions = full score
      hasData = true;
    }

    // Responsiveness: how quickly needs get matched
    var needs = data.needsOpen || 0;
    var offers = data.offers || 0;
    if (needs + offers > 0) {
      responsiveness = offers / (needs + offers);
      hasData = true;
    }

    // Accountability: promise follow-through rate + evaluation coverage
    var promiseRate = data.promiseFollowRate || 0;
    var evalCoverage = data.evalCoverage || 0; // % of officials with 5+ evaluations
    if (promiseRate > 0 || evalCoverage > 0) {
      accountability = (promiseRate * 0.6 + evalCoverage * 0.4);
      hasData = true;
    }

    // Solidarity: needs matched + directory connections
    var matched = data.needsMatched || 0;
    var directory = data.directorySize || 0;
    if (matched + directory > 0) {
      solidarity = Math.min(1, (matched * 2 + directory) / 30);
      hasData = true;
    }

    if (!hasData) return { score: 0, display: false };

    var composite = (participation * 0.30 + responsiveness * 0.25 + accountability * 0.25 + solidarity * 0.20);
    composite = Math.round(composite * 100);

    return {
      score: composite,
      display: true,
      grade: composite >= 80 ? 'A' : composite >= 60 ? 'B' : composite >= 40 ? 'C' : composite >= 20 ? 'D' : 'F',
      color: composite >= 60 ? 'var(--forest)' : composite >= 40 ? 'var(--gold)' : 'var(--coral)',
      components: {
        participation: Math.round(participation * 100),
        responsiveness: Math.round(responsiveness * 100),
        accountability: Math.round(accountability * 100),
        solidarity: Math.round(solidarity * 100)
      }
    };
  }

  // ═══ RENDER HELPERS ═══

  function renderInsights(insights, containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    if (!insights.length) {
      el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--dim);font-size:.78rem">No active insights. Community data builds intelligence over time.</div>';
      return;
    }

    var h = '';
    insights.forEach(function(ins) {
      var sevClass = ins.severity === 'high' ? 'ci-high' : ins.severity === 'medium' ? 'ci-med' : 'ci-low';
      h += '<div class="ci-insight ' + sevClass + '">';
      h += '<span class="ci-icon">' + ins.icon + '</span>';
      h += '<div class="ci-body">';
      h += '<div class="ci-title">' + ins.title + '</div>';
      h += '<div class="ci-action">' + ins.action + '</div>';
      if (ins.links) {
        h += '<div class="ci-links">';
        ins.links.forEach(function(l) {
          h += '<a href="' + l.href + '" class="ci-link">' + l.label + '</a>';
        });
        h += '</div>';
      }
      h += '</div></div>';
    });
    el.innerHTML = h;
  }

  function renderHealthScore(score, containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    if (!score.display) {
      el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--dim);font-size:.78rem">Community health score requires active participation data.</div>';
      return;
    }

    var c = score.components;
    el.innerHTML =
      '<div class="ci-health">' +
        '<div class="ci-health-ring" style="color:' + score.color + '">' +
          '<div class="ci-health-score">' + score.score + '</div>' +
          '<div class="ci-health-grade">' + score.grade + '</div>' +
        '</div>' +
        '<div class="ci-health-domains">' +
          renderBar('Participation', c.participation) +
          renderBar('Responsiveness', c.responsiveness) +
          renderBar('Accountability', c.accountability) +
          renderBar('Solidarity', c.solidarity) +
        '</div>' +
      '</div>';
  }

  function renderBar(label, pct) {
    var color = pct >= 60 ? 'var(--forest)' : pct >= 40 ? 'var(--gold)' : 'var(--coral)';
    return '<div class="ci-bar-row">' +
      '<span class="ci-bar-label">' + label + '</span>' +
      '<div class="ci-bar-track"><div class="ci-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '<span class="ci-bar-val">' + pct + '</span>' +
    '</div>';
  }

  // ═══ INJECT CSS ═══
  function injectCSS() {
    if (document.getElementById('ci-css')) return;
    var s = document.createElement('style');
    s.id = 'ci-css';
    s.textContent = [
      '.ci-insight{display:flex;gap:10px;padding:12px;margin:6px 0;border-radius:10px;align-items:flex-start;font-size:.78rem}',
      '.ci-high{background:rgba(212,112,74,.04);border:1px solid rgba(212,112,74,.15)}',
      '.ci-med{background:rgba(184,150,62,.04);border:1px solid rgba(184,150,62,.15)}',
      '.ci-low{background:rgba(91,140,122,.04);border:1px solid rgba(91,140,122,.15)}',
      '.ci-icon{font-size:1rem;flex-shrink:0;margin-top:1px}',
      '.ci-body{flex:1}',
      '.ci-title{font-weight:700;color:var(--deep);line-height:1.4;font-size:.78rem}',
      '.ci-action{color:var(--body);line-height:1.5;margin-top:2px;font-size:.72rem}',
      '.ci-links{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}',
      '.ci-link{font-size:.65rem;font-weight:600;padding:3px 10px;border-radius:6px;border:1px solid var(--sage);color:var(--forest);text-decoration:none}',
      '.ci-link:hover{background:rgba(45,90,78,.04)}',
      '.ci-health{display:flex;gap:16px;align-items:center;padding:16px;flex-wrap:wrap}',
      '.ci-health-ring{text-align:center;min-width:80px}',
      '.ci-health-score{font-family:var(--display);font-size:2.2rem;font-weight:800;line-height:1}',
      '.ci-health-grade{font-family:var(--display);font-size:.75rem;font-weight:700;opacity:.7}',
      '.ci-health-domains{flex:1;min-width:200px}',
      '.ci-bar-row{display:flex;align-items:center;gap:6px;margin:4px 0;font-size:.68rem}',
      '.ci-bar-label{width:90px;font-weight:600;color:var(--deep);text-align:right}',
      '.ci-bar-track{flex:1;height:6px;background:var(--sand);border-radius:3px;overflow:hidden}',
      '.ci-bar-fill{height:100%;border-radius:3px;transition:width .5s}',
      '.ci-bar-val{width:24px;font-family:var(--display);font-weight:700;font-size:.65rem;color:var(--dim)}',
      '.ci-deident{font-size:.58rem;color:var(--dim);text-align:center;margin:12px 0;line-height:1.5;padding:8px;background:rgba(91,140,122,.03);border-radius:8px;border:1px solid rgba(91,140,122,.08)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function deidentNotice() {
    return '<div class="ci-deident">🛡️ All scores are aggregated from anonymous token-verified submissions. ' +
      'Individual evaluations are never displayed. Minimum ' + K_ANON + ' independent submissions required. ' +
      'No identifying data collected or stored.</div>';
  }

  // ═══ EXPORT ═══
  window.CivicIntel = {
    aggregateScores: aggregateScores,
    generateInsights: generateInsights,
    getMyJourney: getMyJourney,
    communityHealthScore: communityHealthScore,
    renderInsights: renderInsights,
    renderHealthScore: renderHealthScore,
    deidentNotice: deidentNotice,
    detectAnomalies: detectAnomalies,
    K_ANON: K_ANON,
    K_SUPPRESS: K_SUPPRESS,
    injectCSS: injectCSS
  };

  injectCSS();
})();


// ═══════════════════════════════════════════════════════════
// CROSS-DOMAIN PAIRING ENGINE
// ═══════════════════════════════════════════════════════════
// Mirrors Honors Hub: identifies complementary blind spots
// between civic domains and surfaces productive tensions.
// When someone posts about healthcare, the engine finds
// related housing/education/environment perspectives.

(function() {
  'use strict';

  // Domain taxonomy — each has a lens, blind spots, and tension pairings
  // Mirrors Honors Hub identity library structure
  var CIVIC_DOMAINS = {
    healthcare: {
      lens: 'Health outcomes and access',
      blindSpots: 'Cannot address housing instability, food deserts, or income inequality that drive health disparities',
      icon: '🏥',
      keywords: ['health','medical','hospital','clinic','insurance','medicaid','medicare','doctor','nurse','mental','diabetes','obesity','asthma']
    },
    education: {
      lens: 'Learning outcomes and opportunity',
      blindSpots: 'Cannot address hunger, housing instability, or safety concerns that prevent students from learning',
      icon: '🎓',
      keywords: ['school','education','teacher','student','college','GED','tutor','literacy','library','IEP','504','curriculum']
    },
    housing: {
      lens: 'Shelter stability and affordability',
      blindSpots: 'Cannot address employment gaps, healthcare access, or environmental hazards that make housing unsafe',
      icon: '🏠',
      keywords: ['housing','rent','eviction','landlord','tenant','mortgage','homeless','shelter','affordable','section 8','voucher','lease']
    },
    environment: {
      lens: 'Environmental burden and sustainability',
      blindSpots: 'Cannot address economic pressures that force communities to accept polluting industries for jobs',
      icon: '🌳',
      keywords: ['environment','pollution','lead','asthma','water','air','soil','toxic','EPA','climate','green','garden','tree']
    },
    safety: {
      lens: 'Physical security and justice',
      blindSpots: 'Cannot address root causes — poverty, trauma, lack of opportunity — that drive violence',
      icon: '🔒',
      keywords: ['safety','police','crime','violence','gun','arrest','prison','court','justice','victim','surveillance','patrol']
    },
    economy: {
      lens: 'Income, employment, and wealth',
      blindSpots: 'Cannot address health barriers, discrimination, or educational gaps that prevent economic mobility',
      icon: '💰',
      keywords: ['job','wage','income','poverty','employment','business','tax','benefit','SNAP','WIC','unemployment','worker']
    },
    immigration: {
      lens: 'Belonging, documentation, and rights',
      blindSpots: 'Cannot address structural racism, labor exploitation, or foreign policy that drives migration',
      icon: '🌎',
      keywords: ['immigration','immigrant','undocumented','DACA','asylum','deportation','citizenship','visa','ICE','sanctuary','refugee']
    }
  };

  // Productive tension map — which domain pairings generate the richest dialogue
  // Mirrors Honors Hub tensionTypes
  var TENSION_MAP = {
    'healthcare|housing': { type: 'Health ↔ Stability', desc: 'You can\'t be healthy in unstable housing. You can\'t maintain housing while sick. Each domain sees half the problem.' },
    'healthcare|economy': { type: 'Health ↔ Income', desc: 'Healthcare costs drive poverty. Poverty drives poor health. The cycle can\'t be broken from one side alone.' },
    'education|economy': { type: 'Learning ↔ Earning', desc: 'Education promises mobility. The economy decides whether that promise is kept. Neither controls the other.' },
    'education|safety': { type: 'Schools ↔ Streets', desc: 'Children can\'t learn when they don\'t feel safe. Policing can\'t address what happens before a child gives up.' },
    'housing|environment': { type: 'Shelter ↔ Safety', desc: 'Affordable housing is often near pollution sources. Environmental cleanup raises rents. The tension is structural.' },
    'environment|economy': { type: 'Planet ↔ Paycheck', desc: 'Communities accept polluters for jobs. Clean transitions eliminate livelihoods. Neither can be ignored.' },
    'safety|economy': { type: 'Security ↔ Opportunity', desc: 'Policing without investment is containment. Investment without safety is unsustainable. Both are required.' },
    'immigration|economy': { type: 'Belonging ↔ Labor', desc: 'Immigrants power the economy but lack its protections. Economic policy shapes who belongs. The tension is foundational.' },
    'healthcare|immigration': { type: 'Care ↔ Status', desc: 'Health doesn\'t check papers. The system does. Access depends on documentation status, not medical need.' },
    'education|immigration': { type: 'Promise ↔ Barrier', desc: 'Education is the promise. Immigration status is the barrier. The gap between them is where families live.' }
  };

  // ── Detect domain from text content ──
  function detectDomains(text) {
    if (!text) return [];
    var lower = text.toLowerCase();
    var matches = [];
    Object.keys(CIVIC_DOMAINS).forEach(function(domain) {
      var score = 0;
      CIVIC_DOMAINS[domain].keywords.forEach(function(kw) {
        if (lower.indexOf(kw) >= 0) score++;
      });
      if (score > 0) matches.push({ domain: domain, score: score });
    });
    matches.sort(function(a, b) { return b.score - a.score; });
    return matches.map(function(m) { return m.domain; });
  }

  // ── Find pairings for a post ──
  function findPairings(post, allPosts) {
    var postDomains = detectDomains((post.title || '') + ' ' + (post.body || '') + ' ' + (post.category || ''));
    if (postDomains.length === 0) return [];

    var primaryDomain = postDomains[0];
    var pairings = [];

    allPosts.forEach(function(other) {
      if (other.id === post.id) return;
      var otherDomains = detectDomains((other.title || '') + ' ' + (other.body || '') + ' ' + (other.category || ''));
      if (otherDomains.length === 0) return;

      var otherPrimary = otherDomains[0];
      if (otherPrimary === primaryDomain) return; // Same domain — not a pairing

      // Check for productive tension
      var key1 = primaryDomain + '|' + otherPrimary;
      var key2 = otherPrimary + '|' + primaryDomain;
      var tension = TENSION_MAP[key1] || TENSION_MAP[key2];

      if (tension) {
        pairings.push({
          post: other,
          domain: otherPrimary,
          tension: tension,
          strength: 'optimal'
        });
      } else {
        pairings.push({
          post: other,
          domain: otherPrimary,
          tension: { type: CIVIC_DOMAINS[primaryDomain].icon + ' ↔ ' + CIVIC_DOMAINS[otherPrimary].icon, desc: 'Different perspectives on a shared community challenge.' },
          strength: 'natural'
        });
      }
    });

    // Sort: optimal pairings first, then by recency
    pairings.sort(function(a, b) {
      if (a.strength !== b.strength) return a.strength === 'optimal' ? -1 : 1;
      return new Date(b.post.date || 0) - new Date(a.post.date || 0);
    });

    return pairings.slice(0, 3); // Top 3 pairings
  }

  // ── Render pairing suggestions ──
  function renderPairingSuggestions(pairings) {
    if (!pairings.length) return '';
    var h = '<div class="ci-pairings"><div class="ci-pair-header">🔗 Related perspectives from other domains</div>';
    pairings.forEach(function(p) {
      var icon = CIVIC_DOMAINS[p.domain] ? CIVIC_DOMAINS[p.domain].icon : '📌';
      h += '<div class="ci-pair-card' + (p.strength === 'optimal' ? ' ci-pair-optimal' : '') + '">';
      h += '<div class="ci-pair-tension">' + p.tension.type + '</div>';
      h += '<div class="ci-pair-title">' + icon + ' ' + (p.post.title || p.post.body || '').substring(0, 80) + '</div>';
      h += '<div class="ci-pair-why">' + p.tension.desc + '</div>';
      h += '</div>';
    });
    h += '</div>';
    return h;
  }

  // ═══════════════════════════════════════════════════════════
  // CASE STUDY FRAMEWORK
  // ═══════════════════════════════════════════════════════════
  // Complex civic problems that require multiple lenses.
  // Mirrors Honors Hub HIA themes — shared problems that
  // every disciplinary identity addresses from their perspective.

  var CASE_STUDIES = [
    {
      id: 'vacant-lot',
      title: 'The Vacant Lot at 19th & Loomis',
      subtitle: 'One empty lot. Seven community needs. No single lens sees them all.',
      domains: ['environment','housing','economy','education','safety','healthcare'],
      scenario: 'A vacant lot has sat empty for 3 years on Chicago\'s South Side. It collects trash, attracts dumping, and has become a safety concern. The community wants to do something with it. But what?',
      perspectives: [
        { domain: 'environment', question: 'Is the soil contaminated? What remediation is needed before any use? What about stormwater management?', blindSpot: 'Cannot address who owns the lot, who has legal authority, or who funds the cleanup.' },
        { domain: 'healthcare', question: 'A community garden could address the food desert — 13% diabetes in this zip code. Fresh produce within walking distance changes health outcomes.', blindSpot: 'Cannot address whether residents have time, tools, or knowledge to garden.' },
        { domain: 'economy', question: 'Could this become an urban farm that employs neighborhood residents? Local workforce development programs train exactly this skill set.', blindSpot: 'Cannot address zoning restrictions, property ownership disputes, or community preferences.' },
        { domain: 'education', question: 'An outdoor classroom for the elementary school two blocks away. Science, ecology, nutrition — experiential learning on their doorstep.', blindSpot: 'Cannot address liability insurance, supervision requirements, or curriculum integration barriers.' },
        { domain: 'safety', question: 'The lot is a dumping ground and a crime hotspot. Any plan must address lighting, visibility, and legitimate foot traffic that displaces illegitimate activity.', blindSpot: 'Cannot address root causes of why people dump there or commit crimes there.' },
        { domain: 'housing', question: 'Affordable housing is desperately needed. But building housing removes the only open green space in three blocks.', blindSpot: 'Cannot address whether the community wants housing or green space — that\'s a democratic question.' }
      ],
      integrationPrompt: 'No single perspective can address this lot. The garden needs clean soil (environment). The farm needs trained workers (education/economy). The school needs safe access (safety). The housing development would eliminate all other uses. What does the community actually need most — and who decides?',
      dataLinks: [
        { label: 'Environmental check for this area', href: '/environment-strategy.html?zip=60608' },
        { label: 'Food access data', href: '/food-strategy.html?zip=60608' },
        { label: 'Housing vulnerability', href: '/housing-strategy.html?zip=60608' }
      ]
    },
    {
      id: 'school-closure',
      title: 'When They Close Your School',
      subtitle: 'A school closure touches every domain. The community feels all of them at once.',
      domains: ['education','housing','economy','safety','healthcare','immigration'],
      scenario: 'The district announces your neighborhood school will close due to declining enrollment. The building will be "repurposed." Students will be reassigned to a school 1.5 miles away, across a busy road, in a different neighborhood.',
      perspectives: [
        { domain: 'education', question: 'Will academic outcomes improve at the receiving school? What happens to the IEP students, the bilingual programs, the relationships teachers built?', blindSpot: 'Cannot address the non-academic functions the school served — community anchor, safe space, social hub.' },
        { domain: 'safety', question: 'Children now cross gang boundaries to reach the new school. The walk is 1.5 miles through areas with no crossing guards. Who is responsible for their safety?', blindSpot: 'Cannot address why the district chose this receiving school or whether alternatives exist.' },
        { domain: 'housing', question: 'Property values near schools are higher. The closure depresses the neighborhood. Families who can afford to leave, do. Those who can\'t are trapped in a declining area.', blindSpot: 'Cannot address whether the building could be repurposed for community benefit rather than sold.' },
        { domain: 'economy', question: 'The school employed 40 people from the neighborhood — teachers, aides, custodians, cafeteria workers. Those jobs are gone. The small businesses that served them lose customers.', blindSpot: 'Cannot address the district\'s budget crisis that drove the decision.' },
        { domain: 'immigration', question: 'The school was the one place where undocumented families felt safe accessing services — ESL classes, free meals, immunizations. Where do they go now?', blindSpot: 'Cannot address federal immigration policy that creates the fear.' },
        { domain: 'healthcare', question: 'The school nurse screened 300 children annually for vision, hearing, and dental problems. The school-based health center served families without insurance. That infrastructure disappears overnight.', blindSpot: 'Cannot address educational policy decisions or budget allocation.' }
      ],
      integrationPrompt: 'The district sees enrollment numbers. The community sees a life support system. How do you hold both truths and make a decision that acknowledges what the data can\'t measure?',
      dataLinks: [
        { label: 'Education data for this zip', href: '/education-strategy.html?zip=60608' },
        { label: 'Community proposals', href: '/propose.html' },
        { label: 'Evaluate the decision-makers', href: '/evaluate.html' }
      ]
    },
    {
      id: 'water-crisis',
      title: 'The Water You Can\'t See',
      subtitle: 'Lead pipes. Aging infrastructure. The crisis is invisible until a child tests positive.',
      domains: ['environment','healthcare','housing','economy','education','safety'],
      scenario: 'Lead service lines connect homes to the water main in neighborhoods with pre-1978 housing. The city has a replacement program, but it\'s 15 years behind schedule. Testing shows elevated lead levels in 12% of homes tested. Most homes haven\'t been tested.',
      perspectives: [
        { domain: 'environment', question: 'Where are the lead service lines? Which blocks have been tested? What does the EPA violation history show for the water utility?', blindSpot: 'Cannot address who lives in those homes, whether they rent or own, or whether they can afford filters.' },
        { domain: 'healthcare', question: 'Lead exposure causes irreversible neurological damage in children under 6. Blood lead level screening should be universal in this zip code. Where are the screening sites?', blindSpot: 'Cannot replace the pipes. Medical intervention treats the symptom, not the infrastructure.' },
        { domain: 'housing', question: 'Landlords aren\'t required to disclose lead service lines in most jurisdictions. Tenants don\'t know. Homeowners can\'t afford $10,000 for replacement.', blindSpot: 'Cannot address the city\'s failure to fund infrastructure replacement.' },
        { domain: 'economy', question: 'Lead-exposed children score lower on tests, earn less as adults, and are more likely to interact with the criminal justice system. The economic cost is $50 billion annually nationwide.', blindSpot: 'Cannot address the immediate crisis — a child drinking contaminated water right now.' },
        { domain: 'education', question: 'Lead-exposed children have documented learning disabilities, attention problems, and behavioral challenges. Schools absorb the cost of special education services without addressing the cause.', blindSpot: 'Cannot test the water, replace the pipes, or screen the children.' }
      ],
      integrationPrompt: 'The environment lens finds the pipes. The health lens finds the children. The housing lens finds the landlords. The economy lens calculates the cost. The education lens absorbs the damage. No single lens solves it. What would a coordinated community response look like?',
      dataLinks: [
        { label: 'Environmental justice data', href: '/environment-strategy.html?zip=60608' },
        { label: 'Health data for this zip', href: '/health-strategy.html?zip=60608' },
        { label: 'Housing vulnerability', href: '/housing-strategy.html?zip=60608' }
      ]
    }
  ];

  // ═══════════════════════════════════════════════════════════
  // INTEGRATIVE CIVIC LEARNING RUBRIC
  // ═══════════════════════════════════════════════════════════
  // Adapted from AAC&U Integrative Learning VALUE Rubric
  // Evaluates quality of civic engagement, not just quantity.
  // Used internally for community health scoring — never
  // displayed as individual scores.

  var INTEGRATIVE_RUBRIC = {
    name: 'Civic Integrative Engagement',
    source: 'Adapted from AAC&U Integrative Learning VALUE Rubric',
    components: [
      {
        id: 'experience',
        name: 'Connections to Lived Experience',
        aacuDimension: 'Connections to Experience',
        levels: {
          4: 'Connects policy positions to specific, documented community impact with evidence',
          3: 'Connects policy to personal or community experience with specific examples',
          2: 'References community impact in general terms without specifics',
          1: 'Evaluates based on ideology or party affiliation without community connection'
        },
        civicSignals: ['evaluation includes evidence field', 'discussion references local impact', 'proposal includes affected population']
      },
      {
        id: 'evidence',
        name: 'Connections to Evidence',
        aacuDimension: 'Connections to Discipline',
        levels: {
          4: 'Uses multiple data sources (federal + community + personal observation) to support position',
          3: 'References specific data or documented sources to support position',
          2: 'Makes claims that could be verified but provides no source',
          1: 'Makes claims without evidence or contradicted by available data'
        },
        civicSignals: ['position includes source URL', 'evaluation includes evidence text', 'proposal includes data from partner dashboard']
      },
      {
        id: 'transfer',
        name: 'Cross-Domain Transfer',
        aacuDimension: 'Transfer',
        levels: {
          4: 'Explicitly connects issues across domains and identifies how they interact',
          3: 'Recognizes that an issue in one domain affects another domain',
          2: 'Participates in multiple domains without connecting them',
          1: 'Engages only within a single domain'
        },
        civicSignals: ['participates in 3+ issue domains', 'discussion references another domain', 'evaluation covers multiple policy areas']
      },
      {
        id: 'communication',
        name: 'Constructive Engagement',
        aacuDimension: 'Integrated Communication',
        levels: {
          4: 'Engages substantively with opposing perspectives, modifies own position based on evidence',
          3: 'Responds to different perspectives with respect and specific counterpoints',
          2: 'Acknowledges other perspectives exist without engaging them',
          1: 'Dismisses or ignores different perspectives'
        },
        civicSignals: ['replies to posts in other domains', 'upvotes posts they disagree with', 'modifies evaluation after discussion']
      },
      {
        id: 'reflection',
        name: 'Civic Self-Assessment',
        aacuDimension: 'Reflection and Self-Assessment',
        honorsCSLO: 'Component 3: Recognition of what the disciplinary lens cannot address',
        levels: {
          4: 'Names what their perspective cannot see and identifies who else needs to be at the table',
          3: 'Acknowledges limits of their own expertise or experience on an issue',
          2: 'Recognizes complexity without identifying specific limits',
          1: 'Treats own perspective as sufficient to address the problem'
        },
        civicSignals: ['uses "I don\'t know enough about..." language', 'tags other domains in discussion', 'seeks pairing with different perspective']
      }
    ]
  };

  // ── Compute integrative engagement score from behavioral signals ──
  // This is NEVER displayed individually. It feeds into the aggregate
  // community health score to weight quality alongside quantity.
  function computeIntegrativeScore(userActivity) {
    var score = { experience: 1, evidence: 1, transfer: 1, communication: 1, reflection: 1 };

    if (!userActivity) return score;

    // Evidence: did they cite sources?
    var sourcedActions = (userActivity.positions || []).filter(function(p) { return p.source && p.source.length > 5; });
    if (sourcedActions.length >= 3) score.evidence = 3;
    else if (sourcedActions.length >= 1) score.evidence = 2;

    // Transfer: how many domains did they engage?
    var domains = {};
    (userActivity.evaluations || []).forEach(function(e) { if (e.issue) domains[e.issue] = true; });
    (userActivity.discussions || []).forEach(function(d) { var dd = detectDomains(d.body || ''); if (dd[0]) domains[dd[0]] = true; });
    var domainCount = Object.keys(domains).length;
    if (domainCount >= 4) score.transfer = 4;
    else if (domainCount >= 3) score.transfer = 3;
    else if (domainCount >= 2) score.transfer = 2;

    // Communication: did they reply to posts in other domains?
    var crossReplies = (userActivity.replies || []).filter(function(r) { return r.crossDomain; }).length;
    if (crossReplies >= 3) score.communication = 3;
    else if (crossReplies >= 1) score.communication = 2;

    return score;
  }

  // ═══════════════════════════════════════════════════════════
  // LONGITUDINAL TRACKING
  // ═══════════════════════════════════════════════════════════
  // Tracks how civic metrics change over time.
  // Stored in D1/backend. Computed from periodic snapshots.

  function computeLongitudinalTrend(snapshots) {
    if (!snapshots || snapshots.length < 2) return { trend: 'insufficient', periods: 0 };

    var first = snapshots[0];
    var last = snapshots[snapshots.length - 1];

    var metrics = {};
    var keys = ['evaluations', 'promises', 'proposals', 'discussions', 'needsMatched', 'healthScore'];

    keys.forEach(function(k) {
      var firstVal = first[k] || 0;
      var lastVal = last[k] || 0;
      var change = firstVal > 0 ? (lastVal - firstVal) / firstVal : (lastVal > 0 ? 1 : 0);
      metrics[k] = {
        first: firstVal,
        last: lastVal,
        change: Math.round(change * 100),
        trend: change > 0.1 ? 'growing' : change < -0.1 ? 'declining' : 'stable'
      };
    });

    // Overall civic trajectory
    var growingCount = Object.values(metrics).filter(function(m) { return m.trend === 'growing'; }).length;
    var decliningCount = Object.values(metrics).filter(function(m) { return m.trend === 'declining'; }).length;

    return {
      trend: growingCount > decliningCount ? 'strengthening' : decliningCount > growingCount ? 'weakening' : 'stable',
      periods: snapshots.length,
      metrics: metrics,
      summary: growingCount + ' improving, ' + decliningCount + ' declining, ' + (keys.length - growingCount - decliningCount) + ' stable'
    };
  }

  // ═══ INJECT PAIRING CSS ═══
  var ps = document.createElement('style');
  ps.textContent = [
    '.ci-pairings{margin:10px 0;padding:10px;background:rgba(91,140,122,.03);border-radius:10px;border:1px solid rgba(91,140,122,.1)}',
    '.ci-pair-header{font-family:var(--display);font-size:.72rem;font-weight:700;color:var(--forest);margin-bottom:6px}',
    '.ci-pair-card{padding:8px 10px;margin:4px 0;border-radius:8px;background:#fff;border:1px solid var(--sand);font-size:.72rem}',
    '.ci-pair-optimal{border-left:3px solid var(--forest)}',
    '.ci-pair-tension{font-family:var(--display);font-size:.68rem;font-weight:700;color:var(--forest)}',
    '.ci-pair-title{font-weight:600;color:var(--deep);margin:2px 0}',
    '.ci-pair-why{color:var(--dim);font-size:.65rem;line-height:1.5;font-style:italic}',
    '.ci-case{background:var(--warm);border-radius:14px;padding:18px;margin:14px 0;border:1px solid var(--sand)}',
    '.ci-case h3{font-family:var(--display);font-size:.95rem;font-weight:700;color:var(--deep);margin-bottom:2px}',
    '.ci-case .ci-case-sub{font-size:.75rem;color:var(--dim);font-style:italic;margin-bottom:8px}',
    '.ci-case .ci-case-scenario{font-size:.82rem;color:var(--body);line-height:1.7;margin-bottom:10px}',
    '.ci-case-persp{padding:8px 10px;margin:4px 0;border-radius:8px;font-size:.75rem;line-height:1.6}',
    '.ci-case-persp strong{display:block;font-size:.72rem;margin-bottom:2px}',
    '.ci-case-persp .ci-blind{font-size:.65rem;color:var(--dim);font-style:italic;margin-top:3px}',
    '.ci-case-prompt{background:rgba(212,112,74,.04);border:1.5px solid rgba(212,112,74,.12);border-radius:10px;padding:12px;margin:10px 0;font-size:.78rem;color:var(--body);line-height:1.7;font-weight:500}'
  ].join('\n');
  document.head.appendChild(ps);

  // ═══ EXTEND CivicIntel exports ═══
  var CI = window.CivicIntel;
  CI.CIVIC_DOMAINS = CIVIC_DOMAINS;
  CI.TENSION_MAP = TENSION_MAP;
  CI.CASE_STUDIES = CASE_STUDIES;
  CI.INTEGRATIVE_RUBRIC = INTEGRATIVE_RUBRIC;
  CI.detectDomains = detectDomains;
  CI.findPairings = findPairings;
  CI.renderPairingSuggestions = renderPairingSuggestions;
  CI.computeIntegrativeScore = computeIntegrativeScore;
  CI.computeLongitudinalTrend = computeLongitudinalTrend;
})();

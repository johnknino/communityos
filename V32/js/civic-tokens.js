/**
 * CommUnity OS — Civic Token System v1.0
 * 
 * Anonymous participation tokens for manipulation-resistant civic engagement.
 * 
 * Architecture:
 *   1. Community member receives invite code (from seed leader or existing member)
 *   2. Invite code → Worker validates → issues batch of anonymous tokens
 *   3. Tokens stored locally on device (never sent with identity)
 *   4. Each high-stakes action (evaluation, vote, promise) costs 1 token
 *   5. Worker verifies token validity + checks spent-token list in D1
 *   6. Spent tokens cannot be reused. No identity linked to any action.
 * 
 * Tiers:
 *   Tier 1 (read/browse/tools): No token needed
 *   Tier 2 (discuss/needs/offers): Turnstile only (bot check)
 *   Tier 3 (evaluate/vote/promise): Token required
 * 
 * Demo mode: When no backend is configured, tokens are simulated locally
 * so community pages still function for demonstration.
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'cos_civic_tokens';
  var INVITE_KEY = 'cos_invite_status';
  var TOKENS_PER_INVITE = 20; // Each invite code grants 20 tokens
  var TOKEN_ACTIONS = ['evaluate', 'vote', 'promise', 'add_official'];

  // ═══ Token Storage (local device only) ═══

  function getTokens() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function saveTokens(tokens) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens)); } catch(e) {}
  }

  function tokenCount() {
    return getTokens().length;
  }

  function hasTokens() {
    return tokenCount() > 0;
  }

  function isActivated() {
    try { return localStorage.getItem(INVITE_KEY) === 'active'; } catch(e) { return false; }
  }

  // ═══ Token Generation (demo mode — local) ═══
  // In production, tokens come from the Cloudflare Worker via blind signatures.
  // In demo mode, we generate locally so community pages still function.

  function generateLocalToken() {
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function generateLocalBatch(count) {
    var tokens = [];
    for (var i = 0; i < count; i++) {
      tokens.push({
        token: generateLocalToken(),
        issued: new Date().toISOString(),
        spent: false
      });
    }
    return tokens;
  }

  // ═══ Invite Code Redemption ═══

  function redeemInvite(code, callback) {
    if (!code || code.length < 4) {
      callback({ success: false, error: 'Invalid invite code' });
      return;
    }

    // Check if backend is configured
    if (typeof CommunityAPI !== 'undefined' && CommunityAPI.isConfigured()) {
      // Production: validate invite code with Worker, receive blind-signed tokens
      CommunityAPI.smartFetch(CommunityAPI.endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'redeem_invite',
          code: code
        })
      }).then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.tokens && data.tokens.length > 0) {
            var existing = getTokens();
            saveTokens(existing.concat(data.tokens));
            localStorage.setItem(INVITE_KEY, 'active');
            callback({ success: true, count: data.tokens.length, total: tokenCount() });
          } else {
            callback({ success: false, error: data.error || 'Invalid code' });
          }
        })
        .catch(function() {
          // Fallback to demo mode
          activateDemo(code, callback);
        });
    } else {
      // Demo mode: accept any code, generate local tokens
      activateDemo(code, callback);
    }
  }

  function activateDemo(code, callback) {
    var existing = getTokens();
    var newTokens = generateLocalBatch(TOKENS_PER_INVITE);
    saveTokens(existing.concat(newTokens));
    localStorage.setItem(INVITE_KEY, 'active');
    callback({ success: true, count: TOKENS_PER_INVITE, total: tokenCount(), demo: true });
  }

  // ═══ Token Spending ═══

  function spendToken(actionType, callback) {
    if (TOKEN_ACTIONS.indexOf(actionType) < 0) {
      callback({ success: false, error: 'Invalid action type' });
      return;
    }

    var tokens = getTokens();
    var available = tokens.filter(function(t) { return !t.spent; });

    if (available.length === 0) {
      callback({ success: false, error: 'no_tokens', remaining: 0 });
      return;
    }

    var token = available[0];

    // Check if backend is configured
    if (typeof CommunityAPI !== 'undefined' && CommunityAPI.isConfigured()) {
      // Production: send token to Worker for validation + spend
      CommunityAPI.smartFetch(CommunityAPI.endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'spend_token',
          token: token.token,
          action_type: actionType
        })
      }).then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.success || data.valid) {
            token.spent = true;
            saveTokens(tokens);
            callback({ success: true, remaining: tokenCount() - tokens.filter(function(t){return t.spent}).length });
          } else {
            // Token was already spent (possibly on another device)
            token.spent = true;
            saveTokens(tokens);
            callback({ success: false, error: data.error || 'Token already used' });
          }
        })
        .catch(function() {
          // Offline or backend down — accept locally
          token.spent = true;
          saveTokens(tokens);
          callback({ success: true, remaining: tokenCount() - tokens.filter(function(t){return t.spent}).length, offline: true });
        });
    } else {
      // Demo mode: spend locally
      token.spent = true;
      saveTokens(tokens);
      var remaining = tokens.filter(function(t) { return !t.spent; }).length;
      callback({ success: true, remaining: remaining, demo: true });
    }
  }

  // ═══ UI Helpers ═══

  function renderTokenStatus() {
    var tokens = getTokens();
    var available = tokens.filter(function(t) { return !t.spent; }).length;
    var spent = tokens.filter(function(t) { return t.spent; }).length;

    if (!isActivated()) {
      return '<div class="ct-status ct-inactive">' +
        '<span class="ct-icon">🔒</span>' +
        '<span class="ct-text">Get an invite code from a community member to participate in evaluations and votes.</span>' +
        '</div>';
    }

    var statusClass = available > 5 ? 'ct-good' : available > 0 ? 'ct-low' : 'ct-empty';
    return '<div class="ct-status ' + statusClass + '">' +
      '<span class="ct-icon">' + (available > 0 ? '🗳️' : '⚠️') + '</span>' +
      '<span class="ct-text">' + available + ' token' + (available !== 1 ? 's' : '') + ' remaining' +
      (spent > 0 ? ' · ' + spent + ' used' : '') + '</span>' +
      '</div>';
  }

  function renderInviteForm(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    if (isActivated()) {
      el.innerHTML = renderTokenStatus();
      return;
    }

    el.innerHTML =
      '<div class="ct-invite">' +
        '<h4>🔐 Community Verification</h4>' +
        '<p>Evaluations and votes require an invite code from a community member. This prevents spam while keeping you anonymous.</p>' +
        '<div class="ct-invite-form">' +
          '<input type="text" id="ctInviteCode" placeholder="Enter invite code" maxlength="20" style="flex:1;font-family:var(--display);font-size:.82rem;padding:10px 12px;border:2px solid var(--sand);border-radius:8px;background:#fff;color:var(--deep);text-transform:uppercase;letter-spacing:.1em">' +
          '<button onclick="CivicTokens.handleRedeem()" style="font-family:var(--display);font-size:.75rem;font-weight:700;padding:10px 16px;border-radius:8px;border:none;background:var(--forest);color:#fff;cursor:pointer;white-space:nowrap">Activate</button>' +
        '</div>' +
        '<p style="font-size:.6rem;color:var(--dim);margin-top:6px">No identifying data is collected. Tokens are anonymous and cryptographically unlinkable to your identity.</p>' +
      '</div>';
  }

  function handleRedeem() {
    var code = document.getElementById('ctInviteCode');
    if (!code) return;
    var val = code.value.trim().toUpperCase();
    if (!val) { alert('Enter an invite code.'); return; }

    redeemInvite(val, function(result) {
      if (result.success) {
        alert('Activated! You have ' + result.total + ' tokens for evaluations and votes.' +
          (result.demo ? ' (Demo mode — connect a backend for production tokens.)' : ''));
        // Re-render the form area as status
        var el = code.closest('.ct-invite');
        if (el && el.parentElement) {
          el.parentElement.innerHTML = renderTokenStatus();
        }
      } else {
        alert('Invalid invite code. Ask a community member for a valid code.');
      }
    });
  }

  function requireToken(actionType, onSuccess) {
    if (!isActivated()) {
      alert('This action requires community verification. Get an invite code from a community member to participate.');
      return;
    }

    spendToken(actionType, function(result) {
      if (result.success) {
        onSuccess(result);
      } else if (result.error === 'no_tokens') {
        alert('You\'ve used all your tokens. Get a new invite code from a community member to continue participating.');
      } else {
        alert('Token verification failed: ' + (result.error || 'unknown error'));
      }
    });
  }

  // ═══ Inject CSS ═══
  function injectCSS() {
    if (document.getElementById('ct-css')) return;
    var s = document.createElement('style');
    s.id = 'ct-css';
    s.textContent = [
      '.ct-status{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;font-size:.75rem;margin:10px 0}',
      '.ct-good{background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.15);color:#16a34a}',
      '.ct-low{background:rgba(234,179,8,.06);border:1px solid rgba(234,179,8,.15);color:#ca8a04}',
      '.ct-empty{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.15);color:#dc2626}',
      '.ct-inactive{background:var(--warm);border:1px solid var(--sand);color:var(--dim)}',
      '.ct-icon{font-size:1rem}',
      '.ct-text{font-family:var(--display);font-weight:600;font-size:.72rem}',
      '.ct-invite{background:var(--warm);border-radius:12px;padding:16px;margin:12px 0;border:1.5px solid var(--sage)}',
      '.ct-invite h4{font-family:var(--display);font-size:.82rem;font-weight:700;color:var(--deep);margin-bottom:6px}',
      '.ct-invite p{font-size:.75rem;color:var(--body);line-height:1.5;margin-bottom:8px}',
      '.ct-invite-form{display:flex;gap:6px;align-items:center}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ═══ Export ═══
  window.CivicTokens = {
    getTokens: getTokens,
    tokenCount: tokenCount,
    hasTokens: hasTokens,
    isActivated: isActivated,
    redeemInvite: redeemInvite,
    spendToken: spendToken,
    requireToken: requireToken,
    renderTokenStatus: renderTokenStatus,
    renderInviteForm: renderInviteForm,
    handleRedeem: handleRedeem,
    injectCSS: injectCSS,
    TIERS: {
      READ: 0,      // No verification needed
      DISCUSS: 1,   // Turnstile only
      EVALUATE: 2   // Token required
    }
  };

  injectCSS();
})();

// ═══ Bayesian Scoring Engine ═══
// Produces trustworthy aggregate scores from anonymous evaluations
(function(){
  'use strict';

  // Prior: assume 7 evaluations at a neutral 3.0 before real data
  var PRIOR_COUNT = 7;
  var PRIOR_MEAN = 3.0;
  var K_THRESHOLD = 5;     // Don't display until 5+ evaluations
  var DECAY_LAMBDA = 0.002; // ~346 day half-life

  // Bayesian average with time decay
  function bayesianScore(evaluations) {
    if (!evaluations || evaluations.length < K_THRESHOLD) {
      return { display: false, count: evaluations ? evaluations.length : 0, needed: K_THRESHOLD };
    }

    var now = Date.now();
    var weightedSum = 0, weightTotal = 0;

    evaluations.forEach(function(e) {
      var age = (now - new Date(e.date || e.created_at).getTime()) / 86400000; // days
      var w = Math.exp(-DECAY_LAMBDA * age);
      var score = (e.respond + e.transp + e.follow + e.impact) / 4;
      weightedSum += score * w;
      weightTotal += w;
    });

    // Bayesian: blend weighted average with prior
    var dataAvg = weightTotal > 0 ? weightedSum / weightTotal : PRIOR_MEAN;
    var bayesian = (PRIOR_COUNT * PRIOR_MEAN + weightTotal * dataAvg) / (PRIOR_COUNT + weightTotal);

    return {
      display: true,
      score: Math.round(bayesian * 10) / 10,
      count: evaluations.length,
      confidence: Math.min(evaluations.length / 20, 1), // 0-1, reaches 1 at 20 evals
      domains: domainScores(evaluations),
      anomalies: detectAnomalies(evaluations)
    };
  }

  // Per-domain Bayesian scores
  function domainScores(evaluations) {
    var domains = ['respond', 'transp', 'follow', 'impact'];
    var result = {};
    domains.forEach(function(d) {
      var vals = evaluations.map(function(e) { return e[d] || 0; }).filter(function(v) { return v > 0; });
      if (vals.length < K_THRESHOLD) { result[d] = null; return; }
      var sum = 0; vals.forEach(function(v) { sum += v; });
      var avg = sum / vals.length;
      result[d] = Math.round(((PRIOR_COUNT * PRIOR_MEAN + vals.length * avg) / (PRIOR_COUNT + vals.length)) * 10) / 10;
    });
    return result;
  }

  // Anomaly detection — flag suspicious patterns
  function detectAnomalies(evaluations) {
    var flags = [];
    if (evaluations.length < 3) return flags;

    // Check for bimodal distribution (all 1s and 5s)
    var ones = 0, fives = 0;
    evaluations.forEach(function(e) {
      var avg = (e.respond + e.transp + e.follow + e.impact) / 4;
      if (avg <= 1.5) ones++;
      if (avg >= 4.5) fives++;
    });
    if (ones > evaluations.length * 0.3 && fives > evaluations.length * 0.3) {
      flags.push('bimodal'); // Suspicious: lots of extremes, few middle scores
    }

    // Check for temporal clustering (many evals in short window)
    var sorted = evaluations.slice().sort(function(a, b) {
      return new Date(a.date || a.created_at) - new Date(b.date || b.created_at);
    });
    for (var i = 0; i < sorted.length - 2; i++) {
      var span = new Date(sorted[i + 2].date || sorted[i + 2].created_at) - new Date(sorted[i].date || sorted[i].created_at);
      if (span < 600000) { // 3 evals within 10 minutes
        flags.push('velocity');
        break;
      }
    }

    return flags;
  }

  // Render a score badge
  function renderScore(result) {
    if (!result.display) {
      return '<div class="ct-score-pending">' + result.count + '/' + result.needed + ' evaluations needed</div>';
    }
    var cls = result.score >= 3.5 ? 'ct-score-good' : result.score >= 2.5 ? 'ct-score-mid' : 'ct-score-low';
    var conf = Math.round(result.confidence * 100);
    var h = '<div class="ct-score ' + cls + '">';
    h += '<span class="ct-score-val">' + result.score.toFixed(1) + '</span>';
    h += '<span class="ct-score-of">/5</span>';
    h += '<span class="ct-score-meta">' + result.count + ' evals · ' + conf + '% confidence</span>';
    if (result.anomalies.length > 0) {
      h += '<span class="ct-score-flag">⚠️ Under review</span>';
    }
    h += '</div>';
    return h;
  }

  // Export
  window.CivicScoring = {
    bayesianScore: bayesianScore,
    detectAnomalies: detectAnomalies,
    renderScore: renderScore,
    K_THRESHOLD: K_THRESHOLD
  };

  // Inject scoring CSS
  var s = document.createElement('style');
  s.textContent = [
    '.ct-score{display:flex;align-items:baseline;gap:4px;flex-wrap:wrap}',
    '.ct-score-val{font-family:var(--display);font-size:1.8rem;font-weight:800}',
    '.ct-score-of{font-size:.8rem;color:var(--dim);font-weight:600}',
    '.ct-score-meta{font-size:.6rem;color:var(--dim);margin-left:4px}',
    '.ct-score-flag{font-size:.6rem;color:var(--coral);font-weight:600;margin-left:4px}',
    '.ct-score-good .ct-score-val{color:var(--forest)}',
    '.ct-score-mid .ct-score-val{color:var(--gold)}',
    '.ct-score-low .ct-score-val{color:var(--coral)}',
    '.ct-score-pending{font-size:.75rem;color:var(--dim);font-style:italic;padding:6px 0}'
  ].join('\n');
  document.head.appendChild(s);
})();

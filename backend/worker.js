/**
 * CommUnity OS — Cloudflare Worker Backend v1.0
 * 
 * Reference implementation of the community API contract.
 * Deploy: npx wrangler deploy
 * 
 * Implements:
 *   POST   /api/posts          Create a post
 *   GET    /api/posts           List posts  
 *   PUT    /api/posts/:id       Update a post
 *   DELETE /api/posts/:id       Delete a post
 *   GET    /api/stats           Community statistics
 */

export default {
  async fetch(request, env) {
    // CORS — allow static frontend to call this
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    };

    try {
      // ═══ POST /api/posts — Create ═══
      if (path === '/api/posts' && request.method === 'POST') {
        const body = await request.json();
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        await env.DB.prepare(
          `INSERT INTO posts (id, type, community, author, title, body, category, status, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
        ).bind(
          id, body.type, body.community || '', body.author || 'Anonymous',
          body.title || '', body.body || '', body.category || '',
          JSON.stringify(body.metadata || {}), now, now
        ).run();

        return new Response(JSON.stringify({ id, created_at: now }), { headers });
      }

      // ═══ GET /api/posts — List ═══
      if (path === '/api/posts' && request.method === 'GET') {
        const type = url.searchParams.get('type') || '';
        const community = url.searchParams.get('community') || '';
        const category = url.searchParams.get('category') || '';
        const status = url.searchParams.get('status') || 'active';
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
        const offset = parseInt(url.searchParams.get('offset') || '0');

        let query = 'SELECT * FROM posts WHERE status = ?';
        let params = [status];

        if (type) { query += ' AND type = ?'; params.push(type); }
        if (community) { query += ' AND community = ?'; params.push(community); }
        if (category) { query += ' AND category = ?'; params.push(category); }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const result = await env.DB.prepare(query).bind(...params).all();

        // Attach replies to each post
        for (const post of result.results) {
          const replies = await env.DB.prepare(
            'SELECT * FROM replies WHERE post_id = ? ORDER BY created_at ASC'
          ).bind(post.id).all();
          post.replies = replies.results;
          if (post.metadata) {
            try { post.metadata = JSON.parse(post.metadata); } catch(e) {}
          }
        }

        return new Response(JSON.stringify({
          posts: result.results,
          total: result.results.length,
          offset
        }), { headers });
      }

      // ═══ PUT /api/posts/:id — Update ═══
      if (path.startsWith('/api/posts/') && request.method === 'PUT') {
        const id = path.split('/').pop();
        const body = await request.json();
        const now = new Date().toISOString();

        // Handle special actions
        if (body.action === 'reply' && body.reply) {
          const replyId = crypto.randomUUID();
          await env.DB.prepare(
            'INSERT INTO replies (id, post_id, author, body, created_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(replyId, id, body.reply.author || 'Anonymous', body.reply.body, now).run();
          return new Response(JSON.stringify({ reply_id: replyId }), { headers });
        }

        if (body.action === 'vote') {
          const dir = body.direction === 'down' ? -1 : 1;
          await env.DB.prepare(
            'UPDATE posts SET votes = votes + ?, updated_at = ? WHERE id = ?'
          ).bind(dir, now, id).run();
          return new Response(JSON.stringify({ voted: true }), { headers });
        }

        // General update
        const updates = [];
        const vals = [];
        if (body.status) { updates.push('status = ?'); vals.push(body.status); }
        if (body.title) { updates.push('title = ?'); vals.push(body.title); }
        if (body.body) { updates.push('body = ?'); vals.push(body.body); }
        if (body.category) { updates.push('category = ?'); vals.push(body.category); }
        updates.push('updated_at = ?'); vals.push(now);
        vals.push(id);

        await env.DB.prepare(
          `UPDATE posts SET ${updates.join(', ')} WHERE id = ?`
        ).bind(...vals).run();

        return new Response(JSON.stringify({ updated: true }), { headers });
      }

      // ═══ DELETE /api/posts/:id ═══
      if (path.startsWith('/api/posts/') && request.method === 'DELETE') {
        const id = path.split('/').pop();
        await env.DB.prepare('DELETE FROM replies WHERE post_id = ?').bind(id).run();
        await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ deleted: true }), { headers });
      }

      // ═══ GET /api/stats ═══
      if (path === '/api/stats' && request.method === 'GET') {
        const community = url.searchParams.get('community') || '';
        let where = "WHERE status = 'active'";
        let params = [];
        if (community) { where += ' AND community = ?'; params.push(community); }

        const counts = await env.DB.prepare(
          `SELECT type, COUNT(*) as count FROM posts ${where} GROUP BY type`
        ).bind(...params).all();

        const recent = await env.DB.prepare(
          `SELECT type, title, author, created_at FROM posts ${where} ORDER BY created_at DESC LIMIT 10`
        ).bind(...params).all();

        const total = await env.DB.prepare(
          `SELECT COUNT(*) as total FROM posts ${where}`
        ).bind(...params).first();

        return new Response(JSON.stringify({
          total: total?.total || 0,
          by_type: counts.results,
          recent: recent.results
        }), { headers });
      }

      // ═══ POST /api/tokens/redeem — Redeem invite code, issue tokens ═══
      if (path === '/api/tokens/redeem' && request.method === 'POST') {
        const body = await request.json();
        const code = (body.code || '').toUpperCase().trim();
        
        // Validate invite code
        const invite = await env.DB.prepare(
          'SELECT * FROM invite_codes WHERE code = ? AND uses_remaining > 0 AND active = 1'
        ).bind(code).first();
        
        if (!invite) {
          return new Response(JSON.stringify({ error: 'Invalid or expired invite code' }), { status: 400, headers });
        }
        
        // Generate anonymous tokens (blind-signed in production, random in MVP)
        const tokens = [];
        const batchSize = invite.tokens_per_use || 20;
        for (let i = 0; i < batchSize; i++) {
          const tokenBytes = new Uint8Array(32);
          crypto.getRandomValues(tokenBytes);
          const token = Array.from(tokenBytes, b => b.toString(16).padStart(2, '0')).join('');
          tokens.push({ token, issued: new Date().toISOString() });
          
          // Pre-register token as valid
          await env.DB.prepare(
            'INSERT INTO valid_tokens (token_hash, issued_at) VALUES (?, ?)'
          ).bind(token, new Date().toISOString()).run();
        }
        
        // Decrement invite uses
        await env.DB.prepare(
          'UPDATE invite_codes SET uses_remaining = uses_remaining - 1, last_used = ? WHERE code = ?'
        ).bind(new Date().toISOString(), code).run();
        
        // Generate child invite codes for the new member
        const childCodes = [];
        const childCount = invite.child_codes || 3;
        for (let i = 0; i < childCount; i++) {
          const codeBytes = new Uint8Array(4);
          crypto.getRandomValues(codeBytes);
          const childCode = Array.from(codeBytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
          await env.DB.prepare(
            'INSERT INTO invite_codes (code, parent_code, uses_remaining, tokens_per_use, child_codes, active, created_at) VALUES (?, ?, 1, 20, 2, 1, ?)'
          ).bind(childCode, code, new Date().toISOString()).run();
          childCodes.push(childCode);
        }
        
        return new Response(JSON.stringify({ 
          tokens, 
          your_invite_codes: childCodes,
          message: 'Share these invite codes with community members you trust.'
        }), { headers });
      }

      // ═══ POST /api/tokens/spend — Validate and spend a token ═══
      if (path === '/api/tokens/spend' && request.method === 'POST') {
        const body = await request.json();
        const token = body.token || '';
        const actionType = body.action_type || '';
        
        if (!token || !actionType) {
          return new Response(JSON.stringify({ error: 'Token and action_type required' }), { status: 400, headers });
        }
        
        // Check if token exists and hasn't been spent
        const valid = await env.DB.prepare(
          'SELECT * FROM valid_tokens WHERE token_hash = ? AND spent = 0'
        ).bind(token).first();
        
        if (!valid) {
          return new Response(JSON.stringify({ valid: false, error: 'Token invalid or already spent' }), { headers });
        }
        
        // Mark as spent
        await env.DB.prepare(
          'UPDATE valid_tokens SET spent = 1, spent_at = ?, action_type = ? WHERE token_hash = ?'
        ).bind(new Date().toISOString(), actionType, token).run();
        
        return new Response(JSON.stringify({ valid: true, success: true }), { headers });
      }

      // ═══ POST /api/tokens/seed — Create seed invite codes (admin) ═══
      if (path === '/api/tokens/seed' && request.method === 'POST') {
        const body = await request.json();
        const adminKey = body.admin_key || '';
        
        // Simple admin key check (set in wrangler.toml as secret)
        if (adminKey !== (env.ADMIN_KEY || 'civic_infrastructure_2026')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
        }
        
        const count = Math.min(body.count || 5, 20);
        const codes = [];
        for (let i = 0; i < count; i++) {
          const codeBytes = new Uint8Array(4);
          crypto.getRandomValues(codeBytes);
          const code = Array.from(codeBytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
          await env.DB.prepare(
            'INSERT INTO invite_codes (code, parent_code, uses_remaining, tokens_per_use, child_codes, active, created_at) VALUES (?, ?, 10, 20, 3, 1, ?)'
          ).bind(code, 'SEED', new Date().toISOString()).run();
          codes.push(code);
        }
        
        return new Response(JSON.stringify({ seed_codes: codes, message: 'Distribute to community seed leaders.' }), { headers });
      }

      // ═══ GET /api/census/:zip — Census ACS proxy (no CORS issues) ═══
      if (path.startsWith('/api/census/') && request.method === 'GET') {
        const zip = path.split('/')[3];
        if (!/^\d{5}$/.test(zip)) {
          return new Response(JSON.stringify({ error: 'Invalid zip' }), { status: 400, headers });
        }
        // Census ACS 5-year data: income, poverty, education, insurance, language
        const fields = 'B19013_001E,B17001_002E,B17001_001E,B15003_022E,B15003_023E,B15003_024E,B15003_025E,B15003_001E,B27001_005E,B27001_001E,B16001_002E,B16001_001E,B01003_001E';
        const censusUrl = `https://api.census.gov/data/2022/acs/acs5?get=${fields}&for=zip%20code%20tabulation%20area:${zip}`;
        try {
          const resp = await fetch(censusUrl);
          const data = await resp.json();
          if (!data || data.length < 2) {
            return new Response(JSON.stringify({ error: 'No census data for this zip' }), { status: 404, headers });
          }
          const vals = data[1];
          const pop = parseInt(vals[12]) || 1;
          const result = {
            zip: zip,
            population: pop,
            median_income: parseInt(vals[0]) || null,
            poverty_count: parseInt(vals[1]) || 0,
            poverty_universe: parseInt(vals[2]) || 1,
            poverty_rate: ((parseInt(vals[1]) || 0) / (parseInt(vals[2]) || 1) * 100).toFixed(1),
            bachelors_plus: (((parseInt(vals[3])||0)+(parseInt(vals[4])||0)+(parseInt(vals[5])||0)+(parseInt(vals[6])||0)) / (parseInt(vals[7]) || 1) * 100).toFixed(1),
            uninsured_rate: ((parseInt(vals[8]) || 0) / (parseInt(vals[9]) || 1) * 100).toFixed(1),
            english_only_rate: ((parseInt(vals[10]) || 0) / (parseInt(vals[11]) || 1) * 100).toFixed(1),
            source: 'Census ACS 5-Year 2022',
            fetched_at: new Date().toISOString()
          };
          return new Response(JSON.stringify(result), { headers });
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Census API unavailable', detail: e.message }), { status: 502, headers });
        }
      }

      // ═══ GET /api/cdc/:fips — CDC PLACES proxy ═══
      if (path.startsWith('/api/cdc/') && request.method === 'GET') {
        const locId = path.split('/')[3];
        // CDC PLACES uses ZCTA or county FIPS
        const cdcUrl = `https://data.cdc.gov/resource/cwsq-ngmh.json?$where=locationid='${locId}'&$limit=50`;
        try {
          const resp = await fetch(cdcUrl);
          const data = await resp.json();
          if (!data || data.length === 0) {
            return new Response(JSON.stringify({ error: 'No CDC data for this location' }), { status: 404, headers });
          }
          // Reshape into keyed object
          const measures = {};
          data.forEach(function(row) {
            measures[row.measureid || row.measure] = {
              value: parseFloat(row.data_value) || null,
              measure: row.measure || row.measureid,
              category: row.category || '',
              low_ci: parseFloat(row.low_confidence_limit) || null,
              high_ci: parseFloat(row.high_confidence_limit) || null
            };
          });
          return new Response(JSON.stringify({
            location_id: locId,
            measures: measures,
            count: data.length,
            source: 'CDC PLACES',
            fetched_at: new Date().toISOString()
          }), { headers });
        } catch (e) {
          return new Response(JSON.stringify({ error: 'CDC API unavailable', detail: e.message }), { status: 502, headers });
        }
      }

      // ═══ GET /api/diagnostics — Retrieve diagnostic reports ═══
      if (path === '/api/diagnostics' && request.method === 'GET') {
        const community = url.searchParams.get('community') || '';
        const periodType = url.searchParams.get('period_type') || 'weekly';
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '12'), 52);

        const result = await env.DB.prepare(
          'SELECT * FROM diagnostic_reports WHERE community = ? AND period_type = ? ORDER BY created_at DESC LIMIT ?'
        ).bind(community, periodType, limit).all();

        return new Response(JSON.stringify({ reports: result.results || [] }), { headers });
      }

      // ═══ GET /api/diagnostics/latest — Latest report ═══
      if (path === '/api/diagnostics/latest' && request.method === 'GET') {
        const community = url.searchParams.get('community') || '';
        const result = await env.DB.prepare(
          'SELECT * FROM diagnostic_reports WHERE community = ? ORDER BY created_at DESC LIMIT 1'
        ).bind(community).all();

        const report = (result.results || [])[0] || null;
        if (report) {
          // Parse JSON fields
          ['failpoints','strengths','recommended_actions','census_crossref','cdc_crossref','raw_signals'].forEach(function(f) {
            if (report[f]) try { report[f] = JSON.parse(report[f]); } catch(e) {}
          });
        }

        return new Response(JSON.stringify({ report: report }), { headers });
      }

      // ═══ POST /api/diagnostics/run — Manual diagnostic trigger (admin) ═══
      if (path === '/api/diagnostics/run' && request.method === 'POST') {
        const body = await request.json();
        if ((body.admin_key || '') !== (env.ADMIN_KEY || 'civic_infrastructure_2026')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
        }
        const community = body.community || '';
        const report = await runDiagnostics(env, community);
        return new Response(JSON.stringify(report), { headers });
      }

      // ═══ GET /api/failpoints — List failpoint definitions ═══
      if (path === '/api/failpoints' && request.method === 'GET') {
        const result = await env.DB.prepare(
          'SELECT id, name, description, category, nbf_stage, threshold_warn, threshold_critical, recommended_action FROM failpoint_definitions WHERE active = 1'
        ).all();
        return new Response(JSON.stringify({ failpoints: result.results || [] }), { headers });
      }

      // ═══ POST /api/federation/join — Opt community into cross-community sharing ═══
      if (path === '/api/federation/join' && request.method === 'POST') {
        const body = await request.json();
        if ((body.admin_key || '') !== (env.ADMIN_KEY || 'civic_infrastructure_2026')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
        }
        const community = body.community || '';
        const level = body.sharing_level || 'aggregate';
        await env.DB.prepare(
          'INSERT OR REPLACE INTO federation_members (community, sharing_level, joined_at, active) VALUES (?, ?, ?, 1)'
        ).bind(community, level, new Date().toISOString()).run();
        return new Response(JSON.stringify({ joined: true, community: community, sharing_level: level }), { headers });
      }

      // ═══ POST /api/federation/leave — Remove community from federation ═══
      if (path === '/api/federation/leave' && request.method === 'POST') {
        const body = await request.json();
        if ((body.admin_key || '') !== (env.ADMIN_KEY || 'civic_infrastructure_2026')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
        }
        const community = body.community || '';
        await env.DB.prepare(
          'UPDATE federation_members SET active = 0 WHERE community = ?'
        ).bind(community).run();
        return new Response(JSON.stringify({ left: true, community: community }), { headers });
      }

      // ═══ GET /api/federation/reports — Cross-community aggregate (public, deidentified) ═══
      if (path === '/api/federation/reports' && request.method === 'GET') {
        const members = await env.DB.prepare(
          'SELECT community, sharing_level FROM federation_members WHERE active = 1'
        ).all();
        
        const reports = [];
        for (const m of (members.results || [])) {
          const latest = await env.DB.prepare(
            'SELECT community, period, health_score, health_grade, trend, failpoints, strengths FROM diagnostic_reports WHERE community = ? ORDER BY created_at DESC LIMIT 1'
          ).bind(m.community).first();
          
          if (latest) {
            const entry = {
              community: latest.community,
              period: latest.period,
              health_score: latest.health_score,
              health_grade: latest.health_grade,
              trend: latest.trend
            };
            // Only include details if sharing level permits
            if (m.sharing_level === 'detailed' || m.sharing_level === 'full') {
              try { entry.failpoints = JSON.parse(latest.failpoints); } catch(e) {}
              try { entry.strengths = JSON.parse(latest.strengths); } catch(e) {}
            }
            reports.push(entry);
          }
        }
        
        // Compute network-level signals
        const scores = reports.map(function(r){ return r.health_score; }).filter(function(s){ return s != null; });
        const network = {
          communities: reports.length,
          avg_health: scores.length > 0 ? Math.round(scores.reduce(function(a,b){return a+b},0) / scores.length * 10) / 10 : null,
          strengthening: reports.filter(function(r){ return r.trend === 'strengthening'; }).length,
          weakening: reports.filter(function(r){ return r.trend === 'weakening'; }).length,
          common_failpoints: {}
        };
        
        // Aggregate failpoint frequency across communities
        reports.forEach(function(r) {
          (r.failpoints || []).forEach(function(fp) {
            network.common_failpoints[fp.type] = (network.common_failpoints[fp.type] || 0) + 1;
          });
        });
        
        return new Response(JSON.stringify({ network: network, communities: reports, generated_at: new Date().toISOString() }), { headers });
      }

      // ═══ 404 ═══
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  },

  // ═══ SCHEDULED HANDLER — Adaptive Civic Diagnostic Engine ═══
  // Runs weekly via Cloudflare Cron Trigger.
  // Queries community data for civic failure patterns.
  // Produces deidentified diagnostic reports.
  // N→B→F: How is the civic system functioning → Where is it failing → What addresses it.
  async scheduled(event, env, ctx) {
    // Get all active communities
    const communities = await env.DB.prepare(
      'SELECT DISTINCT community FROM posts WHERE community != \'\' GROUP BY community HAVING COUNT(*) >= 5'
    ).all();

    for (const row of (communities.results || [])) {
      ctx.waitUntil(runDiagnostics(env, row.community));
    }
  }
};

// ═══════════════════════════════════════════════════════════
// DIAGNOSTIC ENGINE — Clinical reasoning applied to civic systems
// ═══════════════════════════════════════════════════════════

async function runDiagnostics(env, community) {
  const K_THRESHOLD = 11; // k-anonymity: suppress counts below this
  const now = new Date().toISOString();
  const weekNum = getISOWeek(new Date());
  const year = new Date().getFullYear();
  const period = year + '-W' + String(weekNum).padStart(2, '0');

  // Check if report already exists for this period
  const existing = await env.DB.prepare(
    'SELECT id FROM diagnostic_reports WHERE community = ? AND period = ?'
  ).bind(community, period).first();
  if (existing) return { status: 'already_exists', period: period };

  // ═══ GATHER SIGNALS — Aggregate community activity data ═══
  const signals = {};

  // Activity counts by type (last 30 days vs previous 30 days)
  const current = await env.DB.prepare(
    'SELECT type, COUNT(*) as cnt FROM posts WHERE community = ? AND created_at > datetime(\'now\', \'-30 days\') GROUP BY type'
  ).bind(community).all();

  const previous = await env.DB.prepare(
    'SELECT type, COUNT(*) as cnt FROM posts WHERE community = ? AND created_at BETWEEN datetime(\'now\', \'-60 days\') AND datetime(\'now\', \'-30 days\') GROUP BY type'
  ).bind(community).all();

  signals.current_activity = {};
  signals.previous_activity = {};
  (current.results || []).forEach(function(r) { signals.current_activity[r.type] = r.cnt; });
  (previous.results || []).forEach(function(r) { signals.previous_activity[r.type] = r.cnt; });

  // Total active participants (distinct authors, suppress if < K)
  const authors = await env.DB.prepare(
    'SELECT COUNT(DISTINCT author) as cnt FROM posts WHERE community = ? AND created_at > datetime(\'now\', \'-30 days\')'
  ).bind(community).first();
  signals.active_participants = (authors && authors.cnt >= K_THRESHOLD) ? authors.cnt : 'suppressed';

  // Reply rate (responsiveness)
  const postsWithReplies = await env.DB.prepare(
    'SELECT COUNT(DISTINCT p.id) as replied, (SELECT COUNT(*) FROM posts WHERE community = ? AND created_at > datetime(\'now\', \'-30 days\') AND type IN (\'discuss\',\'need\',\'proposal\')) as total FROM posts p INNER JOIN replies r ON p.id = r.post_id WHERE p.community = ? AND p.created_at > datetime(\'now\', \'-30 days\')'
  ).bind(community, community).first();
  signals.reply_rate = (postsWithReplies && postsWithReplies.total > 0) 
    ? (postsWithReplies.replied / postsWithReplies.total) : 0;

  // ═══ RUN FAILPOINT DETECTION ═══
  const failpoints = [];
  const strengths = [];
  const actions = [];

  // Failpoint 1: Unmet needs (needs with 0 replies after 72h)
  const unmetNeeds = await env.DB.prepare(
    'SELECT category, COUNT(*) as cnt FROM posts WHERE community = ? AND type = \'need\' AND status = \'active\' AND created_at < datetime(\'now\', \'-3 days\') AND id NOT IN (SELECT DISTINCT post_id FROM replies) GROUP BY category HAVING cnt >= 3'
  ).bind(community).all();

  for (const row of (unmetNeeds.results || [])) {
    if (row.cnt >= K_THRESHOLD || row.cnt >= 3) {
      failpoints.push({
        type: 'unmet_need_accumulation',
        category: row.category || 'uncategorized',
        signal: row.cnt + ' needs with zero responses after 72 hours',
        severity: row.cnt >= 10 ? 'critical' : row.cnt >= 5 ? 'high' : 'medium',
        nbf_stage: 'broken'
      });
      actions.push({
        target: 'platform',
        action: 'Surface ' + (row.category || 'general') + ' resources more prominently in knowledge guides',
        failpoint: 'unmet_need_accumulation'
      });
    }
  }

  // Failpoint 2: Accountability gap (proposals with votes but no response)
  const stalledProposals = await env.DB.prepare(
    'SELECT category, COUNT(*) as cnt FROM posts WHERE community = ? AND type = \'proposal\' AND votes >= 5 AND status = \'active\' AND created_at < datetime(\'now\', \'-30 days\') GROUP BY category HAVING cnt >= 1'
  ).bind(community).all();

  for (const row of (stalledProposals.results || [])) {
    failpoints.push({
      type: 'accountability_gap',
      category: row.category || 'uncategorized',
      signal: row.cnt + ' voted proposals with no official response after 30 days',
      severity: row.cnt >= 3 ? 'critical' : 'high',
      nbf_stage: 'broken'
    });
    actions.push({
      target: 'community',
      action: (row.category || 'General') + ' accountability follow-up needed — surface in governance dashboard',
      failpoint: 'accountability_gap'
    });
  }

  // Failpoint 3: Engagement decline
  const currentTotal = Object.values(signals.current_activity).reduce(function(a,b){return a+b}, 0);
  const previousTotal = Object.values(signals.previous_activity).reduce(function(a,b){return a+b}, 0);
  if (previousTotal > 10 && currentTotal < previousTotal * 0.7) {
    const declineRate = ((1 - currentTotal / previousTotal) * 100).toFixed(0);
    failpoints.push({
      type: 'engagement_decline',
      category: 'overall',
      signal: declineRate + '% decline in activity month-over-month',
      severity: currentTotal < previousTotal * 0.5 ? 'critical' : 'medium',
      nbf_stage: 'broken'
    });
    actions.push({
      target: 'community',
      action: 'Review for seasonal patterns. Check if unresolved issues are suppressing participation.',
      failpoint: 'engagement_decline'
    });
  } else if (previousTotal > 0 && currentTotal > previousTotal * 1.2) {
    strengths.push({
      type: 'engagement_growth',
      signal: ((currentTotal / previousTotal - 1) * 100).toFixed(0) + '% increase in community activity'
    });
  }

  // Failpoint 4: Need-offer mismatch
  const needOfferGap = await env.DB.prepare(
    'SELECT n.category, n.cnt as needs, COALESCE(o.cnt, 0) as offers FROM (SELECT category, COUNT(*) as cnt FROM posts WHERE community = ? AND type = \'need\' AND status = \'active\' GROUP BY category) n LEFT JOIN (SELECT category, COUNT(*) as cnt FROM posts WHERE community = ? AND type = \'offer\' AND status = \'active\' GROUP BY category) o ON n.category = o.category WHERE n.cnt > COALESCE(o.cnt, 0) + 3'
  ).bind(community, community).all();

  for (const row of (needOfferGap.results || [])) {
    failpoints.push({
      type: 'resource_gap',
      category: row.category || 'uncategorized',
      signal: row.needs + ' needs vs ' + row.offers + ' offers in ' + (row.category || 'uncategorized'),
      severity: row.needs - row.offers >= 10 ? 'critical' : 'medium',
      nbf_stage: 'broken'
    });
    actions.push({
      target: 'platform',
      action: 'Add targeted offer prompts for ' + (row.category || 'this category') + ' in needs page',
      failpoint: 'resource_gap'
    });
  }

  // Failpoint 5: Promise failures
  const brokenPromises = await env.DB.prepare(
    'SELECT category, COUNT(*) as cnt FROM posts WHERE community = ? AND type = \'promise\' AND metadata LIKE \'%stalled%\' OR metadata LIKE \'%broken%\' GROUP BY category HAVING cnt >= 2'
  ).bind(community).all();

  for (const row of (brokenPromises.results || [])) {
    failpoints.push({
      type: 'promise_failure',
      category: row.category || 'uncategorized',
      signal: row.cnt + ' stalled or broken promises in ' + (row.category || 'uncategorized'),
      severity: row.cnt >= 5 ? 'critical' : 'high',
      nbf_stage: 'broken'
    });
  }

  // ═══ DETECT STRENGTHS ═══
  // High reply rate
  if (signals.reply_rate > 0.7) {
    strengths.push({
      type: 'strong_responsiveness',
      signal: (signals.reply_rate * 100).toFixed(0) + '% of posts receive community responses'
    });
  }

  // Active needs-offers matching
  const resolvedNeeds = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM posts WHERE community = ? AND type = \'need\' AND status = \'resolved\' AND updated_at > datetime(\'now\', \'-30 days\')'
  ).bind(community).first();
  if (resolvedNeeds && resolvedNeeds.cnt >= 5) {
    strengths.push({
      type: 'active_mutual_aid',
      signal: resolvedNeeds.cnt + ' needs resolved in last 30 days'
    });
  }

  // ═══ COMPUTE HEALTH SCORE ═══
  // Participation (30%): based on distinct active authors and activity volume
  const participationRaw = Math.min(currentTotal / 50, 1.0); // 50 posts/month = max
  
  // Responsiveness (25%): reply rate
  const responsivenessRaw = signals.reply_rate;
  
  // Accountability (25%): inverse of failpoints in accountability category
  const accountabilityFailpoints = failpoints.filter(function(f){ return f.type === 'accountability_gap' || f.type === 'promise_failure'; }).length;
  const accountabilityRaw = Math.max(0, 1.0 - accountabilityFailpoints * 0.25);
  
  // Solidarity (20%): need resolution rate + offer activity
  const solidarityRaw = resolvedNeeds && currentTotal > 0 
    ? Math.min((resolvedNeeds.cnt || 0) / Math.max(currentTotal * 0.2, 1), 1.0) : 0.5;

  const healthScore = (
    participationRaw * 30 +
    responsivenessRaw * 25 +
    accountabilityRaw * 25 +
    solidarityRaw * 20
  );

  const healthGrade = healthScore >= 90 ? 'A' : healthScore >= 80 ? 'B' : healthScore >= 70 ? 'C' : healthScore >= 60 ? 'D' : 'F';
  
  // Trend detection
  const prevReport = await env.DB.prepare(
    'SELECT health_score FROM diagnostic_reports WHERE community = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(community).first();
  
  const trend = prevReport 
    ? (healthScore > prevReport.health_score + 3 ? 'strengthening' : healthScore < prevReport.health_score - 3 ? 'weakening' : 'stable')
    : 'baseline';

  // ═══ CENSUS / CDC CROSS-REFERENCE ═══
  let censusData = null;
  let cdcData = null;
  try {
    const censusResp = await fetch('https://api.census.gov/data/2022/acs/acs5?get=B19013_001E,B17001_002E,B17001_001E,B01003_001E&for=zip%20code%20tabulation%20area:' + community);
    const censusJson = await censusResp.json();
    if (censusJson && censusJson.length >= 2) {
      const v = censusJson[1];
      censusData = {
        median_income: parseInt(v[0]) || null,
        poverty_rate: ((parseInt(v[1]) || 0) / (parseInt(v[2]) || 1) * 100).toFixed(1),
        population: parseInt(v[3]) || null
      };
    }
  } catch(e) { /* Census unavailable — continue without */ }

  try {
    const cdcResp = await fetch('https://data.cdc.gov/resource/cwsq-ngmh.json?$where=locationid=\'' + community + '\'&$limit=20');
    const cdcJson = await cdcResp.json();
    if (cdcJson && cdcJson.length > 0) {
      cdcData = {};
      cdcJson.forEach(function(row) {
        cdcData[row.measureid || row.measure] = parseFloat(row.data_value) || null;
      });
    }
  } catch(e) { /* CDC unavailable — continue without */ }

  // ═══ CONVERGENCE DETECTION — same signal in 2+ data sources ═══
  if (censusData && failpoints.length > 0) {
    // Housing needs + poverty rate convergence
    const housingFP = failpoints.find(function(f){ return f.category === 'housing'; });
    if (housingFP && censusData.poverty_rate && parseFloat(censusData.poverty_rate) > 20) {
      housingFP.convergence = 'Community housing needs confirmed by Census poverty rate (' + censusData.poverty_rate + '%)';
      housingFP.severity = 'critical';
      actions.push({
        target: 'upgrade',
        action: 'Add housing-specific intake fields to needs.html. Connect to tenant rights guide.',
        failpoint: 'convergence_housing_poverty',
        evidence: 'community_data + census_acs'
      });
    }

    // Health needs + CDC convergence
    if (cdcData) {
      const healthFP = failpoints.find(function(f){ return f.category === 'health' || f.category === 'healthcare'; });
      const mentalHealth = cdcData['MHLTH'] || cdcData['DEPRESSION'];
      if (healthFP && mentalHealth && mentalHealth > 15) {
        healthFP.convergence = 'Community health needs confirmed by CDC mental health prevalence (' + mentalHealth + '%)';
        healthFP.severity = 'critical';
      }
    }
  }

  // ═══ GENERATE REPORT ═══
  const reportId = crypto.randomUUID();
  const report = {
    id: reportId,
    community: community,
    period: period,
    period_type: 'weekly',
    health_score: Math.round(healthScore * 10) / 10,
    health_grade: healthGrade,
    participation_score: Math.round(participationRaw * 100 * 10) / 10,
    responsiveness_score: Math.round(responsivenessRaw * 100 * 10) / 10,
    accountability_score: Math.round(accountabilityRaw * 100 * 10) / 10,
    solidarity_score: Math.round(solidarityRaw * 100 * 10) / 10,
    trend: trend,
    failpoints: failpoints,
    strengths: strengths,
    recommended_actions: actions,
    census_crossref: censusData,
    cdc_crossref: cdcData,
    raw_signals: signals
  };

  // ═══ STORE REPORT ═══
  await env.DB.prepare(
    'INSERT INTO diagnostic_reports (id, community, period, period_type, health_score, health_grade, participation_score, responsiveness_score, accountability_score, solidarity_score, trend, failpoints, strengths, recommended_actions, census_crossref, cdc_crossref, raw_signals, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    reportId, community, period, 'weekly',
    report.health_score, healthGrade,
    report.participation_score, report.responsiveness_score,
    report.accountability_score, report.solidarity_score,
    trend,
    JSON.stringify(failpoints), JSON.stringify(strengths),
    JSON.stringify(actions),
    JSON.stringify(censusData), JSON.stringify(cdcData),
    JSON.stringify(signals),
    now
  ).run();

  return report;
}

// ISO week number
function getISOWeek(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

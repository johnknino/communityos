/**
 * CommUnity OS — Migration Tool
 * Export data from Apps Script backend → Import to Cloudflare D1
 * 
 * USAGE:
 * 1. Open this file in a browser (or run with Node.js)
 * 2. It fetches all data from the Apps Script endpoint
 * 3. Generates SQL INSERT statements for D1
 * 4. Run the SQL against your D1 database:
 *    npx wrangler d1 execute communityos-db --file=migration-data.sql
 * 
 * AFTER MIGRATION:
 * 1. Update community.json: change backend_url to your Cloudflare Worker URL
 * 2. Change backend_type from "appscript" to "cloudflare"
 * 3. Deploy. Done.
 */

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz4FlOymlifEnmh8wdv8anKVGWXzGGS54_Kd3ulsxUryFb9nLW01ZJYQjv9BoQHHZ0X/exec';
const COMMUNITY = '60608';

async function exportAll() {
  console.log('CommUnity OS — Data Migration');
  console.log('Exporting from Apps Script...\n');

  const sql = ['-- CommUnity OS Migration Data', '-- Generated: ' + new Date().toISOString(), ''];
  let totalRecords = 0;

  // Export discussions
  try {
    const discussions = await fetchJSON(APPS_SCRIPT_URL + '?action=get_discussions&zip=' + COMMUNITY);
    if (Array.isArray(discussions)) {
      console.log(`Discussions: ${discussions.length}`);
      discussions.forEach(d => {
        const id = d.id || crypto.randomUUID();
        sql.push(insertPost(id, 'discuss', COMMUNITY, d.name || d.author || 'Anonymous',
          d.subject || d.title || '', d.body || d.message || d.content || '',
          d.tag || '', 'active', d.upvotes || 0, '{}', d.timestamp || d.created_at || new Date().toISOString()));
        totalRecords++;

        // Export replies
        if (d.replies && Array.isArray(d.replies)) {
          d.replies.forEach(r => {
            sql.push(insertReply(crypto.randomUUID(), id,
              r.name || r.author || 'Anonymous', r.body || r.text || '',
              r.timestamp || r.created_at || new Date().toISOString()));
            totalRecords++;
          });
        }
      });
    }
  } catch(e) { console.log('Discussions: error - ' + e.message); }

  // Export needs/offers
  try {
    const listings = await fetchJSON(APPS_SCRIPT_URL + '?action=get_listings&zip=' + COMMUNITY + '&type=all');
    if (Array.isArray(listings)) {
      console.log(`Needs/Offers: ${listings.length}`);
      listings.forEach(l => {
        const type = l.type === 'offer' ? 'offer' : 'need';
        sql.push(insertPost(l.id || crypto.randomUUID(), type, COMMUNITY,
          l.name || l.author || 'Anonymous', l.title || '',
          l.description || l.body || '', l.category || '',
          l.status || 'active', l.upvotes || 0,
          JSON.stringify({ contact: l.contact || '', urgency: l.urgency || '' }),
          l.timestamp || l.created_at || new Date().toISOString()));
        totalRecords++;
      });
    }
  } catch(e) { console.log('Listings: error - ' + e.message); }

  // Export proposals
  try {
    const proposals = await fetchJSON(APPS_SCRIPT_URL + '?action=get_proposals&zip=' + COMMUNITY);
    if (Array.isArray(proposals)) {
      console.log(`Proposals: ${proposals.length}`);
      proposals.forEach(p => {
        sql.push(insertPost(p.id || crypto.randomUUID(), 'proposal', COMMUNITY,
          p.name || p.author || 'Anonymous', p.title || '',
          p.description || p.body || '', p.category || '',
          p.status || 'active', p.votes_yes || p.upvotes || 0,
          JSON.stringify({ target: p.target || '', budget: p.budget || '' }),
          p.timestamp || p.created_at || new Date().toISOString()));
        totalRecords++;
      });
    }
  } catch(e) { console.log('Proposals: error - ' + e.message); }

  // Export evaluations
  try {
    const evals = await fetchJSON(APPS_SCRIPT_URL + '?action=get_evaluations&leader=all');
    if (Array.isArray(evals)) {
      console.log(`Evaluations: ${evals.length}`);
      evals.forEach(ev => {
        sql.push(insertPost(ev.id || crypto.randomUUID(), 'rating', COMMUNITY,
          ev.name || ev.author || 'Anonymous', ev.leader || ev.subject || '',
          ev.comment || ev.body || '', ev.role || '',
          'active', 0,
          JSON.stringify({ scores: ev.scores || {}, overall: ev.overall || ev.score || 0 }),
          ev.timestamp || ev.created_at || new Date().toISOString()));
        totalRecords++;
      });
    }
  } catch(e) { console.log('Evaluations: error - ' + e.message); }

  console.log(`\nTotal records: ${totalRecords}`);
  console.log('SQL statements generated.\n');

  // Output SQL
  const sqlText = sql.join('\n');
  console.log('--- COPY BELOW THIS LINE ---');
  console.log(sqlText);
  console.log('--- END ---');

  // If in browser, offer download
  if (typeof document !== 'undefined') {
    const blob = new Blob([sqlText], { type: 'text/sql' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'migration-data.sql';
    a.click();
    console.log('Download triggered: migration-data.sql');
  }

  return sqlText;
}

function insertPost(id, type, community, author, title, body, category, status, votes, metadata, created) {
  return `INSERT INTO posts (id, type, community, author, title, body, category, status, votes, metadata, created_at, updated_at) VALUES (${esc(id)}, ${esc(type)}, ${esc(community)}, ${esc(author)}, ${esc(title)}, ${esc(body)}, ${esc(category)}, ${esc(status)}, ${votes}, ${esc(metadata)}, ${esc(created)}, ${esc(created)});`;
}

function insertReply(id, postId, author, body, created) {
  return `INSERT INTO replies (id, post_id, author, body, created_at) VALUES (${esc(id)}, ${esc(postId)}, ${esc(author)}, ${esc(body)}, ${esc(created)});`;
}

function esc(s) {
  if (s === null || s === undefined) return "''";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

async function fetchJSON(url) {
  const r = await fetch(url);
  return r.json();
}

// Auto-run
exportAll().catch(e => console.error('Migration failed:', e));

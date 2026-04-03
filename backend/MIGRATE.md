# Chicago Migration: Apps Script → Cloudflare Workers

## Current State
- community.json points to Apps Script URL
- All community pages use CommunityAPI adapter
- Chicago data lives in Google Sheets

## Migration Steps

### Step 1: Set up Cloudflare (5 minutes)
```bash
# Install wrangler
npm install -g wrangler

# Login to Cloudflare (free account)
wrangler login

# Create the database
npx wrangler d1 create communityos-db
# Copy the database_id from output

# Edit backend/wrangler.toml — paste your database_id

# Create the tables
npx wrangler d1 execute communityos-db --file=backend/schema.sql

# Deploy the worker
cd backend
npx wrangler deploy
# Note your worker URL: https://communityos-backend.YOUR-ACCOUNT.workers.dev
```

### Step 2: Export Chicago data
```bash
# Run the migration script in a browser or Node.js
node backend/migrate.js > migration-data.sql

# Import to D1
npx wrangler d1 execute communityos-db --file=migration-data.sql
```

### Step 3: Switch Chicago to Cloudflare
Edit `data/community.json`:
```json
{
  "backend_url": "https://communityos-backend.YOUR-ACCOUNT.workers.dev/api",
  "backend_type": "cloudflare"
}
```

### Step 4: Deploy
Drag the folder to Netlify. Done.

### Step 5: Verify
- Open /discuss.html — should show existing discussions
- Post a test discussion — should appear
- Open /needs.html — should show existing listings
- Open /dashboard.html — should show community stats

### Rollback
If anything breaks, change community.json back:
```json
{
  "backend_url": "https://script.google.com/macros/s/.../exec",
  "backend_type": "appscript"
}
```
Redeploy. Everything reverts instantly. No data lost on either side.

## After Migration
- Apps Script stays running (backup)
- New data goes to Cloudflare D1
- Data is exportable: `npx wrangler d1 export communityos-db`
- No Google account dependency
- No Apps Script quotas
- Data portable as standard SQLite

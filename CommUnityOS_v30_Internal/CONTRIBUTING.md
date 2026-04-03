# Contributing to CommUnity OS

This platform was built by one person. It should not depend on one person. Here's how you can help carry the memories forward.

---

## Ways to contribute

### 1. Translate a page

Every page has English and Spanish built in. Adding a third language means the platform reaches communities that currently can't use it.

**What you need:** Fluency in the target language. A text editor. That's it.

**How it works:**

Every page has a translation block inside `EQ.init({})`. It looks like this:

```javascript
EQ.init({
  en: {
    title: 'Community Discussion',
    subtitle: 'Talk about what\'s happening...',
  },
  es: {
    title: 'Discusión Comunitaria',
    subtitle: 'Habla de lo que está pasando...',
  }
});
```

To add a new language (e.g., Polish):

1. Copy the `en` block
2. Rename it to the language code (e.g., `pl`)
3. Translate each value
4. Submit the file

The bilingual engine in shared.js already supports language switching. Adding a third language to the toggle requires one line in shared.js.

**Medical and legal content:** If you translate vitals.html, knowledge guides, or rights information, please have a professional in that field review the translation. Medical mistranslation can harm people. Legal mistranslation can cost people their rights.

### 2. Write a knowledge guide

Knowledge guides follow the N→B→F structure. Every guide answers three questions about a system that affects your community:

- **Normal:** How does this system work when everything goes right?
- **Broken:** Where does it fail? What catches people off guard?
- **Fix:** What can you do? Specific steps. Phone numbers. Exact words to say.

**Format:**

```json
{
  "domain": "health|money|rights|power",
  "title": "How [System] Works — and Where [People] Get Stuck",
  "noun": "The noun that completes 'When the _____ Fails'",
  "normal": "2-4 sentences. Plain language. No jargon.",
  "broken": "2-4 sentences. The specific failure mode, not the general concept.",
  "fix": "2-4 sentences. Actionable. Include phone numbers, websites, exact phrases.",
  "action": "One sentence. The single most important thing to do right now.",
  "author": "Your display name and zip code"
}
```

**Add bilingual versions** by including `title_es`, `noun_es`, `normal_es`, `broken_es`, `fix_es`, `action_es` fields.

**Submit** by adding your guide to `data/knowledge_guides.json` or by posting it through the "Contribute a Guide" form on the knowledge page.

**What makes a good guide:**
- Written from experience, not from Google
- Specific to a real situation someone actually faced
- Includes at least one phone number or concrete next step
- Doesn't assume the reader has insurance, a car, English fluency, or internet at home

### 3. Become a Data Steward

Every community needs a Data Steward — a trusted member who maintains the community's Google Sheet.

**What a Data Steward does:**
- Reviews flagged posts (community moderation)
- Verifies resource accuracy (are the phone numbers still working? are the pantry hours current?)
- Updates local information that changes (new food pantry, closed clinic, changed hotline)
- Serves as the community's point of contact with the platform
- Downloads the Sheet as CSV periodically as a community backup

**What a Data Steward does NOT do:**
- Make decisions for the community (that's the community's job)
- Access personal data (there is none)
- Answer to the platform builder (you answer to your neighbors)
- Need technical skills (if you can use a spreadsheet, you can be a Data Steward)

**To become a Data Steward:**
1. Be a member of the community you're stewarding
2. Be nominated or volunteer through the community's discuss board
3. Receive edit access to the community's Google Sheet from the current steward or the community consensus

### 4. Start a new community

Any neighborhood can join. You need:

1. A Google account (personal or Workspace)
2. The CommUnity OS Google Sheet template (create tabs using `initializeCommunity()`)
3. A deployed Apps Script endpoint (paste the .gs files, deploy as web app)
4. 15 minutes to set up and configure

See `Federation_Handshake_Protocol_v1.md` for the complete registration process.

**Your community owns its data from day one.** The hub never stores a copy. You can disconnect at any time.

### 5. Verify content

The most valuable contribution might be the simplest: check whether the information on survive.html is still accurate.

- Is the food pantry phone number still working?
- Did the SNAP threshold change?
- Is the legal aid hotline still staffed in Spanish?
- Did the crisis line change its hours?

One wrong phone number at 11pm can mean someone doesn't get help. Verification saves lives.

### 6. Improve the code

The codebase is intentionally simple. Static HTML, vanilla JavaScript, CSS. No frameworks, no build tools, no package managers.

**Before contributing code, understand why:**
- No React because a community member can View Source and understand it
- No npm because there's no build step to break
- No database because the community can open the Sheet and see their data
- Inline styles exist where a pattern occurs only once — extract only if it repeats 3+ times

**If you improve something:**
- Test on a phone (most users are mobile)
- Test in Spanish (toggle the ES button)
- Test offline (turn off WiFi, reload)
- Test with a screen reader (VoiceOver on Mac, TalkBack on Android)
- Run the test suite (`communityos-test-suite.html`)

---

## Code of conduct

This platform exists because communities decided to take care of each other. Contributions should reflect that.

- Write for the person who needs help, not the person who reviews code
- Translate for the mother reading at 11pm, not the linguist grading accuracy
- Build for the $30 phone on 3G, not the MacBook on fiber
- Document for the person who picks this up after you're gone

---

## What not to contribute

- Tracking, analytics, or any code that identifies individual users
- Features that require an account, email, or login
- Dependencies on paid services
- Content that is political, partisan, or advocates for a specific candidate or party
- AI-generated translations without human review
- Any content that could endanger undocumented community members

---

## The principle behind all of this

How does this work. Where is it failing. What can you do about it.

Apply it to whatever you're contributing. If the answer doesn't follow that shape, it probably doesn't belong here.

---

*CommUnity OS · NinoTech LLC · Chicago, Illinois*
*The memories belong to the community. Help carry them forward.*

// =====================================================================
// SEED CONTENT — Run once after deploying v30
// Creates 5 discussion posts, 3 needs, 2 offers, 1 evaluation
// for zip 60608 (Pilsen) so the platform isn't empty
//
// HOW TO USE:
//   1. Paste into Apps Script editor (temporary tab)
//   2. Run seedCommunity60608()
//   3. Verify posts appear on discuss.html
//   4. Delete this tab (one-time use)
// =====================================================================

function seedCommunity60608() {
  var zip = '60608';
  var now = new Date();
  
  // ── DISCUSSION POSTS ──
  var discussions = [
    {
      name: 'Rosa M.', tag: 'survive', 
      title: 'Free produce boxes at St. Pius V',
      body: 'St. Pius V on Ashland has free produce boxes every Saturday 9-11 AM. No questions asked. They also have canned goods. Line moves fast — I was in and out in 15 minutes. Bring your own bags.'
    },
    {
      name: 'Carlos R.', tag: 'understand',
      title: 'RLTO protections — know before your lease is up',
      body: 'My landlord tried to raise rent by $400 with only 2 weeks notice. Under the RLTO he needed 60 days written notice for my yearly lease. I cited the law and he backed down. Know your rights before they try.'
    },
    {
      name: 'Elena T.', tag: 'connect',
      title: 'Looking for walking group mornings',
      body: 'Anyone interested in a morning walking group? I walk along the Pilsen trail most days 7-8 AM. Would love company. Good for blood pressure too — I just checked mine and it\'s finally down.'
    },
    {
      name: 'Daniel P.', tag: 'govern',
      title: 'Ward meeting next Tuesday — they\'re discussing the vacant lot on 18th',
      body: 'The ward meeting is Tuesday 6 PM at Rudy Lozano Library. They\'re talking about the vacant lot on 18th and Loomis. If we don\'t show up, someone else decides what goes there. Bring neighbors.'
    },
    {
      name: 'José L.', tag: 'survive',
      title: 'Free flu shots at Esperanza clinic through April',
      body: 'Esperanza Health Center on California Ave is doing free flu shots through end of April. No insurance needed. Walk-ins welcome. They also do blood pressure checks and blood sugar tests while you wait.'
    }
  ];
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var discSheet = ss.getSheetByName('Discussions');
  
  discussions.forEach(function(d, i) {
    var ts = new Date(now.getTime() - (i * 3600000 * 12)); // Space out by 12 hours
    var postId = 'D-SEED-' + (i + 1);
    discSheet.appendRow([
      postId, '', zip, d.name, d.tag,
      d.title, d.body, ts.toISOString(), 0, '',
      false, 0, 'active'
    ]);
  });
  Logger.log('Seeded ' + discussions.length + ' discussion posts');
  
  // ── NEEDS ──
  var needs = [
    {
      name: 'Maria G.', category: 'food',
      desc: 'Looking for a food pantry open Saturday mornings near 60608. I work weekdays and can\'t make the weekday-only ones.'
    },
    {
      name: 'Ana S.', category: 'legal',
      desc: 'Need help understanding my lease renewal letter. Landlord is asking me to sign new terms I don\'t fully understand. Looking for free legal advice in Spanish.'
    },
    {
      name: 'Roberto V.', category: 'health',
      desc: 'My mom needs a doctor who speaks Spanish and accepts Medicaid in the Pilsen area. She\'s 67 and needs regular checkups.'
    }
  ];
  
  var needsSheet = ss.getSheetByName('NeedsOffers');
  var expires30 = new Date(now.getTime() + 30 * 86400000).toISOString();
  
  needs.forEach(function(n, i) {
    var ts = new Date(now.getTime() - (i * 3600000 * 8));
    needsSheet.appendRow([
      'N-SEED-' + (i + 1), 'need', zip, n.name,
      n.category, n.desc, 'Reply here', ts.toISOString(), expires30,
      'active', 0, '', false
    ]);
  });
  Logger.log('Seeded ' + needs.length + ' needs');
  
  // ── OFFERS ──
  var offers = [
    {
      name: 'Elena T.', category: 'food',
      desc: 'Extra tomatoes, peppers, and cilantro from my container garden. Free to anyone nearby. Pick up near 18th and Ashland.'
    },
    {
      name: 'Carlos R.', category: 'skills',
      desc: 'I can help with basic tax prep for free. I\'m not a CPA but I volunteer at VITA and know the common forms. DM me.'
    }
  ];
  
  offers.forEach(function(o, i) {
    var ts = new Date(now.getTime() - (i * 3600000 * 6));
    needsSheet.appendRow([
      'O-SEED-' + (i + 1), 'offer', zip, o.name,
      o.category, o.desc, 'Reply here', ts.toISOString(), expires30,
      'active', 0, '', false
    ]);
  });
  Logger.log('Seeded ' + offers.length + ' offers');
  
  // ── LEADER CHECK ──
  var evalSheet = ss.getSheetByName('Evaluations');
  evalSheet.appendRow([
    'E-SEED-1', 'Alderperson', 'Ward 25 Alderperson', 'Daniel P.', zip,
    2, 1, 2, 1, 2,  // promises, listening, transparency, results, fairness (0-3 scale)
    8, 15, 'C',
    'Shows up to some meetings but doesn\'t follow through on promises about the vacant lots. Transparency is mixed — budget info is hard to find.',
    new Date(now.getTime() - 86400000 * 3).toISOString()
  ]);
  Logger.log('Seeded 1 leader check');
  
  // ── USERS ──
  var userSheet = ss.getSheetByName('Users');
  var seedUsers = ['Rosa M.', 'Carlos R.', 'Elena T.', 'Daniel P.', 'José L.', 'Maria G.', 'Ana S.', 'Roberto V.'];
  seedUsers.forEach(function(name, i) {
    userSheet.appendRow([
      'U-SEED-' + (i + 1), name, zip,
      new Date(now.getTime() - 86400000 * (7 - i)).toISOString(),
      new Date(now.getTime() - 3600000 * i).toISOString(),
      i < 5 ? 1 : 0
    ]);
  });
  Logger.log('Seeded ' + seedUsers.length + ' users');
  
  // ── STATS ──
  var statsSheet = ss.getSheetByName('Stats');
  statsSheet.appendRow([
    zip, seedUsers.length, discussions.length, needs.length, offers.length,
    3, 1, 1, 1, now.toISOString(), now.toISOString()
  ]);
  Logger.log('Seeded stats for ' + zip);
  
  Logger.log('═══ SEED COMPLETE: 60608 is alive ═══');
}

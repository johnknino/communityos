/**
 * CommUnity OS — Community API Adapter v2.0
 * Dual-protocol: Apps Script passthrough OR Cloudflare REST translation.
 * Community pages change ONE line: var API = CommunityAPI.endpoint();
 * Then use CommunityAPI.smartFetch() instead of raw fetch() for POSTs.
 */
(function(){
  'use strict';
  var _cfg=null,_url='',_type='none',_zip='',_ready=false,_cbs=[];

  function init(){
    fetch('/data/community.json').then(function(r){return r.json()}).then(function(c){
      _cfg=c;_url=c.backend_url||'';_type=c.backend_type||'none';_zip=c.zip||'';
      _ready=true;_cbs.forEach(function(cb){cb(c)});
    }).catch(function(){_cfg={features:{}};_ready=true;_cbs.forEach(function(cb){cb(_cfg)})});
  }
  function onReady(cb){if(_ready)cb(_cfg);else _cbs.push(cb)}
  function endpoint(){return _url}
  function isConfigured(){return!!_url&&_type!=='none'}
  function isEnabled(f){return!_cfg||!_cfg.features||_cfg.features[f]!==false}

  function smartFetch(url,opts){
    if(!opts)opts={};
    // Apps Script — pass through unchanged
    if(_type==='appscript')return fetch(url,opts);
    // No backend
    if(_type==='none')return Promise.reject(new Error('No backend'));

    // Cloudflare — translate
    if(opts.method==='POST'){
      try{var body=JSON.parse(opts.body||'{}');return translatePost(body.action||'',body)}
      catch(e){return fetch(url,opts)}
    }
    // GET — translate action params
    return translateGet(url);
  }

  function rest(path,method,body){
    var opts={method:method||'GET',headers:{'Content-Type':'application/json'}};
    if(body)opts.body=JSON.stringify(body);
    return fetch(_url+path,opts).then(function(r){return r.json()}).then(function(d){
      return new Response(JSON.stringify(d.posts||d.success||d))
    });
  }

  function translatePost(action,b){
    var z=b.zip||_zip;
    // Discussions
    if(action==='post_discussion'||action==='submitDiscussion')
      return rest('/posts','POST',{type:'discuss',community:z,author:b.name||'Anon',title:b.title||b.subject||'',body:b.body||b.message||b.content||'',category:b.tag||''});
    if(action==='reply_discussion'||action==='replyDiscussion')
      return rest('/posts/'+b.id,'PUT',{action:'reply',reply:{author:b.name||'Anon',body:b.reply||b.body||''}});
    if(action.indexOf('upvote')>=0)
      return rest('/posts/'+b.id,'PUT',{action:'vote',direction:'up'});
    if(action.indexOf('flag')>=0)
      return rest('/posts/'+b.id,'PUT',{status:'flagged'});
    // Needs/offers
    if(action==='submit_listing'||action==='post_need'||action==='post_offer')
      return rest('/posts','POST',{type:b.type==='offer'?'offer':'need',community:z,author:b.name||'Anon',title:b.title||'',body:b.description||b.body||'',category:b.category||'',metadata:{contact:b.contact||'',urgency:b.urgency||''}});
    // Proposals
    if(action==='submit_proposal')
      return rest('/posts','POST',{type:'proposal',community:z,author:b.name||'Anon',title:b.title||'',body:b.description||b.body||'',category:b.category||'',metadata:{target:b.target||''}});
    if(action==='vote_proposal')
      return rest('/posts/'+b.id,'PUT',{action:'vote',direction:b.vote||'up'});
    if(action==='comment_proposal')
      return rest('/posts/'+b.id,'PUT',{action:'reply',reply:{author:b.name||'Anon',body:b.comment||b.body||''}});
    // Evaluations
    if(action==='submit_evaluation'||action==='submitEvaluation')
      return rest('/posts','POST',{type:'rating',community:z,author:b.name||'Anon',title:b.leader||b.subject||'',body:b.comment||b.body||'',category:b.role||'',metadata:{scores:b.scores||{},overall:b.overall||0}});
    // Governance
    if(action==='add_promise')
      return rest('/posts','POST',{type:'promise',community:z,author:b.author||'Anon',title:b.promise||b.title||'',body:b.source||'',category:b.official||'',metadata:{date_made:b.date||'',status:'pending'}});
    // Grow
    if(action==='log_harvest'||action==='add_plant')
      return rest('/posts','POST',{type:'plant',community:z,author:b.name||'Anon',title:b.plant||'',body:b.notes||'',metadata:{quantity:b.quantity||'',action_type:action}});
    // Unknown
    return rest('/posts','POST',{type:'unknown',community:z,body:JSON.stringify(b),metadata:{action:action}});
  }

  function translateGet(url){
    var u=new URL(url,location.origin),p=u.searchParams,a=p.get('action')||'',z=p.get('zip')||_zip;
    var typeMap={'get_discussions':'discuss','getDiscussions':'discuss','get_proposals':'proposal','get_evaluations':'rating'};
    if(typeMap[a])return rest('/posts?type='+typeMap[a]+'&community='+encodeURIComponent(z)+'&limit=50');
    if(a==='get_listings'||a==='get_needs_crosszip')
      return fetch(_url+'/posts?community='+encodeURIComponent(z)+'&limit=100').then(function(r){return r.json()}).then(function(d){
        var posts=(d.posts||[]).filter(function(p){return p.type==='need'||p.type==='offer'});
        return new Response(JSON.stringify(posts))});
    if(a==='get_governance_pulse'||a==='get_community_modules')
      return rest('/stats?community='+encodeURIComponent(z));
    if(a==='get_officials_multilevel'||a==='state_legislators')
      return Promise.resolve(new Response(JSON.stringify([])));
    if(a==='geocode')
      return fetch('https://api.zippopotam.us/us/'+z).then(function(r){return r.json()}).then(function(d){
        var pl=d.places&&d.places[0]?d.places[0]:{};
        return new Response(JSON.stringify({data:{lat:pl.latitude||0,lon:pl.longitude||0,city:pl['place name']||'',state:pl['state abbreviation']||''}}))});
    return fetch(url);
  }

  function renderSetupMessage(el){
    el.innerHTML='<div style="text-align:center;padding:40px 20px;max-width:480px;margin:0 auto">'+
      '<div style="font-size:2rem;margin-bottom:12px">🏗️</div>'+
      '<h3 style="font-family:var(--display,system-ui);font-size:1.1rem;font-weight:700;color:var(--deep,#1a2e2a);margin-bottom:8px">Community Features</h3>'+
      '<p style="font-size:.85rem;color:var(--body,#555);line-height:1.7;margin-bottom:16px">This page needs a community backend. Setup takes 5 minutes with Cloudflare Workers (free). The 18 national tools work without any setup.</p>'+
      '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">'+
        '<a href="/how-it-works.html" style="font-size:.78rem;font-weight:600;padding:10px 20px;border-radius:10px;background:var(--forest,#2d5a4e);color:#fff;text-decoration:none">Setup Guide →</a>'+
        '<a href="/" style="font-size:.78rem;font-weight:600;padding:10px 20px;border-radius:10px;border:1.5px solid var(--sage,#5b8c7a);color:var(--forest,#2d5a4e);text-decoration:none">National Tools →</a>'+
      '</div></div>';
  }

  window.CommunityAPI={init:init,onReady:onReady,endpoint:endpoint,isConfigured:isConfigured,
    isEnabled:isEnabled,getType:function(){return _type},getCommunity:function(){return _zip},
    getConfig:function(){return _cfg},smartFetch:smartFetch,renderSetupMessage:renderSetupMessage};
  init();
})();

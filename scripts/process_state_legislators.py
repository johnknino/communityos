#!/usr/bin/env python3
"""Process Open States YAML into static JSON. Usage: python process_state_legislators.py [state]"""
import yaml, json, os, sys, time, requests
GITHUB = "https://api.github.com/repos/openstates/people/contents/data/{}/legislature"
def process(state):
    r = requests.get(GITHUB.format(state.lower()), headers={"User-Agent":"CommUnityOS"})
    if r.status_code != 200: print(f"Error: {r.status_code}"); return
    files = [f for f in r.json() if f['name'].endswith('.yml')]
    officials = []
    for i, f in enumerate(files):
        yr = requests.get(f['download_url'], headers={"User-Agent":"CommUnityOS"})
        if yr.status_code != 200: continue
        d = yaml.safe_load(yr.text)
        if not d: continue
        roles = d.get('roles', [{}])
        current = roles[-1] if roles else {}
        phone = next((o['voice'] for o in d.get('offices',[]) if o.get('voice')), '')
        links = d.get('links', [])
        url = next((l['url'] for l in links if l.get('note')=='homepage'), links[-1]['url'] if links else '')
        party = d.get('party',[{}])
        officials.append({'name':d.get('name',''),'party':party[0].get('name','') if party else '','chamber':'upper' if current.get('type')=='upper' else 'lower','district':current.get('district',''),'phone':phone,'email':d.get('email',''),'url':url})
        if (i+1)%10==0: print(f"  {i+1}/{len(files)}")
        time.sleep(0.3)
    output = {'state':state.upper(),'updated':time.strftime('%Y-%m-%d'),'source':'openstates/people','total':len(officials),'upper':[o for o in officials if o['chamber']=='upper'],'lower':[o for o in officials if o['chamber']=='lower']}
    with open(f'data/state_officials_{state.lower()}.json','w') as f: json.dump(output,f,separators=(',',':'))
    print(f"Done: {len(officials)} officials")
if __name__=='__main__': process(sys.argv[1] if len(sys.argv)>1 else 'il')

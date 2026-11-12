import json, re, difflib, unicodedata
new=json.load(open('build/rules2026_raw.json'))
old=json.load(open('/workspace/repos/seoul-wr-squad/academy/quiz/data/rules.json'))['articles']
oldmap={a['no']:a for a in old}
def norm(s):
    s=s.replace('’',"'").replace('‘',"'").replace('“','"').replace('”','"').replace('–','-').replace('—','-')
    s=re.sub(r'\s+',' ',s)
    return s.strip().lower()
def nospace(s): return re.sub(r'[^a-z0-9]','',norm(s))
pairs=[]
for a in new:
    no=a['no']
    cand = no if no<=81 else no+1
    o=oldmap.get(cand)
    pairs.append((a,o,cand))
rows=[]
for a,o,cand in pairs:
    if not o:
        rows.append((a['no'],'NEW',a['title'],'',''))
        continue
    ot=norm(o['titleEn']); nt=norm(a['title'])
    ob=norm(' '.join(o['bodyEn'])); nb=norm(a['body'])
    r=difflib.SequenceMatcher(None,ob,nb).ratio()
    rt=difflib.SequenceMatcher(None,ot,nt).ratio()
    rows.append((a['no'],cand,round(r,3),round(rt,3),a['title'],o['titleEn']))
for r in rows:
    if r[1]=='NEW' or r[2]<0.985 or r[3]<0.9:
        print(r)
print('---title mismatches---')
for r in rows:
    if r[1]!='NEW' and r[3]<0.9: print(r[0],r[1],'|',r[4],'||',r[5])
print('old only:', [ (a['no'],a['titleEn']) for a in old if a['no'] not in [p[2] for p in pairs]])

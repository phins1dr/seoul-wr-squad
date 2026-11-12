import json, re, difflib
new={a['no']:a for a in json.load(open('build/rules2026_raw.json'))}
old={a['no']:a for a in json.load(open('/workspace/repos/seoul-wr-squad/academy/quiz/data/rules.json'))['articles']}
def oldno(n): return n if n<=81 else n+1
WORDNUM={'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10,
 'eleven':11,'twelve':12,'fourteen':14,'fifteen':15,'nineteen':19,'twenty':20,'thirty':30,'forty':40,
 'fifty':50,'sixty':60,'seventy':70,'eighty':80,'hundred':100,'twelve-second':12}
UNITS={'zero':0,'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9}
def pre(s):
    s=s.replace('’',"'").replace('‘',"'").replace('“','"').replace('”','"').replace('–','-').replace('—','-')
    s=s.replace('colour','color').replace('centre','center').replace('metre','meter').replace('millimetre','millimeter').replace('centimetre','centimeter')
    s=re.sub(r'\bhis\b','their',s); s=re.sub(r'\bhim\b','them',s); s=re.sub(r'\bhe\b','they',s)
    s=re.sub(r'(\w) ?- ?(\w)',r'\1-\2',s)
    # compound spelled numbers e.g. seventy-five (75)
    def comp(m):
        a,b,num=m.group(1),m.group(2),m.group(3)
        return num if a in WORDNUM or a in UNITS else m.group(0)
    s=re.sub(r'\b([a-z]+)-([a-z]+) ?\((\d+)\)',comp,s)
    s=re.sub(r'\b([a-z]+) ?\((\d+)\)',lambda m: m.group(2) if (m.group(1) in WORDNUM or m.group(1) in UNITS) else m.group(0),s)
    s=re.sub(r'\b([a-z]+)-([a-z]+)\b',lambda m: str(WORDNUM.get(m.group(1),m.group(1))+UNITS.get(m.group(2),0)) if (m.group(1) in WORDNUM and m.group(2) in UNITS and m.group(1) in ('twenty','thirty','forty','fifty','sixty','seventy','eighty')) else m.group(0),s)
    s=re.sub(r'\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|fifteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty)\b',lambda m:str(WORDNUM[m.group(1)]),s)
    return s
def norm(s):
    s=pre(s.lower())
    s=re.sub(r'[^a-z0-9$%.,;:\-/() ]',' ',s)
    s=re.sub(r'\s+',' ',s)
    return s.strip()
out=[]
for n in sorted(new):
    o=old.get(oldno(n)); a=new[n]
    if not o:
        out.append(f'### [{n}] 2021 대응 없음 — {a["title"]}'); continue
    ob=norm(' '.join(o['bodyEn'])); nb=norm(a['body'])
    sm=difflib.SequenceMatcher(None, ob.split(), nb.split())
    if sm.ratio()>0.995: continue
    out.append(f'### [{n}] ratio={sm.ratio():.3f} 2026:{a["title"]}')
    for t,i1,i2,j1,j2 in sm.get_opcodes():
        if t=='equal': continue
        print_old=' '.join(ob.split()[i1:i2]); print_new=' '.join(nb.split()[j1:j2])
        out.append(f'   - {print_old[:400]}')
        out.append(f'   + {print_new[:400]}')
open('build/diffnorm.txt','w').write('\n'.join(out))
print('\n'.join(out)[:12000])

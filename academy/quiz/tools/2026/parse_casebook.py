import re, json
raw=open('WWR-Casebook-2026/ALL.txt').read()
# strip running headers/footers per page
pages=raw.split('===== PAGE ')
out=[]
for p in pages[1:]:
    num=int(p.split(' =====')[0]); body=p.split('=====',1)[1]
    lines=[]
    skip=('Interpretations from the International','World Wheelchair Rugby','Interpretations from the International Rules for the Sport','of Wheelchair Rugby')
    for ln in body.split('\n'):
        s=ln.strip()
        if s in skip: continue
        if re.fullmatch(r'\d{1,3}', s): continue
        lines.append(s)
    out.append((num,'\n'.join(lines)))
text='\n'.join(f'[[PDFPAGE {n}]]\n{t}' for n,t in out)
open('build/casebook_raw.txt','w').write(text)
# case start regex
pat=re.compile(r'^(\d{1,2})\.(\d{2,3})\s*\.?\s*(\d{1,2})?\b')
cases=[]; cur=None
for ln in text.split('\n'):
    m=pat.match(ln.strip())
    if m and not ln.strip().startswith('[['):
        # candidate case heading: must have third group or be section? section headers like '3.21  Uniform' have no number group
        ch=m.group(1); art=m.group(2); idx=m.group(3)
        rest=ln.strip()[m.end():]
        if idx is None and re.match(r'^[A-Z][a-z]', rest.strip()):
            continue  # section header like "3.21 Uniform"
        if cur: cases.append(cur)
        cur={'caseNo':f'{ch}.{art}.{idx}' if idx else f'{ch}.{art}','text':[ln.strip()],'page':None}
        continue
    if cur is not None: cur['text'].append(ln)
if cur: cases.append(cur)
print('cases',len(cases))
from collections import Counter
print(Counter(c['caseNo'].split('.0')[0][:2] for c in cases))
json.dump(cases, open('build/casebook_cases_raw.json','w'), ensure_ascii=False, indent=1)
for c in cases[:5]: print(c['caseNo'], c['text'][0][:100])
print('...')
for c in cases[-5:]: print(c['caseNo'], c['text'][0][:100])

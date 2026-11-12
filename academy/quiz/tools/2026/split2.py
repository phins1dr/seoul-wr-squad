import re, json
lines=open('build/casebook_raw.txt').read().split('\n')
cases=[]; cur=None; page=None
skiphead=('Interpretations from the International','World Wheelchair Rugby','of Wheelchair Rugby')
for ln in lines:
    s=ln.strip()
    m0=re.match(r'^\[\[PDFPAGE (\d+)\]\]$', s)
    if m0: page=int(m0.group(1)); continue
    if not s: 
        if cur: cur['lines'].append('')
        continue
    if s in skiphead: continue
    if re.fullmatch(r'\d{1,3}', s): continue
    m=re.match(r'^(\d{1,2})\.(\d{2,3})\s*\.?\s*(\d{1,2})?\b', s)
    is_case=False
    if m:
        ch,art,idx=s[m.start():].split(' ')[0],None,None
        rest=s[m.end():].strip()
        # section header: "3.21  Uniform" (no third number, short rest, capitalized word)
        if m.group(3) is None and re.match(r'^[A-Z][A-Za-z /\-–]+$', rest) and len(rest)<45:
            is_case=False
        else:
            is_case=True
    if is_case:
        if cur: cases.append(cur)
        cur={'caseNo': m.group(1)+'.'+m.group(2)+(('.'+m.group(3)) if m.group(3) else ''),
             'page': page, 'lines':[s], 'first': s, 'mend': m.end()}
        continue
    if cur is not None: cur['lines'].append(s)
if cur: cases.append(cur)
out=[]
for c in cases:
    body_lines=[c['lines'][0][c['mend']:].strip()]+c['lines'][1:]
    body=re.sub(r'\s+',' ',' '.join(l for l in body_lines if l.strip())).strip()
    if '.....' in body: continue
    am=re.search(r'\bAnswer\s*:?', body)
    q=body[:am.start()].strip() if am else body
    ans=body[am.start():].strip() if am else ''
    if am: ans=re.sub(r'^Answer\s*:?','',ans).strip()
    rm=re.search(r'\bRule\s*:', ans)
    rule=''
    if rm: rule=ans[rm.start():].strip(); ans=ans[:rm.start()].strip()
    out.append({'caseNo':c['caseNo'],'page':c['page'],'q':q,'a':ans,'rule':rule})
json.dump(out, open('build/casebook_split.json','w'), ensure_ascii=False, indent=1)
from collections import Counter, defaultdict
print(len(out), Counter(o['caseNo'].split('.')[0] for o in out))
print('NOA:', [(o['caseNo'],o['q'][:70]) for o in out if not o['a']])
print('SHORTQ:', [(o['caseNo'],o['q'][:50]) for o in out if len(o['q'])<40])

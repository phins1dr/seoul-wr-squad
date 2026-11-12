import re, json, os
pages = []
for i in range(1,49):
    t = open(f'WWR-Rules-2026/p{i:03d}.txt').read()
    pages.append(t)
# drop running headers/footers
def clean(t):
    lines = t.split('\n')
    out=[]
    for ln in lines:
        s=ln.strip()
        if s in ('International rules for the sport of Wheelchair Rugby',): continue
        if re.fullmatch(r'\d{1,2}', s): continue
        if s.startswith('April 2026 – WWR International Rules'): continue
        if s.startswith('© Copyright'): continue
        if re.fullmatch(r'[-–]\s*\d+\s*[-–]', s): continue
        out.append(ln)
    return '\n'.join(out)
body_pages = pages[6:]  # from page 7 (pdf index 6)
text = '\n'.join(f'[[PAGE {i+7}]]\n'+clean(p) for i,p in enumerate(body_pages))
open('build/rules2026_raw.txt','w').write(text)
# split articles
parts = re.split(r'(?m)^\s*(Article\s+\d+)\.', text)
print('split parts', len(parts))
arts=[]
for i in range(1,len(parts),2):
    head=parts[i]; body=parts[i+1]
    no=int(re.search(r'\d+',head).group())
    lines=[l for l in body.split('\n')]
    # first non-empty line is title
    title=''
    rest=[]
    started=False
    for l in lines:
        if not started and l.strip():
            title=l.strip(); started=True; continue
        if started: rest.append(l)
    arts.append({'no':no,'title':title,'body':'\n'.join(rest)})
print('articles', len(arts))
print([a['no'] for a in arts])
for a in arts[:3]+arts[-3:]:
    print('---',a['no'],a['title']); print(a['body'][:300])
json.dump(arts, open('build/rules2026_raw.json','w'), ensure_ascii=False, indent=1)

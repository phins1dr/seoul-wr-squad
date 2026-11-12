import re, json
raw=open('WWR-Rules-2026/ALL.txt').read()
pages={}
for chunk in raw.split('===== PAGE ')[1:]:
    num=int(chunk.split(' =====')[0]); pages[num]=chunk.split('=====',1)[1]
def clean(body):
    out=[]
    for ln in body.split('\n'):
        s=ln.rstrip(); t=s.strip()
        if t in ('International rules for the sport of Wheelchair Rugby',): continue
        if re.fullmatch(r'\d{1,2}', t): continue
        if t.startswith('April 2026 – WWR International Rules'): continue
        if t.startswith('© Copyright'): continue
        if re.fullmatch(r'[-–]\s*\d+\s*[-–]', t): continue
        out.append(s)
    return out
stream=[]
for n in sorted(pages):
    if n<7 or n>45: continue
    for s in clean(pages[n]): stream.append((n,s))
starts=[]
for i,(n,s) in enumerate(stream):
    m=re.match(r'^\s*Article\s+(\d+)\.\s*(.*)$', s)
    if m: starts.append((i,int(m.group(1)),m.group(2).strip(),n))
arts=[]
for k,(i,no,titleline,n) in enumerate(starts):
    end=starts[k+1][0] if k+1<len(starts) else len(stream)
    body=stream[i+1:end]
    cut=len(body)
    for j,(pn,s) in enumerate(body):
        if re.match(r'^SECTION\s+\d+', s.strip()) or s.strip().startswith('Annex'): cut=j; break
    body=body[:cut]
    paras=[]; cur=[]
    for pn,s in body:
        st=s.strip()
        if not st:
            if cur: paras.append(cur); cur=[]
            continue
        if re.match(r'^([a-z]|[ivxl]+)\.\s', st) or st.startswith('•') or st.startswith('Note'):
            if cur: paras.append(cur)
            cur=[st]
        else:
            cur.append(st)
    if cur: paras.append(cur)
    paragraphs=[]
    for p in paras:
        txt=re.sub(r'\s+',' ',' '.join(p)).strip()
        # split glued bullet runs
        parts=[x.strip() for x in re.split(r'\s•\s', txt) if x.strip()]
        for x in parts:
            if len(x)<=420: paragraphs.append(x); continue
            sents=re.split(r'(?<=[.;:])\s+', x)
            buf=[]
            for s2 in sents:
                buf.append(s2)
                if len(' '.join(buf))>200: paragraphs.append(' '.join(buf)); buf=[]
            if buf: paragraphs.append(' '.join(buf))
    arts.append({'no':no,'title':titleline,'page':n,'bodyEn':paragraphs})
json.dump(arts,open('build/rules2026_articles.json','w'),ensure_ascii=False,indent=1)
# coverage check
alltext=' '.join(' '.join(a['bodyEn']) for a in arts)
srctext=' '.join(s.strip() for n,s in stream if s.strip() and not re.match(r'^Article\s+\d+\.',s.strip()))
print('words src',len(srctext.split()),'words parsed',len(alltext.split()))
print('n=',len(arts))
for n in (56,43,52):
    a=[x for x in arts if x['no']==n][0]
    print('###',n,a['title'],'p',a['page'],len(a['bodyEn']))
    for p in a['bodyEn'][:6]: print('  |',p[:150])

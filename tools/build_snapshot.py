#!/usr/bin/env python3
"""서울휠체어럭비 선수단 '공유용(로그인 없이 보기)' 페이지 만들기.

사용법:
  python3 build_snapshot.py <원본 앱 index.html> <DB 덤프 폴더> <assetmap.json> <기준일 YYYY-MM-DD> <출력 폴더> [pages]

- 마지막에 pages 를 붙이면 깃허브 페이지용으로 만들어요: 사진은 출력 폴더의 img/<원본id>.jpg 를 쓰고
  (assetmap.json 은 무시), need_assets.json 에는 img/ 에 아직 없는 원본 사진 id 가 나와요.

- DB 덤프 폴더: ArtifactData list(out_dir=...)로 받은 players/attendance/fitness/chairs/events/config 폴더
  (private/pinfo 는 절대 넣지 않음 — 연락처·주소 등 개인정보)
- assetmap.json: {"원본 사진 id": "공유용 페이지 사진 id"}  (없으면 {} 로 시작)
- 출력: index.html, snapshot.json, need_assets.json(아직 공유용으로 복사 안 된 원본 사진 id 목록)
"""
import json, os, sys, glob

app_path, dump, map_path, asof, out = sys.argv[1:6]
PAGES = len(sys.argv) > 6 and sys.argv[6] == 'pages'
amap = json.load(open(map_path)) if os.path.exists(map_path) else {}
COLS = ['players', 'attendance', 'fitness', 'chairs', 'events', 'config']
data = {}
for c in COLS:
    data[c] = {}
    for f in sorted(glob.glob(os.path.join(dump, c, '*.json'))):
        d = json.load(open(f, encoding='utf-8'))
        data[c][os.path.basename(f)[:-5]] = d

need = set()
def mp(i):
    if not i: return i
    if PAGES:
        if not os.path.exists(os.path.join(out, 'img', i + '.jpg')): need.add(i)
        return i + '.jpg'
    if i in amap: return amap[i]
    need.add(i); return ''
for p in data['players'].values():
    if p.get('photo'): p['photo'] = mp(p['photo'])
for c in data['chairs'].values():
    if c.get('photo'): c['photo'] = mp(c['photo'])
    if isinstance(c.get('photos'), dict):
        c['photos'] = {k: mp(v) for k, v in c['photos'].items() if v}
for m in data['attendance'].values():
    m.pop('reasons', None)
    m['photos'] = {}  # 공유용에는 증빙 사진 화면이 없어서 출석 사진은 넣지 않아요

snap = {'asOf': asof, 'data': data}
os.makedirs(out, exist_ok=True)
json.dump(snap, open(os.path.join(out, 'snapshot.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump(sorted(need), open(os.path.join(out, 'need_assets.json'), 'w'))

STUB = r'''<script>
/* 공유용 화면: 저장소 대신 snapshot.json 을 읽어요. 수정 불가, 개인정보 없음 */
(function(){
  let snapP = null;
  const load = () => snapP || (snapP = fetch('snapshot.json', {cache: 'no-store'}).then(r => r.json()));
  const docsOf = (s, col) => Object.entries(s.data[col] || {}).map(([id, v]) => ({ id, data: () => v }));
  const db = {
    collection: col => ({ onSnapshot: (next) => { load().then(s => next({ docs: docsOf(s, col) })); return () => {}; } }),
    doc: () => ({ set: async () => {}, update: async () => {}, delete: async () => {} })
  };
  // 앱 코드의 window.claude 는 빌드할 때 window.__claudeSnap 으로 바꿔 둬요 (플랫폼 객체는 건드리지 않음)
  window.__claudeSnap = { use: async n => {
    if (n === 'db') return db;
    if (n === 'user') return { canEdit: async () => false, isOwner: async () => false };
    if (n === 'assets') return null;
    const r = window.claude; if (r && r.use) return r.use(n);
    // claude.ai 밖(깃허브 페이지)에서는 브라우저 기본 다운로드로 저장
    if (n === 'downloads') return { save: async ({ filename, data }) => { const b = data instanceof Blob ? data : new Blob([data]); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); return { status: 'saved' }; } };
    return null; } };
  load().then(s => {
    window.__snapAsOf = s.asOf;
    const put = () => { const m = document.getElementById('mode'); if (!m) return setTimeout(put, 100); m.className = 'pill ro'; m.textContent = '공유용 · ' + s.asOf.replace(/-/g, '.') + ' 기준'; };
    const keep = () => { put(); setTimeout(keep, 1500); }; keep();
  });
})();
</script>
'''
html = open(app_path, encoding='utf-8').read().replace('window.claude', 'window.__claudeSnap')
i = html.find('<title>')
if i < 0: raise SystemExit('원본 앱에서 <title>을 찾지 못했어요')
# 공유용에서 보여줄 것: 출석부(월별·연간·선수 평가), 체력테스트, 휠체어만
SWAPS = [
    ("tab: store.get('tab', 'home')", "tab: 'att'"),
    ("attView: 'check',", "attView: 'month',"),
    ("const views = [['check', '출석 체크'], ['month', '월별 출석부'], ['year', '연간 통계'], ['report', '선수 평가'], ['photos', '증빙 사진']];",
     "const views = [['month', '월별 출석부'], ['year', '연간 통계'], ['report', '선수 평가']];"),
]
for x, y in SWAPS:
    if x not in html: print('경고: 원본 앱에서 못 찾음 →', x[:40])
    html = html.replace(x, y, 1)
HIDE = '<style>.tab[data-tab="home"],.tab[data-tab="players"],.tab[data-tab="events"],.tab[data-tab="export"],[data-act="fitTab"][data-v="std"]{display:none!important}</style>\n'
html = html[:i] + STUB + HIDE + html[i:]
html = html.replace('<title>서울휠체어럭비 선수단</title>', '<title>선수단 공유용</title>', 1)
if PAGES:
    html = html.replace('/_blob/', 'img/')
    html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"></head><body>' + html + '</body></html>'
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
print('players', len(data['players']), 'attendance', len(data['attendance']), 'events', len(data['events']), 'need assets', len(need))

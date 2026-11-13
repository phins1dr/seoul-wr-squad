"""코트 장면 점검 (예전 work/test_scene.py를 대신함, 2026-11-14).
data/cases.json의 모든 scene에 대해: 캡션·영어 누락, 단계 시간 순서, duration, 선수 id·이동 대상·볼 소유자,
표시 글씨 영어, 좌표 범위(코트 밖 여백 안), 휠체어끼리 겹침(중심 거리 0.8m 미만이면 경고)을 본다.
실행: python -X utf8 tools/2026/check_scenes.py  (academy/quiz 폴더에서). 오류가 있으면 종료 코드 1."""
import io, json, math, sys

d = json.load(io.open('data/cases.json', encoding='utf-8'))
err, warn, n = [], [], 0
X0, X1, Y0, Y1 = -1.9, 29.9, -1.9, 16.9   # scene.js PAD 1.9 안


def chk_xy(cid, what, x, y):
    if not (X0 <= x <= X1 and Y0 <= y <= Y1):
        err.append(f'{cid}: {what} 좌표 범위 밖 ({x},{y})')


for c in d['cases']:
    s = c.get('scene')
    if not s:
        continue
    n += 1
    cid = c['id']
    ids = [a['id'] for a in s.get('actors', [])]
    if len(ids) != len(set(ids)): err.append(f'{cid}: 선수 id 중복')
    if not ids: err.append(f'{cid}: 선수 없음')
    pos = {}
    for a in s['actors']:
        if a.get('team') not in ('A', 'B'): err.append(f'{cid}: {a["id"]} 팀 없음')
        chk_xy(cid, a['id'], a['x'], a['y'])
        pos[a['id']] = (a['x'], a['y'])
    b = s.get('ball')
    if b and b.get('holder') and b['holder'] not in ids: err.append(f'{cid}: 볼 소유자 {b["holder"]} 없음')
    steps = s.get('steps') or []
    if not steps: err.append(f'{cid}: 단계 없음')
    ats = [st.get('at', 0) for st in steps]
    if ats != sorted(ats) or len(set(ats)) != len(ats): err.append(f'{cid}: 단계 시간 순서 이상 {ats}')
    if steps and not steps[0].get('caption'): err.append(f'{cid}: 첫 단계 캡션 없음')
    if s.get('duration', 0) <= (ats[-1] if ats else 0): err.append(f'{cid}: duration이 마지막 단계보다 짧음')
    frames = [dict(pos)]
    for st in steps:
        if st.get('caption') and not st.get('captionEn'): err.append(f'{cid}: 영어 캡션 없음 "{st["caption"]}"')
        for k, v in (st.get('move') or {}).items():
            if k not in ids: err.append(f'{cid}: 없는 선수 이동 {k}')
            else:
                chk_xy(cid, k, v[0], v[1]); pos[k] = tuple(v)
        for k in (st.get('face') or {}):
            if k not in ids: err.append(f'{cid}: 없는 선수 방향 {k}')
        sb = st.get('ball')
        if isinstance(sb, dict) and sb.get('holder') and sb['holder'] not in ids: err.append(f'{cid}: 볼 소유자 {sb["holder"]} 없음')
        if isinstance(sb, list): chk_xy(cid, '볼', sb[0], sb[1])
        frames.append(dict(pos))
    for m in s.get('markers', []):
        chk_xy(cid, m.get('type'), m['x'], m['y'])
        for k in ('text', 'label'):
            if m.get(k) and not m.get(k + 'En'): err.append(f'{cid}: 표시 글씨 영어 없음 "{m[k]}"')
    for h in s.get('highlight', []):
        if h.get('type') not in ('key', 'circle', 'line'): err.append(f'{cid}: 모르는 강조 {h.get("type")}')
    for i, f in enumerate(frames):
        ks = list(f)
        for p in range(len(ks)):
            for q in range(p + 1, len(ks)):
                dd = math.dist(f[ks[p]], f[ks[q]])
                if dd < 0.8: warn.append(f'{cid}: 단계 {i} {ks[p]}-{ks[q]} 겹침 {dd:.2f}m')

print(f'장면 {n}개 점검')
for w in warn: print('  경고', w)
for e in err: print('  오류', e)
print('OK' if not err else f'오류 {len(err)}개')
sys.exit(1 if err else 0)

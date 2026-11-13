"""선수 무리 위치(cx) 시계열에서 공격턴 경계를 찾는다.

원리: 휠체어럭비는 한 공격턴 동안 선수 무리가 한쪽 골라인 방향으로 이동한다.
득점·턴오버로 공격권이 바뀌면 이동 방향이 뒤집힌다 → 방향이 D미터 이상 반대로
바뀐 지점(지그재그 꼭짓점)을 공격턴 시작으로 본다.

출력 JSON: {"video": id, "series": [[t, cx]...], "turns": [{start, end, dir, ...}]}
  dir = "far"  : 먼 쪽 골라인(화면 오른쪽 위)으로 공격
        "near" : 가까운 쪽 골라인(화면 왼쪽 아래)으로 공격
"""
import sys, csv, json
import numpy as np

CSV, OUT, VIDEO = sys.argv[1], sys.argv[2], sys.argv[3]
D = float(sys.argv[4]) if len(sys.argv) > 4 else 6.0   # 방향 전환으로 인정할 최소 이동(m)
PRE = 3.0      # 클립을 꼭짓점보다 몇 초 앞에서 시작할지
LONG = 75.0    # 이보다 긴 턴은 휴식·타임아웃이 섞였을 수 있어 확인 표시

t, cx = [], []
with open(CSV, encoding="utf-8") as f:
    for r in csv.DictReader(f):
        t.append(float(r["t"]))
        cx.append(float(r["cx"]) if r["cx"] not in ("", None) else np.nan)
t, cx = np.array(t), np.array(cx)
ok = ~np.isnan(cx)
cx = np.interp(t, t[ok], cx[ok])

def roll(a, k, fn):
    pad = k // 2
    ap = np.pad(a, pad, mode="edge")
    return np.array([fn(ap[i:i + k]) for i in range(len(a))])

# 5fps 기준: 3초 중앙값(튀는 값 제거) → 2초 평균(부드럽게)
sm = roll(roll(cx, 15, np.median), 11, np.mean)

# 지그재그: 마지막 꼭짓점에서 D 이상 반대로 움직이면 그 꼭짓점을 확정
pivots = []
hi = lo = 0
trend = 0  # +1 증가 중, -1 감소 중
for i in range(1, len(sm)):
    if trend == 0:
        if sm[i] > sm[hi]: hi = i
        if sm[i] < sm[lo]: lo = i
        if sm[i] - sm[lo] >= D:
            pivots.append((lo, "min")); trend, hi = 1, i
        elif sm[hi] - sm[i] >= D:
            pivots.append((hi, "max")); trend, lo = -1, i
    elif trend == 1:
        if sm[i] > sm[hi]: hi = i
        elif sm[hi] - sm[i] >= D:
            pivots.append((hi, "max")); trend, lo = -1, i
    else:
        if sm[i] < sm[lo]: lo = i
        elif sm[i] - sm[lo] >= D:
            pivots.append((lo, "min")); trend, hi = 1, i
pivots.append((len(sm) - 1, "end"))

turns = []
for k in range(len(pivots) - 1):
    i0, kind = pivots[k]
    i1 = pivots[k + 1][0]
    if kind == "?":
        continue
    d = "far" if kind == "min" else "near"
    start = max(0.0, t[i0] - PRE)
    end = max(start, t[i1] - PRE)
    turns.append({
        "start": round(start, 1),
        "end": round(end, 1),
        "dir": d,
        "from_x": round(float(sm[i0]), 1),
        "to_x": round(float(sm[i1]), 1),
        "check": bool(end - start > LONG),
    })

# 화면 그래프용으로 1초 간격으로 줄인 시계열
series = [[round(float(t[i]), 1), round(float(sm[i]), 1)] for i in range(0, len(t), 5)]
json.dump({"video": VIDEO, "D": D, "series": series, "turns": turns},
          open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
nf = sum(1 for x in turns if x["dir"] == "far")
print(f"turns={len(turns)}  far={nf}  near={len(turns)-nf}  check={sum(x['check'] for x in turns)}")
for x in turns[:40]:
    print(x)

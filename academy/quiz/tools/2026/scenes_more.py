"""2026-11-14 코트 장면 27개 추가 (코트 위치가 판정을 가르는 케이스).
data/cases.json의 해당 케이스에 scene을 넣는다(이미 있으면 덮어씀). 영어는 그다음 scene_en.py로 넣는다.
좌표계: x 0→28 (A팀 공격 방향, 오른쪽 트라이 라인 x=28), y 0→15 (y=0 위 사이드라인), 단위 m.
코트 치수는 engine/rugby-court.js의 SPEC에서 읽는다(키 깊이 1.75, 폭 8 → 키·포스트 좌표 계산).
캡션은 정답을 미리 말하지 않게 상황까지만 적는다.
실행: python -X utf8 tools/2026/scenes_more.py && python -X utf8 tools/2026/scene_en.py  (academy/quiz 폴더에서)"""
import io, json, math, re, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
QUIZ = os.path.normpath(os.path.join(HERE, '..', '..'))
COURT_JS = os.path.normpath(os.path.join(QUIZ, '..', '..', 'engine', 'rugby-court.js'))

src = io.open(COURT_JS, encoding='utf-8').read()
num = lambda pat: float(re.search(pat, src).group(1))
L = num(r'L:\s*([\d.]+)')
WD = num(r'\bW:\s*([\d.]+)')
KD = num(r'key:\s*Object\.freeze\(\{\s*d:\s*([\d.]+)')
KW = num(r'key:\s*Object\.freeze\(\{\s*d:\s*[\d.]+,\s*w:\s*([\d.]+)')
CX, CY = L / 2, WD / 2
KX = L - KD                     # 오른쪽 키 앞 모서리
P1, P2 = CY - KW / 2, CY + KW / 2  # 포스트(콘) y
PI = round(math.pi, 4)
UP, DOWN = round(-math.pi / 2, 4), round(math.pi / 2, 4)
END = '여기까지의 상황이다'


def r(v):
    return round(v, 2)


def act(i, x, y, a=0):
    return {'id': i, 'team': i[0], 'x': r(x), 'y': r(y), 'a': a}


def step(at, cap=None, move=None, face=None, ball=None):
    s = {'at': at}
    if cap is not None: s['caption'] = cap
    if move: s['move'] = {k: [r(v[0]), r(v[1])] for k, v in move.items()}
    if face: s['face'] = face
    if ball is not None: s['ball'] = ball
    return s


def scene(actors, steps, hl=None, markers=None, ball=None, extra=1.2):
    s = {'court': 'full', 'duration': round(steps[-1]['at'] + extra, 1)}
    if hl: s['highlight'] = hl
    s['actors'] = actors
    if ball: s['ball'] = ball
    if markers: s['markers'] = markers
    s['steps'] = steps
    return s


def tag(x, y, text, at=None, hide=None):
    m = {'type': 'tag', 'x': r(x), 'y': r(y), 'text': text}
    if at is not None: m['showAt'] = at
    if hide is not None: m['hideAt'] = hide
    return m


def dot(x, y, label, at=None):
    m = {'type': 'dot', 'x': r(x), 'y': r(y), 'label': label}
    if at is not None: m['showAt'] = at
    return m


CENTER = {'type': 'line', 'x1': CX, 'y1': 0, 'x2': CX, 'y2': WD, 'color': 'focus'}
GOAL = {'type': 'line', 'x1': L, 'y1': P1, 'x2': L, 'y2': P2, 'color': 'focus'}
KEYR = {'type': 'key', 'side': 'right'}
def side_line(x1, x2): return {'type': 'line', 'x1': x1, 'y1': 0, 'x2': x2, 'y2': 0, 'color': 'focus'}
def end_line_left(y1, y2): return {'type': 'line', 'x1': 0, 'y1': y1, 'x2': 0, 'y2': y2, 'color': 'focus'}
def zone(x, y): return {'type': 'circle', 'x': x, 'y': y, 'r': 1}

H = {'holder': 'A1'}
S = {}
SX = CX - 0.4   # 센터라인에 걸친 휠체어 중심 (앞바퀴 프론트, 뒷바퀴 백)

# ── 센터라인·백코트 ──
S['9.73.2'] = scene(
    [act('A1', SX, CY)], ball=H, hl=[CENTER],
    markers=[dot(CX + 1.2, CY + 2.2, '프론트코트에 튕김', 1.3), dot(CX - 1.6, CY + 3.6, '백코트에 튕김', 3.6)],
    steps=[step(0, 'A1이 센터라인에 걸쳐 멈춰 있다 (앞바퀴 프론트코트, 뒷바퀴 백코트)'),
           step(1.3, 'A1이 볼을 프론트코트 바닥에 튕긴다', ball=[CX + 1.2, CY + 2.2]),
           step(2.4, ball={'holder': 'A1'}),
           step(3.6, '이번에는 백코트 바닥에 튕긴다', ball=[CX - 1.6, CY + 3.6]),
           step(4.7, ball={'holder': 'A1'}),
           step(5.4, '두 경우를 각각 판정한다')])

S['9.73.3'] = scene(
    [act('A1', CX - 2.6, CY)], ball=H, hl=[CENTER],
    steps=[step(0, 'A1이 볼을 몰고 백코트에서 올라간다'),
           step(1.3, '센터라인을 넘는 순간 볼을 프론트코트에 튕긴다', move={'A1': (SX, CY)}, ball=[CX + 0.9, CY]),
           step(2.3, move={'A1': (CX + 1.6, CY)}, ball={'holder': 'A1'}),
           step(3.3, '같은 장면에서 이번에는 백코트에 튕긴다면?', move={'A1': (CX - 2.6, CY)}),
           step(4.6, move={'A1': (SX, CY)}, ball=[CX - 1.3, CY]),
           step(5.6, move={'A1': (CX + 1.6, CY)}, ball={'holder': 'A1'}),
           step(6.4, END)])

S['9.73.7'] = scene(
    [act('A1', SX, CY), act('B1', CX + 3.4, CY - 1.6, PI)], ball=H, hl=[CENTER],
    markers=[tag(CX - 1.6, CY - 2.4, '바퀴 하나가 백코트로', 2.6)],
    steps=[step(0, 'A1이 센터라인에 두 바퀴씩 걸쳐 있다'),
           step(1.3, 'B1이 다가와 압박한다', move={'B1': (CX + 1.7, CY - 1.0)}, face={'B1': 2.8}),
           step(2.6, '볼을 지키려 몸을 틀다 프론트코트 바퀴 하나가 백코트로 굴러 들어간다', move={'A1': (CX - 0.75, CY + 0.2)}, face={'A1': 0.7}),
           step(4.2, END)])

S['9.73.8'] = scene(
    [act('A1', SX, CY), act('B1', CX + 3.4, CY - 1.4, PI), act('B2', CX + 3.4, CY + 1.4, PI)], ball=H, hl=[CENTER],
    markers=[tag(CX + 1.9, CY + 3.3, '캐스터는 센터라인에 닿지 않음', 2.6)],
    steps=[step(0, 'A1이 센터라인에 두 바퀴씩 걸쳐 있다'),
           step(1.3, 'B1·B2가 압박한다', move={'B1': (CX + 1.6, CY - 0.9), 'B2': (CX + 1.6, CY + 0.9)}),
           step(2.6, '볼을 지키려다 휠체어가 뒤로 조금 밀린다', move={'A1': (SX - 0.2, CY)}),
           step(4.0, END)])

S['9.73.9'] = scene(
    [act('A1', SX, CY), act('A2', CX + 4.5, CY - 2.6), act('B1', CX + 2.6, CY + 1.2, PI)], ball=H, hl=[CENTER],
    markers=[tag(CX - 0.2, CY - 2.1, '앞바퀴를 듦 (안티팁에 기댐)', 1.3)],
    steps=[step(0, 'A1이 센터라인에 걸쳐 있다 (앞바퀴 프론트코트, 뒷바퀴 백코트)'),
           step(1.3, 'A1이 안티팁에 기대 앞바퀴를 들어 올린다'),
           step(2.6, 'A1이 프론트코트의 A2에게 패스한다', ball={'holder': 'A2'}),
           step(4.0, END)])

# ── 트라이 라인 ──
S['8.65.1'] = scene(
    [act('A1', L - 6.2, CY + 0.5)], ball={'x': L - 4.2, 'y': CY + 0.5}, hl=[GOAL],
    markers=[tag(L - 1.6, CY + 2.6, '볼이 바퀴에 끼임', 2.6)],
    steps=[step(0, '볼이 A1이 공격하는 트라이 라인 쪽으로 굴러간다'),
           step(1.3, 'A1이 따라붙는다', move={'A1': (L - 3.2, CY + 0.5)}, ball=[L - 2.1, CY + 0.9]),
           step(2.6, '라인 직전에 볼을 바퀴에 끼워 고정한다', move={'A1': (L - 1.9, CY + 0.5)}, ball=[L - 1.75, CY + 0.95]),
           step(3.9, '그대로 트라이 라인을 넘는다', move={'A1': (L + 1.0, CY + 0.5)}, ball=[L + 1.15, CY + 0.95]),
           step(5.2, END)])

S['9.77.1'] = scene(
    [act('A1', L - 2.4, CY)], ball=H, hl=[GOAL],
    markers=[tag(L - 0.6, CY - 2.0, '앞바퀴 하나만 라인 너머', 1.3, 2.6), tag(L - 0.6, CY - 2.0, '앞바퀴를 들었다 놓으며 민다', 2.6)],
    steps=[step(0, 'A1이 트라이 라인으로 다가간다'),
           step(1.3, '앞바퀴 하나를 라인 너머에 두고 멈춘다', move={'A1': (L - 0.55, CY - 0.1)}, face={'A1': -0.45}),
           step(2.6, '두 번째 바퀴가 닿기 전에 앞바퀴를 위아래로 들어 올리며 계속 민다', move={'A1': (L - 0.3, CY - 0.1)}),
           step(4.0, END)])

S['9.77.2'] = scene(
    [act('A1', L - 3.0, CY), act('B3', L - 0.9, CY - 1.4, PI), act('B4', L - 0.9, CY + 1.4, PI)], ball=H, hl=[GOAL],
    markers=[tag(L - 2.6, CY + 3.2, '앞 캐스터가 공중에 뜬 채', 1.3, 3.9)],
    steps=[step(0, 'B3·B4가 라인 앞을 지키고 A1이 득점을 노린다'),
           step(1.3, '앞 캐스터가 바닥에서 떨어진 채 트라이 라인을 넘는다', move={'A1': (L - 0.35, CY)}),
           step(2.6, '캐스터가 다시 닿기 전에 B3·B4가 A1을 가둔다', move={'B3': (L - 0.35, CY - 1.15), 'B4': (L - 0.35, CY + 1.15)}),
           step(3.9, '버티다 두 캐스터가 코트 안쪽으로 돌아와 바닥에 닿는다', move={'A1': (L - 1.0, CY)}),
           step(5.3, END)])

S['11.88.1'] = scene(
    [act('A1', L - 8.0, CY + 1.6), act('B1', L - 4.6, P1 + 0.6, 0.3)], ball=H, hl=[GOAL],
    markers=[tag(L - 0.6, P1 - 1.2, '포스트 사이', 3.0)],
    steps=[step(0, 'A1이 수비 없이 트라이 라인 쪽으로 간다'),
           step(1.5, 'A1이 라인 앞에서 일부러 멈춘다', move={'A1': (L - 3.6, CY + 1.0)}),
           step(3.0, 'B1이 A1을 무시하고 포스트 사이로 코트를 벗어난다', move={'B1': (L + 1.2, P1 + 1.8)}, face={'B1': 0.2}),
           step(4.4, END)])

S['11.93.7'] = scene(
    [act('A1', L - 4.6, P1 + 0.9), act('B1', L - 2.6, CY, -1.2)], ball=H, hl=[GOAL],
    markers=[tag(L - 3.2, P1 + 2.6, '포스트와 범퍼 사이 몇 cm', 1.4)],
    steps=[step(0, 'A1이 포스트 근처로 득점을 노린다'),
           step(1.4, 'B1이 먼저 라인 쪽으로 내려와 길을 막는다', move={'B1': (L - 0.55, P1 + 0.85)}, face={'B1': UP}),
           step(2.8, 'A1이 B1과 접촉한다', move={'A1': (L - 1.95, P1 + 0.9)}),
           step(4.0, 'A1이 계속 밀어 B1을 트라이 라인 너머로 밀어낸다', move={'A1': (L - 1.2, P1 + 0.9), 'B1': (L + 0.6, P1 + 0.95)}),
           step(5.4, END)])

S['11.94.3'] = scene(
    [act('A1', L - 2.6, CY), act('B1', L - 0.75, CY - 0.95, PI), act('B2', L - 0.75, CY + 0.95, PI), act('A4', L - 6.4, CY)], ball=H, hl=[GOAL],
    steps=[step(0, 'B1·B2가 A1의 길을 일부 막고 있다'),
           step(1.4, 'A4가 뒤에서 A1을 한 번 들이받는다', move={'A4': (L - 4.0, CY)}),
           step(2.6, 'A1이 밀려 트라이 라인을 넘는다', move={'A1': (L + 0.9, CY), 'A4': (L - 3.4, CY), 'B1': (L - 0.75, CY - 1.3), 'B2': (L - 0.75, CY + 1.3)}),
           step(4.0, END)])

S['11.94.4'] = scene(
    [act('A3', L - 5.6, CY), act('B2', L - 0.8, CY, PI)], ball={'holder': 'A3'}, hl=[KEYR],
    markers=[tag(L - 3.4, CY + 2.2, '1차 접촉', 1.3, 2.6)],
    steps=[step(0, 'A3가 키로 들어간다. B2가 트라이 라인 앞을 지킨다'),
           step(1.3, 'A3가 B2와 부딪힌다', move={'A3': (L - 2.15, CY)}),
           step(2.6, 'A3가 멈추지 않고 계속 밀어 B2를 트라이 라인 밖으로 밀어낸다', move={'A3': (L - 0.6, CY), 'B2': (L + 0.75, CY)}),
           step(4.0, END)])

# ── 키 에어리어 ──
S['9.80.2'] = scene(
    [act('A2', KX - 2.2, CY, PI), act('B1', KX - 3.6, CY, 0), act('A1', KX - 6.5, CY - 4.0)], ball=H, hl=[KEYR],
    markers=[tag(KX - 2.6, CY + 1.9, '안티팁만 키 안', 1.4), tag(KX - 3.6, CY - 2.5, '9초 동안 묶임', 2.8)],
    steps=[step(0, 'A팀이 볼을 갖고 있고, A2가 공격 키 쪽으로 뒤로 물러난다'),
           step(1.4, 'A2의 안티팁이 키 안으로 들어간다', move={'A2': (KX - 0.6, CY), 'B1': (KX - 2.0, CY)}),
           step(2.8, 'B1에게 막혀 A2가 그 자리에 9초 동안 묶여 있다'),
           step(4.2, END)])

S['11.91.3'] = scene(
    [act('B1', L - 0.8, P1 + 1.3, PI), act('B3', L - 0.8, CY, PI), act('B4', L - 0.8, P2 - 1.3, PI),
     act('B2', KX - 1.0, CY - 1.6, UP), act('A1', KX - 5.6, CY + 2.4)], ball=H, hl=[KEYR],
    markers=[tag(KX - 0.4, P1 - 1.0, '앞 캐스터를 들고 키 위로', 1.4)],
    steps=[step(0, 'B팀 셋이 키 안에, B2는 키 바로 위에 있다'),
           step(1.4, 'B2가 방향을 돌리며 앞 캐스터를 들어 키 위로 넘긴다', move={'B2': (KX - 0.7, CY - 1.0)}, face={'B2': 0}),
           step(2.8, '캐스터가 키 바닥에 닿지 않은 채 B2가 지나간다', move={'B2': (KX - 0.9, CY + 1.4)}, face={'B2': DOWN}),
           step(4.2, END)])

# ── 인바운드 지점·1m ──
S['8.69.1'] = scene(
    [act('B3', L + 1.3, P1 + 1.5, PI), act('A1', L + 0.6, CY + 1.0, PI), act('B1', L - 5.0, CY, PI)],
    ball={'holder': 'B3'}, hl=[GOAL],
    steps=[step(0, 'A1의 트라이 뒤 B3가 엔드라인 밖에서 스로인 볼을 받는다'),
           step(1.4, 'B3가 엔드라인을 따라 다른 지점으로 옮긴다', move={'B3': (L + 1.3, P2 - 0.6), 'A1': (L - 2.0, CY - 1.5)}),
           step(2.8, '그 자리에서 B1에게 스로인한다', ball={'holder': 'B1'}),
           step(4.2, END)])

S['8.69.2'] = scene(
    [act('A1', -1.3, CY + 2.0, 0), act('A2', 4.5, CY - 1.5), act('B1', 3.0, CY + 2.0, PI)], ball=H,
    hl=[end_line_left(0, WD)],
    markers=[tag(-0.2, CY + 4.0, '8초 카운트', 0.6, 2.4), tag(-0.2, CY + 4.0, '8초 초과', 2.4)],
    steps=[step(0, 'A1이 엔드라인 밖에서 스로인을 준비한다'),
           step(1.2, 'A2는 B1에게 막혀 빠져나오지 못한다', move={'A2': (3.6, CY - 0.4), 'B1': (2.0, CY + 1.5)}),
           step(2.4, 'A1이 8초 안에 스로인하지 못한다'),
           step(3.8, 'B팀은 어디서 스로인하는가?')])

S['8.69.9'] = scene(
    [act('A2', 3.0, CY - 1.0, PI), act('A3', 7.0, 3.0, UP)], ball={'x': -0.9, 'y': CY}, hl=[end_line_left(P1, P2)],
    markers=[tag(-0.2, CY + 2.3, '8초 카운트', 0.4, 3.0)],
    steps=[step(0, 'A팀이 오지 않아 레퍼리가 트라이 뒤 엔드라인 밖에 볼을 놓고 8초 카운트를 시작한다'),
           step(1.5, 'A2가 엔드라인 밖으로 나가 볼을 집는다', move={'A2': (-1.1, CY - 0.3)}, ball={'holder': 'A2'}),
           step(3.0, '같은 일이 사이드라인 스로인에서 생긴다면?', ball=[7.0, -0.9]),
           step(4.5, 'A3가 사이드라인 밖으로 나가 볼을 집는다', move={'A3': (7.0, -1.1)}, ball={'holder': 'A3'}),
           step(6.0, END)])

S['9.81.5'] = scene(
    [act('A1', 10.0, -1.5, DOWN), act('A2', 13.0, 3.2, PI)], ball=H, hl=[zone(10.0, 0)],
    markers=[tag(7.6, 2.0, '1m 반경', 0.5)],
    steps=[step(0, 'A1이 사이드라인 밖에서 스로인을 준비한다'),
           step(1.3, 'A1이 A2에게 스로인한다', ball={'holder': 'A2'}),
           step(2.6, 'A1이 45도 각도로 1m 반경 안으로 코트에 들어온다', move={'A1': (10.6, 0.6)}, face={'A1': 0.785}),
           step(4.0, END)])

S['9.81.6'] = scene(
    [act('A1', 10.0, -1.4, DOWN), act('A2', 12.6, 3.4, PI)], ball=H, hl=[side_line(6.5, 13.5)],
    markers=[tag(7.4, 1.7, '앞 캐스터가 사이드라인에 닿음', 1.3)],
    steps=[step(0, 'A1이 사이드라인 밖에서 스로인을 준비한다'),
           step(1.3, '몸을 움직이다 앞 캐스터가 사이드라인에 닿는다', move={'A1': (10.0, -0.72)}),
           step(2.4, '바로 그때 A1이 볼을 떠나보낸다', ball={'holder': 'A2'}),
           step(3.8, END)])

S['9.81.7'] = scene(
    [act('A1', 10.0, -1.5, DOWN), act('A2', 13.4, 4.4, PI), act('B1', 10.6, 2.0, 0)], ball=H, hl=[zone(10.0, 0)],
    markers=[tag(7.6, 2.0, '1m 반경', 0.5)],
    steps=[step(0, 'A1이 스로인을 준비하고 B1이 기다린다'),
           step(1.3, 'A1이 A2에게 스로인한다', ball={'holder': 'A2'}),
           step(2.6, 'A1이 비스듬히 돌아 코트 밖 사이드라인을 따라 달린다', move={'A1': (12.3, -0.9), 'B1': (12.0, 1.9)}, face={'A1': 0}),
           step(3.9, '1m 구역 밖에서 들어와 B1을 제친다', move={'A1': (14.2, 0.9), 'B1': (13.0, 2.0)}, face={'A1': 0.5}),
           step(5.3, END)])

S['11.97.2'] = scene(
    [act('A1', -1.3, CY + 3.0, 0), act('B1', 0.9, CY, 0), act('A2', 1.0, CY - 1.15, PI), act('A3', 1.0, CY + 1.15, PI),
     act('A4', 4.5, CY + 3.0, PI)], ball=H, hl=[zone(0, CY)],
    markers=[tag(3.6, CY - 3.2, '1m 제한 구역', 1.4)],
    steps=[step(0, '트라이 뒤 A1이 엔드라인에서 인바운드한다. A2·A3가 B1을 가두고 있다'),
           step(1.4, 'A1이 엔드라인을 따라 B1 쪽으로 옮긴다. 세 선수 모두 1m 안이다', move={'A1': (-1.3, CY)}),
           step(2.8, 'A1이 A3에게 패스한다', ball={'holder': 'A3'}),
           step(4.2, END)])

S['12.99.7'] = scene(
    [act('A1', 10.0, -1.5, DOWN), act('A2', 13.4, 4.4, PI), act('B1', 11.7, 1.75, UP)], ball=H, hl=[zone(10.0, 0)],
    markers=[tag(13.9, 1.4, 'B1은 1m 구역 밖', 0.5)],
    steps=[step(0, 'A1이 스로인을 준비한다. B1은 1m 구역 밖에 있다'),
           step(1.3, 'A1이 A2에게 스로인한다', ball={'holder': 'A2'}),
           step(2.6, 'A1이 B1 쪽으로 비스듬히 들어온다', move={'A1': (10.9, 0.25)}, face={'A1': 0.9}),
           step(3.9, 'B1과 부딪히지 않고는 완전히 들어올 수 없게 된다'),
           step(5.2, END)])

S['12.99.9'] = scene(
    [act('A1', 10.0, -1.5, DOWN), act('A2', 13.0, 2.0, 0), act('B1', 14.4, 3.4, -2.3), act('B2', 12.0, 3.6, -0.8)],
    ball=H, hl=[zone(10.0, 0)],
    markers=[tag(9.0, 2.8, 'A1이 A2를 받쳐 준다', 3.9)],
    steps=[step(0, 'A1이 1m 밖, 사이드라인 가까이에 있는 A2를 본다'),
           step(1.3, 'A1이 A2에게 인바운드한다', ball={'holder': 'A2'}),
           step(2.6, 'B1·B2가 A2를 사이드라인 쪽으로 밀어붙인다', move={'A2': (13.2, 1.45), 'B1': (14.2, 2.6), 'B2': (12.3, 2.7), 'A1': (11.2, 0.4)}, face={'A1': 0}),
           step(3.9, '코트에 들어온 A1이 A2와 접촉해 A2가 밖으로 나가지 않게 막는다', move={'A1': (12.7, 0.5)}),
           step(5.3, END)])

# ── 코트 밖·재진입 ──
S['8.63.5'] = scene(
    [act('A1', L + 1.3, P2 - 1.0, UP), act('B1', L - 3.0, P1 + 2.4, -0.5)], hl=[GOAL],
    steps=[step(0, '득점한 A1이 반대편으로 들어가려고 엔드라인 뒤로 돌아간다'),
           step(1.4, 'A1이 엔드라인 밖에서 코트로 들어서려 한다', move={'A1': (L + 1.3, P1 + 1.2)}),
           step(2.6, '앞 캐스터가 코트에 들어서는 순간 B1이 막아선다', move={'A1': (L + 0.55, P1 + 1.2), 'B1': (L - 1.0, P1 + 1.2)}, face={'A1': PI, 'B1': 0}),
           step(3.9, 'A1이 다시 밖으로 물러나 다른 지점에서 들어간다', move={'A1': (L + 1.3, P1 - 1.4)}),
           step(5.2, move={'A1': (L - 1.8, P1 - 1.4)}),
           step(6.2, END)])

S['11.93.1'] = scene(
    [act('A2', 7.0, 1.0, 0), act('B1', 7.8, 2.3, -0.3)], hl=[side_line(7, 16)],
    steps=[step(0, 'A2가 사이드라인을 따라 B1을 앞지르려 한다'),
           step(1.4, 'B1이 A2를 코트 밖으로 밀어낸다', move={'A2': (10.0, -0.75), 'B1': (10.0, 0.9)}, face={'B1': 0}),
           step(2.8, 'A2가 코트 밖으로 계속 달린다', move={'A2': (14.4, -0.85), 'B1': (12.6, 0.95)}),
           step(4.0, 'A2가 B1 앞에서 코트로 들어온다', move={'A2': (15.6, 1.0), 'B1': (13.6, 1.0)}, face={'A2': 0.5}),
           step(5.4, END)])

S['11.93.3'] = scene(
    [act('A1', L - 1.4, P1 - 0.7, PI), act('B1', L - 2.9, P1 + 0.4, -0.4), act('A2', L - 6.0, CY + 1.6)], ball=H, hl=[GOAL],
    markers=[tag(L - 1.0, P1 + 1.6, '포스트', 2.8)],
    steps=[step(0, 'A1이 트라이 라인 근처, 키 밖에서 B1의 압박을 받는다'),
           step(1.4, 'A1이 A2에게 패스한다', ball={'holder': 'A2'}),
           step(2.8, 'A1이 뒤로 물러나다 포스트에 닿는다', move={'A1': (L - 0.7, P1 - 0.6)}),
           step(4.2, END)])

S['11.93.4'] = scene(
    [act('A2', 14.0, 1.3, -0.4), act('B3', 12.8, 2.5, -0.6), act('B4', 15.3, 2.6, -2.4)], hl=[side_line(10, 18)],
    steps=[step(0, 'A2가 사이드라인 근처에서 B3·B4에게 막혀 있다'),
           step(1.4, '벗어나려던 A2가 코트를 벗어난다', move={'A2': (14.2, -1.0)}, face={'A2': UP}),
           step(2.8, 'B3·B4가 다가가 A2가 코트로 다시 못 들어오게 막는다', move={'B3': (13.4, 0.7), 'B4': (15.0, 0.7)}, face={'B3': -0.3, 'B4': -2.8}),
           step(4.2, END)])

p = os.path.join(QUIZ, 'data', 'cases.json')
d = json.load(io.open(p, encoding='utf-8'))
ids = {c['id']: c for c in d['cases']}
missing = [k for k in S if k not in ids]
if missing:
    sys.exit('없는 케이스: %s' % missing)
for k, sc in S.items():
    ids[k]['scene'] = sc
io.open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, ensure_ascii=False, indent=1))
print('scenes added:', len(S), '| total with scene:', sum(1 for c in d['cases'] if c.get('scene')))

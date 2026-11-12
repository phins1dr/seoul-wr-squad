# -*- coding: utf-8 -*-
import json, sys
sys.path.insert(0,'.')
import ko_cases_3_6, ko_cases_7, ko_cases_8, ko_cases_9, ko_cases_10_11, ko_cases_12_13
KO = []
for m in (ko_cases_3_6, ko_cases_7, ko_cases_8, ko_cases_9, ko_cases_10_11, ko_cases_12_13):
    KO += m.C
old = json.load(open('/workspace/repos/seoul-wr-squad/academy/quiz/data/cases.json'))
oldcases = {c['id']: c for c in old['cases']}

SCENES = {
 '9.81.10': {
   "court": "full", "duration": 5.4,
   "highlight": [{"type": "line", "x1": 11.5, "y1": 0, "x2": 16.5, "y2": 0, "color": "focus"}],
   "actors": [{"id": "A1", "team": "A", "x": 14, "y": -0.55, "a": 1.57}],
   "ball": {"holder": "A1"},
   "markers": [{"type": "dot", "x": 14, "y": 0, "text": "사이드라인", "showAt": 0}],
   "steps": [
     {"at": 0, "caption": "A1이 사이드라인 밖에서 인바운드를 준비한다"},
     {"at": 1.6, "caption": "볼을 바닥에 내려놓는다", "ball": [14, -0.35]},
     {"at": 3.0, "caption": "볼이 코트 밖 바닥을 지나 코트 안으로 굴러간다", "ball": [14, 1.2]},
     {"at": 4.4, "caption": "볼이 코트에 들어왔지만 코트 밖 바닥에 먼저 닿았다"}
   ]
 },
 '11.91.1': {
   "court": "full", "duration": 4.8,
   "highlight": [{"type": "key", "side": "right"}],
   "actors": [{"id": "A2", "team": "A", "x": 21.6, "y": 7.5, "a": 0},
              {"id": "B3", "team": "B", "x": 22.7, "y": 7.5, "a": 3.14}],
   "ball": {"holder": "A2"},
   "markers": [{"type": "tag", "x": 22.4, "y": 10.6, "text": "네 번째 수비수", "showAt": 2.0}],
   "steps": [
     {"at": 0, "caption": "B3가 키 위쪽에서 수비하고, A2가 달려온다"},
     {"at": 1.2, "caption": "A2의 적법한 충돌", "move": {"A2": [22.6, 7.5]}},
     {"at": 2.4, "caption": "B3가 키 안으로 밀려 들어간다", "move": {"B3": [23.6, 7.5]}},
     {"at": 3.8, "caption": "B3는 이제 키 안의 네 번째 수비수다"}
   ]
 },
 '11.97.1': {
   "court": "full", "duration": 5.2,
   "highlight": [{"type": "circle", "x": 14, "y": 0, "r": 1}],
   "actors": [{"id": "A1", "team": "A", "x": 14, "y": -0.55, "a": 1.57},
              {"id": "A2", "team": "A", "x": 12.2, "y": 0.5, "a": 0}],
   "ball": {"holder": "A1"},
   "markers": [{"type": "tag", "x": 11.4, "y": 2.4, "text": "1m 제한 구역", "showAt": 0.6}],
   "steps": [
     {"at": 0, "caption": "A1이 사이드라인에서 스로인을 준비한다"},
     {"at": 1.4, "caption": "A2가 1m 구역 안으로 A1 앞을 지나간다", "move": {"A2": [14, 0.45]}},
     {"at": 2.6, "caption": "A2가 구역 반대편에서 볼을 받는다", "move": {"A2": [15.6, 0.5]}, "ball": {"holder": "A2"}},
     {"at": 4.2, "caption": "1m 제한선은 양 팀 모두 침범할 수 없다"}
   ]
 },
}

SCENE_FROM = {'8.63.1':'8.63.1','8.63.4':'8.63.4','8.68.2':'8.68.2','9.80.4':'9.80.4',
              '9.81.10':'9.81.10','11.91.1':'11.91.1','11.97.1':'11.97.1'}
split = {c['caseNo']: c for c in json.load(open('build/casebook_split.json')) if len(c['q']) >= 40}
missing = [k['n'] for k in KO if k['n'] not in split]
print('ko entries', len(KO), 'missing EN:', missing)

CH = [
 (3, '장비', 'EQUIPMENT', '7'),
 (4, '휠체어', 'WHEELCHAIR', '8~9'),
 (5, '팀', 'TEAMS', '9~11'),
 (6, '오피셜', 'OFFICIALS', '11~13'),
 (7, '시간 규정', 'TIMING REGULATIONS', '13~18'),
 (8, '경기 규정', 'PLAYING REGULATIONS', '18~27'),
 (9, '바이얼레이션', 'VIOLATIONS', '27~36'),
 (10, '접촉의 원칙', 'PRINCIPLES OF CONTACT', '36~37'),
 (11, '일반 파울', 'COMMON FOULS', '37~42'),
 (12, '테크니컬·플래그런트·디스퀄리파잉 파울', 'TECHNICAL, FLAGRANT AND DISQUALIFYING FOULS', '42~49'),
 (13, '페널티', 'PENALTIES', '49'),
]
cases = []
for k in KO:
    n = k['n'].replace('디스쿄', '디스퀄')
    src = split.get(n) or split.get({'12.103.1':'12.10.3'}.get(n, ''))
    if not src: 
        continue
    chapter = n.split('.')[0]
    ch = str(3)
    if k.get('ox') is not None:
        choices = ['옳다', '옳지 않다']
        choicesEn = ['Correct', 'Incorrect']
        ans = k['a']
    else:
        choices = k['c']; choicesEn = k.get('cEn') or k['c']; ans = k['a']
    item = {
      'id': n, 'chapter': chapter, 'caseNo': n, 'page': (src['page'] or 0) + 2,
      'relatedArticles': [str(a) for a in k['arts']],
      'question': k['q'].replace('디스쿄', '디스퀄'),
      'questionEn': src['q'],
      'choices': [x.replace('디스쿄', '디스퀄') for x in choices],
      'choicesEn': choicesEn,
      'answer': ans,
      'explanation': k['e'].replace('디스쿄', '디스퀄'),
      'explanationEn': src['a'],
      'rule': '',
    }
    if k['n'] in SCENES:
        item['scene'] = SCENES[k['n']]
    elif k['n'] in SCENE_FROM and oldcases.get(SCENE_FROM[k['n']], {}).get('scene'):
        item['scene'] = oldcases[SCENE_FROM[k['n']]]['scene']
    cases.append(item)
cases.sort(key=lambda c: (int(c['chapter']), [int(x) for x in c['caseNo'].split('.')[1:]]))
data = {
 'meta': {
   'title': '휠체어럭비 케이스북 퀴즈',
   'source': 'WWR Casebook 2026 — Interpretations from the International Rules for the Sport of Wheelchair Rugby',
   'sourceKo': 'World Wheelchair Rugby 케이스북 2026 (48쪽)',
   'edition': '2026 Casebook (2026년 1월 1일 개정 규정 기준)',
   'updated': '2026-11-12',
   'note': '문항은 2026 케이스북의 케이스 항목을 하나씩 퀴즈로 옮긴 것입니다. 국문은 이번에 새로 번역했고, 영문은 케이스북 원문을 그대로 실었습니다. 케이스북이 "Is this correct?" 형태로 묻는 항목은 보기를 옳다/옳지 않다로 두었습니다. a)·b) 등 여러 상황을 함께 묻는 케이스는 한 상황을 골라 단일 정답으로 만들고, 고르지 않은 상황은 해설에 적었습니다.',
   'sourceNote': '출처: World Wheelchair Rugby, Interpretations from the International Rules for the Sport of Wheelchair Rugby (WWR Casebook 2026), worldwheelchair.rugby',
 },
 'chapters': [{'id': str(i), 'title': t, 'en': e, 'pages': p} for i, t, e, p in CH],
 'cases': cases,
}
json.dump(data, open('/workspace/repos/seoul-wr-squad/academy/quiz/data/cases.json','w'), ensure_ascii=False, indent=1)
from collections import Counter
print('cases', len(cases), Counter(c['chapter'] for c in cases))
print('scenes', sum(1 for c in cases if c.get('scene')))
# coverage check: which casebook cases are not covered
nocover = sorted(set(c for c in split if c.split('.')[0] in [str(i) for i,_,_,_ in CH]) - set(x['caseNo'] for x in cases))
print('casebook cases', len(split), 'not covered', nocover)

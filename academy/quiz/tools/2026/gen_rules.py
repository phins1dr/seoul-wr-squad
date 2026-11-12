# -*- coding: utf-8 -*-
import json, re, sys
sys.path.insert(0,'.')
import ko_part1, ko_part2
KO = {}
KO.update(ko_part1.KO); KO.update(ko_part2.KO)
KO[104] = KO[104].replace('디스쿨리파잉','디스퀄리파잉')

new = {a['no']: a for a in json.load(open('build/rules2026_articles.json'))}
OLDSRC = 'build/rules2021.json'
_old = json.load(open(OLDSRC))
assert '2021' in _old['meta']['edition'], '2021 원본이 아니다 — 잘못된 파일을 기준으로 삼을 뻔했다'
old = {a['no']: a for a in _old['articles']}
def oldno(n): return n if n <= 81 else n + 1

CHANGED = {
 27: "캐스터 휠의 빛 방출 금지 문구가 추가되었습니다.",
 35: "여자 선수 등급분류 점수 보정: 0.5~1.5등급은 팀당 +0.5점, 2.0~3.5등급은 +1.0점.",
 36: "선발 선수의 10분 이후 교체 제한 문구가 삭제되고 코치 서명 절차가 정리되었습니다.",
 40: "기술위원(TC) 자리가 게임 커미셔너로 바뀌고 테이블 심판장 표현이 반영되었습니다.",
 43: "주어진 시간(60초) 안에 처리하지 못하면 교체하도록 명시되었습니다.",
 46: "타임아웃을 기록할 때 시간·피리어드·팀을 함께 적도록 명시되었습니다.",
 49: "페널티 기록 항목이 '파울을 범한 선수와 피리어드'에서 '파울이 발생한 시간과 피리어드'로 바뀌었습니다.",
 50: "피리어드 사이 휴식이 1·3피리어드 뒤 3분, 2피리어드 뒤 10분으로 고정되었습니다.",
 56: "타임아웃이 전·후반 각 3개(60초)로 바뀌고, 부여 시 벤치로 가야 하며, 요청 시점과 철회 규정이 새로 정리되었습니다.",
 58: "넘어짐으로 움직일 수 없는 선수에게는 이 조항을 적용하지 않는다는 단서가 붙었습니다.",
 59: "장비 문제만으로 움직일 수 없는 선수 예외가 이 조항 첫머리로 정리되었습니다.",
 68: "프론트코트·백코트 기준 문구가 69조에서 이 조항으로 옮겨졌습니다.",
 69: "타임아웃 뒤 볼을 프론트코트로 옮길 수 있는 요건이 정리되었습니다.",
 79: "드리블 제한 시간이 10초에서 8초로 바뀌었습니다.",
 80: "키 에어리어 제한 시간이 10초에서 8초로 바뀌었습니다.",
 81: "인바운드 제한 시간이 10초에서 8초로 바뀌었습니다.",
 88: "수비자 일반 파울의 페널티가 60초에서 30초로 바뀌었습니다.",
 98: "테크니컬 파울의 페널티가 60초에서 30초로 바뀌었습니다.",
 99: "타임아웃 요청과 관련된 항목이 삭제되고, 적법한 1차 접촉 뒤 불안정한 선수와의 접촉 항목이 들어왔습니다.",
 100: "등급분류 카드 제시 항목이 삭제되고 103조 참조가 102조로 바로잡혔습니다.",
 101: "장비 테크니컬 파울에서 60초 타임아웃을 잃는 요소가 삭제되었습니다.",
 104: "디스퀄리파잉 파울의 페널티가 60초에서 40초로 바뀌었습니다.",
 111: "2명 미만으로는 경기를 계속할 수 없음이 명시되고 조항 참조 번호가 정리되었습니다.",
}
KO_NEW_NO_BADGE = {42, 52, 105}   # 표현 정리만 된 조항(새 번역, 배지 없음)

TITLE_KO = {79: "8초 드리블 바이얼레이션", 80: "8초 키 에어리어 바이얼레이션",
            82: "팁 오프 바이얼레이션", 83: "40초 바이얼레이션"}

# 2021년판 국문을 재사용한 조항 중, 조 번호가 한 칸 밀린 곳(2021년 83~112조 → 2026년 82~111조)의 상호참조
REF_FIX = {44: [('112조', '111조')], 110: [('112조', '111조')], 95: [('87조', '86조')]}

CH = [
 (1, 1, 1, "SECTION 1. The Game", "게임"),
 (2, 2, 13, "SECTION 2. Field of play", "경기장"),
 (3, 14, 22, "SECTION 3. Equipment", "장비"),
 (4, 23, 32, "SECTION 4. Wheelchair", "휠체어"),
 (5, 33, 39, "SECTION 5. Teams", "팀"),
 (6, 40, 49, "SECTION 6. Officials", "오피셜"),
 (7, 50, 59, "SECTION 7. Timing Regulations", "시간 규정"),
 (8, 60, 71, "SECTION 8. Playing regulations", "경기 규정"),
 (9, 72, 83, "SECTION 9. Violations", "바이얼레이션"),
 (10, 84, 87, "SECTION 10. Principles of contact", "접촉의 원칙"),
 (11, 88, 97, "SECTION 11. Common Fouls", "일반 파울"),
 (12, 98, 104, "SECTION 12. Technical, Flagrant and Disqualifying fouls", "테크니컬·플래그런트·디스퀄리파잉 파울"),
 (13, 105, 108, "SECTION 13. Penalties", "페널티"),
 (14, 109, 111, "SECTION 14. Concluding the Game", "게임 종료"),
]
CH_EN = {1:"The Game",2:"Field of play",3:"Equipment",4:"Wheelchair",5:"Teams",6:"Officials",
 7:"Timing Regulations",8:"Playing regulations",9:"Violations",10:"Principles of contact",
 11:"Common Fouls",12:"Technical, Flagrant and Disqualifying fouls",13:"Penalties",14:"Concluding the Game"}

def normt(t):
    t = t.lower().replace('colour', 'color').replace('centre', 'center').replace('–', '-').replace('’', "'")
    t = re.sub(r'[^a-z0-9 ]', ' ', t)
    return ' '.join(t.split())
MIS = []
for a in sorted(new.values(), key=lambda x: x['no']):
    o = old.get(oldno(a['no']))
    if o and normt(o['titleEn']) != normt(a['title']):
        MIS.append((a['no'], o['titleEn'], a['title']))
print('제목 불일치:', MIS if MIS else '없음')
assert {m[0] for m in MIS} <= {73, 79, 80, 81}, MIS

articles = []
for a in sorted(new.values(), key=lambda x: x['no']):
    n = a['no']; o = old.get(oldno(n))
    titleKo = TITLE_KO.get(n) or (o['titleKo'] if o else a['title'])
    if n in KO:
        bodyKo = [p.strip() for p in KO[n].split('\n') if p.strip()]
        koNew = True
    else:
        bodyKo = o['bodyKo'] if o else []
        koNew = False
    item = {
        'no': n,
        'chapter': next(c[0] for c in CH if c[1] <= n <= c[2]),
        'titleKo': titleKo,
        'titleEn': a['title'],
        'page': a['page'],
        'bodyKo': bodyKo,
        'bodyEn': a['bodyEn'],
    }
    if n in CHANGED:
        item['changed2026'] = True
        item['changeNote'] = CHANGED[n]
    elif n in KO_NEW_NO_BADGE:
        item['changeNote'] = "표현만 정리되었습니다(규칙 내용 변화 없음)."
    if koNew:
        item['koNew'] = True
    elif n in REF_FIX:
        for a_, b_ in REF_FIX[n]:
            item['bodyKo'] = [p.replace(a_, b_) for p in item['bodyKo']]
        item['koRefFixed'] = [f'{a_}→{b_}' for a_, b_ in REF_FIX[n]]
    articles.append(item)

chapters = []
for cid, lo, hi, en, ko in CH:
    chapters.append({'id': cid, 'title': ko, 'en': CH_EN[cid], 'section': en,
                     'articles': list(range(lo, hi+1))})

data = {
 'meta': {
   'title': '휠체어럭비 국제 경기규정',
   'edition': 'International Rules for the Sport of Wheelchair Rugby — April 2026, World Wheelchair Rugby',
   'editionKo': '2026년 4월판 WWR 국제 경기규정 (2026년 1월 1일 개정판을 이어받은 최신 원문)',
   'scope': '2026 International Rules 1~111조 및 부록 A~C (원문 48쪽)',
   'translation': '영문 원문은 WWR 2026년 4월판 그대로입니다. 국문은 2021년 대한장애인럭비협회 번역본을 조항 내용이 실질적으로 같은 경우 그대로 재사용했고, 2026년에 내용이 바뀌었거나 2021년 번역에 오류가 있던 조항은 새로 번역했습니다.',
   'changedCount': len(CHANGED),
   'articleCount': len(articles),
   'chapterCount': len(chapters),
   'sourceNote': '출처: World Wheelchair Rugby, International rules for the sport of Wheelchair Rugby (April 2026), worldwheelchair.rugby',
 },
 'chapters': chapters,
 'articles': articles,
 'annexes': [
   {'id': 'A', 'titleKo': '경기장', 'titleEn': 'Field of play', 'page': 46},
   {'id': 'B', 'titleKo': '스코어시트', 'titleEn': 'Score sheet', 'page': 47},
   {'id': 'C', 'titleKo': '페널티시트', 'titleEn': 'Penalty sheet', 'page': 48},
 ],
}
json.dump(data, open('/workspace/repos/seoul-wr-squad/academy/quiz/data/rules.json','w'), ensure_ascii=False, indent=1)
print('articles', len(articles), 'changed', len(CHANGED), 'koNew', sum(1 for a in articles if a.get('koNew')))
print('missing ko', [a['no'] for a in articles if not a['bodyKo']])
print('sample 79:', articles[78]['titleKo'], articles[78]['bodyKo'], articles[78].get('changeNote'))

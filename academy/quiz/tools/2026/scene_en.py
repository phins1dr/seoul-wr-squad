"""코트 장면 캡션·표시 글씨의 영어판을 data/cases.json에 넣는다 (captionEn / textEn / labelEn).
한국어 원문을 키로 쓰므로, 장면 캡션을 고치면 여기 사전도 같이 고친다.
실행: python -X utf8 tools/2026/scene_en.py  (academy/quiz 폴더에서)"""
import io, json, sys

EN = {
    '여기까지의 상황이다': "That's the situation.",
    # 8.63.1
    'A2가 사이드라인으로 굴러가는 볼을 쫓는다': 'A2 chases the ball rolling toward the sideline',
    '라인에 닿기 전에 볼을 코트 중앙 쪽으로 건드린다': 'Before it reaches the line, A2 taps it back toward the middle',
    'A2의 가속도로 몸이 코트 밖으로 나간다': "A2's momentum carries the chair out of bounds",
    # 8.63.3
    'A1이 볼을 갖고 백코트에서 올라간다': 'A1 brings the ball up from the backcourt',
    '앞 캐스터가 센터라인을 터치한다': 'A front caster touches the centre line',
    'A1이 다시 백코트로 물러난다': 'A1 backs into the backcourt again',
    # 8.63.4
    'A1이 키 에어리어에서 볼을 몰고 있다': 'A1 is dribbling in the key area',
    '균형을 잃고 트라이라인 쪽으로 기운다': 'A1 loses balance and tips toward the goal line',
    '손이 포스트 사이 트라이라인 밖으로 나간다': 'A hand goes past the goal line between the posts',
    '곧 균형을 되찾고 코트 안으로 돌아온다': 'A1 quickly recovers and comes back onto the court',
    # 8.68.2
    'A1이 볼을 소유한 채 트라이라인으로 나아간다': 'A1 moves to the goal line with the ball',
    '몸을 틀면서 뒷바퀴 하나와 안티팁 하나가 라인을 넘는다': 'Turning, one rear wheel and one anti-tip cross the line',
    '두 바퀴가 라인 너머에 닿았다': 'Two wheels are touching beyond the line',
    # 8.69.3
    'A2·A4가 페널티 박스에서 나올 B3를 가두고 있다': 'A2 and A4 trap B3, who is about to leave the penalty box',
    'A1이 트라이를 성공한다': 'A1 scores a goal',
    'B3가 인바운더라고 알리고 사이드라인 밖을 따라 내려간다': 'B3 says they will inbound and travels down outside the sideline',
    'B3가 엔드라인에 도착한다': 'B3 arrives at the end line',
    # 9.73.1
    'A1은 앞바퀴는 프론트코트, 뒷바퀴는 백코트에 걸쳐 있다': 'A1 has front wheels in the frontcourt and rear wheels in the backcourt',
    'A3도 똑같이 센터라인에 걸쳐 있다': 'A3 is straddling the centre line the same way',
    'A1이 A3에게 패스한다': 'A1 passes to A3',
    # 9.73.6
    'A1이 센터라인에 두 바퀴씩 걸쳐 있다': 'A1 straddles the centre line, two wheels on each side',
    'B1·B2가 다가와 A1을 압박한다': 'B1 and B2 close in and pressure A1',
    'A1이 백코트의 A4에게 패스한다': 'A1 passes to A4 in the backcourt',
    # 9.80.4
    'A3가 볼을 들고 키 에어리어 밖에 있다': 'A3 holds the ball outside the key area',
    '휠이 키 에어리어 바닥에 닿는다': 'A wheel touches the floor of the key area',
    'A3가 키 에어리어를 완전히 떠난다': 'A3 leaves the key area completely',
    # 9.81.10
    'A1이 백코트 사이드라인 밖에서 인바운드를 준비한다': 'A1 prepares to inbound from outside the backcourt sideline',
    '볼을 바닥에 내려놓는다': 'A1 puts the ball on the floor',
    '볼이 코트 밖 바닥을 지나 코트 안으로 굴러간다': 'The ball rolls across the floor outside and onto the court',
    '볼이 코트에 들어왔지만 코트 밖 바닥에 먼저 닿았다': 'The ball came onto the court, but touched the floor outside first',
    # 9.81.11
    'A1이 사이드라인 1m 안쪽에서 스로인을 준비한다. B2는 1m 구역 바로 밖': 'A1 prepares a throw-in within 1 m of the sideline. B2 is just outside the 1 m zone',
    'A1이 A2에게 스로인한다': 'A1 throws in to A2',
    'A1이 사이드라인까지 밀고 올라간다': 'A1 pushes up to the sideline',
    '라인 직전에 45도로 꺾어 B2를 살짝 돌아 들어온다': 'Just before the line A1 cuts in at 45° and slips around B2',
    # 11.88.3
    'A1이 트라이 라인으로 달리고, B1이 옆에서 따라간다': 'A1 drives to the goal line with B1 alongside',
    'B1이 길을 막으며 A1과 접촉한다': 'B1 cuts off the path and makes contact with A1',
    'B1이 A1보다 먼저 트라이 라인을 넘는다': 'B1 crosses the goal line before A1',
    # 11.91.1
    'B팀 셋이 키 안에 있고, B3는 키 위쪽에서 수비한다. A2가 달려온다': 'Three B players are in the key, B3 defends just above it. A2 drives in',
    'A2의 적법한 충돌': 'A2 makes a legal hit',
    'B3가 키 안으로 밀려 들어간다': 'B3 is pushed into the key',
    'B3는 이제 키 안의 네 번째 수비수다': 'B3 is now the fourth defender in the key',
    # 11.91.2
    'B팀 셋이 키 안에, B2는 키 위쪽에 있다. A1이 트라이 라인을 노린다': 'Three B players are in the key, B2 is above it. A1 attacks the goal line',
    'B2가 포스트 쪽으로 가며 키 안을 지나간다': 'B2 heads for the post, passing through the key',
    'B2가 키를 빠져나와 A1 앞을 막는다': 'B2 comes out of the key and blocks A1',
    # 11.93.2
    '호각 전: A2가 트라이 라인을 보고 키 자리, B1은 A2 옆(인바운더 쪽), B3는 A2 바로 뒤': 'Before the whistle: A2 faces the goal line in the key, B1 beside A2 (inbounder side), B3 right behind A2',
    '호각이 울려 경기가 시작된다': 'The whistle blows and play starts',
    'B3가 A2를 한 번 친다': 'B3 hits A2 once',
    'A2가 포스트 사이로 굴러 나간다': 'A2 rolls out between the posts',
    # 11.94.1
    'A1이 프론트코트 센터라인 근처에 멈춰 있다': 'A1 is stopped in the frontcourt near the centre line',
    'B4가 달려와 A1의 범퍼에 부딪힌다': "B4 drives in and hits A1's bumper",
    '충돌로 A1이 뒤로 밀려 뒷바퀴가 센터라인에 닿는다': "The hit pushes A1 back and a rear wheel touches the centre line",
    # 11.97.1
    'A1이 사이드라인에서 스로인을 준비한다': 'A1 prepares a throw-in at the sideline',
    'A2가 1m 구역 안으로 A1 앞을 지나간다': 'A2 passes in front of A1 inside the 1 m zone',
    'A2가 구역 반대편에서 볼을 받는다': 'A2 receives the ball on the other side of the zone',
    '1m 제한선은 양 팀 모두 침범할 수 없다': 'Neither team may enter the 1 m restricted zone',
    # 11.97.3
    '트라이 뒤 A1이 엔드라인에서 스로인을 준비한다': 'After a goal, A1 prepares a throw-in at the end line',
    'B2가 1m 구역 안으로 들어온다': 'B2 enters the 1 m zone',
    # 12.103.8
    'A1이 키 위쪽에서 트라이 라인을 공격하고 B2가 쫓는다': 'A1 attacks the goal line from above the key, B2 chasing',
    'B2가 따라잡아 A1보다 살짝 앞선다': 'B2 catches up and gets slightly ahead of A1',
    'B2가 몸을 돌려 A1 뒷축 중간을 친다': "B2 turns and hits A1 in the middle of the rear axle",
    'A1이 볼을 가진 채 앞으로 넘어진다': 'A1 falls forward holding the ball',
    # 표시 글씨
    '1m 제한 구역': '1 m zone',
    '8초 카운트 시작': '8-second count starts',
    'A1의 손': "A1's hand",
    'B1이 먼저 라인을 넘음': 'B1 crosses first',
    '네 번째 수비수': '4th defender',
    '뒷바퀴 + 안티팁이 라인을 넘음': 'Rear wheel + anti-tip over',
    '뒷바퀴가 라인에 닿음': 'Rear wheel on the line',
    '사이드라인': 'Sideline',
    '센터라인에 걸친 두 선수': 'Both straddling the line',
    '앞 캐스터가 라인에 닿음': 'Front caster on the line',
    '축 선상 접촉 (범퍼 절반씩)': 'Contact on the axle (half bumper each)',
    '카운트 중단': 'Count stops',
    '키 안 수비수 4명': '4 defenders in the key',
    '페널티 박스 앞 트랩': 'Trap at the penalty box',
    '포스트 사이': 'Between the posts',
}

p = sys.argv[1] if len(sys.argv) > 1 else 'data/cases.json'
d = json.load(io.open(p, encoding='utf-8'))
miss = set()
for c in d['cases']:
    s = c.get('scene')
    if not s:
        continue
    for st in s['steps']:
        if st.get('caption'):
            if st['caption'] in EN: st['captionEn'] = EN[st['caption']]
            else: miss.add(st['caption'])
    for m in s.get('markers', []) + s.get('highlight', []):
        for k in ('text', 'label'):
            if m.get(k):
                if m[k] in EN: m[k + 'En'] = EN[m[k]]
                else: miss.add(m[k])
io.open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, ensure_ascii=False, indent=1))
print('missing:', sorted(miss))

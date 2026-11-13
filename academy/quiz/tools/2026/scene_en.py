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
    # 2026-11-14 추가 장면 27개 (scenes_more.py)
    'A1이 센터라인에 걸쳐 멈춰 있다 (앞바퀴 프론트코트, 뒷바퀴 백코트)': 'A1 is stopped straddling the centre line (front wheels in the frontcourt, rear wheels in the backcourt)',
    'A1이 센터라인에 걸쳐 있다 (앞바퀴 프론트코트, 뒷바퀴 백코트)': 'A1 straddles the centre line (front wheels in the frontcourt, rear wheels in the backcourt)',
    'A1이 볼을 프론트코트 바닥에 튕긴다': 'A1 bounces the ball in the frontcourt',
    '이번에는 백코트 바닥에 튕긴다': 'This time A1 bounces it in the backcourt',
    '두 경우를 각각 판정한다': 'Rule on each case',
    'A1이 볼을 몰고 백코트에서 올라간다': 'A1 dribbles up from the backcourt',
    '센터라인을 넘는 순간 볼을 프론트코트에 튕긴다': 'Crossing the centre line, A1 bounces the ball in the frontcourt',
    '같은 장면에서 이번에는 백코트에 튕긴다면?': 'Same play, but this time the bounce is in the backcourt?',
    'B1이 다가와 압박한다': 'B1 closes in and applies pressure',
    '볼을 지키려 몸을 틀다 프론트코트 바퀴 하나가 백코트로 굴러 들어간다': 'Turning to protect the ball, one frontcourt wheel rolls into the backcourt',
    'B1·B2가 압박한다': 'B1 and B2 apply pressure',
    '볼을 지키려다 휠체어가 뒤로 조금 밀린다': 'Protecting the ball, the chair drifts back a little',
    'A1이 안티팁에 기대 앞바퀴를 들어 올린다': 'A1 leans on the anti-tip and lifts the front wheels',
    'A1이 프론트코트의 A2에게 패스한다': 'A1 passes to A2 in the frontcourt',
    '볼이 A1이 공격하는 트라이 라인 쪽으로 굴러간다': "The ball rolls toward A1's attacking goal line",
    'A1이 따라붙는다': 'A1 chases it',
    '라인 직전에 볼을 바퀴에 끼워 고정한다': 'Just before the line, A1 traps the ball against a wheel',
    '그대로 트라이 라인을 넘는다': 'A1 crosses the goal line like that',
    'A1이 트라이 라인으로 다가간다': 'A1 approaches the goal line',
    '앞바퀴 하나를 라인 너머에 두고 멈춘다': 'A1 stops with one front wheel over the line',
    '두 번째 바퀴가 닿기 전에 앞바퀴를 위아래로 들어 올리며 계속 민다': 'Before a second wheel touches, A1 keeps pushing while lifting the front wheel up and down',
    'B3·B4가 라인 앞을 지키고 A1이 득점을 노린다': 'B3 and B4 guard the line as A1 tries to score',
    '앞 캐스터가 바닥에서 떨어진 채 트라이 라인을 넘는다': 'The front casters cross the goal line off the floor',
    '캐스터가 다시 닿기 전에 B3·B4가 A1을 가둔다': 'Before the casters come down, B3 and B4 trap A1',
    '버티다 두 캐스터가 코트 안쪽으로 돌아와 바닥에 닿는다': 'Holding on, both casters come back inside the court and touch the floor',
    'A1이 수비 없이 트라이 라인 쪽으로 간다': 'A1 heads to the goal line unguarded',
    'A1이 라인 앞에서 일부러 멈춘다': 'A1 stops on purpose in front of the line',
    'B1이 A1을 무시하고 포스트 사이로 코트를 벗어난다': 'B1 ignores A1 and leaves the court between the posts',
    'A1이 포스트 근처로 득점을 노린다': 'A1 goes for a goal near the post',
    'B1이 먼저 라인 쪽으로 내려와 길을 막는다': 'B1 gets down to the line first and blocks the path',
    'A1이 B1과 접촉한다': 'A1 makes contact with B1',
    'A1이 계속 밀어 B1을 트라이 라인 너머로 밀어낸다': 'A1 keeps pushing and drives B1 over the goal line',
    'B1·B2가 A1의 길을 일부 막고 있다': "B1 and B2 partly block A1's path",
    'A4가 뒤에서 A1을 한 번 들이받는다': 'A4 bumps A1 once from behind',
    'A1이 밀려 트라이 라인을 넘는다': 'A1 is pushed over the goal line',
    'A3가 키로 들어간다. B2가 트라이 라인 앞을 지킨다': 'A3 enters the key. B2 guards the goal line',
    'A3가 B2와 부딪힌다': 'A3 hits B2',
    'A3가 멈추지 않고 계속 밀어 B2를 트라이 라인 밖으로 밀어낸다': 'A3 does not stop and pushes B2 out over the goal line',
    'A팀이 볼을 갖고 있고, A2가 공격 키 쪽으로 뒤로 물러난다': 'Team A has the ball, and A2 backs toward the attacking key',
    'A2의 안티팁이 키 안으로 들어간다': "A2's anti-tip goes into the key",
    'B1에게 막혀 A2가 그 자리에 9초 동안 묶여 있다': 'Blocked by B1, A2 is stuck there for 9 seconds',
    'B팀 셋이 키 안에, B2는 키 바로 위에 있다': 'Three B players are in the key, B2 just above it',
    'B2가 방향을 돌리며 앞 캐스터를 들어 키 위로 넘긴다': 'B2 turns, lifting the front casters over the key',
    '캐스터가 키 바닥에 닿지 않은 채 B2가 지나간다': 'B2 goes past without the casters touching the key floor',
    'A1의 트라이 뒤 B3가 엔드라인 밖에서 스로인 볼을 받는다': "After A1's goal, B3 receives the throw-in ball outside the end line",
    'B3가 엔드라인을 따라 다른 지점으로 옮긴다': 'B3 moves to another spot along the end line',
    '그 자리에서 B1에게 스로인한다': 'B3 throws in to B1 from there',
    'A1이 엔드라인 밖에서 스로인을 준비한다': 'A1 prepares a throw-in outside the end line',
    'A2는 B1에게 막혀 빠져나오지 못한다': 'A2 is held up by B1 and cannot get free',
    'A1이 8초 안에 스로인하지 못한다': 'A1 does not throw in within 8 seconds',
    'B팀은 어디서 스로인하는가?': 'Where does Team B throw in?',
    'A팀이 오지 않아 레퍼리가 트라이 뒤 엔드라인 밖에 볼을 놓고 8초 카운트를 시작한다': 'No A player comes, so the referee puts the ball down outside the end line after the goal and starts the 8-second count',
    'A2가 엔드라인 밖으로 나가 볼을 집는다': 'A2 goes out over the end line and picks up the ball',
    '같은 일이 사이드라인 스로인에서 생긴다면?': 'What if the same happens on a sideline throw-in?',
    'A3가 사이드라인 밖으로 나가 볼을 집는다': 'A3 goes out over the sideline and picks up the ball',
    'A1이 사이드라인 밖에서 스로인을 준비한다': 'A1 prepares a throw-in outside the sideline',
    'A1이 A2에게 스로인한다': 'A1 throws in to A2',
    'A1이 45도 각도로 1m 반경 안으로 코트에 들어온다': 'A1 enters the court at 45° within the 1 m radius',
    '몸을 움직이다 앞 캐스터가 사이드라인에 닿는다': 'Moving, a front caster touches the sideline',
    '바로 그때 A1이 볼을 떠나보낸다': 'Right then A1 releases the ball',
    'A1이 스로인을 준비하고 B1이 기다린다': 'A1 prepares the throw-in and B1 waits',
    'A1이 비스듬히 돌아 코트 밖 사이드라인을 따라 달린다': 'A1 turns and runs along outside the sideline',
    '1m 구역 밖에서 들어와 B1을 제친다': 'A1 comes in outside the 1 m zone and beats B1',
    '트라이 뒤 A1이 엔드라인에서 인바운드한다. A2·A3가 B1을 가두고 있다': 'After a goal, A1 inbounds from the end line. A2 and A3 are trapping B1',
    'A1이 엔드라인을 따라 B1 쪽으로 옮긴다. 세 선수 모두 1m 안이다': 'A1 moves along the end line toward B1. All three players are within 1 m',
    'A1이 A3에게 패스한다': 'A1 passes to A3',
    'A1이 스로인을 준비한다. B1은 1m 구역 밖에 있다': 'A1 prepares the throw-in. B1 is outside the 1 m zone',
    'A1이 B1 쪽으로 비스듬히 들어온다': 'A1 comes in at an angle toward B1',
    'B1과 부딪히지 않고는 완전히 들어올 수 없게 된다': 'Now A1 cannot get fully onto the court without hitting B1',
    'A1이 1m 밖, 사이드라인 가까이에 있는 A2를 본다': 'A1 looks to A2, outside the 1 m zone and close to the sideline',
    'A1이 A2에게 인바운드한다': 'A1 inbounds to A2',
    'B1·B2가 A2를 사이드라인 쪽으로 밀어붙인다': 'B1 and B2 push A2 toward the sideline',
    '코트에 들어온 A1이 A2와 접촉해 A2가 밖으로 나가지 않게 막는다': 'A1, now on court, contacts A2 to keep A2 from going out',
    '득점한 A1이 반대편으로 들어가려고 엔드라인 뒤로 돌아간다': 'After scoring, A1 goes around behind the end line to come in on the other side',
    'A1이 엔드라인 밖에서 코트로 들어서려 한다': 'A1 tries to come onto the court from outside the end line',
    '앞 캐스터가 코트에 들어서는 순간 B1이 막아선다': 'As the front casters come onto the court, B1 blocks',
    'A1이 다시 밖으로 물러나 다른 지점에서 들어간다': 'A1 backs out again and enters at another spot',
    'A2가 사이드라인을 따라 B1을 앞지르려 한다': 'A2 tries to get past B1 along the sideline',
    'B1이 A2를 코트 밖으로 밀어낸다': 'B1 pushes A2 out of bounds',
    'A2가 코트 밖으로 계속 달린다': 'A2 keeps driving outside the court',
    'A2가 B1 앞에서 코트로 들어온다': 'A2 comes back onto the court ahead of B1',
    'A1이 트라이 라인 근처, 키 밖에서 B1의 압박을 받는다': 'Near the goal line, outside the key, A1 is under pressure from B1',
    'A1이 A2에게 패스한다': 'A1 passes to A2',
    'A1이 뒤로 물러나다 포스트에 닿는다': 'Backing up, A1 touches the post',
    'A2가 사이드라인 근처에서 B3·B4에게 막혀 있다': 'A2 is boxed in by B3 and B4 near the sideline',
    '벗어나려던 A2가 코트를 벗어난다': 'Trying to escape, A2 leaves the court',
    'B3·B4가 다가가 A2가 코트로 다시 못 들어오게 막는다': 'B3 and B4 move in to stop A2 from coming back on',
    '프론트코트에 튕김': 'Bounce in frontcourt',
    '백코트에 튕김': 'Bounce in backcourt',
    '바퀴 하나가 백코트로': 'One wheel into backcourt',
    '캐스터는 센터라인에 닿지 않음': 'Casters not on the centre line',
    '앞바퀴를 듦 (안티팁에 기댐)': 'Front wheels up (on anti-tip)',
    '볼이 바퀴에 끼임': 'Ball trapped by wheel',
    '앞바퀴 하나만 라인 너머': 'One front wheel over',
    '앞바퀴를 들었다 놓으며 민다': 'Lifts the front wheel and pushes',
    '앞 캐스터가 공중에 뜬 채': 'Front casters in the air',
    '포스트': 'Post',
    '포스트와 범퍼 사이 몇 cm': 'A few cm between post and bumper',
    '1차 접촉': 'First contact',
    '안티팁만 키 안': 'Only the anti-tip in the key',
    '9초 동안 묶임': 'Stuck for 9 seconds',
    '앞 캐스터를 들고 키 위로': 'Casters lifted over the key',
    '8초 카운트': '8-second count',
    '8초 초과': 'Over 8 seconds',
    '1m 반경': '1 m radius',
    '앞 캐스터가 사이드라인에 닿음': 'Front caster on the sideline',
    'B1은 1m 구역 밖': 'B1 outside the 1 m zone',
    'A1이 A2를 받쳐 준다': 'A1 holds A2 in',
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

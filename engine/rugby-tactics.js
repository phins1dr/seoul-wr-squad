/* 전술 표 (RugbyTactics) — 원문 전술을 두뇌가 읽을 수 있는 표로 옮긴 것
   알파고 2단계(2026-11-15): "형식이 맞는지" 먼저 보려고 수비 6세트 + 공격 4개 + 2하드2소프트만 옮김. 나머지는 4단계에서.
   원문: playbook_seoul(작전집) · 공격 전술 얼라이먼트3 · 전술 사전(WR-K1) · 코칭 자료 모음(WR-K3) · 노션 26.11.9 경기분석
   규칙: 원문에 글로 적힌 것만 옮긴다. 그림에서만 알 수 있는 것(정확한 자리)은 '자리 규칙'으로 계산하고, 애매한 건 ask에 적어 감독에게 묻는다.

   한 줄(전술 하나)의 모양
     id, name, side('def'|'off'), src(원문 어디), ready(두뇌가 지금 돌릴 수 있나)
     when   시작 조건 — 수비: {dist: 인바운드 거리 10/20/30/40, tops: 탑(센터라인 위)에 있는 공격 수}
                        공격: {note: 언제 쓰나}
     roles  역할 — 번호별 {seat: 자리 규칙, mark: 맡는 공격 선수(A1 첫 리시버·A2 세컨드·A3 인바운더·A4 로우), mission: 원문 미션}
     steps  단계 — 휘슬 뒤 순서대로 일어날 일
     planB  실패하면 — [{if: 이런 일이 생기면, then: 이렇게}]
     engine 두뇌 연결 — {cfg: 두뇌 설정, does: 두뇌가 실제로 따라 하는 것, gap: 아직 못 하는 것}
     demo   시험용 상황 — {align: 공격 대형, ibPass: 인바운더 패스 거리(m)}  (회귀 테스트가 씀)
     ask    감독에게 물어볼 것 (없으면 생략)

   자리 규칙(seat)  — 좌표: 공격 방향 +x(위 = 트라이라인), 볼 = 인바운더
     long    롱자리: 상대보다 위(트라이라인 쪽)에 선다 → 진출을 막는다(눌러주기)
     short   숏자리: 볼과 상대 사이에 선다 → 패스를 막는다(디나이)
     ibcheck 인바체크: 인바운드 지점 1m 반경 바로 밖, 인바운더 정면
     double  더블체크: 인바체크 옆에서 라인. 인바운더를 살려주러 오는 선수를 막는다
     trapTop / trapBot  트랩: 두 명이 한 선수를 위·아래에서 막는다                              */
(function (root) {
'use strict';
const VERSION = '0.1.0';
const PI = Math.PI;

/* 인바운드 거리 단계 (전술 사전 2장): 사람이 아니라 인바운더가 던질 수 있는 거리로 부른다.
   need = 그 단계로 치는 최소 패스 거리(m). 예전 두뇌에 있던 숫자(40:5, 30:7, 20:10, 10:13.5)를 그대로 가져옴 ⚠ 감독 확인 필요 */
const DIST = [{ code: 10, need: 13.5, name: '센터라인 이상' }, { code: 20, need: 10, name: '바닥 이상' }, { code: 30, need: 7, name: '바닥 이하' }, { code: 40, need: 0, name: '키 근처' }];
const distOf = reach => DIST.find(d => reach >= d.need).code;
const TOPS = ['제로탑', '원탑', '투탑', '쓰리탑'];

/* 지금 상황 읽기: ps = 선수들 [{id,x,y,pass?}], reach = 인바운더 패스 거리(없으면 A3.pass) → {dist, tops, name} */
function situation(ps, reach) {
  const ib = ps.find(p => p.id === 'A3'); const r = reach != null ? reach : (ib && ib.pass) || 10;
  const tops = ps.filter(p => p.id[0] === 'A' && p.id !== 'A3' && p.x > 14).length; const dist = distOf(r);
  return { dist, tops, reach: r, name: dist + ' ' + TOPS[Math.min(tops, 3)] };
}

/* ───────── 수비 (작전집 「인바운드 상황」 21세트 중 6개) ─────────
   맡는 사람: 인바체크를 하면 우리 4번 ↔ 상대 3번(인바운더), 우리 3번 ↔ 상대 4번으로 바꿔 막는다 (전술 사전 3장 인바체크) */
const IB4 = { cfg: { inPos: '11', ib11: 'check', ibBy: 4 }, does: '시작 자리, 4번 인바체크(공이 떠나면 범퍼 앞 봉쇄), 나머지는 맨투맨', gap: '롱자리↔숏자리 전환, 크로스 대비, 인터셉트 판단은 아직 일반 맨투맨 로직' };
const DEFENSE = [
  { id: 'D20-1', name: '20 원탑', side: 'def', src: '작전집 · 인바운드 상황 · 20 원탑 (인바운더 패스거리: 바닥 이상)', ready: true,
    when: { dist: 20, tops: 1 },
    roles: { 1: { seat: 'long', mark: 'A1', mission: '바닥으로 접근하지 못하도록, 크로스 하지 않도록 수비' },
             2: { seat: 'long', mark: 'A2', mission: '바닥으로 접근하지 못하도록, 크로스 하지 않도록 수비' },
             3: { seat: 'short', mark: 'A4', mission: '센터라인 밑으로 못 가게. 센터라인 밑으로 가면 롱자리로 전환' },
             4: { seat: 'ibcheck', mark: 'A3', mission: '인바체크. 실패하면 1:1 마크' } },
    steps: ['휘슬 전: 1·2번 롱자리, 3번 숏자리, 4번 인바체크 자리', '인바운드 전: 4번은 1m 밖에서 대기', '공이 떠나면: 4번이 인바운더 범퍼 앞을 막음', '볼맨이 올라오면: 1·2번이 위에서 눌러 12초를 씀'],
    planB: [{ if: '인바체크 실패(인바운더가 빠져나감)', then: '4번은 인바운더 1:1 마크' }, { if: '탑 선수가 센터라인 밑으로 내려옴', then: '3번은 숏자리 → 롱자리' }],
    engine: IB4, demo: { align: '1set', ibPass: 11 },
    ask: '원탑일 때 탑에 서는 상대가 2번이면 우리 2번이 숏자리로 가나요? (원문은 1·2번 롱자리, 3번 숏자리)' },
  { id: 'D20-2', name: '20 투탑', side: 'def', src: '작전집 · 20 투탑 (바닥 이상)', ready: true,
    when: { dist: 20, tops: 2 },
    roles: { 1: { seat: 'long', mark: 'A1', mission: '바닥에서 스타트 하지 못하도록 밀착 수비' },
             2: { seat: 'short', mark: 'A2', mission: '센터라인 밑으로 못 가게. 센터라인 밑으로 가면 롱자리로 전환' },
             3: { seat: 'short', mark: 'A4', mission: '센터라인 밑으로 못 가게. 센터라인 밑으로 가면 롱자리로 전환' },
             4: { seat: 'ibcheck', mark: 'A3', mission: '인바체크. 실패하면 1:1 마크' } },
    steps: ['휘슬 전: 1번 롱자리(밀착), 2·3번은 탑 선수 숏자리, 4번 인바체크', '공이 떠나면: 4번 봉쇄, 1번은 첫 리시버 스타트를 막음', '롱패스가 뜨면: 2·3번이 숏자리에서 끊음'],
    planB: [{ if: '인바체크 실패', then: '4번은 인바운더 1:1 마크' }, { if: '탑 선수가 내려옴', then: '그 선수 담당은 롱자리로' }],
    engine: IB4, demo: { align: '2set', ibPass: 11 } },
  { id: 'D20-0', name: '20 제로탑', side: 'def', src: '작전집 · 20 제로탑 (바닥 이상)', ready: true,
    when: { dist: 20, tops: 0 },
    roles: { 1: { seat: 'long', mark: 'A1', mission: '볼을 잡고 스타트 하지 못하도록 밀착 수비' },
             2: { seat: 'long', mark: 'A2', mission: '주변 동료들과 라인을 형성해서 12초 동안 진출 못하도록 수비' },
             3: { seat: 'short', mark: 'A4', mission: '크로스 상황 대비 / 탑으로 올라가면 인터셉트 할 것' },
             4: { seat: 'ibcheck', mark: 'A3', mission: '인바체크. 실패하면 1:1 마크' } },
    steps: ['휘슬 전: 상대 4명이 다 아래 → 1·2번 롱자리로 라인, 3번 숏자리, 4번 인바체크', '공이 떠나면: 4번 봉쇄, 1·2번은 라인을 유지하며 12초를 씀', '누가 탑으로 뛰면: 3번이 패스를 끊음'],
    planB: [{ if: '인바체크 실패', then: '4번은 인바운더 1:1 마크' }, { if: '상대가 크로스', then: '3번이 대비(콜 플레이로 스위치)' }],
    engine: IB4, demo: { align: '2setlow', ibPass: 11 } },
  { id: 'D30-1', name: '30 원탑', side: 'def', src: '작전집 · 30 원탑 (바닥 이하)', ready: true,
    when: { dist: 30, tops: 1 },
    roles: { 1: { seat: 'long', mark: 'A1', mission: '1번을 눌러주며 스타트를 못하게. 로우볼이 되면 적극적으로 어택' },
             2: { seat: 'short', mark: 'A2', mission: '내려가서 도와주지 못하도록. 볼인되면 롱패스 조심' },
             3: { seat: 'long', mark: 'A1', side: 1.3, mission: '1번 트랩. 1번이 스타트 하지 못하도록 수비' },
             4: { seat: 'ibcheck', mark: 'A3', mission: '인바체크. 실패하면 1:1' } },
    steps: ['휘슬 전: 1·3번이 상대 1번 위에 나란히(롱자리), 2번은 탑 선수 숏자리, 4번 인바체크', '공이 떠나면: 4번 봉쇄, 1·3번이 상대 1번을 묶음', '로우포인터가 공을 잡으면(로우볼): 근처 선수 모두 어택'],
    planB: [{ if: '인바체크 실패', then: '4번은 인바운더 1:1' }, { if: '로우볼', then: '1번이 적극 어택, 4번은 다른 선수 접근을 막음' }],
    engine: Object.assign({}, IB4, { gap: '1번 트랩 유지, 로우볼 어택은 아직 없음(상대 4번은 비어 있음)' }), demo: { align: '1set', ibPass: 8 },
    ask: '3번이 1번을 트랩할 때 상대 4번(로우)은 일부러 비워두는 게 맞나요?' },
  { id: 'D40-0', name: '40 제로탑', side: 'def', src: '작전집 · 40 제로탑 (키 이하)', ready: true,
    when: { dist: 40, tops: 0 },
    roles: { 1: { seat: 'trapTop', mark: 'A1', mission: '4번과 함께 1번을 트랩. 패스를 받지 못하게 해야 한다' },
             2: { seat: 'long', mark: 'A2', mission: '바닥으로 접근하지 못하게. 1번에게 볼인되면 롱패스를 대비' },
             3: { seat: 'long', mark: 'A4', mission: '바닥으로 접근하지 못하게. 1번에게 볼인되면 롱패스를 대비' },
             4: { seat: 'trapBot', mark: 'A1', mission: '1번을 도와서 트랩' } },
    steps: ['휘슬 전: 1번(위)·4번(아래)이 상대 1번을 트랩, 2·3번은 롱자리', '인바운더는 멀리 못 던짐(키 근처) → 받을 사람이 1번뿐이면 8초 인바운드를 노림', '1번에게 볼인되면: 2·3번은 롱패스 대비'],
    planB: [{ if: '트랩이 풀림', then: '바로 콜, 1번은 맨투맨' }, { if: '1번에게 볼인', then: '2·3번 롱패스 대비' }],
    engine: { cfg: { inPos: '2x2', after: 'keep' }, does: '시작 자리(트랩 모양)', gap: '두뇌의 2x2 트랩 로직은 원문과 맡는 사람이 다름 → 휘슬 뒤 움직임은 근사' }, demo: { align: '2setlow', ibPass: 6 } },
  { id: 'D10-1', name: '10 원탑', side: 'def', src: '작전집 · 10 원탑 (하이포인트 인바운드)', ready: true,
    when: { dist: 10, tops: 1 },
    roles: { 1: { seat: 'long', mark: 'A1', mission: '스타트 하지 못하도록' },
             2: { seat: 'short', mark: 'A2', mission: '롱패스 받지 못하도록 숏자리 수비. 1번이 리턴받기 전까진 롱패스는 없다' },
             3: { seat: 'ibcheck', mark: 'A3', mission: '인바운드를 체크, 꼭!꼭!꼭! / 실점 이후 8초 키 대비해야 한다' },
             4: { seat: 'double', mark: 'A4', mission: '인바체크를 막는 사람을 막아준다(더블체크)' } },
    steps: ['휘슬 전: 3번 인바체크, 4번은 그 옆에서 더블체크, 1번 롱자리, 2번 숏자리', '공이 떠나면: 3번 봉쇄, 4번은 살려주러 오는 선수를 막음', '하이 인바운더가 못 나오면 상대는 3명으로 공격'],
    planB: [{ if: '인바체크 실패', then: '3번은 인바운더(하이) 1:1 — 가장 위험' }, { if: '우리가 실점', then: '인바체크 했던 3번의 키 8초 조심' }],
    engine: { cfg: { inPos: '11', ib11: 'check', ibBy: 3 }, does: '시작 자리, 3번 인바체크', gap: '더블체크(4번이 헬퍼를 막는 움직임)는 시작 자리만' }, demo: { align: '1set', ibPass: 15 } },
  { id: 'H2S2', name: '2하드2소프트', side: 'def', src: '코칭 자료 모음 2.1 (일본 대표팀) + 감독 정리 (3-1)', ready: false,
    when: { note: '볼이 인바운드된 뒤 전 구간. 하이포인터 2명의 스피드와 로우 2명의 위치 선정이 될 때' },
    roles: { hard: { mission: '볼을 가진 선수와 직접 싸워 시간을 끈다(실제로는 한 명). 우리 하이는 상대 하이에게' },
             lane1: { mission: '남은 방향의 첫 패스 코스 — 리시버의 캐스터 앞(공이 도착할 자리)을 먼저 차지' },
             lane2: { mission: '두 번째 코스(스킵 패스, 반대편 아웃렛)' },
             wall: { mission: '키 앞 1.75m 라인. 볼이 키로 들어가는 순간 벽' } },
    steps: ['하드가 볼러의 방향 하나를 지움', '나머지 3명은 공을 보고 움직이지 않고 예상 패스 코스에 먼저 섬(코스마다 한 명)', '볼이 넘어가면 0.5초 안에 재정렬 — 새 볼러에게 가장 가까운 사람이 하드', '볼러가 방향을 바꾸면 가장 가까운 한 명만 이동'],
    planB: [{ if: '볼러가 하드의 어깨를 반쯤 지나침', then: '즉시 스위치 — 뚫린 하드는 뒤에서 체이스, 가장 가까운 소프트가 새 하드' }, { if: '셋이 공 쪽으로 몰림', then: '볼 쪽 2명·반대편 1명·키 앞 1명으로 복귀' }],
    engine: { cfg: null, does: '없음', gap: '두뇌에 이 수비 모드가 없음 → 3단계에서 def:"hard2soft" 구현' },
    ask: '우리 팀에서 실제로 쓰는 이름이 "2하드2소프트"인가요, 다른 콜이 있나요?' },
];

/* ───────── 공격 (노션 26.11.9 경기분석의 4개 대형. 얼라이먼트 코드의 로우포인터 행동과 짝지음) ─────────
   얼라이먼트 코드(공격 전술 얼라이먼트3): 라인업 - 인바운드 거리 - 로우포인터 행동
   로우포인터 행동: 0 인바운더 헬프 / 1 1번 헬프 / 2 백코트 지역 헬프 / 3 탑 지역 헬프 / 4 갈매기 */
const LOW_ACTION = { 0: '인바운더 헬프', 1: '1번 헬프', 2: '백코트 지역 헬프', 3: '탑 지역 헬프', 4: '갈매기' };
const OFFENSE = [
  { id: 'O-1set', name: '1셋 (14셋팅)', side: 'off', low: 1, src: '노션 26.11.9 · 전술 사전 4장 셋팅', ready: true,
    when: { note: '기본. 2번이 센터라인 위에 서서 수비 2명을 데리고 올라갈 수 있을 때(아래가 3:2)' },
    roles: { A1: { mission: '베이스라인 쪽 첫 리시버' }, A4: { mission: '1번 범퍼를 지킴(셋팅) — 둘이 한 덩어리' }, A2: { mission: '센터라인 위(롱)에서 수비를 끌어 올림' }, A3: { mission: '인바운더. 인바운드 뒤 1번과 같이 진출' } },
    steps: ['휘슬 전: 1·4번 붙어서 아래, 2번 센터라인 위', '인바운드 → 1번', '1번·3번이 넓은 진출 공간으로(3:2)', '센터라인 통과 후 득점'],
    planB: [{ if: '인바체크가 있음 + 인바운더 롱패스 가능', then: '2셋' }, { if: '인바체크가 있음 + 롱패스 불가', then: '4갈메기' }, { if: '1번이 로우트랩에 걸림', then: '1번에게 인바운드하지 않는다(팀이 망하는 길)' }, { if: '2번이 센터라인 아래에 있음(4:4)', then: '1:1에서 밀리는 상대면 어렵다 → 다른 대형' }],
    engine: { cfg: { align: '1set' }, does: '자리, 인바운드, 진출', gap: '' } },
  { id: 'O-2set', name: '2셋 (24셋, 센터라인 위)', side: 'off', low: 3, src: '노션 26.11.9', ready: true,
    when: { note: '인바체크가 있거나 센터라인 아래 수비가 3명 이상이고, 인바운더 롱패스(약 17m)가 될 때' },
    roles: { A2: { mission: '센터라인 위에서 롱패스를 바로 받음' }, A4: { mission: '2번과 같이 센터라인 위' }, A1: { mission: '아래에서 수비를 잡아둠' }, A3: { mission: '인바운더 — 2번에게 바로 롱패스' } },
    steps: ['휘슬 전: 2·4번 센터라인 위, 1번 아래', '인바운더가 2번에게 바로 롱패스', '수비 2명 이상이 프론트로 갈 수밖에 없음 → 득점'],
    planB: [{ if: '인바운더 롱패스가 안 됨', then: '4갈메기 (1번이 받고 3번 리턴이면 턴오버가 많다)' }],
    engine: { cfg: { align: '2set', ibPass: 17 }, does: '자리, 롱패스 인바운드', gap: '' } },
  { id: 'O-4gull', name: '4갈메기', side: 'off', low: 4, src: '노션 26.11.9 · 전술 사전 4장 갈매기', ready: true,
    when: { note: '인바체크가 있거나 아래 수비가 많은데 인바운더 롱패스가 안 될 때' },
    roles: { A4: { mission: '셋팅 없이 혼자 센터라인 위 사이드(1번 쪽). 수비를 끌거나 기습 패스, 볼이 넘어오면 볼맨에게 스크린' }, A2: { mission: '센터라인 바로 아래로 수비를 끌고 내려감' }, A1: { mission: '첫 리시버' }, A3: { mission: '인바운더' } },
    steps: ['휘슬 전: 4번 혼자 탑 사이드, 2번은 센터라인 바로 아래', '4번 쪽 프론트 공간이 열림', '인바운드 → 열린 쪽', '볼이 센터라인을 넘으면 4번이 볼맨 스크린'],
    planB: [{ if: '4번에게 수비가 안 따라옴', then: '4번에게 기습 패스' }],
    engine: { cfg: { align: '4gull' }, does: '자리, 인바운드', gap: '넘어온 뒤 4번 스크린은 일반 픽 로직' } },
  { id: 'O-2setlow', name: '2셋 아래 (센터라인 아래)', side: 'off', low: 2, src: '노션 26.11.9', ready: true,
    when: { note: '2셋을 센터라인 아래로 조정. 1·3번 타이밍이 맞을 때' },
    roles: { A2: { mission: '휘슬 뒤 돌아서 달리는 공간으로 패스를 받음' }, A4: { mission: '2번 수비를 막아줌(픽)' }, A1: { mission: '받고 3번에게 리턴하지 않는다' }, A3: { mission: '인바운더 — 달리는 2번 앞 공간으로' } },
    steps: ['휘슬 전: 2·4번 센터라인 아래', '휘슬 → 2번이 돌아서 달림, 4번이 2번 수비를 픽', '인바운더가 달리는 공간으로 롱패스'],
    planB: [{ if: '인바체크가 없음', then: '2번에게 가는 롱패스를 자주 뺏김 → 1·3번 타이밍으로' }, { if: '1번이 받음', then: '3번에게 리턴 금지(망함)' }],
    engine: { cfg: { align: '2setlow', ibPass: 17 }, does: '자리, 2번 달리기, 4번 픽, 리턴 금지', gap: '' } },
];
const ALL = DEFENSE.concat(OFFENSE);
const byId = id => ALL.find(t => t.id === id);

/* 상황에 맞는 수비 세트 고르기 (표에 옮긴 것 중에서) */
function pickDefense(sit) { return DEFENSE.filter(t => t.when && t.when.dist === sit.dist && t.when.tops === sit.tops); }

/* 자리 규칙 → 좌표. ps = 지금 선수들. 반환 {D1:{x,y,a}, …} — 두뇌 b.setup()에 그대로 넣는다 */
const GAP = 1.4, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function seatPos(role, ps) {
  const m = ps.find(p => p.id === role.mark), ib = ps.find(p => p.id === 'A3'); const ball = { x: Math.max(0, ib.x), y: ib.y };
  let x, y;
  if (role.seat === 'long' || role.seat === 'trapTop') { x = m.x + GAP; y = m.y + (role.side || 0); }
  else if (role.seat === 'short' || role.seat === 'trapBot') { const dx = ball.x - m.x, dy = ball.y - m.y, d = Math.hypot(dx, dy) || 1; x = m.x + dx / d * GAP; y = m.y + dy / d * GAP; }
  else if (role.seat === 'ibcheck') { x = ball.x + 1.75; y = ball.y; }
  else if (role.seat === 'double') { x = ball.x + 1.9; y = ball.y + (m.y < ball.y ? -1.4 : 1.4); }
  else return null;
  return { x: clamp(x, 0.6, 27.4), y: clamp(y, 0.7, 14.3), a: PI };
}
function seats(id, ps) {
  const t = byId(id); if (!t || t.side !== 'def' || !t.ready) return null; const out = {};
  for (const n of Object.keys(t.roles)) { const s = seatPos(t.roles[n], ps); if (s) out['D' + n] = s; }
  const ids = Object.keys(out), others = ps.filter(p => p.id[0] === 'A'); // 겹치면 살짝 벌림 (인바체크 자리는 고정)
  for (let k = 0; k < 6; k++) for (const a of ids) { if (t.roles[a.slice(1)].seat === 'ibcheck') continue; const A = out[a];
    for (const o of ids.filter(b => b !== a).map(b => out[b]).concat(others)) { const dx = A.x - o.x, dy = A.y - o.y, d = Math.hypot(dx, dy); if (d < 1.3) { const ux = d > 1e-6 ? dx / d : 0, uy = d > 1e-6 ? dy / d : 1; A.x = clamp(A.x + ux * (1.3 - d), 0.6, 27.4); A.y = clamp(A.y + uy * (1.3 - d), 0.7, 14.3); } } }
  return out;
}

/* 표가 형식에 맞는지 검사 → 틀린 곳 목록 (비어 있으면 통과) */
function check() {
  const bad = [], SEATS = ['long', 'short', 'ibcheck', 'double', 'trapTop', 'trapBot'], seen = {};
  for (const t of ALL) { const e = m => bad.push(t.id + ': ' + m);
    if (!t.id || seen[t.id]) e('id가 없거나 겹침'); seen[t.id] = 1;
    for (const k of ['name', 'side', 'src', 'when', 'roles', 'steps', 'planB', 'engine']) if (t[k] == null) e(k + ' 없음');
    if (typeof t.ready !== 'boolean') e('ready 없음');
    if (!Array.isArray(t.steps) || !t.steps.length) e('steps 비어 있음');
    if (!Array.isArray(t.planB) || !t.planB.length || t.planB.some(p => !p.if || !p.then)) e('planB는 {if,then} 한 개 이상');
    for (const [n, r] of Object.entries(t.roles || {})) { if (!r.mission) e('역할 ' + n + ' 미션 없음');
      if (t.side === 'def' && t.ready) { if (!SEATS.includes(r.seat)) e('역할 ' + n + ' 자리 규칙 모름: ' + r.seat); if (!/^A[1-4]$/.test(r.mark || '')) e('역할 ' + n + ' 맡는 사람 없음'); } }
    if (t.side === 'def' && t.ready) { if (!(t.when.dist && t.when.tops != null)) e('시작 조건(dist·tops) 없음'); if (Object.keys(t.roles).sort().join('') !== '1234') e('역할은 1~4번'); if (!t.demo) e('demo 없음'); }
    if (t.ready && !(t.engine && t.engine.cfg)) e('ready인데 두뇌 설정이 없음'); }
  return bad;
}

const API = { VERSION, DIST, distOf, situation, DEFENSE, OFFENSE, LOW_ACTION, byId, pickDefense, seats, check };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.RugbyTactics = API;
})(typeof window !== 'undefined' ? window : globalThis);

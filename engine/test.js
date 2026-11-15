/* 럭비두뇌 회귀 테스트 — 두뇌를 고친 뒤 꼭 돌려요.   실행: bun engine/test.js   (node도 됨)
   1) 규정 확인: 정해진 상황을 만들어 판정이 맞는지 (틀리면 ✗)
   2) 흐름 확인: 같은 난수로 장면마다 N판 돌려 결과 비율이 기준(BASE)에서 3%p 넘게 달라졌는지
      → 일부러 바꾼 거면 출력된 "새 기준" 줄을 BASE에 붙여 넣기
   3) 현실 비교: 실제 경기 기록(REAL)과 나란히 보기 — 참고용, 합격/불합격 아님
   옵션: --n=60 (장면당 판수)                                                    */
const RB = require('./rugby-brain.js');
const RT = require('./rugby-tactics.js');
const N = +((process.argv.find(a => a.startsWith('--n=')) || '').slice(4)) || 60;
let seed = 1; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

/* 실제 경기 기준값 (2026-11-15, 드라이브 「휠체어럭비 분석 프로그램」 경기 시트 15개의 리포트_팀 합계. 팀·선수 이름 없이 합계만)
   성공 = 득점/공격기회, 턴오버 = 뺏김·바이올레이션, 실책 = 패스 미스 등 자기 실수, 초 = 경기 시계 32분 ÷ 양 팀 공격기회 */
const REAL = {
  '국내 12경기': { 성공: 64.2, 턴오버: 9.1, 실책: 23.9, 기회: 66.2, 초: 14.5, 범위: '40~81%' },
  '국제 3경기(패럴림픽·AOC)': { 성공: 84.6, 턴오버: 4.0, 실책: 7.4, 기회: 58.3, 초: 16.5, 범위: '83~89%' },
};
/* 흐름 기준 (v1.5.0, n=60). 숫자 = 장면별 [득점%, 뺏김%, 바이올레이션%, 수비파울%] */
const BASE = {"기본":[75,17,8,0],"1셋 · 2번 위":[85,8,7,0],"1셋 · 2번 아래":[77,10,13,0],"인바체크":[80,7,13,0],"2셋":[92,7,2,0],"4갈메기":[87,8,5,0],"프론트 수비 2명":[85,8,7,0],"1번 로우트랩":[78,8,13,0],"2셋 아래":[75,7,18,0]};

let fail = 0;
const ok = (name, cond, note) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (note ? '  — ' + note : '')); if (!cond) fail++; };
function play(cfg, o) { o = o || {}; let e = null; const b = RB.create(Object.assign({ cfg: JSON.parse(JSON.stringify(cfg || {})), end: x => { e = x; } }, o.opts || {}));
  b.newGame(); if (o.pos) b.setup(o.pos); if (o.before) o.before(b);
  let t = 0; while (b.G.phase !== 'over' && t < (o.max || 90)) { if (b.G.phase === 'ready') b.whistle(); b.tick(1 / 60); t += 1 / 60; if (o.each) o.each(b, t); }
  return { e, b, t }; }

console.log('럭비두뇌 v' + RB.VERSION + ' 회귀 테스트\n\n1) 규정 확인');
{ // 여자 가산 (35조)
  const L = RB.lineup;
  ok('라인업 8.0 이하면 통과', L(['3.0', '2.0', '1.5', '1.5']).ok && !L(['3.0', '2.5', '1.5', '1.5']).ok);
  ok('여자 0.5~1.5는 +0.5', L(['3.0', '2.5', '1.5', { cls: '1.5', female: true }]).ok);
  ok('여자 2.0~3.5는 +1.0', L(['3.5', { cls: '2.5', female: true }, '1.5', '1.5']).ok && L([{ cls: '2.0', female: true }]).limit === 9);
  ok('3명이면 8 미만', L(['3.5', '3.0', '1.0']).ok && !L(['3.5', '3.5', '1.0']).ok);
}
{ // 포 인 더 키 (91조) → 30초 페널티
  const r = play({ trans: false }, { pos: { D1: { x: 27.2, y: 5.5 }, D2: { x: 27.2, y: 6.8 }, D3: { x: 27.2, y: 8.2 }, D4: { x: 27.2, y: 9.5 } }, max: 2 });
  ok('수비 4명이 키에 들어가면 포 인 더 키', r.e && r.e.kind === 'penalty' && /포 인 더 키/.test(r.e.text) && r.e.sec === 30, r.e && r.e.text);
  const r3 = play({ trans: false }, { pos: { D1: { x: 27.2, y: 5.5 }, D2: { x: 27.2, y: 6.8 }, D3: { x: 27.2, y: 8.2 } }, max: 0.5 });
  ok('3명까지는 괜찮음', !r3.e || r3.e.kind !== 'penalty');
}
{ // 1m 파울 (97조): 사람이 조종하는 수비가 인바운드 지점 1m 안으로
  const r = play({ trans: false }, { opts: { control: id => id === 'D4' ? { x: -1, y: 0 } : null }, pos: { D4: { x: 3, y: 7.5, a: Math.PI } }, max: 6 });
  ok('수비가 인바운드 전 1m 반경에 들어가면 30초 페널티(득점 아님)', r.e && r.e.kind === 'penalty' && /1m/.test(r.e.text) && r.e.good === false, r.e && r.e.text);
  let foul = 0; for (let i = 0; i < 40; i++) { seed = 500 + i; const q = play({}); if (q.e && /1m/.test(q.e.text)) foul++; }
  ok('컴퓨터 수비는 1m 파울을 안 함 (40판)', foul === 0, foul + '번');
}
{ // 득점 (68조): 바퀴 2개 = 똑바로 들어가면 휠체어 중심이 27.4m쯤일 때
  let mn = 99, n = 0; for (let i = 0; i < 60; i++) { seed = 900 + i; const q = play({}); if (q.e && q.e.kind === 'try') { n++; const h = q.b.P(q.b.G.ball.holder); if (h) mn = Math.min(mn, h.x); } }
  ok('득점은 바퀴 2개가 라인을 넘은 뒤에만', n > 10 && mn > 27.40, '득점 ' + n + '번, 가장 이른 중심 x=' + mn.toFixed(2));
}
{ // 페널티 박스: 수비 3명으로 진행
  const r = play({ box: [4] }, { max: 1 }); const d4 = r.b.P('D4');
  ok('박스에 있는 수비는 코트 밖에 묶여 있음', d4.box === true && d4.y < 0);
}
{ // 경기: 수비 파울 → 같은 팀 다시 공격 + 30초 페널티 → 상대 득점하면 풀려남 / 타임아웃
  const ev = []; const M = RB.match({ plen: 120, event: (k, d) => ev.push([k, d]) }); M.start(); let t = 0, forced = false, att0 = null, boxSeen = false, keptAtt = null;
  while (!M.fin && t < 4000) { const G = M.brain.G;
    if (!ev.some(e => e[0] === 'penalty') && G.phase === 'live') { forced = true; att0 = att0 || M.att; ['D1', 'D2', 'D3', 'D4'].forEach((id, i) => { const p = M.brain.P(id); p.x = 27.2; p.y = 5.5 + i * 1.3; }); }
    if (forced && M.pens.length && G.phase !== 'over' && keptAtt === null && M.poss > 0) { keptAtt = M.att; boxSeen = G.ps.some(p => p.box); }
    M.step(1 / 30); t += 1 / 30; }
  const pen = ev.find(e => e[0] === 'penalty'), rel = ev.find(e => e[0] === 'release');
  ok('경기: 수비 파울이면 30초 페널티가 기록됨', !!pen && pen[1].sec === 30, pen && pen[1].text);
  ok('경기: 파울 뒤 같은 팀이 다시 공격, 수비는 3명', keptAtt === att0 && boxSeen);
  ok('경기: 득점 당하거나 30초 지나면 풀려남', !!rel, rel && rel[1].why);
  ok('경기: 끝까지 진행됨', M.fin, M.score.B + ':' + M.score.R);
  const T = RB.match({ plen: 60 }); T.start(); const live = T.timeout('B'); let k = 0; while (T.brain.G.phase !== 'over' && k++ < 6000) T.step(1 / 30);
  const a = T.timeout('B'), g0 = T.gc; T.step(1); const paused = T.gc === g0 && T.toT > 0; T.toT = 0; T.brain.G.phase = 'over'; const b2 = T.timeout('B'), c = T.timeout('B'), d = T.timeout('B');
  ok('타임아웃: 볼 데드에만, 전·후반 3개, 그동안 시계 멈춤', (live === true || live === false) && a && paused && T.timeouts.B + (live ? 1 : 0) <= 2 && !(live ? c : d), '남은 ' + T.timeouts.B + '개');
}

console.log('\n1-2) 전술 표 (rugby-tactics.js v' + RT.VERSION + ') — 표의 전술을 두뇌가 읽고 돌리는지');
{ const bad = RT.check(); ok('표 형식 검사 (수비 ' + RT.DEFENSE.length + ' + 공격 ' + RT.OFFENSE.length + ')', bad.length === 0, bad.join(' / '));
  for (const t of RT.DEFENSE.filter(t => t.ready)) {
    const reach = t.demo.reach != null ? t.demo.reach : t.demo.ibPass;
    const cfg = { trans: false, align: t.demo.align, ibPass: t.demo.ibPass, tac: t.id };
    let why = ''; const b = RB.create({ cfg: JSON.parse(JSON.stringify(cfg)), event: (k, d) => { if (k === 'tac') why = d.why; } }); b.newGame(); const ps = b.G.ps;
    const sit = RT.situation(ps, reach), picked = RT.pickDefense(sit).map(x => x.id), ib = b.P('A3'), ball = { x: 0, y: ib.y }; let geo = true;
    for (const n of Object.keys(t.roles)) { const r = t.roles[n], d = b.P('D' + n), m = b.P(r.mark), far = q => Math.hypot(q.x - ball.x, q.y - ball.y), seat = r.seat === 'auto' ? RT.autoSeat(ib.pass, far(m)) : r.seat;
      if (seat === 'long' || seat === 'trapTop') geo = geo && d.x > m.x + 0.5;      // 위(트라이라인 쪽)에 섰나
      if (seat === 'short' || seat === 'trapBot') geo = geo && far(d) < far(m);     // 볼과 상대 사이에 섰나
      if (seat === 'ibcheck') geo = geo && far(d) >= 1.62; }                         // 1m 반경 밖인가
    const run = (tac, pe) => { let n = 0, tr = 0, pen = 0; for (let i = 0; i < Math.max(10, N / 3 | 0); i++) { seed = 3000 + i; const q = play(Object.assign({}, cfg, { tac, passErr: pe })); n++; if (q.e && q.e.kind === 'try') tr++; if (q.e && q.e.kind === 'penalty') pen++; } return { n, tr, pen }; };
    const on = run(t.id, 0.12), off = run(null, 0.12);
    ok('수비 ' + t.name + ': 상황 인식 · 자리 · 실행', picked.includes(t.id) && geo && on.pen === 0 && !!b.G.tac, '상황 "' + sit.name + '" · 상대 공격 성공: 표대로 ' + Math.round(on.tr / on.n * 100) + '% / 기본 수비 ' + Math.round(off.tr / off.n * 100) + '% (' + on.n + '판, 패스 실수 0.12)'); }
  { const a = RT.autoSeat; ok('자리 규칙: 패스가 상대 너머로 닿으면 롱자리, 못 닿으면 숏자리', a(15, 5) === 'long' && a(15, 16) === 'short' && a(6, 5.5) === 'short' && a(11, 4) === 'long');
    ok('바닥 = 농구 3점라인 반원', RT.inBadak(5, 7.5) && RT.inBadak(8.2, 7.5) && !RT.inBadak(8.5, 7.5) && !RT.inBadak(6, 0.5) && RT.distOf(8.4) === 20 && RT.distOf(14) === 10 && RT.distOf(1.7) === 40); }
  { // 씨앗: 같은 씨앗이면 같은 경기
    const g = sd => { RB.seed(sd); const q = play({ trans: false, align: '1set', tac: 'auto', passErr: 0.12 }); RB.seed(null); return q.e.kind + '@' + q.b.G.t.toFixed(3); };
    ok('씨앗이 같으면 같은 경기가 다시 나옴', g(77) === g(77) && [78, 79, 80, 81].some(x => g(x) !== g(77)), g(77)); }
  for (const t of RT.OFFENSE.filter(t => t.ready)) ok('공격 ' + t.name + ': 두뇌 대형과 연결', !!RB.ALIGN[t.engine.cfg.align], 'align=' + t.engine.cfg.align + ' · 로우 행동 ' + t.low + ' ' + RT.LOW_ACTION[t.low]);
  const nr = RT.DEFENSE.concat(RT.OFFENSE).filter(t => !t.ready); if (nr.length) console.log('  · 아직 두뇌가 못 돌리는 것: ' + nr.map(t => t.name).join(', '));
}

console.log('\n2) 흐름 확인 (장면당 ' + N + '판, 같은 난수)');
const runs = [{ name: '기본', cfg: {} }, ...RB.SCENES.map(s => ({ name: s.name, cfg: s.cfg, pos: s.pos }))];
const out = {}, tot = { n: 0, try: 0, to: 0, vio: 0, pen: 0, t: 0 };
const sweep = pe => { const c = { n: 0, try: 0, err: 0, t: 0 }; for (const r of runs) for (let i = 0; i < N; i++) { seed = 1000 + i; const q = play(Object.assign({}, r.cfg, { passErr: pe }), { pos: r.pos }); c.n++; c.t += q.b.G.t; if (q.e && q.e.kind === 'try') c.try++; else if (q.e && q.e.err) c.err++; } return c; };
for (const r of runs) { const c = { n: 0, try: 0, to: 0, vio: 0, pen: 0 };
  for (let i = 0; i < N; i++) { seed = 1000 + i; const q = play(r.cfg, { pos: r.pos }); const k = q.e ? q.e.kind : 'none'; c.n++; tot.n++; tot.t += q.b.G.t;
    const key = k === 'try' ? 'try' : k === 'turnover' ? 'to' : k === 'violation' ? 'vio' : k === 'penalty' ? 'pen' : null; if (key) { c[key]++; tot[key]++; } }
  out[r.name] = [c.try, c.to, c.vio, c.pen].map(v => Math.round(v / c.n * 100)); }
let moved = 0;
for (const name of Object.keys(out)) { const now = out[name], was = BASE && BASE[name]; const diff = was ? now.map((v, i) => v - was[i]) : null; const bad = diff && diff.some(d => Math.abs(d) > 3); if (bad) moved++;
  console.log('  ' + (bad ? '✗ ' : '  ') + name.padEnd(12) + ' 득점 ' + String(now[0]).padStart(3) + '%  뺏김 ' + String(now[1]).padStart(2) + '%  바이올레이션 ' + String(now[2]).padStart(2) + '%  수비파울 ' + String(now[3]).padStart(2) + '%' + (bad ? '   ← 기준 ' + JSON.stringify(was) : '')); }
if (!BASE) console.log('  (기준 없음)'); if (moved) { fail += moved; }
if (moved || !BASE) console.log('\n  새 기준:\nconst BASE = ' + JSON.stringify(out) + ';');

console.log('\n3) 현실 비교 (참고)');
const pc = v => (v / tot.n * 100).toFixed(1) + '%';
console.log('  두뇌 (전체 ' + tot.n + '판)'.padEnd(26) + ' 성공 ' + pc(tot.try) + '  뺏김·바이올레이션 ' + pc(tot.to + tot.vio) + '  실책 0% (passErr 0)  공격 1번 ' + (tot.t / tot.n).toFixed(1) + '초');
{ const c = sweep(0.12); console.log('  ' + '두뇌 + 패스 실수 0.12'.padEnd(24) + ' 성공 ' + (c.try / c.n * 100).toFixed(1) + '%  실책 ' + (c.err / c.n * 100).toFixed(1) + '%  그 외 실패 ' + ((c.n - c.try - c.err) / c.n * 100).toFixed(1) + '%  공격 1번 ' + (c.t / c.n).toFixed(1) + '초   ← cfg.passErr'); }
for (const k of Object.keys(REAL)) { const r = REAL[k]; console.log('  ' + k.padEnd(24) + ' 성공 ' + r.성공 + '% (' + r.범위 + ')  턴오버 ' + r.턴오버 + '%  실책 ' + r.실책 + '%  공격 1번 ' + r.초 + '초  팀당 기회 ' + r.기회); }

console.log('\n' + (fail ? '✗ 확인할 것 ' + fail + '개' : '✓ 모두 통과'));
process.exit(fail ? 1 : 0);

/* 롤아웃 — 같은 상황을 여러 판 돌려 숫자로 보기 (AI 토큰 0).   실행: bun engine/rollout.js   옵션: --n=40 --err=0.12
   공격 대형(전술 표 OFFENSE) × 인바운드 거리 × 수비(기본 수비 / 전술 표 자동 선택)를 판마다 다른 씨앗으로 돌린다.
   결과: 화면에 표 + lab/rollouts.json (럭비랩 「롤아웃」 줄에서 눌러 그 판을 그대로 다시 봄 — 같은 씨앗이면 같은 경기)
   노이즈: 패스 실수 cfg.passErr (기본 0.12 = 국제 경기 실책 수준). 채점은 가치 함수 없이 실제 결과(득점·뺏김·바이올레이션·실책)만. */
const fs = require('fs'), path = require('path');
const RB = require('./rugby-brain.js'), RT = require('./rugby-tactics.js');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? +a.split('=')[1] : d; };
const N = arg('n', 40), ERR = arg('err', 0.12);
const LINE_A = ['3.5', '1.5', '1.5', '1.5']; // 럭비랩과 같은 라인업(노션 26.11.9) — 랩에서 그대로 다시 보려면 설정이 같아야 함
const DT = 1 / 60;

function one(cfg, seed) { // 한 판. 럭비랩의 다시 보기와 똑같은 순서: 씨앗 → 새 게임 → 휘슬 → 1/60초씩
  let e = null, why = ''; RB.seed(seed);
  const b = RB.create({ cfg: Object.assign({ lineA: LINE_A.slice(), trans: false, autoWhistle: false, mode: 'watch' }, cfg), end: x => { e = x; }, event: (k, d) => { if (k === 'tac') why = d.why; } });
  b.newGame(); b.whistle(); let t = 0; while (b.G.phase === 'live' && t < 90) { b.tick(DT); t += DT; }
  RB.seed(null); return { kind: e ? e.kind : 'none', text: e ? e.text : '안 끝남', err: !!(e && e.err), t: b.G.t, why };
}
const cases = [];
for (const o of RT.OFFENSE.filter(t => t.ready)) { const ibs = o.engine.cfg.ibPass ? [o.engine.cfg.ibPass] : [11, 8];
  for (const ib of ibs) for (const def of ['base', 'table']) cases.push({ o, ib, def }); }

const rows = [];
console.log(`롤아웃: 두뇌 v${RB.VERSION} · 전술 표 v${RT.VERSION} · 판수 ${N} · 패스 실수 ${ERR}\n`);
console.log('공격'.padEnd(22) + '인바'.padEnd(5) + '수비'.padEnd(34) + '득점   뺏김  바이올  실책  파울   초');
for (const c of cases) { const cfg = { align: c.o.engine.cfg.align, ibPass: c.ib, passErr: ERR }; if (c.def === 'table') cfg.tac = 'auto';
  const k = { try: 0, steal: 0, vio: 0, err: 0, pen: 0 }, samples = {}, reasons = {}; let T = 0, why = '';
  for (let i = 1; i <= N; i++) { const r = one(cfg, i); T += r.t; why = r.why || why;
    const key = r.kind === 'try' ? 'try' : r.kind === 'penalty' ? 'pen' : r.kind === 'violation' ? 'vio' : r.err ? 'err' : 'steal'; k[key]++;
    reasons[r.text] = (reasons[r.text] || 0) + 1; if (!samples[key]) samples[key] = { seed: i, text: r.text, t: +r.t.toFixed(1) }; }
  const pc = v => Math.round(v / N * 100), dist = RT.distOf(c.ib);
  const row = { off: c.o.id, offName: c.o.name, align: cfg.align, ib: c.ib, dist, def: c.def, why: c.def === 'table' ? why : '기본 수비(전술 표 안 씀)', n: N,
    try: pc(k.try), steal: pc(k.steal), vio: pc(k.vio), err: pc(k.err), pen: pc(k.pen), sec: +(T / N).toFixed(1), reasons, samples, cfg };
  rows.push(row);
  console.log(c.o.name.slice(0, 20).padEnd(22 - (c.o.name.match(/[가-힣]/g) || []).length / 2 | 0) + String(dist).padEnd(5) + row.why.slice(0, 30).padEnd(34 - (row.why.match(/[가-힣]/g) || []).length / 2 | 0)
    + String(row.try).padStart(3) + '%  ' + String(row.steal).padStart(3) + '%  ' + String(row.vio).padStart(4) + '%  ' + String(row.err).padStart(3) + '%  ' + String(row.pen).padStart(3) + '%  ' + String(row.sec).padStart(5)); }

const out = { made: new Date().toISOString().slice(0, 10), brain: RB.VERSION, tactics: RT.VERSION, n: N, passErr: ERR, lineA: LINE_A, rows };
const file = path.join(__dirname, '..', 'lab', 'rollouts.json'); fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log('\n저장: lab/rollouts.json → 3D 「롤아웃 보기」(game3d/?mode=review)에서 눌러 다시 보기');

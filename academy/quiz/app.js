/* 휠체어럭비 규정 & 케이스북 — 2026 WWR 원문 기준
   데이터: data/rules.json (2026 International Rules 111조), data/cases.json (2026 Casebook),
           data/changes.json (2026 개정 요약)
   게임 요소: 연속 도전·심판 사다리(승급 시험)·배지·경험치는 localStorage,
             공유 랭킹·명예의 전당은 rank-online.js(Firebase). */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const KEY_PROGRESS = 'wracad.quiz.progress.v2';
  const KEY_SESSION = 'wracad.quiz.session.v2';
  const KEY_GAME = 'wracad.game.v3';
  const LETTERS = ['A', 'B', 'C', 'D', 'E'];

  let RULES = null, CASES = [], BYID = new Map(), CH = [], CHANGES = null;
  let ART = [], ARTBY = new Map(), RCH = [];
  let progress = load(KEY_PROGRESS, {});
  let session = null;
  let sceneCtl = null;
  let articleReturn = 'rules';
  let currentChapter = null;
  let currentArticle = null;
  let openChapters = new Set();
  /* 화면 언어: 저장값 → 없으면 기기 언어(한국어면 ko, 아니면 en) */
  let LANG = (function () {
    try { const v = localStorage.getItem('wracad.lang'); if (v === 'ko' || v === 'en') return v; } catch (e) {}
    try { return /^ko/i.test(navigator.language || '') ? 'ko' : 'en'; } catch (e) { return 'ko'; }
  })();
  const DICT = window.I18N_EN || {};
  function T(ko, v) {
    let out = LANG === 'en' && DICT[ko] != null ? DICT[ko] : ko;
    if (v) out = out.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
    return out;
  }
  const EN_UI = () => LANG === 'en';
  function titleCase(x) { return String(x || '').toLowerCase().replace(/(^|[\s,(/-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(And|Of|The|For|In)\b/g, (w) => w.toLowerCase()).replace(/^./, (c) => c.toUpperCase()); }
  function chTitle(ch) { return EN_UI() && ch && ch.en ? titleCase(ch.en) : (ch ? ch.title : ''); }
  function artTitle(a) { return EN_UI() ? (a.titleEn || a.titleKo) : (a.titleKo || a.titleEn); }
  function qText(c) { return EN_UI() ? (c.questionEn || c.question) : c.question; }
  let caseLang = LANG;

  function load(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function chapterById(id) { return CH.find((c) => c.id === String(id)) || { id, title: T('{n}장', { n: id }) }; }
  function ruleChapterById(id) { return RCH.find((c) => String(c.id) === String(id)) || { id, title: T('{n}장', { n: id }) }; }
  function casesOf(chId) { return CASES.filter((c) => String(c.chapter) === String(chId)); }
  function reduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  /* ================= 날짜·저장 ================= */
  function todayKey(d) {
    const t = d || new Date();
    const p = (n) => (n < 10 ? '0' + n : '' + n);
    return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
  }
  function yesterdayKey() {
    const t = new Date(Date.now() - 86400000);
    return todayKey(t);
  }
  let game = load(KEY_GAME, null);
  if (!game || typeof game !== 'object') game = {};
  if (!game.daily) game.daily = null;
  if (!game.badges || typeof game.badges !== 'object') game.badges = {};
  if (!game.streak) game.streak = { last: '', days: 0, best: 0 };
  if (!game.rank) game.rank = { nick: '' };
  if (!game.seen) game.seen = {};
  if (!game.lad) game.lad = { g: 0, track: null, exam: {}, hist: { ko: [], en: [] }, world: { ko: false, en: false }, hallPending: [] };
  if (!game.xp) game.xp = { total: null, week: 0, wk: '' };
  if (!game.xpDay) game.xpDay = { date: '', ids: [] };
  function saveGame() { save(KEY_GAME, game); }
  const RANK = window.QuizRank || { mode: 'off', ready: () => Promise.resolve(false), weekKey: () => '' };

  /* ---------- 심판 사다리 (실제 경로: 국내 기록심 → 코트심 2급 → 1급 → WWR Candidate → Provisional → Zone → World) ----------
     need = 맞힌 '서로 다른 문항' 비율(전체 문항 수에 비례). 넘으면 승급 시험(하루 1번)을 볼 수 있다. */
  const LADDER = [
    { id: 'table', name: '기록심', short: '기록', tier: '국내', desc: '테이블에서 시간·점수·파울을 기록하며 시작합니다.' },
    { id: 'court2', name: '코트심 2급', short: '2급', tier: '국내', need: 0.15, n: 10, pass: 0.8 },
    { id: 'court1', name: '코트심 1급', short: '1급', tier: '국내', need: 0.35, n: 20, pass: 0.8 },
    { id: 'cand', name: 'WWR 캔디데이트', short: 'CAND', en: 'Candidate', tier: '국제', need: 0.5, n: 20, pass: 0.8 },
    { id: 'prov', name: 'WWR 프로비저널', short: 'PROV', en: 'Provisional', tier: '국제', need: 0.65, n: 20, pass: 0.85 },
    { id: 'zone', name: '존 레퍼리', short: 'ZONE', en: 'Zone Referee', tier: '국제', need: 0.8, n: 30, pass: 0.85 },
    { id: 'world', name: '월드 레퍼리', short: 'WORLD', en: 'World Referee', tier: '국제', need: 0.9, n: 30, pass: 0.9, five: true },
  ];
  const WORLD = LADDER.length - 1;
  function masteryOf() { return Object.keys(progress).filter((k) => progress[k] && (progress[k].ok || progress[k].best)).length; }
  function needOf(r) { return Math.ceil((r.need || 0) * CASES.length); }
  function gradeName() {
    const L = game.lad;
    if (L.world.en) return T('월드 레퍼리 👑');
    return T(LADDER[L.g].name);
  }
  /* 지금 도전할 다음 단계: {r, lang, idx, kind:'exam'|'track'|'done', key} */
  function nextStep() {
    const L = game.lad;
    if (L.g >= WORLD) {
      if (L.world.en) return { kind: 'done' };
      if (L.world.ko) return { kind: 'exam', r: LADDER[WORLD], idx: WORLD, lang: 'en', key: 'world_en', enRetry: true };
      return { kind: 'done' };
    }
    const idx = L.g + 1, r = LADDER[idx];
    if (r.tier === '국제' && !L.track) return { kind: 'track', r, idx };
    const lang = r.tier === '국제' ? L.track : 'ko';
    return { kind: 'exam', r, idx, lang, key: r.id + '_' + lang };
  }
  function examTakenToday(key) { return game.lad.exam[key] === todayKey(); }

  /* ---------- 경험치 (랭킹 점수) ----------
     정답 10점 + 연속 정답 보너스(2점씩, 최대 +10) · 승급 시험 합격 +50.
     같은 문항은 하루에 한 번만 경험치가 붙는다. 이번 주 점수는 월요일에 0부터. */
  function xpState() {
    if (game.xp.total == null) game.xp.total = masteryOf() * 10;  // 예전 기록 옮기기
    const wk = RANK.weekKey ? RANK.weekKey() : '';
    if (game.xp.wk !== wk) { game.xp.wk = wk; game.xp.week = 0; }
    return game.xp;
  }
  function addXp(n) {
    const x = xpState();
    x.total += n; x.week += n;
    saveGame();
  }

  const VIEWS = ['home', 'rules', 'article', 'quizhome', 'chapter', 'quiz', 'result', 'changes', 'me'];
  let curView = 'home';
  function show(v) {
    curView = v;
    VIEWS.forEach((x) => { $('view-' + x).hidden = x !== v; });
    if (v !== 'quiz') { if (sceneCtl) { sceneCtl.destroy(); sceneCtl = null; } }
    window.scrollTo(0, 0);
  }

  /* ================= 홈 (게임 우선) ================= */
  function savedSession() {
    const s = load(KEY_SESSION, null);
    return (s && s.ids && s.ids.length && s.i < s.ids.length) ? s : null;
  }

  function renderHome() {
    if ($('ruleCount')) $('ruleCount').textContent = ART.length;
    if ($('caseCount')) $('caseCount').textContent = CASES.length;
    document.querySelectorAll('.rankCalcMax').forEach((el) => { el.textContent = CASES.length; });
    if ($('sceneCount')) $('sceneCount').textContent = CASES.filter((c) => c.scene).length;

    /* ---- 오늘의 도전 ---- */
    const ids = todayIds();
    const done = !!(game.daily && game.daily.date === todayKey() && game.daily.done);
    const st = game.streak;
    const dbtn = $('btnDaily');
    if (dbtn) dbtn.textContent = done ? T('오늘의 10문제 다시 풀기') : T('오늘의 10문제 도전');
    if ($('homeDailyState')) {
      $('homeDailyState').textContent = done
        ? T('오늘 도전 완료 · 연속 {d}일', { d: st.days || 1 })
        : T('오늘의 10문제 · {n}문항', { n: ids.length });
    }
    if ($('dailyNote')) {
      $('dailyNote').textContent = done
        ? T('오늘 몫은 끝냈습니다. 내일 또 새 10문제가 나옵니다. (최고 {b}일)', { b: st.best || st.days || 1 })
        : (st.days ? T('연속 {d}일째 도전 중 · 최고 {b}일', { d: st.days, b: st.best }) : T('아직 연속 도전 기록이 없습니다.'));
    }
    const resume = $('btnResume');
    const saved = savedSession();
    if (resume) {
      if (saved) {
        resume.hidden = false;
        resume.textContent = T('이어풀기 ({i}/{n})', { i: saved.i + 1, n: saved.ids.length });
      } else { resume.hidden = true; resume.textContent = T('이어풀기'); }
    }

    /* ---- 심판 사다리 · 랭킹 ---- */
    renderLadder('home');
    renderRankCard('home');
    renderHello();

    /* ---- 배지·최근 기록 ---- */
    const got = BADGES.filter((b) => game.badges[b.id]).sort((a, b) => String(game.badges[b.id]).localeCompare(String(game.badges[a.id])));
    if ($('homeBadgeCount')) $('homeBadgeCount').textContent = `${got.length} / ${BADGES.length}`;
    if ($('homeBadgeStrip')) {
      $('homeBadgeStrip').innerHTML = got.length ? got.slice(0, 4).map((b) => `<span class="mini-badge-art">${badgeArt(b, true, 'h')}</span>`).join('') : T('아직 없음');
    }
    const answered = Object.keys(progress);
    const last = answered.map((k) => ({ k, at: (progress[k] && progress[k].at) || 0 })).sort((a, b) => b.at - a.at)[0];
    const lc = last ? BYID.get(last.k) : null;
    if ($('homeRecent')) {
      $('homeRecent').textContent = lc
        ? T('케이스 {no} · {r}', { no: lc.caseNo, r: progress[lc.id].ok ? T('맞힘 ✓') : T('틀림 ✕') })
        : T('아직 기록 없음');
    }
    if ($('homeSolved')) $('homeSolved').textContent = T('푼 문항 {a} / {n}', { a: answered.length, n: CASES.length });

    const m = RULES ? RULES.meta : {};
    if ($('metaSource')) $('metaSource').textContent = T('2026 WWR 국제 경기규정 전문(111조·14장) · 2026 케이스북 · 2026 개정 요약');
    if ($('metaEdition')) $('metaEdition').textContent = (m.edition || '') + (m.editionKo && !EN_UI() ? ' · ' + m.editionKo : '');
    show('home');
  }

  /* ================= 심판 사다리 화면 ================= */
  function pctBar(have, need) { return need ? Math.max(3, Math.min(100, Math.round((have / need) * 100))) : 100; }

  function renderLadder(where) {
    const P = where === 'me' ? 'me' : 'home';
    const L = game.lad, m = masteryOf(), ns = nextStep();
    const set = (id, v) => { const el = $(P + id); if (el) el.textContent = v; };
    set('LadTitle', gradeName());
    const cur = LADDER[L.g];
    set('LadTier', T('{tier} · {g} / {n}단계', { tier: T(cur.tier), g: L.g + 1, n: LADDER.length }) + (L.track ? T(' · 국제 시험 {l}', { l: L.track === 'en' ? 'English' : T('한국어') }) : ''));

    const steps = $(P + 'LadSteps');
    if (steps) {
      steps.innerHTML = LADDER.map((r, i) => {
        const cls = i < L.g ? 'done' : i === L.g ? 'now' : '';
        const crown = i === WORLD && L.world.en ? '👑' : '';
        return `<li class="lad-step ${cls} ${r.tier === '국제' ? 'intl' : ''}"><span class="lad-dot">${i < L.g || (i === WORLD && L.g === WORLD) ? '✓' : i + 1}</span><span class="lad-lab">${esc(T(r.short))}${crown}</span></li>`;
      }).join('');
    }

    const btn = $(P + 'BtnExam');
    const bar = $(P + 'LadBar');
    let next = '', count = '', label = '', enabled = false, pct = 100;
    if (ns.kind === 'done') {
      next = L.world.en ? T('영어로 월드 레퍼리까지 올랐습니다. 최고 단계입니다. 명예의 전당에 이름이 올라 있습니다.') : T('최고 단계입니다.');
      count = T('맞힌 문항 {m} / {n}', { m, n: CASES.length });
      label = T('최고 단계 달성');
    } else if (ns.kind === 'track') {
      next = T('국내 1급 다음은 국제심판(WWR) 길입니다. 시험 언어를 고르고 도전하세요. 영어로 월드까지 가면 최고 배지 👑');
      count = T('맞힌 문항 {m} / {n}', { m, n: CASES.length });
      label = T('도전! 국제심판');
      enabled = true;
    } else {
      const r = ns.r, need = needOf(r);
      pct = pctBar(m, need);
      const langTxt = ns.lang === 'en' ? ' · English' : '';
      if (ns.enRetry) {
        next = T('한국어로 월드 레퍼리 달성! 이제 같은 시험을 영어로 통과하면 최고 배지 👑 (30문항, 최근 5회 중 3회 90점 이상 + 평균 90점)');
      } else if (r.five) {
        next = T('다음: {name}{l} — 월드 시험 {n}문항, 최근 5회 중 3회 90점 이상 + 5회 평균 90점 이상이면 승급', { name: T(r.name), l: langTxt, n: r.n });
      } else {
        next = T('다음: {name}{l} — 서로 다른 문항 {need}개를 맞히면 승급 시험({n}문항, {p}점 이상)', { name: T(r.name), l: langTxt, need, n: r.n, p: Math.round(r.pass * 100) });
      }
      const h = (game.lad.hist[ns.lang] || []).slice(-5);
      count = T('맞힌 문항 {m} / {n}', { m, n: need }) + (r.five && h.length ? T(' · 최근 시험 {h}', { h: h.join(' · ') }) : '');
      if (m < need) { label = T('승급 시험까지 {n}문항', { n: need - m }); }
      else if (examTakenToday(ns.key)) { label = T('오늘 시험 완료 · 내일 다시'); }
      else { label = r.five ? T('월드 시험 보기') : T('승급 시험 보기'); enabled = true; }
    }
    set('LadNext', next);
    set('LadCount', count);
    if (bar) bar.style.width = pct + '%';
    if (btn) { btn.textContent = label; btn.disabled = !enabled; }
  }

  function onExamButton() {
    const ns = nextStep();
    if (ns.kind === 'track') return chooseTrack();
    if (ns.kind !== 'exam') return;
    if (masteryOf() < needOf(ns.r) || examTakenToday(ns.key)) return;
    const r = ns.r;
    popup('EXAM', T('{name}{l} 시험', { name: T(r.name), l: ns.lang === 'en' ? ' · English' : '' }),
      T('전체 케이스에서 {n}문항이 섞여 나옵니다. {rule} 시험은 하루 한 번이고, 시작하면 오늘 기회를 씁니다.{en}', {
        n: r.n, rule: r.five ? T('90점 이상이 최근 5회 중 3번, 평균 90점 이상이면 승급합니다.') : T('{p}점 이상이면 승급합니다.', { p: Math.round(r.pass * 100) }),
        en: ns.lang === 'en' ? T(' 문제는 영어로만 나옵니다.') : '' }),
      [{ label: T('시작'), primary: true, fn: () => startExam(ns) }, { label: T('나중에') }]);
  }

  function chooseTrack() {
    popup(T('도전! 국제심판'), T('시험 언어를 고르세요'),
      T('WWR 국제심판 길(캔디데이트 → 프로비저널 → 존 → 월드)을 어떤 언어로 볼지 정합니다. 한국어로도 월드까지 갈 수 있고, 영어로 월드까지 가면 최고 배지 👑를 받습니다. 나중에 내 기록 화면에서 바꿀 수 있습니다.'),
      [{ label: T('한국어로'), primary: true, fn: () => setTrack('ko') }, { label: 'English', primary: true, fn: () => setTrack('en') }, { label: T('나중에') }]);
  }
  function setTrack(t) {
    game.lad.track = t;
    saveGame();
    renderLadder('home'); renderLadder('me');
  }

  function startExam(ns) {
    const r = ns.r;
    game.lad.exam[ns.key] = todayKey();
    saveGame();
    const ids = shuffle(CASES.map((c) => c.id)).slice(0, Math.min(r.n, CASES.length));
    const prevLang = caseLang;
    caseLang = ns.lang === 'en' ? 'en' : caseLang;
    session = { ids, i: 0, answers: [], mode: 'exam', label: T('승급 시험 · {name}{l}', { name: T(r.name), l: ns.lang === 'en' ? ' (EN)' : '' }), from: 'home', startedAt: Date.now(),
      exam: { idx: ns.idx, lang: ns.lang, key: ns.key, n: ids.length, pass: r.pass, five: !!r.five, enRetry: !!ns.enRetry, prevLang } };
    save(KEY_SESSION, session);
    renderQuiz();
  }

  /* 시험이 끝나면 승급 판정 */
  function judgeExam(right, total) {
    const ex = session.exam, L = game.lad;
    const pct = total ? Math.round((right / total) * 100) : 0;
    const r = LADDER[ex.idx];
    let passed = false, msg = '';
    if (ex.five) {
      const h = L.hist[ex.lang] = (L.hist[ex.lang] || []).concat(pct).slice(-10);
      const last = h.slice(-5);
      const over = last.filter((x) => x >= 90).length;
      const avg = last.reduce((a, b) => a + b, 0) / last.length;
      passed = over >= 3 && avg >= 90;
      msg = passed ? '' : T('최근 {n}회: {h} — 90점 이상 {o}/3회, 평균 {a}점 (90점 필요). 내일 다시 도전하세요.', { n: last.length, h: last.join(' · '), o: over, a: avg.toFixed(1) });
    } else {
      passed = pct >= Math.round(ex.pass * 100);
      msg = passed ? '' : T('{s}점 — {p}점 이상이면 합격입니다. 내일 다시 도전하세요.', { s: pct, p: Math.round(ex.pass * 100) });
    }
    if (!passed) { saveGame(); return { passed, pct, msg }; }
    addXp(50);
    if (ex.idx === WORLD) {
      L.g = WORLD;
      if (ex.lang === 'en') { L.world.en = true; L.world.ko = true; giveBadge('worldEn'); giveBadge('world'); }
      else { L.world.ko = true; giveBadge('world'); }
      enterHall(ex.lang);
      msg = ex.lang === 'en' ? T('영어로 월드 레퍼리가 되었습니다. 최고 배지 👑와 함께 명예의 전당에 올랐습니다.') : T('월드 레퍼리가 되었습니다. 명예의 전당에 올랐습니다. 영어로도 도전해 최고 배지 👑를 노려보세요.');
    } else {
      L.g = ex.idx;
      giveBadge(r.id);
      msg = T('{name}(으)로 승급했습니다. 경험치 +50', { name: T(r.name) });
    }
    saveGame();
    return { passed, pct, msg };
  }

  function enterHall(lang) {
    const nick = (game.rank.nick || '').trim();
    if (!nick) {
      if (game.lad.hallPending.indexOf(lang) < 0) game.lad.hallPending.push(lang);
      saveGame();
      return;
    }
    RANK.ready().then((ok) => { if (ok && RANK.enterHall) RANK.enterHall(nick, lang); });
  }

  /* ================= 공유 랭킹 ================= */
  const rankTab = { home: 'week', me: 'week' };
  let syncTimer = null;
  function syncRank() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      const nick = (game.rank.nick || '').trim();
      if (!nick || RANK.mode === 'off') return;
      const x = xpState();
      RANK.push({ nick, total: x.total, week: x.week, wk: x.wk, grade: game.lad.g, en: !!game.lad.world.en })
        .then(() => { refreshBoards(); });
      const pend = game.lad.hallPending.splice(0);
      if (pend.length) { saveGame(); pend.forEach(enterHall); }
    }, 300);
  }
  function refreshBoards() {
    if (!$('view-home').hidden) { renderRankCard('home'); renderHello(); }
    if (!$('view-me').hidden) renderRankCard('me');
  }

  function renderRankCard(where) {
    const P = where === 'me' ? 'me' : 'home';
    const x = xpState();
    if ($(P + 'MyWeek')) $(P + 'MyWeek').textContent = x.week.toLocaleString();
    if ($(P + 'MyTotal')) $(P + 'MyTotal').textContent = x.total.toLocaleString();
    const nick = (game.rank.nick || '').trim();
    const nickRow = $(P + 'NickRow');
    if (nickRow) nickRow.hidden = where === 'home' && !!nick;
    const nin = $(P + 'Nick');
    if (nin && document.activeElement !== nin) nin.value = nick;
    document.querySelectorAll(`#${P}RankTabs [data-tab]`).forEach((b) => {
      const on = b.getAttribute('data-tab') === rankTab[where];
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const st = $(P + 'RankStatus');
    const box = $(P + 'RankBoard');
    if (!box) return;
    if (RANK.mode === 'off') {
      box.innerHTML = `<p class="empty sm">${T('공유 랭킹은 준비 중입니다. 관리자가 서버(Firebase)를 연결하면 이번 주 1등 · 역대 1등 · 명예의 전당이 열립니다. 경험치는 지금부터 쌓입니다.')}</p>`;
      if (st) st.textContent = '';
      return;
    }
    if (st) st.textContent = nick ? T('{nick} 이름으로 순위에 올라갑니다.', { nick }) : T('닉네임을 정하면 순위에 올라갑니다.');
    const n = where === 'me' ? 20 : 5;
    const tab = rankTab[where];
    box.innerHTML = `<p class="empty sm">${T('불러오는 중…')}</p>`;
    const p = tab === 'hall' ? RANK.hall() : RANK.top(tab, x.wk, 50);
    p.then((rows) => {
      if (rankTab[where] !== tab) return;
      if (rows == null) { box.innerHTML = `<p class="empty sm">${T('순위를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.')}${RANK.error ? ' (' + esc(RANK.error) + ')' : ''}</p>`; return; }
      if (!rows.length) {
        box.innerHTML = `<p class="empty sm">${tab === 'hall' ? T('아직 월드 레퍼리에 오른 사람이 없습니다. 첫 번째 주인공이 되어 보세요.') : tab === 'week' ? T('이번 주 기록이 아직 없습니다. 첫 문제를 풀면 1등입니다.') : T('아직 기록이 없습니다.')}</p>`;
        return;
      }
      box.innerHTML = '';
      rows.slice(0, tab === 'hall' ? (where === 'me' ? 100 : 5) : n).forEach((e, i) => {
        const row = document.createElement('div');
        row.className = 'rank-row' + (e.me ? ' me' : '') + (i === 0 ? ' first' : '');
        if (tab === 'hall') {
          const d = e.at ? todayKey(new Date(e.at)) : '';
          row.innerHTML = `<span class="rank-no">${T('{n}호', { n: i + 1 })}</span><span class="rank-nick">${esc(e.nick)}${e.me ? T(' (나)') : ''}</span>
            <span class="rank-lv">${e.lang === 'en' ? '👑 English' : T('🌏 한국어')}</span><span class="rank-x">${esc(d)}</span>`;
        } else {
          const g = LADDER[Math.max(0, Math.min(WORLD, e.grade | 0))];
          row.innerHTML = `<span class="rank-no">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span><span class="rank-nick">${esc(e.nick)}${e.me ? T(' (나)') : ''}</span>
            <span class="rank-lv">${esc(T(g.short))}${e.en && e.grade >= WORLD ? '👑' : ''}</span><span class="rank-x">${Number(e.score).toLocaleString()}</span>`;
        }
        box.appendChild(row);
      });
      if (tab === 'week' && rows[0] && rows[0].me && rows[0].score > 0) giveBadge('weekTop');
      const myIdx = rows.findIndex((r) => r.me);
      if (tab !== 'hall' && nick && myIdx >= n) {
        const tail = document.createElement('p');
        tail.className = 'empty sm';
        tail.textContent = T('나는 {r}위 ({s}점)', { r: myIdx + 1, s: Number(rows[myIdx].score).toLocaleString() });
        box.appendChild(tail);
      } else if (tab !== 'hall' && nick && myIdx < 0) {
        const tail = document.createElement('p');
        tail.className = 'empty sm';
        tail.textContent = T('나는 50위 밖입니다. ({k} {s}점)', { k: tab === 'week' ? T('이번 주') : T('누적'), s: Number(tab === 'week' ? x.week : x.total).toLocaleString() });
        box.appendChild(tail);
      }
    });
  }

  function saveNick(where) {
    const P = where === 'me' ? 'me' : 'home';
    const v = (($(P + 'Nick') && $(P + 'Nick').value) || '').trim().slice(0, 14);
    if (!v) { popup('RANKING', T('닉네임을 넣어 주세요'), T('1~14글자. 순위표와 명예의 전당에 이 이름이 나옵니다.')); return; }
    game.rank.nick = v;
    saveGame();
    syncRank();
    renderRankCard(where);
    renderHello();
  }

  /* 홈 맨 위 인사 줄: 이름 · 대표 배지 · 등급 · 이번 주 순위 · 점수 · 연속 */
  function renderHello() {
    const bar = $('helloBar');
    if (!bar) return;
    const nick = (game.rank.nick || '').trim();
    const x = xpState();
    const got = BADGES.filter((b) => game.badges[b.id]);
    const lead = leadBadge(got);
    $('helloArt').innerHTML = lead ? badgeArt(lead, true, 'hello') : badgeArt(BADGES[0], false, 'hello');
    $('helloArt').classList.toggle('none', !lead);
    $('helloName').textContent = nick ? T('{nick}님, 반가워요 👋', { nick }) : T('처음 오셨네요 👋');
    const st = game.streak.days ? T(' · 🔥{d}일', { d: game.streak.days }) : '';
    $('helloMeta').textContent = T('{g} · {w}점{s}', { g: gradeName(), w: x.week.toLocaleString(), s: st });
    const rk = $('helloRank');
    if (!nick || RANK.mode === 'off') { rk.hidden = true; return; }
    RANK.top('week', x.wk, 50).then((rows) => {
      if (!rows) { rk.hidden = true; return; }
      const i = rows.findIndex((r) => r.me);
      rk.hidden = false;
      rk.classList.toggle('first', i === 0);
      rk.innerHTML = i >= 0 ? `<small>${T('이번 주')}</small><b>${T('{r}위', { r: i + 1 })}</b>` : `<small>${T('이번 주')}</small><b>${x.week > 0 ? '50+' : '—'}</b>`;
    });
  }

  /* ================= 규정 목록 ================= */
  function renderRules() {
    $('searchPanel').hidden = true;
    $('chapterAccordion').hidden = false;
    $('ruleSearch').value = '';
    $('searchClear').hidden = true;
    const box = $('chapterAccordion');
    box.innerHTML = '';
    for (const ch of RCH) {
      const wrap = document.createElement('div');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chap';
      btn.innerHTML = `<span class="chap-main"><span class="chap-title">${esc(chTitle(ch))}</span>
        <span class="chap-en">${EN_UI() ? '' : esc(ch.en || '')}</span></span>
        <span class="chap-meta">${T('{n}조', { n: ch.articles.length })} ${openChapters.has(String(ch.id)) ? '▾' : '▸'}</span>`;
      wrap.appendChild(btn);
      const list = document.createElement('div');
      list.className = 'chap-list';
      list.hidden = !openChapters.has(String(ch.id));
      for (const no of ch.articles) {
        const a = ARTBY.get(Number(no));
        if (!a) continue;
        const link = document.createElement('button');
        link.type = 'button';
        link.className = 'art-link';
        link.innerHTML = `<span class="no">${T('{n}조', { n: a.no })}</span><span class="ti">${esc(artTitle(a))}</span><span class="pg">${a.changed2026 ? '<b class="mini-badge">2026</b>' : ''}${a.page || ''}p</span>`;
        link.addEventListener('click', () => openArticle(a.no, 'rules'));
        list.appendChild(link);
      }
      wrap.appendChild(list);
      btn.addEventListener('click', () => {
        const id = String(ch.id);
        if (openChapters.has(id)) openChapters.delete(id); else openChapters.add(id);
        renderRules();
        if (openChapters.has(id)) {
          const idx = RCH.findIndex((c) => String(c.id) === id);
          const el = $('chapterAccordion').children[idx];
          if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      });
      box.appendChild(wrap);
    }
    show('rules');
  }

  /* -------- 검색 -------- */
  let SEARCH_IDX = [];
  function buildSearchIndex() {
    SEARCH_IDX = ART.map((a) => ({
      a,
      ko: (a.titleKo + ' ' + a.bodyKo.join(' ')).toLowerCase(),
      en: (a.titleEn + ' ' + a.bodyEn.join(' ')).toLowerCase(),
      title: (a.titleKo + ' ' + a.titleEn).toLowerCase()
    }));
  }

  function snippet(a, q) {
    const hay = (EN_UI() ? a.bodyEn : a.bodyKo).join(' ');
    const i = hay.toLowerCase().indexOf(q);
    const b0 = (EN_UI() ? a.bodyEn : a.bodyKo)[0] || '';
    if (i < 0) return b0.slice(0, 78) + (b0.length > 78 ? '…' : '');
    const s = Math.max(0, i - 24);
    return (s > 0 ? '…' : '') + hay.slice(s, s + 84) + (hay.length > s + 84 ? '…' : '');
  }

  function runSearch(raw) {
    const q = raw.trim().toLowerCase();
    $('searchClear').hidden = !q;
    if (!q) {
      $('searchPanel').hidden = true;
      $('chapterAccordion').hidden = false;
      return;
    }
    $('searchPanel').hidden = false;
    $('chapterAccordion').hidden = true;
    const tokens = q.split(/\s+/).filter(Boolean);
    const numOnly = /^\d{1,3}(조)?$/.test(q) ? parseInt(q, 10) : null;
    let hits = SEARCH_IDX.filter((r) => {
      if (numOnly !== null && r.a.no === numOnly) return true;
      return tokens.every((t) => r.ko.includes(t) || r.en.includes(t) || String(r.a.no) === t);
    });
    if (numOnly !== null) {
      hits.sort((x, y) => (x.a.no === numOnly ? -1 : 0) - (y.a.no === numOnly ? -1 : 0) || x.a.no - y.a.no);
    }
    $('searchSummary').textContent = hits.length ? T('{n}개 조항', { n: hits.length }) : T('찾는 조항이 없습니다. 다른 낱말로 해보세요.');
    const box = $('searchResults');
    box.innerHTML = '';
    hits.slice(0, 40).forEach((r) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'case-row';
      b.innerHTML = `<span class="case-no">${T('{n}조', { n: r.a.no })} · ${esc(chTitle(ruleChapterById(r.a.chapter)))}</span>
        <span class="case-q"><b>${esc(artTitle(r.a))}</b>${r.a.changed2026 ? ' <span class="mini-badge">2026</span>' : ''}<br>${esc(snippet(r.a, tokens[0]))}</span>`;
      b.addEventListener('click', () => openArticle(r.a.no, 'rules'));
      box.appendChild(b);
    });
  }

  /* ================= 조문 ================= */
  function openArticle(no, from) {
    const a = ARTBY.get(Number(no));
    if (!a) return;
    articleReturn = from || 'rules';
    currentArticle = a;
    $('artNo').textContent = T('{n}조', { n: a.no });
    $('artChapter').textContent = chTitle(ruleChapterById(a.chapter));
    $('artTitleKo').textContent = artTitle(a);
    $('artTitleEn').textContent = EN_UI() ? '' : (a.titleEn || '');
    const badge = $('art2026');
    if (badge) {
      if (a.changed2026 || a.changeNote) {
        badge.hidden = false;
        badge.innerHTML = `<span class="badge-2026">${T('2026 개정')}</span>
          <span class="badge-text">${esc(EN_UI() ? T('2026년 1월 1일 개정 사항이 반영된 조항입니다.') : (a.changeNote || '2026년 1월 1일 개정 사항이 반영된 조항입니다.'))}</span>`;
      } else { badge.hidden = true; badge.innerHTML = ''; }
    }
    $('artBodyKo').innerHTML = a.bodyKo.map((p) => `<p>${esc(p)}</p>`).join('') || `<p class="muted">${T('국문 본문이 없습니다.')}</p>`;
    $('artBodyEn').innerHTML = a.bodyEn.map((p) => `<p>${esc(p)}</p>`).join('') || `<p class="muted">${T('영문 본문이 없습니다.')}</p>`;
    $('artBodyEn').hidden = !EN_UI();
    $('artBodyKo').hidden = EN_UI();
    $('btnLang').textContent = EN_UI() ? 'KO' : 'EN';
    $('artSrc').textContent = T('2026 International Rules {p}쪽 · {t}', { p: a.page || '', t: a.koNew ? T('국문 새 번역') : T('국문은 2021년 협회 번역') });

    const related = CASES.filter((c) => (c.relatedArticles || []).map(String).includes(String(a.no)));
    const rel = $('artRelated');
    rel.hidden = !related.length;
    const list = $('artCaseList');
    list.innerHTML = '';
    if (related.length) {
      for (const c of related) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'case-row';
        const p = progress[c.id];
        b.innerHTML = `<span class="case-no">${T('케이스 {no} · {p}쪽', { no: esc(c.caseNo), p: esc(c.page) })}</span>
          <span class="case-q">${esc(qText(c))}</span>
          <span class="case-tags">${c.scene ? `<span class="tag scene">${T('장면')}</span>` : `<span class="tag text">${T('글')}</span>`}
          ${p ? (p.ok ? `<span class="tag ok">${T('✓ 맞힘')}</span>` : `<span class="tag bad">${T('✕ 틀림')}</span>`) : ''}</span>`;
        b.addEventListener('click', () => startSession([c.id], 'case', T('케이스 {no}', { no: c.caseNo }), 'article'));
        list.appendChild(b);
      }
    }
    const idx = ART.findIndex((x) => x.no === a.no);
    $('btnPrevArt').disabled = idx <= 0;
    $('btnNextArt').disabled = idx < 0 || idx >= ART.length - 1;
    $('btnPrevArt').onclick = () => idx > 0 && openArticle(ART[idx - 1].no, 'rules');
    $('btnNextArt').onclick = () => idx >= 0 && idx < ART.length - 1 && openArticle(ART[idx + 1].no, 'rules');
    const backBtn = document.querySelector('#view-article .icon-btn[data-back]');
    if (backBtn) {
      const target = articleReturn === 'quiz' ? 'quiz' : articleReturn === 'chapter' ? 'chapter' : 'rules';
      backBtn.setAttribute('data-back', target);
      backBtn.setAttribute('aria-label', target === 'quiz' ? T('문제로 돌아가기') : target === 'chapter' ? T('케이스 목록으로') : T('규정 목록으로'));
    }
    show('article');
  }

  $('btnLang') && $('btnLang').addEventListener('click', () => {
    const en = $('artBodyEn').hidden;
    $('artBodyEn').hidden = !en;
    $('artBodyKo').hidden = en;
    $('btnLang').textContent = en ? 'KO' : 'EN';
  });

  /* ================= 퀴즈 홈 ================= */
  function answeredCount(ids) { return ids.filter((id) => progress[id]).length; }

  function todayIds() {
    const key = todayKey();
    if (game.daily && game.daily.date === key && game.daily.ids && game.daily.ids.length) return game.daily.ids;
    const seedStr = key.replace(/-/g, '');
    let seed = parseInt(seedStr, 10) % 2147483647;
    const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
    const pool = CASES.map((c) => c.id);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const ids = pool.slice(0, Math.min(10, pool.length));
    game.daily = { date: key, ids, done: false };
    saveGame();
    return ids;
  }

  function renderQuizHome() {
    const total = CASES.length;
    const sceneN = CASES.filter((c) => c.scene).length;
    if ($('homeStats')) $('homeStats').textContent = T('전체 {t}문항 · 코트 장면 {s} · 글 문제 {x}', { t: total, s: sceneN, x: total - sceneN });
    const answered = Object.keys(progress).length;
    if ($('homeProgress')) $('homeProgress').textContent = answered ? T('지금까지 {n}문항을 풀었습니다', { n: answered }) : T('아직 푼 문제가 없습니다');
    const list = $('chapterList');
    list.innerHTML = '';
    const counts = {};
    for (const c of CASES) counts[c.chapter] = (counts[c.chapter] || 0) + 1;
    for (const ch of CH) {
      const n = counts[ch.id] || 0;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'chap' + (n ? '' : ' todo');
      el.innerHTML = `<span class="chap-main"><span class="chap-title">${esc(chTitle(ch))}</span>
        <span class="chap-en">${EN_UI() ? '' : esc(ch.en || '')}${ch.pages && !EN_UI() ? ' · ' + esc(ch.pages) : ''}</span></span>
        <span class="chap-meta">${n ? answeredCount(casesOf(ch.id).map((c) => c.id)) + '/' + n : T('준비 중')}${BADGES.some((b) => b.ch && b.ch.indexOf(String(ch.id)) >= 0 && game.badges[b.id]) ? ' ★' : ''}</span>`;
      if (n) el.addEventListener('click', () => openChapter(ch.id));
      list.appendChild(el);
    }
    show('quizhome');
  }

  function openChapter(id) {
    currentChapter = id;
    const ch = chapterById(id);
    const items = casesOf(id);
    $('chapterTitle').textContent = chTitle(ch);
    $('chapterSub').textContent = T('{en}{pg} · {n}문항', { en: EN_UI() ? '' : (ch.en || ''), pg: ch.pages && !EN_UI() ? ' · ' + ch.pages : '', n: items.length }).replace(/^ · /, '');
    const list = $('caseList');
    list.innerHTML = '';
    items.forEach((c) => {
      const p = progress[c.id];
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'case-row' + (p ? (p.ok ? ' ok' : ' bad') : '');
      el.innerHTML = `<span class="case-no">${T('케이스 {no} · {p}쪽', { no: esc(c.caseNo), p: esc(c.page) })}</span>
        <span class="case-q">${esc(qText(c))}</span>
        <span class="case-tags">
          ${c.scene ? `<span class="tag scene">${T('장면')}</span>` : `<span class="tag text">${T('글')}</span>`}
          ${p ? (p.ok ? `<span class="tag ok">${T('✓ 맞힘')}</span>` : `<span class="tag bad">${T('✕ 틀림')}</span>`) : ''}
        </span>`;
      el.addEventListener('click', () => startSession([c.id], 'case', T('케이스 {no}', { no: c.caseNo }), 'chapter'));
      list.appendChild(el);
    });
    $('btnChapterAll').textContent = T('이 장 {n}문항 풀기', { n: items.length });
    $('btnChapterAll').onclick = () => startSession(items.map((c) => c.id), 'chapter', chTitle(ch), 'chapter');
    show('chapter');
  }

  /* ================= 문제 ================= */
  function startSession(ids, mode, label, from) {
    session = { ids, i: 0, answers: [], mode, label, from: from || 'quizhome', startedAt: Date.now() };
    save(KEY_SESSION, session);
    renderQuiz();
  }
  /* 14장 전체에서 섞어 10문항 (같은 판 안에서 문제 중복 없음) */
  function startRandom(from) {
    const ids = shuffle(CASES.map((c) => c.id)).slice(0, Math.min(10, CASES.length));
    startSession(ids, 'random', T('전체 랜덤 10문제'), from || 'home');
  }
  function currentCase() { return session ? BYID.get(session.ids[session.i]) : null; }

  function renderQuiz() {
    if (!session) return renderQuizHome();
    const c = currentCase();
    if (!c) return renderResult();
    if (sceneCtl) { sceneCtl.destroy(); sceneCtl = null; }
    const from = session.from || 'quizhome';

    $('quizStep').textContent = `${session.i + 1} / ${session.ids.length}`;
    $('quizScore').textContent = T('{n}점', { n: session.answers.filter((a) => a.ok).length });
    $('quizMode').textContent = session.label || '';
    $('btnQuizBack').onclick = () => {
      if (from === 'chapter' && (session.mode === 'chapter' || session.mode === 'case')) openChapter(currentChapter || c.chapter);
      else if (from === 'home') renderHome();
      else renderQuizHome();
    };

    $('qNo').textContent = T('케이스 {no}', { no: c.caseNo });
    $('qChapter').textContent = chTitle(chapterById(c.chapter));
    const en = caseLang === 'en';
    $('qText').textContent = en ? (c.questionEn || c.question) : c.question;
    const lb = $('btnQuizLang');
    if (lb) { lb.textContent = en ? 'KO' : 'EN'; lb.hidden = enLocked(); }

    const sceneBox = $('sceneBox'), textBox = $('textOnlyBox');
    if (c.scene && window.QuizScene) {
      sceneBox.hidden = false; textBox.hidden = true;
      const wrap = $('sceneWrap');
      wrap.innerHTML = '<canvas id="sceneCanvas"></canvas>';
      const canvas = $('sceneCanvas');
      requestAnimationFrame(() => {
        sceneCtl = window.QuizScene.create(wrap, canvas, c.scene, { lang: caseLang });
      });
    } else {
      sceneBox.hidden = true; textBox.hidden = false;
    }

    const box = $('choices');
    box.className = 'choices';
    box.innerHTML = '';
    delete box.dataset.locked;
    const labels = en && c.choicesEn && c.choicesEn.length ? c.choicesEn : c.choices;
    const prev = session.answers.find((a) => a.id === c.id);
    let picked = null;
    labels.forEach((text, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      b.innerHTML = `<span class="mark">${LETTERS[i]}</span><span class="ctext">${esc(text)}</span><span class="icon" aria-hidden="true"></span>`;
      b.addEventListener('click', () => {
        if (box.dataset.locked) return;
        picked = i;
        [...box.children].forEach((x, k) => x.classList.toggle('sel', k === i));
        $('btnCheck').disabled = false;
      });
      box.appendChild(b);
    });
    $('btnCheck').disabled = true;
    $('btnCheck').hidden = false;
    $('btnCheck').textContent = T('정답 확인');
    $('btnCheck').onclick = () => checkAnswer(c, box, picked);

    $('feedback').hidden = true;
    $('feedback').innerHTML = '';
    if ($('origBox')) { $('origBox').hidden = true; $('origBox').innerHTML = ''; }
    $('btnNext').hidden = true;
    if (prev) {
      markChoices(c, box, prev.pick);
      renderFeedback(c, prev.pick, prev.ok);
      $('btnNext').hidden = false;
      $('btnNext').textContent = session.i + 1 < session.ids.length ? T('다음 문제') : T('결과 보기');
      $('btnNext').onclick = next;
    }
    show('quiz');
  }

  function markChoices(c, box, pick) {
    box.dataset.locked = '1';
    [...box.children].forEach((x, k) => {
      x.classList.add('locked');
      x.classList.remove('sel');
      if (k === c.answer) { x.classList.add('correct'); x.querySelector('.icon').textContent = '✓'; }
      if (k === pick && pick !== c.answer) { x.classList.add('wrong'); x.querySelector('.icon').textContent = '✕'; }
      if (k === pick) x.classList.add('picked');
    });
    $('btnCheck').hidden = true;
  }

  function enLocked() { return !!(session && session.mode === 'exam' && session.exam && session.exam.lang === 'en'); }

  /* 정답 경험치: 10점 + 연속 정답 보너스(2점씩 최대 +10). 같은 문항은 하루 한 번만. */
  function xpForAnswer(c, ok) {
    if (!ok) { session.combo = 0; return 0; }
    session.combo = (session.combo || 0) + 1;
    const day = todayKey();
    if (game.xpDay.date !== day) game.xpDay = { date: day, ids: [] };
    if (game.xpDay.ids.indexOf(c.id) >= 0) return 0;
    game.xpDay.ids.push(c.id);
    const gain = 10 + Math.min(10, 2 * (session.combo - 1));
    addXp(gain);
    return gain;
  }

  function checkAnswer(c, box, picked) {
    if (picked === null) return;
    const ok = picked === c.answer;
    markChoices(c, box, picked);
    session.answers.push({ id: c.id, pick: picked, ok });
    const was = progress[c.id];
    progress[c.id] = { ok, at: Date.now(), best: ok || !!(was && (was.ok || was.best)) };
    const gain = xpForAnswer(c, ok);
    session.xp = (session.xp || 0) + gain;
    save(KEY_PROGRESS, progress);
    save(KEY_SESSION, session);
    $('quizScore').textContent = T('{n}점', { n: session.answers.filter((a) => a.ok).length });
    renderFeedback(c, picked, ok);
    $('btnNext').hidden = false;
    $('btnNext').textContent = session.i + 1 < session.ids.length ? T('다음 문제') : T('결과 보기');
    $('btnNext').onclick = next;
    if (ok) celebrate();
    if ($('feedback') && $('feedback').scrollIntoView) setTimeout(() => $('feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 70);
  }

  function next() {
    session.i += 1;
    save(KEY_SESSION, session);
    if (session.i >= session.ids.length) renderResult();
    else renderQuiz();
  }

  function renderFeedback(c, picked, ok) {
    const fb = $('feedback');
    const rel = (c.relatedArticles || []).filter((n) => ARTBY.get(Number(n)));
    const en = caseLang === 'en';
    const why = en && c.explanationEn ? c.explanationEn : c.explanation;
    // 다른 언어(국문 화면이면 영문 원문, 영문 화면이면 국문)는 해설 아래 한 덩어리로 모은다
    const oq = en ? c.question : c.questionEn;
    const oc = en ? c.choices : c.choicesEn;
    const ox = en ? c.explanation : c.explanationEn;
    const other = (oq || ox) ? `
      <div class="orig">
        <div class="orig-head">${en ? '국문' : '영문 원문'}</div>
        ${oq ? `<p class="orig-label">${en ? '문제' : 'Question'}</p><p>${esc(oq)}</p>` : ''}
        ${oc && oc.length ? `<ol type="A">${oc.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
        ${ox ? `<p class="orig-label">${en ? '해설' : 'Answer'}</p><p>${esc(ox)}</p>` : ''}
      </div>` : '';
    const TX = en
      ? { ok: 'Correct', bad: 'Incorrect', pick: 'Your answer', ans: 'Answer', head: 'Explanation', src: `Casebook ${esc(c.caseNo)} · p.${esc(c.page)}`, sw: '국문으로 보기' }
      : { ok: '정답입니다', bad: '오답입니다', pick: '내가 고른 답', ans: '정답', head: '해설', src: `케이스북 ${esc(c.caseNo)} · ${esc(c.page)}쪽`, sw: '영문으로 보기' };
    fb.hidden = false;
    fb.innerHTML = `
      <div class="verdict ${ok ? 'ok' : 'bad'}">
        <span class="vicon">${ok ? '✓' : '✕'}</span>
        <span class="vtext">${ok ? TX.ok : TX.bad}</span>
        ${ok ? '' : `<span class="vpick">${TX.pick}: ${LETTERS[picked]} · ${TX.ans}: ${LETTERS[c.answer]}</span>`}
      </div>
      <div class="explain">
        <div class="ex-head">${TX.head}</div>
        <p class="ex-answer">${esc(why)}</p>
        ${c.rule && !en ? `<p class="ex-rule">${esc(c.rule)}</p>` : ''}
        <p class="ex-src">${TX.src} ${c.changed2026 ? `<span class="badge-2026">${T('2026 개정')}</span>` : ''}</p>
        ${rel.length ? `<div class="ex-links">${rel.map((n) => {
          const a = ARTBY.get(Number(n));
          return `<button class="art-link inline" data-art="${a.no}" type="button"><span class="no">${T('{n}조', { n: a.no })}</span><span class="ti">${esc(artTitle(a))}</span></button>`;
        }).join('')}</div>` : ''}
      </div>`;
    // 다른 언어 원문은 '다음 문제' 버튼 아래에 따로 둔다
    const ob = $('origBox');
    if (ob) {
      ob.hidden = false;
      ob.innerHTML = `${other}<div class="btn-row"><button class="btn ghost sm" id="btnFbLang" type="button">${TX.sw}</button></div>`;
      if (EN_UI() && en) ob.hidden = true; // 영어 화면에서는 한국어 원문 덩어리를 숨긴다
    }
    const lb = document.getElementById('btnFbLang');
    if (lb) { lb.hidden = enLocked(); lb.addEventListener('click', () => { caseLang = caseLang === 'en' ? 'ko' : 'en'; renderQuiz(); }); }
    fb.querySelectorAll('[data-art]').forEach((b) => {
      b.addEventListener('click', () => openArticle(Number(b.getAttribute('data-art')), 'quiz'));
    });
  }

  /* ================= 결과 ================= */
  function renderResult() {
    if (!session) return renderQuizHome();
    const answers = session.answers;
    const total = answers.length;
    const right = answers.filter((a) => a.ok).length;
    const pct = total ? Math.round((right / total) * 100) : 0;
    $('resScore').textContent = `${right} / ${total}`;
    $('resPct').textContent = `${pct}%`;
    $('resMsg').textContent = pct === 100 ? T('전부 맞혔습니다. 케이스북 마스터!') : pct >= 70 ? T('좋습니다. 틀린 케이스만 다시 보면 됩니다.') : T('틀린 케이스의 해설을 다시 읽어보세요.');
    const exBox = $('resExam');
    if (exBox) { exBox.hidden = true; exBox.className = 'res-exam'; }
    if (session.mode === 'exam' && session.exam && !session.exam.judged) {
      const j = judgeExam(right, total);
      session.exam.judged = j;
      if (session.exam.prevLang) caseLang = session.exam.prevLang;
    }
    if (session.mode === 'exam' && session.exam && session.exam.judged && exBox) {
      const j = session.exam.judged, r = LADDER[session.exam.idx];
      exBox.hidden = false;
      exBox.className = 'res-exam ' + (j.passed ? 'pass' : 'fail');
      exBox.innerHTML = `<p class="res-exam-k">${j.passed ? T('합격') : T('불합격')} · ${esc(T(r.name))}${session.exam.lang === 'en' ? ' (EN)' : ''}</p><p>${esc(j.msg)}</p>`;
    }
    if ($('resXp')) $('resXp').textContent = T('이번 판 경험치 +{x} · 이번 주 {w}점', { x: session.xp || 0, w: xpState().week.toLocaleString() });
    const wrong = answers.filter((a) => !a.ok);
    const list = $('resWrong');
    list.innerHTML = '';
    if (!wrong.length) list.innerHTML = `<p class="empty">${T('틀린 문제가 없습니다.')}</p>`;
    for (const a of wrong) {
      const c = BYID.get(a.id);
      if (!c) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'wrong-row';
      el.innerHTML = `<span class="case-no">${T('케이스 {no} · {p}쪽', { no: esc(c.caseNo), p: esc(c.page) })}</span><span class="case-q">${esc(qText(c))}</span><span class="chev">${T('다시 보기')}</span>`;
      el.addEventListener('click', () => startSession([c.id], 'case', T('틀린 문제'), 'quizhome'));
      list.appendChild(el);
    }
    $('btnWrongAgain').hidden = !wrong.length;
    $('btnWrongAgain').onclick = () => startSession(wrong.map((a) => a.id), 'review', T('틀린 문제 다시'), 'quizhome');
    const again = $('btnAgain');
    if (again) again.onclick = () => startRandom('home');
    finishSession(answers, right, total);
    show('result');
    save(KEY_SESSION, null);
  }

  /* ================= 게임 요소 ================= */
  function finishSession(answers, right, total) {
    if (session.finished) return;
    session.finished = true;
    // 오늘의 도전 완료
    if (session.mode === 'daily') {
      if (game.daily) game.daily.done = true;
      const key = todayKey();
      if (game.streak.last !== key) {
        game.streak.days = (game.streak.last === yesterdayKey()) ? (game.streak.days + 1) : 1;
        game.streak.last = key;
        if (game.streak.days > game.streak.best) game.streak.best = game.streak.days;
      }
      if (game.streak.days >= 7) giveBadge('streak7');
    }
    if (total >= 10 && right === total) giveBadge('perfect10');
    checkMasteryBadges(false);
    saveGame();
    syncRank();
  }

  function giveBadge(id, silent) {
    if (game.badges[id]) return;
    const b = BADGES.find((x) => x.id === id);
    if (!b) return;
    game.badges[id] = todayKey();
    saveGame();
    if (!silent) popup('NEW BADGE', b.name, T('{d} — 배지를 손에 넣었습니다!', { d: T(b.ko) }), null, { art: badgeArt(b, true, 'pop'), cls: 'pop-badge' });
  }
  /* 장 마스터·전체 마스터: 그 범위 문항을 전부 한 번 이상 맞혀야 받는다 */
  function okCount(ids) { return ids.filter((id) => progress[id] && (progress[id].ok || progress[id].best)).length; }
  function badgeScope(b) {
    if (b.ch) return CASES.filter((c) => b.ch.indexOf(String(c.chapter)) >= 0).map((c) => c.id);
    if (b.id === 'allq') return CASES.map((c) => c.id);
    return null;
  }
  function checkMasteryBadges(silent) {
    for (const b of BADGES) {
      const ids = badgeScope(b);
      if (ids && ids.length && okCount(ids) === ids.length) giveBadge(b.id, silent);
    }
  }
  /* 아직 못 받은 배지의 진행 정도 */
  function badgeProgress(b) {
    const ids = badgeScope(b);
    if (ids) return { have: okCount(ids), need: ids.length };
    if (b.id === 'streak7') return { have: Math.min(7, game.streak.days || 0), need: 7 };
    const gi = LADDER.findIndex((r) => r.id === b.id);
    if (gi > 0) return { text: T('{name} 승급 시험 합격', { name: T(LADDER[gi].name) }) };
    if (b.id === 'worldEn') return { text: T('영어로 월드 시험 합격') };
    return { text: '' };
  }
  function badgeArt(b, got, key) { return window.BadgeArt ? window.BadgeArt.svg(b, got, b.id + (key || '')) : ''; }

  function celebrate() {
    if (reduced()) return;
    const fb = $('feedback');
    if (!fb) return;
    fb.classList.remove('flash');
    void fb.offsetWidth;
    fb.classList.add('flash');
  }

  /* 팝업: 여러 개가 겹치면 차례로 보여준다. actions = [{label, primary, fn}] */
  const popQ = [];
  function popup(kicker, title, text, actions, opt) {
    popQ.push({ kicker, title, text, actions, opt: opt || {} });
    if (popQ.length === 1) showPop();
  }
  function showPop() {
    const p = $('popup');
    const it = popQ[0];
    if (!p || !it) { if (p) p.hidden = true; return; }
    $('popupKicker').textContent = it.kicker;
    $('popupTitle').textContent = it.title;
    $('popupText').textContent = it.text;
    const art = $('popupArt');
    if (art) { art.innerHTML = it.opt.art || ''; art.hidden = !it.opt.art; }
    p.querySelector('.popup-card').className = 'popup-card ' + (it.opt.cls || '');
    const box = $('popupActions');
    box.innerHTML = '';
    const acts = it.actions && it.actions.length ? it.actions : [{ label: T('확인'), primary: true }];
    acts.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn' + (a.primary ? ' primary' : ' ghost');
      b.textContent = a.label;
      b.addEventListener('click', () => {
        popQ.shift();
        p.hidden = true;
        if (a.fn) a.fn();
        if (popQ.length) showPop();
      });
      box.appendChild(b);
    });
    p.hidden = false;
  }

  /* 배지 목록 — 이름은 영어(진짜 배지 느낌), 뜻은 작은 한글 */
  const BADGES = [
    { id: 'court2', sec: 'grade', name: 'COURT REFEREE II', ko: '코트심 2급 승급', shape: 'medal', c: ['#5eead4', '#0f766e'], glyph: 'stars1', label: 'II' },
    { id: 'court1', sec: 'grade', name: 'COURT REFEREE I', ko: '코트심 1급 승급', shape: 'medal', c: ['#34d399', '#065f46'], glyph: 'stars2', label: 'I' },
    { id: 'cand', sec: 'grade', name: 'WWR CANDIDATE', ko: '캔디데이트 승급', shape: 'medal', c: ['#7dd3fc', '#1d4ed8'], glyph: 'globe', label: 'CAND' },
    { id: 'prov', sec: 'grade', name: 'WWR PROVISIONAL', ko: '프로비저널 승급', shape: 'medal', c: ['#a5b4fc', '#4338ca'], glyph: 'globe', label: 'PROV' },
    { id: 'zone', sec: 'grade', name: 'ZONE REFEREE', ko: '존 레퍼리 승급', shape: 'medal', c: ['#d8b4fe', '#7e22ce'], glyph: 'globe', label: 'ZONE' },
    { id: 'world', sec: 'grade', name: 'WORLD REFEREE', ko: '월드 레퍼리 · 명예의 전당', shape: 'star', c: ['#fde68a', '#b45309'], glyph: 'laurel', label: 'WORLD' },
    { id: 'worldEn', sec: 'grade', name: 'WORLD LEGEND', ko: '영어로 월드 레퍼리 · 최고 배지', shape: 'star', c: ['#fef08a', '#ca8a04'], glyph: 'crown', label: 'LEGEND', top: true },
    { id: 'm_setup', sec: 'chapter', name: 'SETUP MASTER', ko: '장비·휠체어·팀·경기임원 전부 맞히기', shape: 'hex', ch: ['3', '4', '5', '6'], c: ['#cbd5e1', '#334155'], glyph: 'wheel' },
    { id: 'm_timing', sec: 'chapter', name: 'TIMING MASTER', ko: '시간 규정 전부 맞히기', shape: 'hex', ch: ['7'], c: ['#7dd3fc', '#0369a1'], glyph: 'clock' },
    { id: 'm_play', sec: 'chapter', name: 'PLAY MASTER', ko: '경기 규정 전부 맞히기', shape: 'hex', ch: ['8'], c: ['#86efac', '#15803d'], glyph: 'ball' },
    { id: 'm_viol', sec: 'chapter', name: 'VIOLATION MASTER', ko: '바이얼레이션 전부 맞히기', shape: 'hex', ch: ['9'], c: ['#fdba74', '#c2410c'], glyph: 'eight' },
    { id: 'm_foul', sec: 'chapter', name: 'FOUL MASTER', ko: '일반 파울 전부 맞히기', shape: 'hex', ch: ['11'], c: ['#fca5a5', '#b91c1c'], glyph: 'whistle' },
    { id: 'm_tech', sec: 'chapter', name: 'TECHNICAL MASTER', ko: '테크니컬·플래그런트·퇴장 파울 전부 맞히기', shape: 'hex', ch: ['12'], c: ['#f9a8d4', '#be185d'], glyph: 'T' },
    { id: 'm_pen', sec: 'chapter', name: 'PENALTY MASTER', ko: '접촉의 원칙·페널티 전부 맞히기', shape: 'hex', ch: ['10', '13'], c: ['#c4b5fd', '#6d28d9'], glyph: 'hourglass' },
    { id: 'weekTop', sec: 'special', name: 'WEEKLY CHAMPION', ko: '이번 주 순위 1등', shape: 'shield', c: ['#fcd34d', '#b45309'], glyph: 'trophy' },
    { id: 'streak7', sec: 'special', name: 'ON FIRE', ko: '7일 연속 오늘의 10문제', shape: 'shield', c: ['#fda4af', '#be123c'], glyph: 'flame' },
    { id: 'perfect10', sec: 'special', name: 'PERFECT 10', ko: '한 판 10문제 전부 정답', shape: 'shield', c: ['#67e8f9', '#0e7490'], glyph: 'target' },
    { id: 'allq', sec: 'special', name: 'CASEBOOK MASTER', ko: '케이스북 전체 문항 전부 맞히기', shape: 'shield', c: ['#e2e8f0', '#475569'], glyph: 'book' },
  ];
  const BADGE_SECS = [['grade', 'REFEREE GRADE', '등급'], ['chapter', 'RULE MASTER', '장 마스터'], ['special', 'SPECIAL', '스페셜']];

  /* 예전 배지(장 '다 풀기' ch3~ch13 등)는 없애고, 새 기준(다 맞히기)으로 조용히 다시 계산 */
  function migrateBadges() {
    let changed = false;
    Object.keys(game.badges).forEach((k) => {
      if (!BADGES.some((b) => b.id === k)) { delete game.badges[k]; changed = true; }
    });
    const all = badgeScope({ id: 'allq' });
    if (game.badges.allq && okCount(all) < all.length) { delete game.badges.allq; changed = true; }
    if (changed) saveGame();
    checkMasteryBadges(true);
  }

  function leadBadge(got) {
    const top = got.find((b) => b.top);
    if (top) return top;
    const grades = got.filter((b) => b.sec === 'grade');
    if (grades.length) return grades[grades.length - 1];
    return got.slice().sort((a, b) => String(game.badges[b.id]).localeCompare(String(game.badges[a.id])))[0];
  }

  function renderBadges() {
    const grid = $('badgeGrid');
    if (!grid) return;
    const got = BADGES.filter((b) => game.badges[b.id]);
    if ($('badgeCount')) $('badgeCount').textContent = `${got.length} / ${BADGES.length}`;
    const show = $('badgeShowcase');
    if (show) {
      const lead = leadBadge(got);
      show.style.setProperty('--glow', lead ? lead.c[1] : '#94a3b8');
      show.className = 'showcase' + (lead ? ' got' : '');
      show.innerHTML = lead
        ? `<div class="showcase-art">${badgeArt(lead, true, 'show')}</div><div class="showcase-txt"><p class="showcase-k">MY BADGE</p><p class="showcase-name">${esc(lead.name)}</p><p class="showcase-ko">${esc(T(lead.ko))}</p><p class="showcase-meta">${T('{d} 획득 · 모은 배지 {g} / {n}', { d: esc(game.badges[lead.id]), g: got.length, n: BADGES.length })}</p></div>`
        : `<div class="showcase-art">${badgeArt(BADGES[0], false, 'show')}</div><div class="showcase-txt"><p class="showcase-k">FIRST BADGE</p><p class="showcase-name">COURT REFEREE II</p><p class="showcase-ko">${T('코트심 2급 승급 시험에 합격하면 첫 배지를 받습니다.')}</p><p class="showcase-meta">${T('모은 배지 0 / {n}', { n: BADGES.length })}</p></div>`;
    }
    grid.innerHTML = '';
    for (const [sec, en, ko] of BADGE_SECS) {
      const items = BADGES.filter((b) => b.sec === sec);
      const n = items.filter((b) => game.badges[b.id]).length;
      const h = document.createElement('p');
      h.className = 'badge-sec';
      h.innerHTML = `<span>${en}</span><small>${T(ko)} · ${n} / ${items.length}</small>`;
      grid.appendChild(h);
      const row = document.createElement('div');
      row.className = 'badge-row';
      // 가진 배지를 앞으로
      items.slice().sort((a, b) => (game.badges[b.id] ? 1 : 0) - (game.badges[a.id] ? 1 : 0)).forEach((b) => {
        const have = !!game.badges[b.id];
        const pr = have ? null : badgeProgress(b);
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'badge' + (have ? ' got' : '') + (b.top ? ' top' : '');
        el.style.setProperty('--glow', b.c[1]);
        const sub = have ? `<span class="badge-date">${esc(game.badges[b.id])}</span>`
          : pr.need ? `<span class="badge-prog"><i style="width:${Math.round((pr.have / pr.need) * 100)}%"></i></span><span class="badge-date">${pr.have} / ${pr.need}</span>`
            : '<span class="badge-date">LOCKED</span>';
        el.innerHTML = `<span class="badge-art">${badgeArt(b, have, 'g')}</span><span class="badge-name">${esc(b.name)}</span>${sub}`;
        el.setAttribute('aria-label', `${b.name}, ${T(b.ko)}, ${have ? T('획득') : T('미획득')}`);
        el.addEventListener('click', () => {
          const p2 = have ? null : badgeProgress(b);
          popup(have ? 'BADGE' : 'LOCKED', b.name,
            have ? T('{d} · {date} 획득', { d: T(b.ko), date: game.badges[b.id] }) : `${T(b.ko)}${p2 && p2.need ? T(' — 지금 {h} / {n}', { h: p2.have, n: p2.need }) : p2 && p2.text ? ` — ${p2.text}` : ''}`,
            null, { art: badgeArt(b, have, 'pop'), cls: have ? 'pop-badge' : 'pop-badge locked' });
        });
        row.appendChild(el);
      });
      grid.appendChild(row);
    }
  }

  function renderMe() {
    renderLadder('me');
    const tr = $('meTrack');
    if (tr) {
      const t = game.lad.track;
      tr.hidden = game.lad.g < 2;
      tr.querySelectorAll('[data-track]').forEach((b) => b.classList.toggle('on', b.getAttribute('data-track') === t));
    }
    const s = game.streak;
    $('meStreak').textContent = s.days ? T('연속 도전 {d}일 · 최고 {b}일', { d: s.days, b: s.best }) : T('아직 연속 도전 기록이 없습니다');
    renderBadges();
    renderRankCard('me');
    show('me');
  }

  /* 내 기록 화면을 열고 랭킹 칸으로 데려간다 */
  function openMeRank() {
    renderMe();
    const box = $('rankBox');
    if (box && box.scrollIntoView) {
      setTimeout(() => { try { box.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); } catch (e) {} }, 60);
    }
  }

  function resetAll() {
    popup('RESET', T('기록을 모두 지울까요?'), T('푼 문제, 등급, 경험치, 배지를 이 브라우저에서 지웁니다. 이미 올라간 공유 순위·명예의 전당은 남습니다.'), [
      { label: T('지우기'), primary: true, fn: doReset }, { label: T('취소') }]);
  }
  function doReset() {
    try {
      localStorage.setItem(KEY_PROGRESS, 'null');
      localStorage.setItem(KEY_SESSION, 'null');
      localStorage.setItem(KEY_GAME, 'null');
    } catch (e) {}
    const nick = game.rank.nick;
    progress = {};
    game = { daily: null, badges: {}, streak: { last: '', days: 0, best: 0 }, rank: { nick }, seen: {},
      lad: { g: 0, track: null, exam: {}, hist: { ko: [], en: [] }, world: { ko: false, en: false }, hallPending: [] },
      xp: { total: 0, week: 0, wk: '' }, xpDay: { date: '', ids: [] } };
    saveGame();
    popup('RESET', T('기록을 지웠습니다'), T('기록심부터 다시 시작합니다.'));
    renderMe();
  }

  /* ================= 2026 개정 사항 ================= */
  function renderChanges() {
    const box = $('changesBody');
    box.innerHTML = '';
    if (!CHANGES || !CHANGES.ratified) {
      box.innerHTML = `<p class="muted">${T('개정 요약 데이터를 불러오지 못했습니다.')}</p>`;
      show('changes');
      return;
    }
    const head = document.createElement('div');
    head.className = 'changes-head';
    head.innerHTML = EN_UI()
      ? `<h2>${esc(CHANGES.meta.titleEn)}</h2><p class="src-label">${esc(CHANGES.meta.source.replace(/, 6쪽$/, ', 6 pages'))}</p><p>${esc(CHANGES.meta.noteEn)}</p>`
      : `<h2>${esc(CHANGES.meta.title)}</h2>
      <p class="muted">${esc(CHANGES.meta.titleEn)}</p>
      <p class="src-label">${esc(CHANGES.meta.source)}</p>
      <p>${esc(CHANGES.meta.note)}</p>
      <p class="muted">${esc(CHANGES.meta.noteEn)}</p>`;
    box.appendChild(head);

    box.appendChild(secTitle(T('확정된 개정')));
    for (const it of CHANGES.ratified) box.appendChild(pairRow(it));

    if (CHANGES.additional && CHANGES.additional.length) {
      box.appendChild(secTitle(T('추가 변경·계속 지켜보는 규정')));
      for (const it of CHANGES.additional) box.appendChild(pairRow(it));
    }
    if (CHANGES.table && CHANGES.table.length) {
      box.appendChild(secTitle(T('조항별 변경')));
      for (const it of CHANGES.table) {
        const row = document.createElement('div');
        row.className = 'change-row';
        const ta = ARTBY.get(Number(it.article));
        row.innerHTML = `<p class="change-article"><b>${T('{n}조', { n: it.article })} ${esc(EN_UI() && ta ? ta.titleEn : it.titleKo)}</b>${it.note && !EN_UI() ? ` <span class="change-note">${esc(it.note)}</span>` : ''}</p>
          <div class="pair"><p class="pair-en">${esc(it.en)}</p>${EN_UI() ? '' : `<p class="pair-ko">${esc(it.ko)}</p>`}</div>
          <div class="btn-row"><button class="art-link inline" data-art="${it.article}" type="button"><span class="no">${T('{n}조', { n: it.article })}</span><span class="ti">${T('조문 보기')}</span></button></div>`;
        row.querySelectorAll('[data-art]').forEach((b) => {
          b.addEventListener('click', () => openArticle(Number(b.getAttribute('data-art')), 'rules'));
        });
        box.appendChild(row);
      }
    }
    box.appendChild(footNote(EN_UI() ? CHANGES.meta.sourceNote.replace(/^출처: /, 'Source: ') : CHANGES.meta.sourceNote));
    show('changes');
  }
  function secTitle(t) { const h = document.createElement('h2'); h.className = 'sec-title'; h.textContent = t; return h; }
  function footNote(t) { const p = document.createElement('p'); p.className = 'foot-note'; p.textContent = t; return p; }
  function pairRow(it) {
    const row = document.createElement('div');
    row.className = 'change-row';
    row.innerHTML = EN_UI()
      ? `<p class="change-article"><b>${it.no}. </b>${esc(it.en)}</p>`
      : `<p class="change-article"><b>${it.no}. </b>${esc(it.ko)}</p>
      <div class="pair"><p class="pair-en">${esc(it.en)}</p></div>`;
    return row;
  }

  /* ================= 이벤트 ================= */
  $('entryRules').addEventListener('click', renderRules);
  $('entryQuiz').addEventListener('click', renderQuizHome);
  $('entryChanges') && $('entryChanges').addEventListener('click', renderChanges);
  $('entryMe') && $('entryMe').addEventListener('click', renderMe);
  $('btnRandom').addEventListener('click', () => startRandom('home'));
  $('btnDaily') && $('btnDaily').addEventListener('click', () => startSession(todayIds(), 'daily', T('오늘의 10문제'), 'home'));
  $('btnResume').addEventListener('click', () => {
    const saved = savedSession();
    if (!saved) return renderHome();
    session = saved;
    renderQuiz();
  });
  $('btnListRandom') && $('btnListRandom').addEventListener('click', () => startRandom('quizhome'));
  $('btnHomeRank') && $('btnHomeRank').addEventListener('click', openMeRank);
  $('helloBar') && $('helloBar').addEventListener('click', renderMe);
  $('btnHomeLadder') && $('btnHomeLadder').addEventListener('click', renderMe);
  ['home', 'me'].forEach((P) => {
    $(P + 'BtnExam') && $(P + 'BtnExam').addEventListener('click', onExamButton);
    $(P + 'NickSave') && $(P + 'NickSave').addEventListener('click', () => saveNick(P));
    $(P + 'Nick') && $(P + 'Nick').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveNick(P); });
    document.querySelectorAll(`#${P}RankTabs [data-tab]`).forEach((b) => b.addEventListener('click', () => {
      rankTab[P] = b.getAttribute('data-tab');
      renderRankCard(P);
    }));
  });
  document.querySelectorAll('#meTrack [data-track]').forEach((b) => b.addEventListener('click', () => {
    setTrack(b.getAttribute('data-track'));
    renderMe();
  }));
  $('btnHomeBadges') && $('btnHomeBadges').addEventListener('click', renderMe);
  $('btnHome').addEventListener('click', renderHome);
  $('btnQuizLang') && $('btnQuizLang').addEventListener('click', () => { caseLang = caseLang === 'en' ? 'ko' : 'en'; renderQuiz(); });
  $('btnReset') && $('btnReset').addEventListener('click', resetAll);

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-back]');
    if (!t) return;
    const go = t.getAttribute('data-back');
    if (go === 'home') renderHome();
    else if (go === 'quizhome') renderQuizHome();
    else if (go === 'chapter') openChapter(currentChapter);
    else if (go === 'rules') renderRules();
    else if (go === 'quiz') renderQuiz();
  });

  const search = $('ruleSearch');
  let timer = null;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => runSearch(search.value), 110);
  });
  search.addEventListener('search', () => runSearch(search.value));
  $('searchClear').addEventListener('click', () => { search.value = ''; runSearch(''); search.focus(); });
  $('sceneReplay') && $('sceneReplay').addEventListener('click', () => sceneCtl && sceneCtl.replay());

  /* ================= 언어 전환 ================= */
  /* index.html의 고정 글씨(텍스트 조각·placeholder·aria-label)를 처음 한 번 기억해 두고, 언어에 맞춰 바꾼다 */
  const STATIC = [];
  (function collectStatic() {
    const root = document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = walker.nextNode())) {
      if (n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) continue;
      const raw = n.nodeValue, key = raw.replace(/\s+/g, ' ').trim();
      if (key && /[가-힣]/.test(key)) STATIC.push({ n, raw, key });
    }
    root.querySelectorAll('[placeholder],[aria-label]').forEach((el) => {
      ['placeholder', 'aria-label'].forEach((at) => {
        const v = el.getAttribute(at);
        if (v && /[가-힣]/.test(v)) STATIC.push({ el, at, key: v });
      });
    });
  })();
  function applyStatic() {
    for (const s of STATIC) {
      if (s.el) { s.el.setAttribute(s.at, T(s.key)); continue; }
      const tr = T(s.key);
      const lead = s.raw.match(/^\s*/)[0], tail = s.raw.match(/\s*$/)[0];
      s.n.nodeValue = tr === s.key ? s.raw : lead + tr + tail;
    }
    document.documentElement.lang = LANG;
    document.title = T('휠체어럭비 퀴즈 챔피언십');
    document.querySelectorAll('.lang-switch [data-lang]').forEach((b) => {
      const on = b.getAttribute('data-lang') === LANG;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function setLang(l) {
    if (l !== 'ko' && l !== 'en') return;
    LANG = l;
    caseLang = l;
    try { localStorage.setItem('wracad.lang', l); } catch (e) {}
    applyStatic();
    if (!CASES.length) return;
    const v = curView;
    if (v === 'home') renderHome();
    else if (v === 'rules') renderRules();
    else if (v === 'article' && currentArticle) openArticle(currentArticle.no, articleReturn);
    else if (v === 'quizhome') renderQuizHome();
    else if (v === 'chapter') openChapter(currentChapter);
    else if (v === 'quiz') renderQuiz();
    else if (v === 'changes') renderChanges();
    else if (v === 'me') renderMe();
    else renderHome();
  }
  document.querySelectorAll('.lang-switch [data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.getAttribute('data-lang'))));
  applyStatic();

  /* ================= 시작 ================= */
  Promise.all([
    fetch('data/rules.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('rules.json HTTP ' + r.status); return r.json(); }),
    fetch('data/cases.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('cases.json HTTP ' + r.status); return r.json(); }),
    fetch('data/changes.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  ]).then(([rules, cases, changes]) => {
    RULES = rules;
    RCH = rules.chapters || [];
    ART = (rules.articles || []).slice().sort((a, b) => a.no - b.no);
    ARTBY = new Map(ART.map((a) => [a.no, a]));
    CASES = cases.cases || [];
    CHANGES = changes && changes.ratified ? changes : null;
    const listed = (cases.chapters || []).map((c) => ({ ...c, id: String(c.id) }));
    const extraIds = [...new Set(CASES.map((c) => String(c.chapter)))].filter((id) => !listed.some((c) => c.id === id));
    CH = listed.concat(extraIds.map((id) => ({ id, title: T('{n}장', { n: id }), en: '', pages: '' })))
      .sort((a, b) => Number(a.id) - Number(b.id));
    BYID = new Map(CASES.map((c) => [c.id, c]));
    buildSearchIndex();
    xpState();
    migrateBadges();
    renderHome();
    syncRank();
  }).catch((err) => {
    $('loadError').hidden = false;
    $('loadError').textContent = T('데이터를 불러오지 못했습니다. 웹 주소(http)로 열어 주세요.') + ' (' + err.message + ')';
  });
})();

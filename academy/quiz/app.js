/* 휠체어럭비 규정 & 케이스북 — 2026 WWR 원문 기준
   데이터: data/rules.json (2026 International Rules 111조), data/cases.json (2026 Casebook),
           data/changes.json (2026 개정 요약)
   게임 요소: 연속 도전·레벨·배지·팀 랭킹 코드. 모두 localStorage에만 저장한다. */
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
  let caseLang = 'ko';

  function load(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function chapterById(id) { return CH.find((c) => c.id === String(id)) || { id, title: id + '장' }; }
  function ruleChapterById(id) { return RCH.find((c) => String(c.id) === String(id)) || { id, title: id + '장' }; }
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
  if (!game.rank) game.rank = { nick: '', board: [] };
  if (!game.seen) game.seen = {};
  function saveGame() { save(KEY_GAME, game); }

  const LEVELS = [
    { xp: 0, name: '새내기 심판' },
    { xp: 30, name: '지역 심판' },
    { xp: 80, name: '국가대표 심판' },
    { xp: 160, name: '국제 심판' },
  ];
  function xpOf() { return Object.keys(progress).filter((k) => progress[k] && progress[k].ok).length; }
  function levelOf() {
    const xp = xpOf();
    let i = 0;
    for (let k = 0; k < LEVELS.length; k++) if (xp >= LEVELS[k].xp) i = k;
    const next = LEVELS[i + 1] || null;
    return { i, xp, name: LEVELS[i].name, next, need: next ? next.xp - xp : 0 };
  }

  const VIEWS = ['home', 'rules', 'article', 'quizhome', 'chapter', 'quiz', 'result', 'changes', 'me'];
  function show(v) {
    VIEWS.forEach((x) => { $('view-' + x).hidden = x !== v; });
    if (v !== 'quiz') { if (sceneCtl) { sceneCtl.destroy(); sceneCtl = null; } }
    window.scrollTo(0, 0);
  }

  /* ================= 홈 (게임 우선) ================= */
  function levelPct(lv) {
    if (!lv.next) return 100;
    const base = LEVELS[lv.i].xp, top = lv.next.xp;
    return Math.max(4, Math.min(100, Math.round(((lv.xp - base) / (top - base)) * 100)));
  }
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
    if (dbtn) dbtn.textContent = done ? '오늘의 10문제 다시 풀기' : '오늘의 10문제 도전';
    if ($('homeDailyState')) {
      $('homeDailyState').textContent = done
        ? `오늘 도전 완료 · 연속 ${st.days || 1}일`
        : `오늘의 10문제 · ${ids.length}문항`;
    }
    if ($('dailyNote')) {
      $('dailyNote').textContent = done
        ? `오늘 몫은 끝냈습니다. 내일 또 새 10문제가 나옵니다. (최고 ${st.best || st.days || 1}일)`
        : (st.days ? `연속 ${st.days}일째 도전 중 · 최고 ${st.best}일` : '아직 연속 도전 기록이 없습니다.');
    }
    const resume = $('btnResume');
    const saved = savedSession();
    if (resume) {
      if (saved) {
        resume.hidden = false;
        resume.textContent = `이어풀기 (${saved.i + 1}/${saved.ids.length})`;
      } else { resume.hidden = true; resume.textContent = '이어풀기'; }
    }

    /* ---- 랭킹 ---- */
    const lv = levelOf();
    if ($('homeLevel')) $('homeLevel').textContent = lv.name;
    if ($('homeLevelBar')) $('homeLevelBar').style.width = levelPct(lv) + '%';
    if ($('homeLevelNext')) {
      $('homeLevelNext').textContent = lv.next
        ? `다음 '${lv.next.name}'까지 ${lv.need}문항 · 누적 ${lv.xp}문항 정답`
        : `최고 레벨입니다 · 누적 ${lv.xp}문항 정답`;
    }
    if ($('homeStreak')) $('homeStreak').textContent = st.days || 0;
    renderHomeRankBoard();

    /* ---- 배지·최근 기록 ---- */
    const list = badgeList();
    const got = list.filter((b) => game.badges[b.id]);
    if ($('homeBadgeCount')) $('homeBadgeCount').textContent = `${got.length} / ${list.length}`;
    if ($('homeBadgeStrip')) {
      $('homeBadgeStrip').textContent = got.length ? got.slice(-3).map((b) => b.icon).join(' ') : '아직 없음';
    }
    const answered = Object.keys(progress);
    const last = answered.map((k) => ({ k, at: (progress[k] && progress[k].at) || 0 })).sort((a, b) => b.at - a.at)[0];
    const lc = last ? BYID.get(last.k) : null;
    if ($('homeRecent')) {
      $('homeRecent').textContent = lc
        ? `케이스 ${lc.caseNo} · ${progress[lc.id].ok ? '맞힘 ✓' : '틀림 ✕'}`
        : '아직 기록 없음';
    }
    if ($('homeSolved')) $('homeSolved').textContent = `푼 문항 ${answered.length} / ${CASES.length}`;

    const m = RULES ? RULES.meta : {};
    if ($('metaSource')) $('metaSource').textContent = '2026 WWR 국제 경기규정 전문(111조·14장) · 2026 케이스북 · 2026 개정 요약';
    if ($('metaEdition')) $('metaEdition').textContent = (m.edition || '') + (m.editionKo ? ' · ' + m.editionKo : '');
    show('home');
  }

  function renderHomeRankBoard() {
    const box = $('homeRankBoard');
    if (!box) return;
    const board = (game.rank.board || []).slice().sort((a, b) => b.x - a.x).slice(0, 3);
    box.innerHTML = '';
    if (!board.length) {
      box.innerHTML = '<p class="empty sm">아직 붙여넣은 코드가 없습니다. 내 코드를 보내고 친구 코드를 받으면 여기에 순위가 나옵니다.</p>';
      return;
    }
    board.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'rank-row';
      row.innerHTML = `<span class="rank-no">${i + 1}</span><span class="rank-nick">${esc(e.n)}</span>
        <span class="rank-lv">${esc(e.l)}</span><span class="rank-x">${e.x}문항</span>`;
      box.appendChild(row);
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
      btn.innerHTML = `<span class="chap-main"><span class="chap-title">${esc(ch.title)}</span>
        <span class="chap-en">${esc(ch.en || '')}</span></span>
        <span class="chap-meta">${ch.articles.length}조 ${openChapters.has(String(ch.id)) ? '▾' : '▸'}</span>`;
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
        link.innerHTML = `<span class="no">${a.no}조</span><span class="ti">${esc(a.titleKo)}</span><span class="pg">${a.changed2026 ? '<b class="mini-badge">2026</b>' : ''}${a.page || ''}p</span>`;
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
    const hay = a.bodyKo.join(' ');
    const i = hay.toLowerCase().indexOf(q);
    if (i < 0) return (a.bodyKo[0] || '').slice(0, 78) + (a.bodyKo[0] && a.bodyKo[0].length > 78 ? '…' : '');
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
    $('searchSummary').textContent = hits.length ? `${hits.length}개 조항` : '찾는 조항이 없습니다. 다른 낱말로 해보세요.';
    const box = $('searchResults');
    box.innerHTML = '';
    hits.slice(0, 40).forEach((r) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'case-row';
      b.innerHTML = `<span class="case-no">${r.a.no}조 · ${esc(ruleChapterById(r.a.chapter).title)}</span>
        <span class="case-q"><b>${esc(r.a.titleKo)}</b>${r.a.changed2026 ? ' <span class="mini-badge">2026</span>' : ''}<br>${esc(snippet(r.a, tokens[0]))}</span>`;
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
    $('artNo').textContent = a.no + '조';
    $('artChapter').textContent = ruleChapterById(a.chapter).title;
    $('artTitleKo').textContent = a.titleKo || a.titleEn;
    $('artTitleEn').textContent = a.titleEn || '';
    const badge = $('art2026');
    if (badge) {
      if (a.changed2026 || a.changeNote) {
        badge.hidden = false;
        badge.innerHTML = `<span class="badge-2026">2026 개정</span>
          <span class="badge-text">${esc(a.changeNote || '2026년 1월 1일 개정 사항이 반영된 조항입니다.')}</span>`;
      } else { badge.hidden = true; badge.innerHTML = ''; }
    }
    $('artBodyKo').innerHTML = a.bodyKo.map((p) => `<p>${esc(p)}</p>`).join('') || '<p class="muted">국문 본문이 없습니다.</p>';
    $('artBodyEn').innerHTML = a.bodyEn.map((p) => `<p>${esc(p)}</p>`).join('') || '<p class="muted">영문 본문이 없습니다.</p>';
    $('artBodyEn').hidden = true;
    $('artBodyKo').hidden = false;
    $('btnLang').textContent = 'EN';
    $('artSrc').textContent = `2026 International Rules ${a.page || ''}쪽 · ${a.koNew ? '국문 새 번역' : '국문은 2021년 협회 번역'}`;

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
        b.innerHTML = `<span class="case-no">케이스 ${esc(c.caseNo)} · ${esc(c.page)}쪽</span>
          <span class="case-q">${esc(c.question)}</span>
          <span class="case-tags">${c.scene ? '<span class="tag scene">장면</span>' : '<span class="tag text">글</span>'}
          ${p ? (p.ok ? '<span class="tag ok">✓ 맞힘</span>' : '<span class="tag bad">✕ 틀림</span>') : ''}</span>`;
        b.addEventListener('click', () => startSession([c.id], 'case', '케이스 ' + c.caseNo, 'article'));
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
      backBtn.setAttribute('aria-label', target === 'quiz' ? '문제로 돌아가기' : target === 'chapter' ? '케이스 목록으로' : '규정 목록으로');
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
    if ($('homeStats')) $('homeStats').textContent = `전체 ${total}문항 · 코트 장면 ${sceneN} · 글 문제 ${total - sceneN}`;
    const answered = Object.keys(progress).length;
    if ($('homeProgress')) $('homeProgress').textContent = answered ? `지금까지 ${answered}문항을 풀었습니다` : '아직 푼 문제가 없습니다';
    const list = $('chapterList');
    list.innerHTML = '';
    const counts = {};
    for (const c of CASES) counts[c.chapter] = (counts[c.chapter] || 0) + 1;
    for (const ch of CH) {
      const n = counts[ch.id] || 0;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'chap' + (n ? '' : ' todo');
      el.innerHTML = `<span class="chap-main"><span class="chap-title">${esc(ch.title)}</span>
        <span class="chap-en">${esc(ch.en || '')}${ch.pages ? ' · ' + esc(ch.pages) : ''}</span></span>
        <span class="chap-meta">${n ? answeredCount(casesOf(ch.id).map((c) => c.id)) + '/' + n : '준비 중'}${game.badges['ch' + ch.id] ? ' ★' : ''}</span>`;
      if (n) el.addEventListener('click', () => openChapter(ch.id));
      list.appendChild(el);
    }
    show('quizhome');
  }

  function openChapter(id) {
    currentChapter = id;
    const ch = chapterById(id);
    const items = casesOf(id);
    $('chapterTitle').textContent = ch.title;
    $('chapterSub').textContent = `${ch.en || ''}${ch.pages ? ' · ' + ch.pages : ''} · ${items.length}문항`;
    const list = $('caseList');
    list.innerHTML = '';
    items.forEach((c) => {
      const p = progress[c.id];
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'case-row' + (p ? (p.ok ? ' ok' : ' bad') : '');
      el.innerHTML = `<span class="case-no">케이스 ${esc(c.caseNo)} · ${esc(c.page)}쪽</span>
        <span class="case-q">${esc(c.question)}</span>
        <span class="case-tags">
          ${c.scene ? '<span class="tag scene">장면</span>' : '<span class="tag text">글</span>'}
          ${p ? (p.ok ? '<span class="tag ok">✓ 맞힘</span>' : '<span class="tag bad">✕ 틀림</span>') : ''}
        </span>`;
      el.addEventListener('click', () => startSession([c.id], 'case', '케이스 ' + c.caseNo, 'chapter'));
      list.appendChild(el);
    });
    $('btnChapterAll').textContent = `이 장 ${items.length}문항 풀기`;
    $('btnChapterAll').onclick = () => startSession(items.map((c) => c.id), 'chapter', ch.title, 'chapter');
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
    startSession(ids, 'random', '전체 랜덤 10문제', from || 'home');
  }
  function currentCase() { return session ? BYID.get(session.ids[session.i]) : null; }

  function renderQuiz() {
    if (!session) return renderQuizHome();
    const c = currentCase();
    if (!c) return renderResult();
    if (sceneCtl) { sceneCtl.destroy(); sceneCtl = null; }
    const from = session.from || 'quizhome';

    $('quizStep').textContent = `${session.i + 1} / ${session.ids.length}`;
    $('quizScore').textContent = `${session.answers.filter((a) => a.ok).length}점`;
    $('quizMode').textContent = session.label || '';
    $('btnQuizBack').onclick = () => {
      if (from === 'chapter' && (session.mode === 'chapter' || session.mode === 'case')) openChapter(currentChapter || c.chapter);
      else if (from === 'home') renderHome();
      else renderQuizHome();
    };

    $('qNo').textContent = `케이스 ${c.caseNo}`;
    $('qChapter').textContent = chapterById(c.chapter).title;
    const en = caseLang === 'en';
    $('qText').textContent = en ? (c.questionEn || c.question) : c.question;
    const qEn = $('qTextEn');
    if (qEn) {
      if (!en && c.questionEn) { qEn.hidden = false; qEn.textContent = c.questionEn; }
      else { qEn.hidden = true; qEn.textContent = ''; }
    }
    const lb = $('btnQuizLang');
    if (lb) lb.textContent = en ? 'KO' : 'EN';

    const sceneBox = $('sceneBox'), textBox = $('textOnlyBox');
    if (c.scene && window.QuizScene) {
      sceneBox.hidden = false; textBox.hidden = true;
      $('sceneCaption').textContent = '';
      const wrap = $('sceneWrap');
      wrap.innerHTML = '<canvas id="sceneCanvas"></canvas>';
      const canvas = $('sceneCanvas');
      requestAnimationFrame(() => {
        sceneCtl = window.QuizScene.create(wrap, canvas, c.scene, {
          onCaption: (t) => { const el = $('sceneCaption'); if (el.textContent !== t) el.textContent = t; }
        });
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
    $('btnCheck').textContent = '정답 확인';
    $('btnCheck').onclick = () => checkAnswer(c, box, picked);

    $('feedback').hidden = true;
    $('feedback').innerHTML = '';
    $('btnNext').hidden = true;
    if (prev) {
      markChoices(c, box, prev.pick);
      renderFeedback(c, prev.pick, prev.ok);
      $('btnNext').hidden = false;
      $('btnNext').textContent = session.i + 1 < session.ids.length ? '다음 문제' : '결과 보기';
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

  function checkAnswer(c, box, picked) {
    if (picked === null) return;
    const ok = picked === c.answer;
    markChoices(c, box, picked);
    session.answers.push({ id: c.id, pick: picked, ok });
    progress[c.id] = { ok, at: Date.now() };
    save(KEY_PROGRESS, progress);
    save(KEY_SESSION, session);
    $('quizScore').textContent = `${session.answers.filter((a) => a.ok).length}점`;
    renderFeedback(c, picked, ok);
    $('btnNext').hidden = false;
    $('btnNext').textContent = session.i + 1 < session.ids.length ? '다음 문제' : '결과 보기';
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
    const whyOther = !en && c.explanationEn ? `<p class="ex-src-en">${esc(c.explanationEn)}</p>` : '';
    fb.hidden = false;
    fb.innerHTML = `
      <div class="verdict ${ok ? 'ok' : 'bad'}">
        <span class="vicon">${ok ? '✓' : '✕'}</span>
        <span class="vtext">${ok ? '정답입니다' : '오답입니다'}</span>
        ${ok ? '' : `<span class="vpick">내가 고른 답: ${LETTERS[picked]} · 정답: ${LETTERS[c.answer]}</span>`}
      </div>
      <div class="explain">
        <div class="ex-head">해설</div>
        <p class="ex-answer">${esc(why)}</p>
        ${whyOther}
        ${c.rule ? `<p class="ex-rule">${esc(c.rule)}</p>` : ''}
        <p class="ex-src">케이스북 ${esc(c.caseNo)} · ${esc(c.page)}쪽 ${c.changed2026 ? '<span class="badge-2026">2026 개정</span>' : ''}</p>
        <div class="btn-row"><button class="btn ghost sm" id="btnFbLang" type="button">${en ? '국문으로 보기' : '영문 원문 보기'}</button></div>
        ${rel.length ? `<div class="ex-links">${rel.map((n) => {
          const a = ARTBY.get(Number(n));
          return `<button class="art-link inline" data-art="${a.no}" type="button"><span class="no">${a.no}조</span><span class="ti">${esc(a.titleKo)}</span></button>`;
        }).join('')}</div>` : ''}
      </div>`;
    const lb = document.getElementById('btnFbLang');
    if (lb) lb.addEventListener('click', () => { caseLang = caseLang === 'en' ? 'ko' : 'en'; renderQuiz(); });
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
    $('resMsg').textContent = pct === 100 ? '전부 맞혔습니다. 케이스북 마스터!' : pct >= 70 ? '좋습니다. 틀린 케이스만 다시 보면 됩니다.' : '틀린 케이스의 해설을 다시 읽어보세요.';
    const wrong = answers.filter((a) => !a.ok);
    const list = $('resWrong');
    list.innerHTML = '';
    if (!wrong.length) list.innerHTML = '<p class="empty">틀린 문제가 없습니다.</p>';
    for (const a of wrong) {
      const c = BYID.get(a.id);
      if (!c) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'wrong-row';
      el.innerHTML = `<span class="case-no">케이스 ${esc(c.caseNo)} · ${esc(c.page)}쪽</span><span class="case-q">${esc(c.question)}</span><span class="chev">다시 보기</span>`;
      el.addEventListener('click', () => startSession([c.id], 'case', '틀린 문제', 'quizhome'));
      list.appendChild(el);
    }
    $('btnWrongAgain').hidden = !wrong.length;
    $('btnWrongAgain').onclick = () => startSession(wrong.map((a) => a.id), 'review', '틀린 문제 다시', 'quizhome');
    const again = $('btnAgain');
    if (again) again.onclick = () => startRandom('home');
    finishSession(answers, right, total);
    show('result');
    save(KEY_SESSION, null);
  }

  /* ================= 게임 요소 ================= */
  function finishSession(answers, right, total) {
    const before = levelOf();
    // 오늘의 도전 완료
    if (session.mode === 'daily') {
      if (game.daily) game.daily.done = true;
      const key = todayKey();
      if (game.streak.last !== key) {
        game.streak.days = (game.streak.last === yesterdayKey()) ? (game.streak.days + 1) : 1;
        game.streak.last = key;
        if (game.streak.days > game.streak.best) game.streak.best = game.streak.days;
      }
      if (game.streak.days >= 7) giveBadge('streak7', '7일 연속 도전');
      if (game.streak.days >= 30) giveBadge('streak30', '30일 연속 도전');
    }
    if (total >= 10 && right === total) giveBadge('perfect10', '10문제 연속 정답');
    for (const ch of CH) {
      const items = casesOf(ch.id);
      if (items.length && items.every((c) => progress[c.id])) giveBadge('ch' + ch.id, ch.title + ' 완주');
    }
    if (CASES.length && CASES.every((c) => progress[c.id])) giveBadge('allq', '전체 문항 완주');
    saveGame();
    const after = levelOf();
    if (after.i > before.i) popup('LEVEL UP', after.name, `${after.xp}문항을 맞혀 ${after.name}이 되었습니다.`);
  }

  function giveBadge(id, label) {
    if (game.badges[id]) return;
    game.badges[id] = todayKey();
    saveGame();
    popup('BADGE', label, '새 배지를 받았습니다.');
  }

  function celebrate() {
    if (reduced()) return;
    const fb = $('feedback');
    if (!fb) return;
    fb.classList.remove('flash');
    void fb.offsetWidth;
    fb.classList.add('flash');
  }

  function popup(kicker, title, text) {
    const p = $('popup');
    if (!p) return;
    $('popupKicker').textContent = kicker;
    $('popupTitle').textContent = title;
    $('popupText').textContent = text;
    p.hidden = false;
  }

  function badgeList() {
    const out = [];
    for (const ch of CH) if (casesOf(ch.id).length) out.push({ id: 'ch' + ch.id, label: ch.title + ' 완주', icon: '🏅' });
    out.push({ id: 'streak7', label: '7일 연속 도전', icon: '🔥' });
    out.push({ id: 'streak30', label: '30일 연속 도전', icon: '🔥' });
    out.push({ id: 'perfect10', label: '10문제 연속 정답', icon: '🎯' });
    out.push({ id: 'allq', label: '전체 문항 완주', icon: '🏆' });
    return out;
  }

  function renderMe() {
    const lv = levelOf();
    $('meLevel').textContent = lv.name;
    const base = LEVELS[lv.i].xp;
    const top = lv.next ? lv.next.xp : lv.xp || 1;
    const pct = lv.next ? Math.max(4, Math.min(100, Math.round(((lv.xp - base) / (top - base)) * 100))) : 100;
    $('meLevelBar').style.width = pct + '%';
    $('meLevelNext').textContent = lv.next
      ? `다음 레벨 '${lv.next.name}'까지 ${lv.need}문항 더 맞히면 됩니다 (누적 ${lv.xp}문항 정답)`
      : `최고 레벨입니다 (누적 ${lv.xp}문항 정답)`;
    const s = game.streak;
    $('meStreak').textContent = s.days ? `연속 도전 ${s.days}일 · 최고 ${s.best}일` : '아직 연속 도전 기록이 없습니다';
    const grid = $('badgeGrid');
    grid.innerHTML = '';
    for (const b of badgeList()) {
      const got = !!game.badges[b.id];
      const el = document.createElement('div');
      el.className = 'badge' + (got ? ' got' : '');
      el.innerHTML = `<span class="badge-icon">${got ? b.icon : '·'}</span><span class="badge-name">${esc(b.label)}</span>
        <span class="badge-date">${got ? esc(game.badges[b.id]) : '미획득'}</span>`;
      grid.appendChild(el);
    }
    const nick = $('rankNick');
    if (nick) nick.value = game.rank.nick || '';
    renderRankBoard();
    show('me');
  }

  /* -------- 내 기록·랭킹 코드 -------- */
  function buildCode(nick) {
    const lv = levelOf();
    const payload = { n: nick, x: xpOf(), q: Object.keys(progress).length, l: lv.name, d: todayKey() };
    return 'WR2026.' + encodeURIComponent(JSON.stringify(payload));
  }

  function makeCode() {
    const nick = (($('rankNick') && $('rankNick').value) || '').trim() || '이름없음';
    game.rank.nick = nick;
    const code = buildCode(nick);
    saveGame();
    $('rankCode').value = code;
    const cp = $('btnRankCopy');
    if (cp) cp.hidden = false;
    return code;
  }

  function copyText(t) {
    try {
      if (window.navigator && window.navigator.clipboard && window.navigator.clipboard.writeText) {
        window.navigator.clipboard.writeText(t);
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* 홈에서 바로 코드 복사. 닉네임이 없으면 내 기록 화면으로 보낸다. */
  function homeCopyCode() {
    const nick = (game.rank.nick || '').trim();
    if (!nick) {
      popup('RANKING', '닉네임을 먼저 정해 주세요', '내 기록 화면의 랭킹 칸에서 닉네임을 넣으면 코드를 만들 수 있습니다.');
      openMeRank('code');
      return;
    }
    const code = buildCode(nick);
    saveGame();
    const copied = copyText(code);
    popup('RANKING', copied ? '내 코드를 복사했습니다' : '내 코드를 만들었습니다',
      copied ? '팀원에게 붙여넣어 보내면, 받은 코드끼리 순위표를 만들 수 있습니다. 서버가 없어 실시간 순위는 아닙니다.'
        : '브라우저가 복사를 막았습니다. 내 기록 화면의 코드 칸에서 직접 복사해 주세요.');
    if (!copied) {
      renderMe();
      const el = $('rankCode');
      if (el) el.value = code;
      const cp = $('btnRankCopy');
      if (cp) cp.hidden = false;
    }
  }

  /* 내 기록 화면을 열고 랭킹 칸으로 데려간다 */
  function openMeRank(target) {
    renderMe();
    const box = $('rankBox');
    if (box && box.scrollIntoView) {
      setTimeout(() => { try { box.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); } catch (e) {} }, 60);
    }
    const el = target === 'paste' ? $('rankPaste') : target === 'nick' ? $('rankNick') : null;
    if (el && el.focus) setTimeout(() => { try { el.focus(); } catch (e) {} }, 220);
  }

  /* -------- 랭킹 코드 모으기 -------- */
  function addCodes() {
    const raw = ($('rankPaste') && $('rankPaste').value) || '';
    const lines = raw.split(/\n+/).map((x) => x.trim()).filter(Boolean);
    let added = 0;
    for (const line of lines) {
      const body = line.indexOf('WR2026.') === 0 ? line.slice(7) : line;
      try {
        const o = JSON.parse(decodeURIComponent(body));
        if (!o || !o.n) continue;
        if (game.rank.board.some((e) => e.n === o.n && e.d === o.d)) continue;
        game.rank.board.push({ n: String(o.n).slice(0, 14), x: Number(o.x) || 0, q: Number(o.q) || 0, l: String(o.l || ''), d: String(o.d || '') });
        added++;
      } catch (e) {}
    }
    saveGame();
    $('rankPaste').value = '';
    renderRankBoard();
    if (!added) popup('RANKING', '추가된 코드가 없습니다', '코드 형식이 맞는지 확인해 주세요.');
  }

  function renderRankBoard() {
    const box = $('rankBoard');
    if (!box) return;
    const board = (game.rank.board || []).slice().sort((a, b) => b.x - a.x).slice(0, 20);
    box.innerHTML = '';
    if (!board.length) { box.innerHTML = '<p class="empty">아직 붙여넣은 코드가 없습니다. 실시간 순위가 아니라, 코드를 모아 만드는 순위표입니다.</p>'; return; }
    board.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'rank-row';
      row.innerHTML = `<span class="rank-no">${i + 1}</span><span class="rank-nick">${esc(e.n)}</span>
        <span class="rank-lv">${esc(e.l)}</span><span class="rank-x">${e.x}문항</span>`;
      box.appendChild(row);
    });
  }

  function resetAll() {
    try {
      localStorage.setItem(KEY_PROGRESS, 'null');
      localStorage.setItem(KEY_SESSION, 'null');
      localStorage.setItem(KEY_GAME, 'null');
    } catch (e) {}
    progress = {};
    game = { daily: null, badges: {}, streak: { last: '', days: 0, best: 0 }, rank: { nick: '', board: [] }, seen: {} };
    popup('RESET', '기록을 지웠습니다', '푼 문제, 연속 도전, 배지, 랭킹 코드를 모두 지웠습니다.');
    renderMe();
  }

  /* ================= 2026 개정 사항 ================= */
  function renderChanges() {
    const box = $('changesBody');
    box.innerHTML = '';
    if (!CHANGES || !CHANGES.ratified) {
      box.innerHTML = '<p class="muted">개정 요약 데이터를 불러오지 못했습니다.</p>';
      show('changes');
      return;
    }
    const head = document.createElement('div');
    head.className = 'changes-head';
    head.innerHTML = `<h2>${esc(CHANGES.meta.title)}</h2>
      <p class="muted">${esc(CHANGES.meta.titleEn)}</p>
      <p class="src-label">${esc(CHANGES.meta.source)}</p>
      <p>${esc(CHANGES.meta.note)}</p>
      <p class="muted">${esc(CHANGES.meta.noteEn)}</p>`;
    box.appendChild(head);

    box.appendChild(secTitle('확정된 개정'));
    for (const it of CHANGES.ratified) box.appendChild(pairRow(it));

    if (CHANGES.additional && CHANGES.additional.length) {
      box.appendChild(secTitle('추가 변경·계속 지켜보는 규정'));
      for (const it of CHANGES.additional) box.appendChild(pairRow(it));
    }
    if (CHANGES.table && CHANGES.table.length) {
      box.appendChild(secTitle('조항별 변경'));
      for (const it of CHANGES.table) {
        const row = document.createElement('div');
        row.className = 'change-row';
        row.innerHTML = `<p class="change-article"><b>${it.article}조 ${esc(it.titleKo)}</b>${it.note ? ` <span class="change-note">${esc(it.note)}</span>` : ''}</p>
          <div class="pair"><p class="pair-en">${esc(it.en)}</p><p class="pair-ko">${esc(it.ko)}</p></div>
          <div class="btn-row"><button class="art-link inline" data-art="${it.article}" type="button"><span class="no">${it.article}조</span><span class="ti">조문 보기</span></button></div>`;
        row.querySelectorAll('[data-art]').forEach((b) => {
          b.addEventListener('click', () => openArticle(Number(b.getAttribute('data-art')), 'rules'));
        });
        box.appendChild(row);
      }
    }
    box.appendChild(footNote(CHANGES.meta.sourceNote));
    show('changes');
  }
  function secTitle(t) { const h = document.createElement('h2'); h.className = 'sec-title'; h.textContent = t; return h; }
  function footNote(t) { const p = document.createElement('p'); p.className = 'foot-note'; p.textContent = t; return p; }
  function pairRow(it) {
    const row = document.createElement('div');
    row.className = 'change-row';
    row.innerHTML = `<p class="change-article"><b>${it.no}. </b>${esc(it.ko)}</p>
      <div class="pair"><p class="pair-en">${esc(it.en)}</p></div>`;
    return row;
  }

  /* ================= 이벤트 ================= */
  $('entryRules').addEventListener('click', renderRules);
  $('entryQuiz').addEventListener('click', renderQuizHome);
  $('entryChanges') && $('entryChanges').addEventListener('click', renderChanges);
  $('entryMe') && $('entryMe').addEventListener('click', renderMe);
  $('btnRandom').addEventListener('click', () => startRandom('home'));
  $('btnDaily') && $('btnDaily').addEventListener('click', () => startSession(todayIds(), 'daily', '오늘의 10문제', 'home'));
  $('btnResume').addEventListener('click', () => {
    const saved = savedSession();
    if (!saved) return renderHome();
    session = saved;
    renderQuiz();
  });
  $('btnListRandom') && $('btnListRandom').addEventListener('click', () => startRandom('quizhome'));
  $('btnHomeRank') && $('btnHomeRank').addEventListener('click', () => openMeRank('code'));
  $('btnHomeRankAdd') && $('btnHomeRankAdd').addEventListener('click', () => openMeRank('paste'));
  $('btnHomeCode') && $('btnHomeCode').addEventListener('click', homeCopyCode);
  $('btnHomeBadges') && $('btnHomeBadges').addEventListener('click', renderMe);
  $('btnHome').addEventListener('click', renderHome);
  $('btnQuizLang') && $('btnQuizLang').addEventListener('click', () => { caseLang = caseLang === 'en' ? 'ko' : 'en'; renderQuiz(); });
  $('popupClose') && $('popupClose').addEventListener('click', () => { $('popup').hidden = true; });
  $('btnRankMake') && $('btnRankMake').addEventListener('click', makeCode);
  $('btnRankCopy') && $('btnRankCopy').addEventListener('click', () => {
    const el = $('rankCode');
    if (!el) return;
    try {
      if (el.select) el.select();
      if (window.navigator && window.navigator.clipboard) window.navigator.clipboard.writeText(el.value);
    } catch (e) {}
    popup('RANKING', '코드를 복사했습니다', '코드를 팀원에게 보내면 서로 순위표를 맞춰 볼 수 있습니다.');
  });
  $('btnRankAdd') && $('btnRankAdd').addEventListener('click', addCodes);
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
    CH = listed.concat(extraIds.map((id) => ({ id, title: id + '장', en: '', pages: '' })))
      .sort((a, b) => Number(a.id) - Number(b.id));
    BYID = new Map(CASES.map((c) => [c.id, c]));
    buildSearchIndex();
    renderHome();
  }).catch((err) => {
    $('loadError').hidden = false;
    $('loadError').textContent = '데이터를 불러오지 못했습니다. 웹 주소(http)로 열어 주세요. (' + err.message + ')';
  });
})();

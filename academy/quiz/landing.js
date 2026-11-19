/* 랜딩(소개) 화면 — 앱 로직과 분리. 숫자는 앱 데이터(QuizPublic)에서 읽는다.
   언어: 앱의 언어 스위치와 같이 움직인다(앱이 브라우저 언어로 먼저 고름). 일본어는 자리만.
   문구를 고칠 곳은 아래 D 한 곳. 일본어를 넣을 때는 D.ja 를 추가하고 언어 버튼 하나만 더 만들면 된다. */
(function () {
  'use strict';
  var KEY = 'wracad.landing.seen';
  var D = {
    ko: {
      logo: '휠체어럭비 퀴즈 챔피언십',
      title: '내 심판 실력,<br><em>몇 점일까?</em>',
      sub: '공식 케이스북 규정 문제를 풀고, 내 심판 등급 카드를 받아 보세요. 로그인 없이 바로 시작합니다.',
      q: '문항', g: '등급', b: '배지',
      start: '지금 시작하기', src: '2026 WWR 공식 케이스북 기준',
      aca: '아카데미에서 더 배우기 · 준비 중', acaBody: '규정 공부와 연결되는 아카데미 페이지를 준비하고 있습니다.',
      jp: '日本語 準備中',
      nickL: '닉네임', nickChip: '선택', nickSkipNote: '건너뛰면 순위에는 오르지 않아요', nickPh: '예: 서울 감독', nickH: '순위표에 이 이름이 나옵니다. 실명·연락처는 쓰지 마세요.',
      nickGo: '시작하기', close: '닫기', nickSkip: '건너뛰고 시작', nickBad: '실명·연락처·욕설은 쓸 수 없어요. 별명으로 바꿔 주세요.'
    },
    en: {
      logo: 'Wheelchair Rugby Quiz Championship',
      title: 'How sharp is<br><em>your referee eye?</em>',
      sub: 'Solve rule questions from the official casebook and earn your referee grade card. No sign-up: start right away.',
      q: 'questions', g: 'grades', b: 'badges',
      start: 'Start now', src: 'Based on the official WWR Casebook 2026',
      aca: 'Learn more at the Academy · coming soon', acaBody: 'An Academy page that connects to rule study is on its way.',
      jp: '日本語 coming soon',
      nickL: 'Nickname', nickChip: 'Optional', nickSkipNote: "Skipping means you won't appear on the leaderboard", nickPh: 'e.g. Coach Seoul', nickH: 'This name shows on the leaderboard. Please do not use your real name or contact info.',
      nickGo: 'Start', close: 'Close', nickSkip: 'Skip and start', nickBad: 'Real names, contact info and swear words are not allowed. Please pick a nickname.'
    }
  };
  var root = document.getElementById('landing');
  if (!root) return;
  var seen = false;
  try { seen = localStorage.getItem(KEY) === '1'; } catch (e) {}
  var force = /[?&]intro=1\b/.test(location.search);
  function $(id) { return document.getElementById(id); }
  function cur() {
    var P = window.QuizPublic; if (P) return P.lang();
    try { var v = localStorage.getItem('wracad.lang'); if (v === 'ko' || v === 'en') return v; } catch (e) {}
    return /^ko/i.test(navigator.language || '') ? 'ko' : 'en';
  }
  function render() {
    var lang = cur(), t = D[lang];
    $('lpLogo').textContent = t.logo; $('lpTitle').innerHTML = t.title; $('lpSub').textContent = t.sub;
    $('lpQL').textContent = t.q; $('lpGL').textContent = t.g; $('lpBL').textContent = t.b;
    $('lpStart').textContent = t.start; $('lpSrc').textContent = t.src;
    $('lpNickL').textContent = t.nickL; $('lpNickChip').textContent = t.nickChip; $('lpNickS').textContent = t.nickSkipNote; $('lpNick').placeholder = t.nickPh; $('lpNickGo').textContent = t.nickGo; $('lpNickSkip').textContent = t.nickSkip;
    if (!$('lpNickH').classList.contains('bad')) $('lpNickH').textContent = t.nickH;
    $('lpClose').setAttribute('aria-label', t.close);
    $('lpAcaS').textContent = t.aca; $('lpAcaB').textContent = t.acaBody; $('lpJp').textContent = t.jp;
    ['ko', 'en'].forEach(function (l) { $('lpLang-' + l).setAttribute('aria-pressed', String(l === lang)); });
    var P = window.QuizPublic;
    if (P) { $('lpQ').textContent = P.caseCount(); $('lpG').textContent = P.ladder.length; $('lpB').textContent = P.badgeCount(); }
  }
  function open() {
    root.hidden = false; root.scrollTop = 0; $('app').setAttribute('aria-hidden', 'true'); document.body.style.overflow = 'hidden';
    $('lpStart').hidden = false; $('lpSrc').hidden = false; $('lpNickStep').hidden = true; $('lpNickH').classList.remove('bad'); render();
  }
  function close() {
    root.hidden = true; $('app').removeAttribute('aria-hidden'); document.body.style.overflow = '';
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    $('lpClose').hidden = true;
    window.scrollTo(0, 0);
    /* 다시 열 때 쌓은 history 칸을 걷어낸다 → 뒤로가기는 항상 홈 */
    if (history.state && history.state.intro) { skipLP = true; try { history.back(); } catch (e) { skipLP = false; } }
  }
  var skipLP = false;
  window.addEventListener('popstate', function () {
    if (skipLP) { skipLP = false; return; }
    if (!root.hidden && reopened) { reopened = false; close(); } /* 뒤로가기 = 닫기(홈) */
  });
  $('lpClose').addEventListener('click', function () { reopened = false; close(); });
  ['ko', 'en'].forEach(function (l) {
    $('lpLang-' + l).addEventListener('click', function () {
      var b = document.querySelector('.lang-switch [data-lang="' + l + '"]');
      if (b) b.click(); else { try { localStorage.setItem('wracad.lang', l); } catch (e) {} }
      render();
    });
  });
  /* 시작 → (닉네임 입력 또는 건너뛰기) → 오늘의 10문제 */
  var reopened = false; /* 홈의 '설명 다시 보기'로 연 경우: 시작을 누르면 퀴즈로 가지 않고 홈으로 돌아간다 */
  function begin() {
    close();
    var b = $('btnDaily'); if (b && !reopened) b.click();
    reopened = false;
  }
  function hasNick() { var P = window.QuizPublic; return !!(P && P.nick()); }
  $('lpStart').addEventListener('click', function () {
    if (hasNick()) { begin(); return; } /* 이미 닉네임이 있으면 바로 시작 */
    $('lpStart').hidden = true; $('lpSrc').hidden = true; $('lpNickStep').hidden = false;
    var h = $('lpNickH'); h.classList.remove('bad'); render();
    setTimeout(function () { try { $('lpNick').focus(); } catch (e) {} }, 50);
  });
  function goWithNick() {
    var raw = $('lpNick').value, h = $('lpNickH'), t = D[cur()];
    if (!raw.trim()) { begin(); return; } /* 비워 두면 건너뛰기와 같음 */
    var c = window.QuizNick ? window.QuizNick.clean(raw, 14) : { nick: raw.trim().slice(0, 14), bad: false };
    if (c.bad) { h.classList.add('bad'); h.textContent = t.nickBad; return; }
    var inp = $('homeNick'), sv = $('homeNickSave');
    if (inp && sv) { inp.value = c.nick; sv.click(); } /* 앱의 기존 닉네임 저장(순위 등록)을 그대로 사용 */
    begin();
  }
  $('lpNickGo').addEventListener('click', goWithNick);
  $('lpNick').addEventListener('input', function () { var h = $('lpNickH'); if (h.classList.contains('bad')) { h.classList.remove('bad'); render(); } });
  $('lpNick').addEventListener('keydown', function (e) { if (e.key === 'Enter') goWithNick(); });
  $('lpNickSkip').addEventListener('click', begin);
  var intro = $('btnIntro'); /* 홈의 '설명 다시 보기' → 랜딩을 강제로 다시 연다 (닉네임이 있으면 닉네임 단계는 건너뜀) */
  if (intro) intro.addEventListener('click', function () {
    reopened = true;
    try { history.pushState({ q: 1, v: 'intro', intro: 1 }, ''); } catch (e) {}
    open(); $('lpClose').hidden = false;
  });
  document.addEventListener('quiz:ready', render);
  if (!seen || force) open();
})();

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
      jp: '日本語 準備中'
    },
    en: {
      logo: 'Wheelchair Rugby Quiz Championship',
      title: 'How sharp is<br><em>your referee eye?</em>',
      sub: 'Solve rule questions from the official casebook and earn your referee grade card. No sign-up: start right away.',
      q: 'questions', g: 'grades', b: 'badges',
      start: 'Start now', src: 'Based on the official WWR Casebook 2026',
      aca: 'Learn more at the Academy · coming soon', acaBody: 'An Academy page that connects to rule study is on its way.',
      jp: '日本語 coming soon'
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
    $('lpAcaS').textContent = t.aca; $('lpAcaB').textContent = t.acaBody; $('lpJp').textContent = t.jp;
    ['ko', 'en'].forEach(function (l) { $('lpLang-' + l).setAttribute('aria-pressed', String(l === lang)); });
    var P = window.QuizPublic;
    if (P) { $('lpQ').textContent = P.caseCount(); $('lpG').textContent = P.ladder.length; $('lpB').textContent = P.badgeCount(); }
  }
  function open() {
    root.hidden = false; $('app').setAttribute('aria-hidden', 'true'); document.body.style.overflow = 'hidden'; render();
  }
  function close() {
    root.hidden = true; $('app').removeAttribute('aria-hidden'); document.body.style.overflow = '';
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    window.scrollTo(0, 0);
  }
  ['ko', 'en'].forEach(function (l) {
    $('lpLang-' + l).addEventListener('click', function () {
      var b = document.querySelector('.lang-switch [data-lang="' + l + '"]');
      if (b) b.click(); else { try { localStorage.setItem('wracad.lang', l); } catch (e) {} }
      render();
    });
  });
  $('lpStart').addEventListener('click', function () {
    close();
    var b = $('btnDaily'); if (b) b.click(); /* 바로 시작: 오늘의 10문제 */
  });
  document.addEventListener('quiz:ready', render);
  if (!seen || force) open();
})();

/* 결과 카드 · 공유 (앱 로직과 분리)
   - 윤디자 B 「페이퍼 티켓」 카드를 canvas로 그려 PNG로 만든다 (인스타 세로 1080×1350, 스토리 1080×1920).
   - 큰 숫자 = 마지막 승급 시험 점수 (시험을 본 적이 없으면 이번 판 점수). 상위 % 없음. 카드에는 별명만.
   - 이미지는 결과 화면이 열릴 때 미리 만들어 두고, 공유 버튼은 누르는 즉시 navigator.share 를 부른다.
   - 공유창이 안 열리면(인앱 브라우저 등) 큰 이미지 + 「길게 눌러 저장」 + 링크 복사 안내를 띄운다.
   - 서버·카카오 SDK·유료 서비스 없음. 데이터는 app.js 가 내놓은 window.QuizPublic 에서만 읽는다. */
(function () {
  'use strict';
  var NICK_KEY = 'wracad.cardnick';
  var GRADE_COLOR = { table: '#5d6b62', court2: '#347560', court1: '#0f766e', cand: '#137a37', prov: '#8f5a06', zone: '#9a3412', world: '#8a6100' };
  var GOLD = '#f5c84b', GOLD_DEEP = '#d9a400'; /* 월드: 띠·겹도장 바깥 고리 */
  var FONT_SANS = '"Gothic A1", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif';
  var FONT_NUM = '"Gothic A1", "Noto Sans KR", "Malgun Gothic", sans-serif';
  var FONT_MONO = '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';
  var FONT_DISP = '"Do Hyeon", "Gothic A1", "Malgun Gothic", sans-serif';

  var TXT = {
    ko: {
      title: '내 등급 카드', hint: '카드에는 별명만 들어갑니다. 실명·연락처는 넣지 마세요.',
      nickLbl: '카드에 넣을 별명', nickPh: '예: 서울 감독',
      feed: '인스타 세로', story: '스토리',
      share: '카드 공유하기', save: '이미지 저장', busy: '카드 준비 중…', ready: '', making: '만드는 중…',
      nickBad: '이 별명은 쓸 수 없어요. 카드에는 「익명 심판」으로 들어갑니다.',
      saved: '이미지를 저장했어요.', copied: '링크를 복사했어요.', copyFail: '복사하지 못했어요. 주소창의 링크를 길게 눌러 복사하세요.',
      mTitle: '이미지를 길게 눌러 저장하세요', mHelp: '저장한 이미지를 인스타·카톡에 올리고, 링크를 함께 붙여 주세요.',
      copy: '링크 복사', close: '닫기',
      inapp: '지금 보고 있는 앱(인스타·카톡 등) 안의 화면에서는 공유 창이 안 열릴 수 있어요. 오른쪽 위 ⋮ 또는 ··· 메뉴에서 「다른 브라우저로 열기」(사파리·크롬)를 누르면 바로 공유됩니다.',
      anon: '익명 심판', by: 'BY',
      shareText: '내 심판 등급 카드! 너도 도전해 봐 👉', alt: '내 등급 카드 미리보기',
      tierN: '국내', tierI: '국제', tierS: '출발점', ladderL: '1', exam: function (n, p) { return '승급 시험 ' + n + '문항 · ' + p + '% 이상 합격'; },
      practice: function (r, n) { return '연습 ' + n + '문제 · ' + r + '개 정답'; }, cta: '도전해 보세요', cta2: '내 등급을 넘어 보세요'
    },
    en: {
      title: 'My grade card', hint: 'Only a nickname goes on the card. Please do not use your real name or contact info.',
      nickLbl: 'Nickname on the card', nickPh: 'e.g. Coach Seoul',
      feed: 'Instagram post', story: 'Story',
      share: 'Share my card', save: 'Save image', busy: 'Preparing card…', ready: '', making: 'Making your card…',
      nickBad: "That nickname can't be used. The card will say “Anonymous Referee”.",
      saved: 'Image saved.', copied: 'Link copied.', copyFail: "Couldn't copy. Long-press the link in the address bar to copy it.",
      mTitle: 'Long-press the image to save it', mHelp: 'Post the saved image on Instagram or chat and add the link.',
      copy: 'Copy link', close: 'Close',
      inapp: "Inside this app's built-in browser (Instagram, KakaoTalk, etc.) the share sheet may not open. Tap the ⋮ or ··· menu at the top right and choose “Open in browser” (Safari / Chrome) to share directly.",
      anon: 'Anonymous Referee', by: 'BY',
      shareText: 'My referee grade card! Can you beat it? 👉', alt: 'My grade card preview',
      tierN: 'National', tierI: 'International', tierS: 'Start', ladderL: '1', exam: function (n, p) { return 'Promotion exam: ' + n + ' questions, pass at ' + p + '%'; },
      practice: function (r, n) { return 'Practice: ' + r + ' of ' + n + ' correct'; }, cta: 'Can you beat me?', cta2: 'Beat my grade'
    }
  };

  var ui = null, last = null, cards = { feed: null, story: null }, fmt = 'feed', rendering = 0, timer = null;

  function P() { return window.QuizPublic; }
  function L() { return (P() && P().lang()) === 'en' ? 'en' : 'ko'; }
  function t() { return TXT[L()]; }
  function siteUrl() { return location.origin.replace(/\/$/, '') + location.pathname.replace(/index\.html$/, ''); }
  function siteShort() { return siteUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''); }

  /* ----- 별명 거르기: nickfilter.js (순위표 닉네임과 같은 함수) ----- */
  function cleanNick(raw) { return window.QuizNick ? window.QuizNick.clean(raw, 12) : { nick: String(raw || '').trim().slice(0, 12), bad: false }; }

  /* 등급 짧은 라벨: 한국어는 g.short(기록·N2·N1·교육생·비기너·존·월드), 영어는 i18n 사전(TABLE·NAT 2·NAT 1·CAND·PROV·ZONE·WORLD) */
  function enShort(g, en) {
    var sh = String(g.short || '');
    return (en && window.I18N_EN && window.I18N_EN[sh]) || sh;
  }

  /* ----- 카드 데이터: 앱에서 읽은 값만 ----- */
  function cardData(detail, nick) {
    var pub = P(), lad = pub.ladder, gi = Math.min(pub.gradeIdx(), lad.length - 1), g = lad[gi];
    var lang = L(), en = lang === 'en', T = TXT[lang], I18N = window.I18N_EN || {};
    var ls = pub.last(), big, total, crit;
    if (ls) {
      var ex = lad[ls.idx] || g;
      big = ls.right; total = ls.total;
      crit = T.exam(ls.total, Math.round((ex.pass || 0) * 100));
    } else {
      big = detail.right; total = detail.total; crit = T.practice(detail.right, detail.total);
    }
    var name = en ? (I18N[g.name] || g.en || g.name) : g.name;
    var tier = gi === 0 ? (en ? 'NATIONAL · START' : '국내 · 출발점') : g.tier === '국제' ? (en ? 'INTERNATIONAL' : '국제') : (en ? 'NATIONAL' : '국내');
    return {
      id: g.id, color: GRADE_COLOR[g.id] || '#ff6b2c', name: name, tier: tier, step: gi + 1, steps: lad.length,
      sk: enShort(g, en), big: big, total: total, crit: crit, nick: nick || T.anon,
      first: enShort(lad[0], en), lastShort: enShort(lad[lad.length - 1], en),
      crown: g.id === 'world' && pub.worldEn(), T: T
    };
  }

  /* ----- 그리기 ----- */
  function fit(ctx, text, maxW, size, weight, family, min) {
    var s = size;
    do { ctx.font = weight + ' ' + s + 'px ' + family; if (ctx.measureText(text).width <= maxW || s <= (min || 20)) break; s -= 2; } while (s > 0);
    return s;
  }
  function spaced(ctx, text, x, y, sp, align) {
    if ('letterSpacing' in ctx) { ctx.letterSpacing = sp + 'px'; ctx.textAlign = align || 'left'; ctx.fillText(text, x, y); ctx.letterSpacing = '0px'; return; }
    ctx.textAlign = 'left'; var w = 0, i; for (i = 0; i < text.length; i++) w += ctx.measureText(text[i]).width + sp;
    var cx = align === 'right' ? x - w : x; for (i = 0; i < text.length; i++) { ctx.fillText(text[i], cx, y); cx += ctx.measureText(text[i]).width + sp; }
  }
  function draw(canvas, d, W, H) {
    canvas.width = W; canvas.height = H;
    var c = canvas.getContext('2d'), INK = '#10201a', PAPER = '#f6f1e7', AC = d.color, k = H / 1350, pad = 112, iw = W - pad * 2;
    c.clearRect(0, 0, W, H);
    c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(0,0,0,.035)'; for (var x = 8; x < W; x += 15) for (var y = 8; y < H; y += 15) c.fillRect(x, y, 1.6, 1.6);
    c.strokeStyle = INK; c.lineWidth = 5; c.strokeRect(44, 44, W - 88, H - 88);
    c.strokeStyle = 'rgba(17,24,39,.35)'; c.lineWidth = 2; c.strokeRect(60, 60, W - 120, H - 120);
    c.fillStyle = d.id === 'world' ? GOLD : AC; c.fillRect(44, 44, W - 88, 20);
    c.textBaseline = 'alphabetic';
    // 상단 브랜드
    var y0 = 130 * Math.max(1, k * .8);
    c.fillStyle = INK; c.font = '600 26px ' + FONT_MONO; spaced(c, 'WHEELCHAIR RUGBY QUIZ', pad, y0, 4); spaced(c, 'REFEREE PASS', W - pad, y0, 4, 'right');
    c.fillRect(pad, y0 + 22, iw, 3);
    // 단계 구분
    var y = y0 + 96 * k;
    c.fillStyle = AC; c.font = /[가-힣]/.test(d.tier) ? '800 34px ' + FONT_SANS : '600 32px ' + FONT_MONO; spaced(c, d.tier.toUpperCase(), pad, y, /[가-힣]/.test(d.tier) ? 2 : 5);
    // 등급 이름
    y += 104 * k;
    c.fillStyle = INK; var fs = fit(c, d.name, iw, 96, 800, FONT_SANS, 44); c.font = '800 ' + fs + 'px ' + FONT_SANS; c.textAlign = 'left'; c.fillText(d.name, pad, y);
    // 별명
    y += 62 * k;
    c.fillStyle = '#4b5563'; var nt = d.T.by + '  ' + d.nick; var ns = fit(c, nt, iw, 38, 700, FONT_SANS, 24); c.font = '700 ' + ns + 'px ' + FONT_SANS; c.fillText(nt, pad, y);
    // 큰 숫자
    var bigSize = Math.round(400 * (1 + (k - 1) * .35)), by = y + bigSize * .88 + 24 * k;
    var bs = String(d.big), ts = '/' + d.total;
    var sw = 0;
    c.font = '800 ' + bigSize + 'px ' + FONT_NUM; var bw = c.measureText(bs).width;
    var subSize = Math.round(bigSize * .27); c.font = '800 ' + subSize + 'px ' + FONT_NUM; sw = c.measureText(ts).width;
    var maxNum = iw - 290; var sc = Math.min(1, maxNum / (bw + sw + 14));
    c.save(); c.translate(pad, by); c.scale(sc, sc);
    c.fillStyle = INK; c.font = '800 ' + bigSize + 'px ' + FONT_NUM; c.textAlign = 'left'; c.fillText(bs, 0, 0);
    c.fillStyle = '#4b5563'; c.font = '800 ' + subSize + 'px ' + FONT_NUM; c.fillText(ts, bw + 14, 0);
    c.restore();
    // 도장
    var r = 128, sx = W - pad - r - 6, sy = by - bigSize * .42;
    c.save(); c.translate(sx, sy); c.rotate(-0.19); c.strokeStyle = AC; c.fillStyle = AC;
    c.lineWidth = 9; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r - 18, 0, 7); c.stroke();
    if (d.id === 'world') { c.strokeStyle = GOLD_DEEP; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, r + 16, 0, 7); c.stroke(); c.strokeStyle = AC; }
    c.textAlign = 'center'; var skFam = /[가-힣]/.test(d.sk) ? FONT_SANS : FONT_MONO; var ss = fit(c, d.sk, 2 * (r - 40), 74, 800, skFam, 30); c.font = '800 ' + ss + 'px ' + skFam;
    c.fillText(d.sk, 0, 4); c.font = '600 26px ' + FONT_MONO; c.fillText('STEP ' + d.step + '/' + d.steps, 0, 46);
    if (d.crown) { c.font = '44px ' + FONT_SANS; c.fillText('👑', 0, -52); }
    c.restore();
    // 사다리 막대
    var ly = by + 52 * k, gap = 14, bw2 = (iw - gap * (d.steps - 1)) / d.steps;
    for (var i = 1; i <= d.steps; i++) {
      c.fillStyle = i < d.step ? AC : i === d.step ? INK : 'rgba(0,0,0,.1)';
      var bx = pad + (i - 1) * (bw2 + gap), bh = 24, rr = 12;
      c.beginPath(); c.moveTo(bx + rr, ly); c.lineTo(bx + bw2 - rr, ly); c.arc(bx + bw2 - rr, ly + rr, rr, -1.5708, 1.5708); c.lineTo(bx + rr, ly + bh); c.arc(bx + rr, ly + rr, rr, 1.5708, 4.7124); c.fill();
    }
    c.fillStyle = '#4b5563'; c.font = '600 24px ' + FONT_MONO; spaced(c, '1 ' + d.first, pad, ly + 56, 3); spaced(c, d.steps + ' ' + d.lastShort, W - pad, ly + 56, 3, 'right');
    // 기준 줄
    var cy = ly + 118 * Math.max(1, k * .8);
    c.fillStyle = '#374151'; var cs = fit(c, d.crit, iw, 32, 500, FONT_SANS, 20); c.font = '500 ' + cs + 'px ' + FONT_SANS; c.textAlign = 'left'; c.fillText(d.crit, pad, cy);
    // 하단: 점선 + 도전 문구 + 주소
    var fy = H - 232;
    c.strokeStyle = INK; c.lineWidth = 3; c.setLineDash([12, 10]); c.beginPath(); c.moveTo(pad, fy); c.lineTo(W - pad, fy); c.stroke(); c.setLineDash([]);
    var url = siteShort(), us = fit(c, url, 360, 32, 600, FONT_MONO, 16); c.font = '600 ' + us + 'px ' + FONT_MONO;
    var uw = Math.min(380, c.measureText(url).width + 56), uh = 68;
    var ux = W - pad - uw, uy = fy + 54;
    c.strokeStyle = INK; c.lineWidth = 4; c.strokeRect(ux, uy, uw, uh);
    c.fillStyle = INK; c.textAlign = 'center'; c.fillText(url, ux + uw / 2, uy + uh / 2 + us * .35);
    c.textAlign = 'left'; c.fillStyle = INK; var cw = ux - pad - 24;
    var s1 = fit(c, d.T.cta, cw, 56, 800, FONT_SANS, 28); c.font = '800 ' + s1 + 'px ' + FONT_SANS; c.fillText(d.T.cta, pad, uy + 34);
    c.fillStyle = '#4b5563'; var s2 = fit(c, d.T.cta2, cw, 30, 500, FONT_SANS, 18); c.font = '500 ' + s2 + 'px ' + FONT_SANS; c.fillText(d.T.cta2, pad, uy + 78);
  }

  function fontsReady(d) {
    var samples = d.name + d.crit + d.nick + d.tier + d.T.cta + d.T.cta2 + '0123456789/BY';
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var loads = [
      document.fonts.load('800 100px "Gothic A1"', samples),
      document.fonts.load('700 40px "Gothic A1"', samples), document.fonts.load('500 40px "Gothic A1"', samples),
      document.fonts.load('600 30px "IBM Plex Mono"', 'WHEELCHAIRRUGBYQUIZ REFEREEPASS0123456789 STEP/'), document.fonts.load('600 30px "IBM Plex Mono"', 'abcdefghijklmnopqrstuvwxyz0123456789.:/-'), document.fonts.load('500 30px "IBM Plex Mono"', 'WHEELCHAIR')
    ];
    return Promise.race([Promise.all(loads).catch(function () {}), new Promise(function (r) { setTimeout(r, 3500); })]);
  }
  function toBlob(canvas) { return new Promise(function (res) { canvas.toBlob(function (b) { res(b); }, 'image/png'); }); }

  function build(detail) {
    var my = ++rendering;
    var cn = cleanNick(ui.nick.value);
    ui.msg.className = 'sh-msg' + (cn.bad ? ' bad' : ''); ui.msg.textContent = cn.bad ? t().nickBad : t().busy;
    ui.share.disabled = true; ui.save.disabled = true;
    ui.making.hidden = false; ui.making.textContent = t().making; ui.img.style.visibility = 'hidden';
    var d = cardData(detail, cn.nick);
    return fontsReady(d).then(function () {
      var feed = document.createElement('canvas'), story = document.createElement('canvas');
      draw(feed, d, 1080, 1350); draw(story, d, 1080, 1920);
      return Promise.all([toBlob(feed), toBlob(story)]);
    }).then(function (bl) {
      if (my !== rendering) return;
      ['feed', 'story'].forEach(function (key, i) {
        if (cards[key]) URL.revokeObjectURL(cards[key].url);
        cards[key] = { blob: bl[i], url: URL.createObjectURL(bl[i]), file: new File([bl[i]], 'referee-card-' + key + '.png', { type: 'image/png' }) };
      });
      show(); ui.making.hidden = true; ui.img.style.visibility = '';
      ui.share.disabled = false; ui.save.disabled = false; if (!cn.bad) ui.msg.textContent = '';
    });
  }
  function show() {
    var c = cards[fmt]; if (!c) return;
    ui.img.src = c.url; ui.img.className = 'sh-preview' + (fmt === 'story' ? ' story' : '');
    ui.img.alt = t().alt;
  }

  /* ----- 공유 ----- */
  function inApp() { return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(inapp|DaumApps|; wv\)/i.test(navigator.userAgent || ''); }
  function copyLink() {
    var u = siteUrl();
    function done(ok) { ui.msg.className = 'sh-msg' + (ok ? '' : ' bad'); ui.msg.textContent = ok ? t().copied : t().copyFail; if (ui.mmsg) ui.mmsg.textContent = ui.msg.textContent; }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(u).then(function () { done(true); }, function () { done(fallbackCopy(u)); }); }
    else done(fallbackCopy(u));
  }
  function fallbackCopy(u) {
    try { var ta = document.createElement('textarea'); ta.value = u; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0'; document.body.appendChild(ta); ta.select(); var ok = document.execCommand('copy'); document.body.removeChild(ta); return ok; } catch (e) { return false; }
  }
  function openModal() {
    var c = cards[fmt]; if (!c) return;
    ui.mimg.src = c.url; ui.modal.hidden = false; ui.mclose.focus();
    ui.minapp.hidden = !inApp();
  }
  function doShare() {
    var c = cards[fmt]; if (!c) return;
    var data = { files: [c.file], url: siteUrl(), title: document.title, text: t().shareText };
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [c.file] }))) {
      navigator.share(data).catch(function (e) { if (e && e.name === 'AbortError') return; openModal(); });
    } else openModal();
  }
  function doSave() {
    var c = cards[fmt]; if (!c) return;
    if (inApp()) { openModal(); return; }
    var a = document.createElement('a'); a.href = c.url; a.download = 'referee-card-' + fmt + '.png'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    ui.msg.className = 'sh-msg'; ui.msg.textContent = t().saved;
  }

  /* ----- 화면 만들기 ----- */
  function mount() {
    var host = document.querySelector('#view-result .result-hero'); if (!host || document.getElementById('shareBox')) return;
    var box = document.createElement('section'); box.className = 'share-box'; box.id = 'shareBox';
    box.innerHTML = '<h2 id="shTitle"></h2><p class="sh-hint" id="shHint"></p>' +
      '<div class="sh-prevwrap"><img class="sh-preview" id="shImg" alt=""><span class="sh-making" id="shMaking" role="status"></span></div>' +
      '<div class="sh-row"><label for="shNick" id="shNickL"></label><input id="shNick" type="text" maxlength="12" autocomplete="off"></div>' +
      '<div class="sh-fmt" role="group"><button type="button" id="shFeed" aria-pressed="true"></button><button type="button" id="shStory" aria-pressed="false"></button></div>' +
      '<div class="sh-actions"><button class="btn primary big" id="shShare" type="button"></button><button class="btn" id="shSave" type="button"></button></div>' +
      '<p class="sh-msg" id="shMsg" role="status"></p>';
    host.insertAdjacentElement('afterend', box);
    var modal = document.createElement('div'); modal.className = 'sh-modal'; modal.hidden = true; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = '<div class="sh-modal-in"><h3 id="mTitle"></h3><img id="mImg" alt=""><div class="sh-inapp" id="mInapp" hidden></div><p id="mHelp"></p><button class="btn primary" id="mCopy" type="button"></button><p id="mMsg" role="status"></p><button class="btn" id="mClose" type="button"></button></div>';
    document.body.appendChild(modal);
    var g = function (id) { return document.getElementById(id); };
    ui = { box: box, img: g('shImg'), making: g('shMaking'), nick: g('shNick'), msg: g('shMsg'), share: g('shShare'), save: g('shSave'), feed: g('shFeed'), story: g('shStory'),
      modal: modal, mimg: g('mImg'), mclose: g('mClose'), minapp: g('mInapp'), mmsg: g('mMsg'), mcopy: g('mCopy') };
    ui.share.addEventListener('click', doShare); ui.save.addEventListener('click', doSave);
    ui.mcopy.addEventListener('click', copyLink); ui.mclose.addEventListener('click', function () { modal.hidden = true; });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') modal.hidden = true; });
    [['feed', ui.feed], ['story', ui.story]].forEach(function (p) {
      p[1].addEventListener('click', function () { fmt = p[0]; ui.feed.setAttribute('aria-pressed', String(fmt === 'feed')); ui.story.setAttribute('aria-pressed', String(fmt === 'story')); show(); });
    });
    ui.nick.addEventListener('input', function () {
      try { localStorage.setItem(NICK_KEY, ui.nick.value); } catch (e) {}
      clearTimeout(timer); timer = setTimeout(function () { if (last) build(last); }, 350);
    });
    ui.nick.addEventListener('blur', function () { var c = cleanNick(ui.nick.value); if (!c.bad) ui.nick.value = c.nick; });
    labels();
  }
  function labels() {
    if (!ui) return; var T = t();
    var set = function (id, v) { document.getElementById(id).textContent = v; };
    set('shTitle', T.title); set('shHint', T.hint); set('shNickL', T.nickLbl); ui.nick.placeholder = T.nickPh;
    ui.feed.textContent = T.feed; ui.story.textContent = T.story; ui.share.textContent = T.share; ui.save.textContent = T.save;
    set('mTitle', T.mTitle); set('mHelp', T.mHelp); ui.mcopy.textContent = T.copy; ui.mclose.textContent = T.close; ui.minapp.textContent = T.inapp;
  }

  document.addEventListener('quiz:result', function (e) {
    mount(); if (!ui) return; last = e.detail;
    var saved = ''; try { saved = localStorage.getItem(NICK_KEY) || ''; } catch (er) {}
    if (!ui.nick.value) ui.nick.value = saved || (P() ? P().nick() : '');
    labels(); build(last);
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.lang-switch [data-lang]');
    if (b && ui && last) setTimeout(function () { labels(); build(last); }, 0);
  });
  window.QuizShare = { draw: draw, cardData: cardData }; /* 미리보기·점검용 */
})();

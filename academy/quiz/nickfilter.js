/* 닉네임 거르기 — 한 곳에서 관리 (순위표 닉네임 app.js, 결과 카드 별명 share.js 가 같이 쓴다).
   QuizNick.clean(원문, 최대글자수) → { nick: 정리된 이름, bad: 쓸 수 없는 이름이면 true }
   막는 것: 욕설, 6자리 이상 숫자(전화번호 꼴), 메일·인터넷 주소 꼴. 실명 자체는 자동으로 알 수 없어 안내 문구로 부탁한다. */
(function () {
  'use strict';
  var BAD = /(씨발|시발|ㅅㅂ|ㅂㅅ|병신|개새|좆|존나|지랄|느금|엿먹|fuck|shit|bitch|asshole|nigg|cunt|dick|porn|섹스)/i;
  function clean(raw, max) {
    var n = String(raw || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 12);
    if (!n) return { nick: '', bad: false };
    var compact = n.replace(/[\s._\-·]/g, '');
    if (BAD.test(compact) || /\d{6,}/.test(compact) || /@|https?:|www\.|\.com|\.kr/i.test(n)) return { nick: '', bad: true };
    return { nick: n, bad: false };
  }
  window.QuizNick = { clean: clean };
})();

/* 공유 랭킹 저장소 — Firebase(Firestore + 익명 로그인)
   window.QuizRank
     .ready()            → Promise<boolean>  쓸 수 있으면 true
     .mode               'firebase' | 'mock' | 'off'
     .push(me)           내 기록 올리기  me = {nick,total,week,wk,grade,en}
     .top(kind, wk)      kind 'week' | 'all' → [{id,nick,score,grade,en,me}]
     .hall()             명예의 전당 → [{id,nick,lang,at,me}] (도달 순서)
     .enterHall(nick, lang)
   설정은 firebase-config.js. 주소에 ?mock=1 이 있으면 이 브라우저 안의 가짜 서버로 동작한다. */
(function () {
  'use strict';
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const cfg = window.FIREBASE_CONFIG || {};
  let mock = false;
  try { mock = /[?&]mock=1\b/.test(location.search); } catch (e) {}
  const R = { mode: mock ? 'mock' : (cfg.apiKey && cfg.projectId ? 'firebase' : 'off') };

  function loadScript(src) {
    return new Promise((ok, bad) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = ok; s.onerror = () => bad(new Error('load ' + src));
      document.head.appendChild(s);
    });
  }

  /* ---------------- 가짜 서버 (테스트용) ---------------- */
  const MK = 'wracad.mockrank.v1';
  function mockDb() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(MK)); } catch (e) {}
    if (!d) {
      d = { players: {
        a1: { nick: '블리츠', total: 1840, grade: 4, en: false },
        a2: { nick: '쿼드킹', total: 1210, grade: 3, en: true },
        a3: { nick: '범퍼카', total: 640, grade: 2, en: false },
        a4: { nick: '인바운더', total: 320, grade: 1, en: false }
      }, weeks: {}, hall: { a9_ko: { nick: '전설의심판', lang: 'ko', at: 1731000000000 } } };
      const wk = weekKey();
      d.weeks[wk] = { a2: { nick: '쿼드킹', xp: 420, grade: 3, en: true }, a3: { nick: '범퍼카', xp: 260, grade: 2, en: false } };
    }
    return d;
  }
  function mockSave(d) { try { localStorage.setItem(MK, JSON.stringify(d)); } catch (e) {} }

  /* ---------------- Firebase ---------------- */
  let db = null, uid = null, readyP = null;
  R.ready = function () {
    if (readyP) return readyP;
    if (R.mode === 'mock') { uid = 'me'; readyP = Promise.resolve(true); return readyP; }
    if (R.mode !== 'firebase') { readyP = Promise.resolve(false); return readyP; }
    readyP = loadScript(SDK + 'firebase-app-compat.js')
      .then(() => Promise.all([loadScript(SDK + 'firebase-auth-compat.js'), loadScript(SDK + 'firebase-firestore-compat.js')]))
      .then(() => {
        const fb = window.firebase;
        if (!fb.apps.length) fb.initializeApp(cfg);
        db = fb.firestore();
        return fb.auth().signInAnonymously();
      })
      .then((cred) => { uid = cred.user.uid; return true; })
      .catch((e) => { console.warn('[rank] Firebase 연결 실패', e); R.error = e.message || String(e); return false; });
    return readyP;
  };

  R.push = function (me) {
    return R.ready().then((ok) => {
      if (!ok || !me || !me.nick) return false;
      const nick = String(me.nick).slice(0, 14);
      if (R.mode === 'mock') {
        const d = mockDb();
        d.players[uid] = { nick, total: me.total | 0, grade: me.grade | 0, en: !!me.en };
        d.weeks[me.wk] = d.weeks[me.wk] || {};
        d.weeks[me.wk][uid] = { nick, xp: me.week | 0, grade: me.grade | 0, en: !!me.en };
        mockSave(d);
        return true;
      }
      const ts = window.firebase.firestore.FieldValue.serverTimestamp();
      const b = db.batch();
      b.set(db.collection('players').doc(uid), { nick, total: me.total | 0, grade: me.grade | 0, en: !!me.en, at: ts });
      b.set(db.collection('weeks').doc(me.wk).collection('players').doc(uid), { nick, xp: me.week | 0, grade: me.grade | 0, en: !!me.en, at: ts });
      return b.commit().then(() => true).catch((e) => { console.warn('[rank] 올리기 실패', e); return false; });
    });
  };

  R.top = function (kind, wk, n) {
    n = n || 20;
    return R.ready().then((ok) => {
      if (!ok) return null;
      if (R.mode === 'mock') {
        const d = mockDb();
        const src = kind === 'week' ? (d.weeks[wk] || {}) : d.players;
        return Object.keys(src).map((id) => ({ id, nick: src[id].nick, score: kind === 'week' ? src[id].xp : src[id].total, grade: src[id].grade, en: src[id].en, me: id === uid }))
          .filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, n);
      }
      const field = kind === 'week' ? 'xp' : 'total';
      const col = kind === 'week' ? db.collection('weeks').doc(wk).collection('players') : db.collection('players');
      return col.orderBy(field, 'desc').limit(n).get().then((qs) => qs.docs.map((doc) => {
        const v = doc.data();
        return { id: doc.id, nick: v.nick, score: v[field] || 0, grade: v.grade || 0, en: !!v.en, me: doc.id === uid };
      }).filter((r) => r.score > 0)).catch((e) => { console.warn('[rank] 읽기 실패', e); return null; });
    });
  };

  R.hall = function () {
    return R.ready().then((ok) => {
      if (!ok) return null;
      if (R.mode === 'mock') {
        const h = mockDb().hall;
        return Object.keys(h).map((id) => ({ id, nick: h[id].nick, lang: h[id].lang, at: h[id].at, me: id.indexOf(uid + '_') === 0 }))
          .sort((a, b) => a.at - b.at);
      }
      return db.collection('hall').orderBy('at', 'asc').limit(100).get().then((qs) => qs.docs.map((doc) => {
        const v = doc.data();
        return { id: doc.id, nick: v.nick, lang: v.lang, at: v.at && v.at.toMillis ? v.at.toMillis() : 0, me: doc.id.indexOf(uid + '_') === 0 };
      })).catch((e) => { console.warn('[rank] 명예의 전당 읽기 실패', e); return null; });
    });
  };

  R.enterHall = function (nick, lang) {
    return R.ready().then((ok) => {
      if (!ok || !nick) return false;
      const id = uid + '_' + lang;
      if (R.mode === 'mock') {
        const d = mockDb();
        if (!d.hall[id]) d.hall[id] = { nick: String(nick).slice(0, 14), lang, at: Date.now() };
        mockSave(d);
        return true;
      }
      const ref = db.collection('hall').doc(id);
      return ref.get().then((s) => {
        if (s.exists) return true;
        return ref.set({ nick: String(nick).slice(0, 14), lang, at: window.firebase.firestore.FieldValue.serverTimestamp() }).then(() => true);
      }).catch((e) => { console.warn('[rank] 명예의 전당 쓰기 실패', e); return false; });
    });
  };

  /* 월요일 시작 주차 키 (기기 날짜 기준) 'YYYY-Www' */
  function weekKey(d) {
    const t = d ? new Date(d) : new Date();
    const x = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    const day = (x.getDay() + 6) % 7;            // 월=0
    x.setDate(x.getDate() - day + 3);            // 그 주의 목요일
    const y = x.getFullYear();
    const jan4 = new Date(y, 0, 4);
    const w = 1 + Math.round(((x - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
    return y + '-W' + (w < 10 ? '0' + w : w);
  }
  R.weekKey = weekKey;

  window.QuizRank = R;
})();

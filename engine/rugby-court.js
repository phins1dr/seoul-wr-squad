/* 코트 부품 — 휠체어럭비 코트 규격 숫자 + 라인 그리기 (랩·게임·퀴즈·3D가 같이 씀)

   규격은 여기 한 곳에만 둔다. 화면마다 키 에어리어를 따로 그리다 크기가 달라졌던 걸 막으려고 만듦 (2026-11-13).
   좌표: 엔진과 같음 — x 0→28(공격 방향, 오른쪽 골라인 x=28), y 0→15, 단위 m. 코트 중심 (14, 7.5).

   규격 출처 (WWR International Rules / WWR 'The Playing Environment')
     - 코트 28×15m                         : WWR, 엔진 space()의 W=28,H=15
     - 키 에어리어 깊이 1.75m × 폭 8m       : WWR, 엔진 판정용 RugbyBrain.KEY {d:1.75,w:8}
     - 골라인 = 키 에어리어 폭(8m), 콘은 키 바깥 모서리 : WWR ("Cones ... at the outside corners of each Key Area")
     - 센터서클 반지름 1.75m                 : ⚠ 확인 필요 (규정 원문에서 숫자 못 확인함, 랩·3D가 쓰던 값)
     - 라인 굵기 0.05m(5cm)                  : ⚠ 확인 필요 (농구 코트 관례, 3D가 쓰던 값)
   ※ 예전 게임·퀴즈는 보기 좋으라고 키를 2.3×9.6m, 서클 2.2m로 키워 그렸음(RugbyBrain.KEYDRAW). 이제 안 씀.

   쓰는 법
     RugbyCourt.SPEC                       → 규격 숫자 (3D는 이것만 씀)
     RugbyCourt.keyRect('left'|'right')    → {x,y,w,h} 키 에어리어 사각형
     RugbyCourt.inKey(x, y, 'right')       → 그 키 에어리어 안인가
     RugbyCourt.cones()                    → 콘 4개 [{x,y}]
     캔버스 2D (ctx가 이미 1단위=1m로 변환돼 있어야 함):
       RugbyCourt.draw2d(ctx, opts)        → 음영 + 라인 + 골라인 + 콘 한 번에
       RugbyCourt.shade2d(ctx) / RugbyCourt.lines2d(ctx, opts)  → 사이에 다른 걸 끼워 그릴 때 (랩의 초록 공간)
     PixiJS (Graphics, 1단위=1m인 컨테이너 안):
       RugbyCourt.drawPixi(g, opts)        → 같은 그림
     opts: { lineW: 화면용 라인 굵기(m, 기본 0.08), cones: true }
   나무 바닥은 RugbyChairs.floor() — 바닥 위에 이걸 얹는다. */
(function (root) {
  'use strict';

  const SPEC = Object.freeze({
    L: 28, W: 15,                    // 코트 길이(공격 방향)·폭
    cx: 14, cy: 7.5,                 // 중심
    key: Object.freeze({ d: 1.75, w: 8 }),   // 키 에어리어 깊이·폭
    goalW: 8,                        // 골라인 길이 = 키 폭 (콘 사이)
    circleR: 1.75,                   // 센터서클 반지름 ⚠ 확인 필요
    lineW: 0.05,                     // 실제 라인 굵기 ⚠ 확인 필요
    cone: 0.26                       // 콘 그림 반지름(그림용)
  });

  // 화면 공통 색 (게임·퀴즈·랩에서 쓰던 색 그대로)
  const STYLE = {
    shade: 0x1b2230, shadeA: 0.10,   // 키·서클 음영
    line: 0x2a2f36,                  // 코트 라인
    goal: 0xffffff, goalA: 0.6,      // 골라인 (콘 사이)
    cone: 0xff6a1a, coneDot: 0xffffff
  };

  const keyRect = (side) => {
    const k = SPEC.key, y = SPEC.cy - k.w / 2;
    return side === 'left' ? { x: 0, y, w: k.d, h: k.w } : { x: SPEC.L - k.d, y, w: k.d, h: k.w };
  };
  const inKey = (x, y, side) => {
    const r = keyRect(side || 'right');
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  };
  const cones = () => {
    const g = SPEC.goalW / 2, out = [];
    for (const x of [0, SPEC.L]) for (const y of [SPEC.cy - g, SPEC.cy + g]) out.push({ x, y });
    return out;
  };

  const css = (n, a) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a == null ? 1 : a})`;

  /* ---------- 캔버스 2D ---------- */
  function shade2d(g) {
    const kl = keyRect('left'), kr = keyRect('right');
    g.save();
    g.fillStyle = css(STYLE.shade, STYLE.shadeA);
    g.fillRect(kl.x, kl.y, kl.w, kl.h); g.fillRect(kr.x, kr.y, kr.w, kr.h);
    g.beginPath(); g.arc(SPEC.cx, SPEC.cy, SPEC.circleR, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  function lines2d(g, o) {
    o = o || {};
    const lw = o.lineW || 0.08, kl = keyRect('left'), kr = keyRect('right'), h = SPEC.goalW / 2;
    g.save();
    g.strokeStyle = css(STYLE.line); g.lineWidth = lw;
    g.strokeRect(0, 0, SPEC.L, SPEC.W);
    g.beginPath(); g.moveTo(SPEC.cx, 0); g.lineTo(SPEC.cx, SPEC.W); g.stroke();
    g.beginPath(); g.arc(SPEC.cx, SPEC.cy, SPEC.circleR, 0, Math.PI * 2); g.stroke();
    g.strokeRect(kl.x, kl.y, kl.w, kl.h); g.strokeRect(kr.x, kr.y, kr.w, kr.h);
    g.strokeStyle = css(STYLE.goal, STYLE.goalA); g.lineWidth = lw * 1.75;
    g.beginPath();
    g.moveTo(0, SPEC.cy - h); g.lineTo(0, SPEC.cy + h);
    g.moveTo(SPEC.L, SPEC.cy - h); g.lineTo(SPEC.L, SPEC.cy + h);
    g.stroke();
    if (o.cones !== false) for (const c of cones()) {
      g.fillStyle = css(STYLE.cone); g.beginPath(); g.arc(c.x, c.y, SPEC.cone, 0, Math.PI * 2); g.fill();
      g.fillStyle = css(STYLE.coneDot); g.beginPath(); g.arc(c.x, c.y, SPEC.cone * 0.38, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  function draw2d(g, o) { shade2d(g); lines2d(g, o); }

  /* ---------- PixiJS Graphics ---------- */
  function drawPixi(g, o) {
    o = o || {};
    const lw = o.lineW || 0.08, kl = keyRect('left'), kr = keyRect('right'), h = SPEC.goalW / 2;
    g.lineStyle(0);
    g.beginFill(STYLE.shade, STYLE.shadeA)
      .drawRect(kl.x, kl.y, kl.w, kl.h).drawRect(kr.x, kr.y, kr.w, kr.h)
      .drawCircle(SPEC.cx, SPEC.cy, SPEC.circleR).endFill();
    g.lineStyle(lw, STYLE.line, 1)
      .drawRect(0, 0, SPEC.L, SPEC.W)
      .moveTo(SPEC.cx, 0).lineTo(SPEC.cx, SPEC.W)
      .drawCircle(SPEC.cx, SPEC.cy, SPEC.circleR)
      .drawRect(kl.x, kl.y, kl.w, kl.h).drawRect(kr.x, kr.y, kr.w, kr.h);
    g.lineStyle(lw * 1.75, STYLE.goal, STYLE.goalA)
      .moveTo(0, SPEC.cy - h).lineTo(0, SPEC.cy + h)
      .moveTo(SPEC.L, SPEC.cy - h).lineTo(SPEC.L, SPEC.cy + h);
    g.lineStyle(0);
    if (o.cones !== false) for (const c of cones()) {
      g.beginFill(STYLE.cone).drawCircle(c.x, c.y, SPEC.cone).endFill();
      g.beginFill(STYLE.coneDot).drawCircle(c.x, c.y, SPEC.cone * 0.38).endFill();
    }
    return g;
  }

  // 두뇌 판정용 KEY와 숫자가 어긋나면 알려줌 (두뇌는 화면 없이도 돌아야 해서 KEY를 따로 들고 있음)
  const RB = root.RugbyBrain;
  if (RB && RB.KEY && (RB.KEY.d !== SPEC.key.d || RB.KEY.w !== SPEC.key.w))
    console.warn('[RugbyCourt] 두뇌 KEY와 코트 규격이 다름', RB.KEY, SPEC.key);

  root.RugbyCourt = { SPEC, STYLE, keyRect, inKey, cones, draw2d, shade2d, lines2d, drawPixi };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.RugbyCourt;
})(typeof window !== 'undefined' ? window : globalThis);

/* 휠체어·코트 그림 (위에서 본 모습) — 퀴즈·게임·랩이 같이 쓴다.
   코드로 그린다: 캠버 진 큰 뒷바퀴(디스크 커버·핸드림·타이어 무늬), 안티팁, 앞 캐스터,
   공격형 A(둥근 범퍼 + 바퀴 가드 날개) / 수비형 D(앞으로 튀어나온 범퍼 + 갈고리),
   선수 상체(머리·어깨·팔·장갑)와 등번호, 그림자, 바퀴 회전, 나무 코트 바닥.

   쓰는 법
     const L = RugbyChairs.look({type:'A'|'D', color:'#4a90d9', num:7});
     L.frame(roll)  → 캔버스 (roll = 굴러간 거리 m, 바퀴 회전 그림이 바뀜)
     L.shadow       → 그림자 캔버스 (같은 크기·기준점, 세계 좌표로 살짝 비켜서 그림)
     L.W, L.H       → 세계 크기(m),  L.ax, L.ay → 기준점(휠체어 중심) 비율 0~1
     L.tex(roll), L.shadowTex() → PixiJS 텍스처 (PIXI 있을 때)
     RugbyChairs.draw(ctx, L, x, y, a, roll)  → 캔버스 2D에 바로 그리기 (그림자 포함)
     RugbyChairs.roll(prev, x, y, a)  → 이동 거리 누적 도우미 (제자리 회전도 바퀴가 돎)
     RugbyChairs.floor({x0,y0,x1,y1,px}) → 나무 바닥 캔버스 (코트 0~28×0~15는 밝은 메이플, 바깥은 진한 색)
   좌표: 휠체어는 +x 방향(범퍼)을 본다. 세계 크기는 실제 크기(뒷바퀴 25", 두뇌 충돌 지름 1.24m와 비슷). */
(function (root) {
  'use strict';

  const U = 0.635 / 78;                    // 그림 단위 1 ≈ 0.0081m — 실제 크기: 뒷바퀴 지름 78단위 = 25"(0.635m). 휠체어 길이 약 1.33m (2026-11-13, 예전엔 1.6배 크게 그렸음)
  const BX0 = -108, BX1 = 120, BY0 = -92, BY1 = 92;   // 그림 상자 (휠체어 중심이 0,0)
  const BW = BX1 - BX0, BH = BY1 - BY0;
  const NPH = 12;                          // 바퀴 회전 그림 수 (디스크 무늬 3갈래 → 120°를 12칸)
  const CIRC = 2.0;                        // 바퀴 한 바퀴 = 2.0m 굴러감 (지름 0.65m 바퀴)
  const SY = 0.84;                         // 프레임 옆폭 배율
  const RES = 1.6;                         // 그림 단위당 픽셀
  const FONT = '"Gothic A1","Apple SD Gothic Neo","Malgun Gothic",-apple-system,sans-serif';

  /* ---------- 색 도우미 ---------- */
  function rgb(hex) {
    hex = String(hex || '#4a90d9').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(c, t, k) { return c.map((v, i) => Math.round(v + (t[i] - v) * k)); }
  function css(c, a) { return a === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
  const shade = (c, k) => mix(c, [12, 16, 24], k);     // 어둡게 (푸른 기 도는 검정 쪽으로)
  const tint = (c, k) => mix(c, [255, 255, 255], k);   // 밝게

  function canvas(w, h) {
    const c = (typeof document !== 'undefined') ? document.createElement('canvas') : new OffscreenCanvas(w, h);
    c.width = w; c.height = h;
    return c;
  }

  /* ---------- 부품 ---------- */
  function tube(g, pts, w, light, dark) {
    // 금속 파이프: 어두운 테두리 → 본색 → 위쪽 하이라이트
    g.lineCap = 'round'; g.lineJoin = 'round';
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
    path(); g.strokeStyle = dark; g.lineWidth = w + 1.6; g.stroke();
    path(); g.strokeStyle = light; g.lineWidth = w; g.stroke();
    g.save(); g.translate(-w * 0.18, -w * 0.18);
    path(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(0.7, w * 0.28); g.stroke();
    g.restore();
  }

  // 뒷바퀴 하나. side = -1(왼쪽, 위) / +1(오른쪽, 아래). 캠버 때문에 위에서 보면 납작한 타원.
  function wheel(g, side, phase, C) {
    const hx = -8, hy = side * 63, R = 39, ry = 12.5;
    g.save(); g.translate(hx, hy);
    // 타이어 (팀색 고무 — 실제 경기용 휠체어처럼 색 타이어)
    const TC = shade(C, 0.18);
    const tg = g.createLinearGradient(0, -ry - 4, 0, ry + 4);
    tg.addColorStop(0, css(tint(TC, 0.12))); tg.addColorStop(0.5, css(shade(TC, 0.35))); tg.addColorStop(1, css(tint(TC, 0.05)));
    g.beginPath(); g.ellipse(0, 0, R, ry, 0, 0, Math.PI * 2);
    g.strokeStyle = tg; g.lineWidth = 7; g.stroke();
    // 타이어 옆면 글자·무늬 — 돌아가며 바퀴 회전을 보여줌
    g.setLineDash([5, 2.5, 1.2, 2.5]); g.lineDashOffset = -phase * 34;
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(0, 0, R + 1.4, ry + 1.4, 0, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    // 림 (은색 얇은 테)
    g.beginPath(); g.ellipse(0, 0, R - 3.4, ry - 2.1, 0, 0, Math.PI * 2);
    g.strokeStyle = '#aab1b9'; g.lineWidth = 1.2; g.stroke();
    // 디스크 커버 (검정 솔리드 디스크)
    const dg = g.createLinearGradient(0, -ry, 0, ry);
    dg.addColorStop(0, '#2a2e35'); dg.addColorStop(0.5, '#15181c'); dg.addColorStop(1, '#0b0d10');
    g.beginPath(); g.ellipse(0, 0, R - 4, ry - 2.6, 0, 0, Math.PI * 2); g.fillStyle = dg; g.fill();
    // 디스크 테두리 볼트 (회전)
    const n = 15;
    for (let j = 0; j < n; j++) {
      const th = phase * (Math.PI * 2 / 3) + j * Math.PI * 2 / n;
      const bx = Math.cos(th) * (R - 6.2), by = Math.sin(th) * (ry - 3.9);
      g.fillStyle = Math.sin(th) < 0 ? '#e5e7eb' : '#9ca3af';
      g.beginPath(); g.ellipse(bx, by, 0.95, 0.75, 0, 0, Math.PI * 2); g.fill();
    }
    // 허브 둘레 로고 링 (회전하는 흰 글자 느낌)
    g.save(); g.scale(1, (ry - 2.6) / (R - 4));
    for (let j = 0; j < 3; j++) {
      const th = phase * (Math.PI * 2 / 3) + j * Math.PI * 2 / 3;
      g.beginPath(); g.arc(0, 0, 10, th, th + 1.3);
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2.2; g.stroke();
    }
    g.restore();
    // 디스크 반사광
    g.beginPath(); g.ellipse(-6, -side * 2.5, R * 0.62, ry * 0.32, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,.13)'; g.fill();
    // 허브
    g.beginPath(); g.ellipse(0, 0, 5.2, 2.6, 0, 0, Math.PI * 2);
    const hg = g.createLinearGradient(0, -3, 0, 3); hg.addColorStop(0, '#ff5a6a'); hg.addColorStop(1, '#8e1424');
    g.fillStyle = hg; g.fill(); g.strokeStyle = '#4b5563'; g.lineWidth = 0.8; g.stroke();
    // 핸드림 (바깥쪽으로 조금 비켜 있음)
    g.translate(0, side * 4.2);
    g.beginPath(); g.ellipse(0, 0, R - 4, ry - 2.6, 0, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(30,34,40,.55)'; g.lineWidth = 3.4; g.stroke();
    g.beginPath(); g.ellipse(0, 0, R - 4, ry - 2.6, 0, 0, Math.PI * 2);
    g.strokeStyle = '#c9ced4'; g.lineWidth = 2.1; g.stroke();
    g.beginPath(); g.ellipse(0, 0, R - 4, ry - 2.6, 0, Math.PI * 1.05, Math.PI * 1.75);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 0.9; g.stroke();
    g.restore();
  }

  function caster(g, x, y) {
    g.save(); g.translate(x, y);
    g.fillStyle = '#9aa1a9'; g.beginPath(); g.roundRect ? g.roundRect(-3, -4.2, 6, 8.4, 2) : g.rect(-3, -4.2, 6, 8.4); g.fill();
    g.fillStyle = '#16191e'; g.beginPath(); g.roundRect ? g.roundRect(-6.5, -2.2, 13, 4.4, 2.2) : g.rect(-6.5, -2.2, 13, 4.4); g.fill();
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-5, -1.6, 10, 1);
    g.restore();
  }

  function antiTip(g) {
    // 트윈 스위블 안티팁 (넓게): 뒷바퀴 안쪽 뒤로 빨간 롤러블레이드 캐스터 2개
    tube(g, [[-40, -40], [-58, -36]], 3.4, '#b8bfc7', '#4b5563');
    tube(g, [[-40, 40], [-58, 36]], 3.4, '#b8bfc7', '#4b5563');
    tube(g, [[-44, -30], [-52, -36]], 2.4, '#a7aeb6', '#4b5563');
    tube(g, [[-44, 30], [-52, 36]], 2.4, '#a7aeb6', '#4b5563');
    for (const y of [-36, 36]) {
      g.fillStyle = '#8b939c'; g.beginPath(); g.ellipse(-59, y, 3.2, 3.2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c8372d'; g.beginPath(); g.roundRect ? g.roundRect(-68, y - 2.2, 11, 4.4, 2.2) : g.rect(-68, y - 2.2, 11, 4.4); g.fill();
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-66.5, y - 1.6, 8, 0.9);
    }
  }

  function chassis(g, type, C) {
    // 바닥 판 (어두운 카본/아노다이즈)
    const pg = g.createLinearGradient(0, -46, 0, 46);
    pg.addColorStop(0, '#2c323b'); pg.addColorStop(0.5, '#3a414b'); pg.addColorStop(1, '#22272e');
    g.beginPath();
    g.moveTo(-44, -38); g.quadraticCurveTo(-46, -46, -36, -47);
    g.lineTo(46, -40); g.quadraticCurveTo(58, -36, 58, -24);
    g.lineTo(58, 24); g.quadraticCurveTo(58, 36, 46, 40);
    g.lineTo(-36, 47); g.quadraticCurveTo(-46, 46, -44, 38); g.closePath();
    g.fillStyle = pg; g.fill();
    // 프레임 파이프 (양옆 + 뒤)
    const M1 = '#d5dae0', M2 = '#5b636d';
    tube(g, [[-42, -44], [50, -38], [58, -26]], 4.2, M1, M2);
    tube(g, [[-42, 44], [50, 38], [58, 26]], 4.2, M1, M2);
    tube(g, [[-42, -44], [-44, 0], [-42, 44]], 4, M1, M2);
    // 바퀴 가드 (옆 레일)
    tube(g, [[-34, -50], [26, -49]], 2.6, '#b8bfc7', M2);
    tube(g, [[-34, 50], [26, 49]], 2.6, '#b8bfc7', M2);
    // 팀색 띠
    g.strokeStyle = css(C, 0.9); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-30, -42.2); g.lineTo(44, -36.6); g.moveTo(-30, 42.2); g.lineTo(44, 36.6); g.stroke();
  }

  function bumperA(g, C) {
    // 공격형 (실제 사진 기준): 뒷바퀴 앞부터 앞을 통째로 감싸는 두꺼운 알루미늄 D자 범퍼 링.
    // 링 안쪽엔 구멍 뚫린 발판과 V자 케이지 파이프, 앞 캐스터.
    const ring = (s) => [[22, s * 76], [44, s * 72], [64, s * 60], [78, s * 40], [84, s * 18], [85, 0]];
    // 링 안 바닥(그늘)
    g.beginPath(); g.moveTo(26, -66);
    g.bezierCurveTo(60, -60, 80, -36, 80, 0); g.bezierCurveTo(80, 36, 60, 60, 26, 66); g.lineTo(46, 0); g.closePath();
    g.fillStyle = 'rgba(20,24,30,.55)'; g.fill();
    // 발판 (구멍 뚫린 판)
    g.fillStyle = '#b9c0c8'; g.beginPath(); g.roundRect ? g.roundRect(44, -16, 22, 32, 2.5) : g.rect(44, -16, 22, 32); g.fill();
    g.fillStyle = '#5b636d';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) { g.beginPath(); g.arc(47.5 + i * 5, -12.5 + j * 5, 1.1, 0, Math.PI * 2); g.fill(); }
    // V자 케이지 파이프 (좌석 앞 → 범퍼 가운데)
    tube(g, [[40, -30], [78, -9]], 3.4, '#d5dae0', '#5b636d');
    tube(g, [[40, 30], [78, 9]], 3.4, '#d5dae0', '#5b636d');
    tube(g, [[28, -50], [62, -58]], 3, '#c7cdd3', '#5b636d');
    tube(g, [[28, 50], [62, 58]], 3, '#c7cdd3', '#5b636d');
    // 범퍼 링 (넓적한 알루미늄 판 → 두껍게)
    const R1 = ring(-1).concat(ring(1).reverse().slice(1));   // 왼쪽 뒤 → 앞 가운데 → 오른쪽 뒤
    tube(g, R1, 7.2, '#e6e9ec', '#6b7380');
    // 용접 자국
    g.strokeStyle = 'rgba(120,128,138,.55)'; g.lineWidth = 0.7; g.setLineDash([1.2, 1.4]);
    g.beginPath(); g.moveTo(30, -73); g.bezierCurveTo(66, -62, 84, -34, 84, 0); g.bezierCurveTo(84, 34, 66, 62, 30, 73); g.stroke();
    g.setLineDash([]);
    // 작은 앞 범퍼 (캐스터 사이, 링보다 살짝 앞) + 고무 스키드
    tube(g, [[80, -16], [90, -14]], 3, '#c7cdd3', '#59616b');
    tube(g, [[80, 16], [90, 14]], 3, '#c7cdd3', '#59616b');
    g.fillStyle = '#15181c'; g.beginPath(); g.roundRect ? g.roundRect(90, -22, 6, 44, 2) : g.rect(90, -22, 6, 44); g.fill();
    tube(g, [[91, -22], [91, 22]], 4.6, '#eef1f3', '#59616b');
    // 앞쪽 팀색 테이프
    g.strokeStyle = css(C, 0.9); g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(80, -30); g.quadraticCurveTo(86, -10, 86.5, 0); g.quadraticCurveTo(86, 10, 80, 30); g.stroke();
  }

  function chassisD(g, C) {
    // 수비형 (실물 사진 기준): 좌석에서 앞으로 갈수록 좁아지는 U자 코 프레임. 날개 없음.
    const M1 = '#d5dae0', M2 = '#5b636d';
    // 좌석 판
    const pg = g.createLinearGradient(0, -40, 0, 40);
    pg.addColorStop(0, '#2c323b'); pg.addColorStop(0.5, '#3a414b'); pg.addColorStop(1, '#22272e');
    g.beginPath(); g.moveTo(-42, -42); g.lineTo(8, -40); g.lineTo(8, 40); g.lineTo(-42, 42); g.closePath();
    g.fillStyle = pg; g.fill();
    // 발판 (검정 타공판)
    g.fillStyle = '#1c2026'; g.beginPath(); g.roundRect ? g.roundRect(30, -15, 22, 30, 2) : g.rect(30, -15, 22, 30); g.fill();
    g.fillStyle = '#4b5361';
    for (let j = 0; j < 5; j++) g.fillRect(33, -12 + j * 5.6, 16, 1.6);
    // 아래 프레임: 뒤 → 앞으로 좁아지는 U
    tube(g, [[-42, -42], [10, -40], [44, -24], [60, -18], [64, -8], [64, 8], [60, 18], [44, 24], [10, 40], [-42, 42]], 4.4, M1, M2);
    tube(g, [[-42, -42], [-44, 0], [-42, 42]], 4, M1, M2);
    // 위 프레임 (무릎 보호 파이프): 좌석 앞 → 코로 내려감
    tube(g, [[-2, -36], [30, -30], [56, -20]], 3.6, '#e3e7eb', M2);
    tube(g, [[-2, 36], [30, 30], [56, 20]], 3.6, '#e3e7eb', M2);
    // 팀색 띠
    g.strokeStyle = css(C, 0.9); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-30, -39); g.lineTo(6, -37.6); g.moveTo(-30, 39); g.lineTo(6, 37.6); g.stroke();
    // 앞 캐스터 (코 양옆)
    caster(g, 56, -24); caster(g, 56, 24);
  }

  function bumperD(g, C) {
    // 픽바: 코 앞에 붙은 사다리꼴 트러스. 앞 가로대가 프레임보다 넓고, 아래엔 검정 고무 스키드.
    const M1 = '#e3e7eb', M2 = '#59616b';
    g.beginPath(); g.moveTo(64, -16); g.lineTo(100, -40); g.lineTo(104, -36); g.lineTo(104, 36); g.lineTo(100, 40); g.lineTo(64, 16); g.closePath();
    g.fillStyle = 'rgba(16,19,24,.45)'; g.fill();
    g.fillStyle = '#15181c'; g.fillRect(98, -36, 7, 72);           // 고무 스키드
    // 트러스 (가는 파이프)
    const T1 = '#c7cdd3';
    for (const s of [-1, 1]) {
      tube(g, [[64, s * 12], [99, s * 22]], 1.8, T1, M2);
      tube(g, [[66, s * 4], [99, s * 34]], 1.8, T1, M2);
      tube(g, [[80, s * 26], [99, s * 6]], 1.8, T1, M2);
    }
    tube(g, [[64, 0], [99, 0]], 1.8, T1, M2);
    // 바깥 사다리꼴 테
    tube(g, [[64, -16], [99, -40], [99, 40], [64, 16]], 4.2, M1, M2);
    // 앞 가로대 (두꺼운 판)
    tube(g, [[101, -41], [101, 41]], 5.4, '#eef1f3', M2);
    g.strokeStyle = css(tint(C, 0.1)); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(101, -30); g.lineTo(101, 30); g.stroke();
  }

  // 좌석 (선수 그림 대신): 방석·등받이 + 방석 위 큰 등번호
  function seat(g, C, num) {
    // 등받이 (뒤쪽, 세로 박음질)
    const bk = g.createLinearGradient(-46, 0, -32, 0);
    bk.addColorStop(0, '#0f1216'); bk.addColorStop(1, '#2a2f37');
    g.fillStyle = bk; g.beginPath(); g.roundRect ? g.roundRect(-46, -32, 14, 64, 5) : g.rect(-46, -32, 14, 64); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-46, -11); g.lineTo(-32, -11); g.moveTo(-46, 11); g.lineTo(-32, 11); g.stroke();
    g.fillStyle = css(C, 0.9); g.fillRect(-46.5, -30, 2.2, 60);       // 등받이 위 팀색 테두리
    // 방석
    const cg = g.createRadialGradient(-12, -6, 4, -12, 0, 36);
    cg.addColorStop(0, css(tint(C, 0.12))); cg.addColorStop(0.7, css(C)); cg.addColorStop(1, css(shade(C, 0.35)));   // 방석 = 팀색
    g.fillStyle = cg; g.beginPath(); g.roundRect ? g.roundRect(-33, -31, 44, 62, 8) : g.rect(-33, -31, 44, 62); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 0.7;
    g.beginPath(); g.roundRect ? g.roundRect(-30, -28, 38, 56, 6) : g.rect(-30, -28, 38, 56); g.stroke();
    // 엉덩이 끈
    g.fillStyle = '#0c0e11'; g.fillRect(-4, -31, 4, 62);
    g.fillStyle = '#8b939c'; g.fillRect(-4.5, -3, 5, 6);
    // 등번호 (글자 위쪽이 앞을 봄)
    if (num !== undefined && num !== null && num !== '') {
      const t = String(num);
      g.save(); g.translate(-16, 0); g.rotate(Math.PI / 2);
      g.font = `900 ${t.length > 1 ? 24 : 30}px ${FONT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.lineWidth = 5; g.strokeStyle = css(shade(C, 0.6)); g.strokeText(t, 0, 1);
      g.fillStyle = '#ffffff'; g.fillText(t, 0, 1);
      g.restore();
    }
  }

  function paint(g, o, phase) {
    const C = rgb(o.color);
    // 프레임은 옆으로 좁게 (멜로스 사양서: 바퀴 24~26", 좌석폭 25~44cm, 캠버 16~20° 비율에 맞춤)
    g.save(); g.scale(1, SY);
    antiTip(g);
    wheel(g, -1, phase, C);
    wheel(g, 1, phase, C);
    if (o.type === 'D') chassisD(g, C);
    else { chassis(g, o.type, C); caster(g, 72, -24); caster(g, 72, 24); }
    if (o.type === 'D') bumperD(g, C); else bumperA(g, C);
    g.restore();
    seat(g, C, o.num);
  }

  // 그림자용 실루엣 (흐리게)
  function silhouette(g, type) {
    g.save(); g.scale(1, SY);
    g.beginPath();
    g.ellipse(-8, -63, 41, 15, 0, 0, Math.PI * 2);
    g.ellipse(-8, 63, 41, 15, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    if (type === 'D') { g.moveTo(-46, -46); g.lineTo(12, -44); g.lineTo(64, -20); g.lineTo(100, -44); g.lineTo(106, -44); g.lineTo(106, 44); g.lineTo(100, 44); g.lineTo(64, 20); g.lineTo(12, 44); g.lineTo(-46, 46); }
    else { g.moveTo(-46, -46); g.lineTo(22, -78); g.bezierCurveTo(70, -66, 89, -36, 89, 0); g.bezierCurveTo(89, 36, 70, 66, 22, 78); g.lineTo(-46, 46); }
    g.closePath(); g.fill();
    g.beginPath(); g.ellipse(-62, -36, 7, 4, 0, 0, Math.PI * 2); g.ellipse(-62, 36, 7, 4, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  /* ---------- 생김새(look) 캐시 ---------- */
  const LOOKS = new Map();
  function look(o) {
    o = o || {};
    const type = o.type === 'D' ? 'D' : 'A';
    const color = o.color || (type === 'D' ? '#e23b3b' : '#3b7fd0');
    const num = o.num === undefined ? '' : String(o.num);
    const res = o.res || RES;
    const key = [type, color, num, res].join('|');
    if (LOOKS.has(key)) return LOOKS.get(key);
    const pw = Math.round(BW * res), ph = Math.round(BH * res);
    const frames = new Array(NPH), texs = new Array(NPH);
    function frameAt(i) {
      if (frames[i]) return frames[i];
      const c = canvas(pw, ph), g = c.getContext('2d');
      g.setTransform(res, 0, 0, res, -BX0 * res, -BY0 * res);
      paint(g, { type, color, num }, i / NPH);
      return (frames[i] = c);
    }
    let shadow = null, shadowTex = null;
    function shadowCanvas() {
      if (shadow) return shadow;
      const c = canvas(pw, ph), g = c.getContext('2d');
      // 실루엣은 화면 밖에 그리고 그림자만 안으로 끌어옴 → 흐린 그림자만 남음
      g.setTransform(res, 0, 0, res, (-BX0 - 1000) * res, -BY0 * res);
      g.shadowColor = 'rgba(8,10,14,.55)'; g.shadowBlur = 7 * res; g.shadowOffsetX = 1000 * res;
      g.fillStyle = '#000'; silhouette(g, type);
      return (shadow = c);
    }
    const idx = (roll) => {
      const p = ((roll || 0) / CIRC) * 3;           // 3갈래 무늬 → 한 바퀴에 3번 같은 모양
      return ((Math.floor((p - Math.floor(p)) * NPH) % NPH) + NPH) % NPH;
    };
    const L = {
      type, color, num,
      W: BW * U, H: BH * U, ax: -BX0 / BW, ay: -BY0 / BH,
      frame(roll) { return frameAt(idx(roll)); },
      get shadow() { return shadowCanvas(); },
      tex(roll) {
        const P = root.PIXI; if (!P) return null;
        const i = idx(roll);
        return texs[i] || (texs[i] = P.Texture.from(frameAt(i)));
      },
      shadowTex() {
        const P = root.PIXI; if (!P) return null;
        return shadowTex || (shadowTex = P.Texture.from(shadowCanvas()));
      }
    };
    LOOKS.set(key, L);
    return L;
  }

  // 캔버스 2D에 그리기 (그림자 → 휠체어). 그림자는 세계 기준 오른쪽 아래로 비킴.
  function draw(g, L, x, y, a, roll, opt) {
    const sx = (opt && opt.shadow !== undefined) ? opt.shadow : 1;
    const w = L.W, h = L.H, ox = -L.ax * w, oy = -L.ay * h;
    if (sx) {
      g.save(); g.translate(x + 0.1 * sx, y + 0.16 * sx); g.rotate(a);
      g.globalAlpha *= 0.8; g.drawImage(L.shadow, ox, oy, w, h); g.restore();
    }
    g.save(); g.translate(x, y); g.rotate(a);
    g.drawImage(L.frame(roll), ox, oy, w, h);
    g.restore();
  }

  // 굴러간 거리 누적: 앞뒤 이동 + 제자리 회전(바퀴 반지름만큼)
  function roll(st, x, y, a) {
    if (!st.init) { st.init = true; st.x = x; st.y = y; st.a = a; st.d = 0; return 0; }
    const dx = x - st.x, dy = y - st.y;
    let da = a - st.a; da = Math.atan2(Math.sin(da), Math.cos(da));
    const fwd = dx * Math.cos(a) + dy * Math.sin(a);
    const side = Math.hypot(dx, dy);
    const mv = Math.abs(fwd) > side * 0.3 ? fwd : side;   // 뒤로 가면 바퀴도 거꾸로
    st.d += mv + Math.abs(da) * 0.35;
    st.x = x; st.y = y; st.a = a;
    return st.d;
  }

  /* ---------- 나무 코트 바닥 ---------- */
  const FLOORS = new Map();
  function prng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function floor(o) {
    o = o || {};
    const x0 = o.x0 ?? -1, y0 = o.y0 ?? -1, x1 = o.x1 ?? 29, y1 = o.y1 ?? 16;
    let px = o.px || 64;
    px = Math.min(px, 4096 / (x1 - x0));
    const key = [x0, y0, x1, y1, Math.round(px)].join('|');
    if (FLOORS.has(key)) return FLOORS.get(key);
    const W = Math.round((x1 - x0) * px), H = Math.round((y1 - y0) * px);
    const c = canvas(W, H), g = c.getContext('2d');
    g.setTransform(px, 0, 0, px, -x0 * px, -y0 * px);
    const rnd = prng(20261113);
    const plank = 0.19, gap = 0.012;
    // 코트 바깥(런오프): 진하게 칠한 나무 / 코트 안: 밝은 메이플
    function planks(rx0, ry0, rx1, ry1, base, vary) {
      g.save(); g.beginPath(); g.rect(rx0, ry0, rx1 - rx0, ry1 - ry0); g.clip();
      for (let y = Math.floor(ry0 / plank) * plank; y < ry1; y += plank) {
        let x = rx0 - rnd() * 2.5;
        while (x < rx1) {
          const len = 1.1 + rnd() * 2.2;
          const k = (rnd() - 0.5) * vary;
          const col = base.map((v) => Math.max(0, Math.min(255, Math.round(v * (1 + k)))));
          const gr = g.createLinearGradient(0, y, 0, y + plank);
          gr.addColorStop(0, css(tint(col, 0.06))); gr.addColorStop(1, css(shade(col, 0.05)));
          g.fillStyle = gr; g.fillRect(x, y, len, plank);
          // 끝 이음새
          g.fillStyle = css(shade(base, 0.45), 0.35); g.fillRect(x + len - gap / 2, y, gap, plank);
          x += len;
        }
        g.fillStyle = css(shade(base, 0.45), 0.3); g.fillRect(rx0, y + plank - gap / 2, rx1 - rx0, gap);
      }
      g.restore();
    }
    planks(x0, y0, x1, y1, [176, 124, 74], 0.10);       // 런오프
    planks(0, 0, 28, 15, [226, 190, 140], 0.05);         // 코트
    // 코트 경계 안쪽 은은한 그늘 + 바니시 광택
    const sh = g.createRadialGradient(14, 6, 2, 14, 7.5, 20);
    sh.addColorStop(0, 'rgba(255,248,235,.20)'); sh.addColorStop(0.55, 'rgba(255,248,235,0)'); sh.addColorStop(1, 'rgba(60,35,10,.16)');
    g.fillStyle = sh; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const gl = g.createLinearGradient(x0, y0, x1, y1);
    gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.42, 'rgba(255,255,255,.07)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)');
    gl.addColorStop(0.7, 'rgba(255,255,255,.05)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const out = { canvas: c, x0, y0, w: x1 - x0, h: y1 - y0 };
    FLOORS.set(key, out);
    return out;
  }

  root.RugbyChairs = { look, draw, roll, floor, U, NPH, CIRC };
})(typeof window !== 'undefined' ? window : globalThis);

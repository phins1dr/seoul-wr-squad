/* 퀴즈 케이스 장면 재생기 — PixiJS
   엔진(rugby-brain.js)은 건드리지 않고, 게임과 같은 코트 색·라인·휠체어 그림·비율만 그대로 가져왔다.
   장면 데이터(JSON)의 좌표계는 게임과 같다: x 0→28(공격 방향), y 0→15, 단위 m. */
(function (root) {
  'use strict';

  const W = 28, H = 15, PAD = 1.9;   // 밖으로 나가는 선수·설명 라벨까지 보이도록 여백을 둔다
  const CW = W + PAD * 2, CH = H + PAD * 2;
  const TEAMCOL = { A: '#4a90d9', B: '#ff2a2a' };
  const FONT = '"Gothic A1","Apple SD Gothic Neo","Malgun Gothic",-apple-system,sans-serif';
  const hex = (c) => parseInt(c.slice(1), 16);

  function ease(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function shortAngle(a, b, t) {
    let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  }

  function drawCourt(g) {
    // 바닥 나무는 RugbyChairs.floor 스프라이트가 깐다 (create 안에서)
    // 키 에어리어·센터서클 음영
    g.lineStyle(0);
    g.beginFill(0x1b2230, 0.10)
      .drawRect(0, 7.5 - 4.8, 2.3, 9.6)
      .drawRect(W - 2.3, 7.5 - 4.8, 2.3, 9.6)
      .drawCircle(14, 7.5, 2.2).endFill();
    // 라인
    g.lineStyle(0.08, 0x2a2f36, 1)
      .drawRect(0, 0, W, H)
      .moveTo(14, 0).lineTo(14, H)
      .drawCircle(14, 7.5, 2.2)
      .drawRect(0, 7.5 - 4.8, 2.3, 9.6)
      .drawRect(W - 2.3, 7.5 - 4.8, 2.3, 9.6);
    // 트라이 라인 (포스트 사이)
    g.lineStyle(0.14, 0xffffff, 0.55)
      .moveTo(0, 7.5 - 4).lineTo(0, 7.5 + 4)
      .moveTo(W, 7.5 - 4).lineTo(W, 7.5 + 4);
    // 포스트
    g.lineStyle(0);
    for (const gx of [0, W]) for (const gy of [7.5 - 4.8, 7.5 + 4.8]) {
      g.beginFill(0xff6a1a).drawCircle(gx, gy, 0.26).endFill();
      g.beginFill(0xffffff).drawCircle(gx, gy, 0.1).endFill();
    }
  }

  function dashedCircle(g, cx, cy, r, color, width, alpha) {
    const seg = 26, len = (Math.PI * 2) / seg;
    for (let i = 0; i < seg; i += 2) {
      g.lineStyle(width, color, alpha);
      g.moveTo(cx + Math.cos(i * len) * r, cy + Math.sin(i * len) * r);
      g.arc(cx, cy, r, i * len, (i + 1) * len);
    }
  }

  function drawHighlight(g, list) {
    if (!list) return;
    for (const h of list) {
      const col = h.color === 'focus' ? 0xff6a1a : 0xffffff;
      if (h.type === 'key') {
        const x = h.side === 'left' ? 0 : W - 2.3;
        g.lineStyle(0).beginFill(col, 0.16).drawRect(x, 7.5 - 4.8, 2.3, 9.6).endFill();
        g.lineStyle(0.09, col, 0.75).drawRect(x, 7.5 - 4.8, 2.3, 9.6);
      } else if (h.type === 'circle') {
        dashedCircle(g, h.x, h.y, h.r || 1, col, 0.075, 0.85);
      } else if (h.type === 'line') {
        g.lineStyle(0.22, col, 0.5).moveTo(h.x1, h.y1).lineTo(h.x2, h.y2);
      }
    }
  }

  function create(host, canvas, data, opts) {
    opts = opts || {};
    const app = new PIXI.Application({
      view: canvas,
      antialias: true,
      resolution: Math.min(root.devicePixelRatio || 1, 2.5),
      autoDensity: true,
      backgroundColor: 0x0c1016,
      backgroundAlpha: 1
    });
    PIXI.GRAPHICS_CURVES.minSegments = 40;
    PIXI.GRAPHICS_CURVES.adaptive = false;

    const world = new PIXI.Container();
    app.stage.addChild(world);
    const court = new PIXI.Graphics();
    const hi = new PIXI.Graphics();
    const under = new PIXI.Container();
    const chairs = new PIXI.Container();
    const ballG = new PIXI.Container();
    // 나무 코트 바닥 (엔진 공용 그림)
    const FL = root.RugbyChairs.floor({ x0: -PAD, y0: -PAD, x1: W + PAD, y1: H + PAD, px: 72 });
    const floorSpr = new PIXI.Sprite(PIXI.Texture.from(FL.canvas));
    floorSpr.position.set(FL.x0, FL.y0); floorSpr.width = FL.w; floorSpr.height = FL.h;
    world.addChild(floorSpr, court, hi, under, chairs, ballG);
    drawCourt(court);
    drawHighlight(hi, data.highlight);

    const ui = new PIXI.Container();
    app.stage.addChild(ui);

    let S = 12, ox = PAD * S, oy = PAD * S;
    const w2s = (x, y) => ({ sx: ox + x * S, sy: oy + y * S });

    const actors = new Map();

    // 휠체어 그림: 엔진 공용 RugbyChairs.look (선수별 팀색·등번호, 바퀴 회전 그림)
    const ball = new PIXI.Graphics().lineStyle(0.045, 0x222222, 1).beginFill(0xffffff).drawCircle(0, 0, 0.3).endFill();
    const ballSh = new PIXI.Graphics().beginFill(0x000000, 0.22).drawEllipse(0, 0, 0.32, 0.24).endFill();
    ballG.addChild(ballSh, ball);

    function makeActor(a) {
      const look = root.RugbyChairs.look({ type: a.chair || (a.team === 'B' ? 'D' : 'A'), color: TEAMCOL[a.team] || TEAMCOL.A, num: a.num !== undefined ? a.num : a.id });
      const shadow = new PIXI.Sprite(look.shadowTex());
      shadow.anchor.set(look.ax, look.ay); shadow.width = look.W; shadow.height = look.H; shadow.alpha = 0.8;
      under.addChild(shadow);
      const c = new PIXI.Container();
      const spr = new PIXI.Sprite(look.tex(0));
      spr.anchor.set(look.ax, look.ay);
      spr.width = look.W; spr.height = look.H;
      c.addChild(spr);
      chairs.addChild(c);
      const label = new PIXI.Text(a.id, new PIXI.TextStyle({ fontFamily: FONT, fontWeight: '800', fontSize: 14, fill: '#ffffff' }));
      label.resolution = Math.min(root.devicePixelRatio || 1, 2) * 2;
      label.anchor.set(0.5);
      const bg = new PIXI.Graphics();
      ui.addChild(bg, label);
      const v = { ...a, c, spr, shadow, label, bg, look, rs: {} };
      actors.set(a.id, v);
      return v;
    }
    (data.actors || []).forEach(makeActor);

    // 장면 안 태그(설명 라벨) — 화면 좌표로 그려 작아져도 읽히게
    const tags = (data.markers || []).filter((m) => m.type === 'tag').map((m) => {
      const t = new PIXI.Text(m.text, new PIXI.TextStyle({ fontFamily: FONT, fontWeight: '700', fontSize: 12.5, fill: '#fff2e6', lineHeight: 16 }));
      t.resolution = Math.min(root.devicePixelRatio || 1, 2) * 2;
      t.anchor.set(0.5);
      const bg = new PIXI.Graphics();
      ui.addChild(bg, t);
      return { ...m, t, bg };
    });
    const dots = (data.markers || []).filter((m) => m.type === 'dot').map((m) => {
      const g = new PIXI.Graphics().lineStyle(0.05, 0x10151c, 1).beginFill(0xffd84a).drawCircle(0, 0, 0.2).endFill();
      g.position.set(m.x, m.y);
      world.addChild(g);
      const t = new PIXI.Text(m.label || '', new PIXI.TextStyle({ fontFamily: FONT, fontWeight: '800', fontSize: 12.5, fill: '#ffe9a8' }));
      t.resolution = Math.min(root.devicePixelRatio || 1, 2) * 2;
      t.anchor.set(0.5, 1);
      const bg = new PIXI.Graphics();
      ui.addChild(bg, t);
      return { ...m, g, t, bg };
    });

    // 키프레임 계산
    const steps = (data.steps || [{ at: 0, caption: '' }]).slice().sort((a, b) => a.at - b.at);
    const keys = [];
    let cur = { pos: {}, face: {}, ball: data.ball ? { x: data.ball.x || 0, y: data.ball.y || 0, holder: data.ball.holder || null } : null };
    for (const a of data.actors || []) {
      cur.pos[a.id] = [a.x, a.y];
      cur.face[a.id] = a.a || 0;
    }
    if (data.ball && data.ball.holder && cur.pos[data.ball.holder]) {
      cur.ball.x = cur.pos[data.ball.holder][0];
      cur.ball.y = cur.pos[data.ball.holder][1];
    }
    for (const s of steps) {
      const st = { pos: {}, face: {}, ball: cur.ball ? { ...cur.ball } : null, caption: s.caption || '' };
      for (const id in cur.pos) st.pos[id] = cur.pos[id].slice();
      for (const id in cur.face) st.face[id] = cur.face[id];
      if (s.move) for (const id in s.move) if (st.pos[id]) st.pos[id] = s.move[id].slice();
      if (s.face) for (const id in s.face) st.face[id] = s.face[id];
      if (s.ball) {
        if (Array.isArray(s.ball)) { st.ball = { x: s.ball[0], y: s.ball[1], holder: null }; }
        else {
          const h = s.ball.holder !== undefined ? s.ball.holder : (st.ball ? st.ball.holder : null);
          st.ball = { x: h && st.pos[h] ? st.pos[h][0] : (st.ball ? st.ball.x : 14), y: h && st.pos[h] ? st.pos[h][1] : (st.ball ? st.ball.y : 7.5), holder: h };
        }
      }
      st.at = s.at || 0;
      keys.push(st);
      cur = st;
    }
    const dur = data.duration || (keys.length ? keys[keys.length - 1].at + 2 : 4);

    // 보간된 상태
    function stateAt(t) {
      let i = 0;
      while (i < keys.length - 1 && keys[i + 1].at <= t) i++;
      const k0 = keys[i], k1 = keys[Math.min(i + 1, keys.length - 1)];
      const span = Math.max(0.001, k1.at - k0.at);
      const u = t <= k0.at ? 0 : Math.min(1, (t - k0.at) / span);
      const e = ease(u);
      const pos = {}, face = {};
      for (const id in k0.pos) {
        const p0 = k0.pos[id], p1 = k1.pos[id] || p0;
        pos[id] = [lerp(p0[0], p1[0], e), lerp(p0[1], p1[1], e)];
        const f0 = k0.face[id] || 0, f1 = k1.face[id] !== undefined ? k1.face[id] : f0;
        face[id] = Math.abs(f0 - f1) > 3 ? f0 : shortAngle(f0, f1, e);
      }
      let b = k0.ball;
      if (k0.ball && k1.ball) b = { x: lerp(k0.ball.x, k1.ball.x, e), y: lerp(k0.ball.y, k1.ball.y, e), holder: u < 0.5 ? k0.ball.holder : k1.ball.holder };
      return { pos, face, ball: b, caption: (t >= k1.at ? k1.caption : k0.caption) };
    }

    function resize() {
      const rect = host.getBoundingClientRect();
      const w = Math.max(200, Math.round(rect.width));
      const h = Math.round((w * CH) / CW);
      app.renderer.resize(w, h);
      S = w / CW;
      ox = PAD * S; oy = PAD * S;
      world.position.set(0, 0);
      world.scale.set(S, S);
      canvas.style.height = h + 'px';
    }

    let t = 0, playing = true, last = performance.now();
    let caption = '';

    function layoutTags(tnow) {
      for (const m of tags) {
        const show = (m.showAt === undefined || tnow >= m.showAt) && (m.hideAt === undefined || tnow < m.hideAt);
        m.t.visible = m.bg.visible = show;
        if (!show) continue;
        const p = w2s(m.x, m.y);
        m.t.position.set(p.sx, p.sy);
        const w = m.t.width + 14, h = m.t.height + 8;
        m.bg.clear().beginFill(0x10151c, 0.82).drawRoundedRect(p.sx - w / 2, p.sy - h / 2, w, h, 7).endFill();
      }
      for (const m of dots) {
        const show = m.showAt === undefined || tnow >= m.showAt;
        m.g.visible = m.t.visible = m.bg.visible = show;
        if (!show) continue;
        const p = w2s(m.x, m.y);
        const ty = p.sy - 12;
        m.t.position.set(p.sx, ty);
        const w = m.t.width + 12, h = m.t.height + 6;
        m.bg.clear().beginFill(0x10151c, 0.82).drawRoundedRect(p.sx - w / 2, ty - h, w, h, 6).endFill();
      }
    }

    function frame() {
      const now = performance.now();
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      if (playing) {
        t += dt;
        if (t > dur + 1.3) t = 0;
      }
      const st = stateAt(t);
      caption = st.caption;
      for (const [id, v] of actors) {
        const p = st.pos[id] || [v.x, v.y];
        const a = st.face[id] || 0;
        v.c.position.set(p[0], p[1]);
        v.c.rotation = a;
        v.spr.texture = v.look.tex(root.RugbyChairs.roll(v.rs, p[0], p[1], a));
        v.shadow.position.set(p[0] + 0.1, p[1] + 0.16);
        v.shadow.rotation = a;
        const s = w2s(p[0], p[1]);
        const ly = s.sy - Math.max(20, 0.78 * S);
        v.label.position.set(s.sx, ly);
        const w = v.label.width + 10, h = v.label.height + 4;
        v.bg.clear().beginFill(hex(TEAMCOL[v.team] || TEAMCOL.A), 0.95).drawRoundedRect(s.sx - w / 2, ly - h / 2, w, h, 5).endFill();
      }
      if (st.ball) {
        let bx = st.ball.x, by = st.ball.y;
        if (st.ball.holder && st.pos[st.ball.holder]) {
          const p = st.pos[st.ball.holder], a = st.face[st.ball.holder] || 0;
          bx = p[0] + Math.cos(a) * 0.55;
          by = p[1] + Math.sin(a) * 0.55;
        }
        ball.position.set(bx, by);
        ballSh.position.set(bx + 0.1, by + 0.14);
        ball.visible = ballSh.visible = true;
      } else {
        ball.visible = ballSh.visible = false;
      }
      layoutTags(t);
      if (opts.onCaption) opts.onCaption(caption);
    }

    app.ticker.add(frame);
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    return {
      resize,
      replay() { t = 0; playing = true; last = performance.now(); },
      pause() { playing = false; },
      play() { playing = true; last = performance.now(); },
      destroy() {
        try { ro.disconnect(); } catch (e) {}
        app.ticker.remove(frame);
        app.destroy(true, { children: true, texture: false, baseTexture: false });
      }
    };
  }

  root.QuizScene = { create };
})(typeof window !== 'undefined' ? window : globalThis);

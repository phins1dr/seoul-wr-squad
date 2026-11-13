/* 배지 그림 — SVG로 직접 그린다 (이미지 파일 없음)
   window.BadgeArt.svg(def, got, uid) → SVG 문자열
   def = { shape:'medal'|'star'|'hex'|'shield', c:[밝은색, 짙은색], glyph, label }
   got=false면 회색 실루엣 + 자물쇠. */
(function () {
  'use strict';
  const W = '#ffffff';

  function star(cx, cy, r, r2, n) {
    n = n || 5; r2 = r2 || r * 0.45;
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r2 : r;
      d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
    }
    return d + 'Z';
  }
  function poly(cx, cy, r, n, rot) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = (rot || 0) + (i * 2 * Math.PI) / n;
      d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
    }
    return d + 'Z';
  }
  /* 월계수 잎 (양쪽) */
  function laurel(col) {
    let s = '';
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * (0.62 + i * 0.1);
        const x = 50 + side * 25 * Math.cos(a) * -1, y = 52 + 25 * Math.sin(a) * 1;
        const rot = (side < 0 ? 180 - (a * 180) / Math.PI : (a * 180) / Math.PI) + (side < 0 ? 35 : -35);
        s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2.6" ry="5.4" fill="${col}" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
      }
    }
    return s;
  }

  /* 가운데 그림 (흰 선·면) */
  function glyph(g, col) {
    const st = `fill="none" stroke="${col}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"`;
    switch (g) {
      case 'stars1': return `<path d="${star(50, 48, 13)}" fill="${col}"/>`;
      case 'stars2': return `<path d="${star(41, 48, 10)}" fill="${col}"/><path d="${star(59, 48, 10)}" fill="${col}"/>`;
      case 'globe': return `<g ${st}><circle cx="50" cy="48" r="14"/><ellipse cx="50" cy="48" rx="6" ry="14"/><path d="M36 48h28M38 41h24M38 55h24" stroke-width="2.4"/></g>`;
      case 'laurel': return `${laurel(col)}<g ${st}><circle cx="50" cy="47" r="10.5"/><ellipse cx="50" cy="47" rx="4.5" ry="10.5" stroke-width="2.4"/><path d="M39.5 47h21" stroke-width="2.4"/></g>`;
      case 'crown': return `<path d="M33 57l-3-19 11 8 9-13 9 13 11-8-3 19z" fill="${col}"/><rect x="33" y="59" width="34" height="5" rx="1.5" fill="${col}"/><circle cx="50" cy="51" r="2.6" fill="rgba(0,0,0,.25)"/>`;
      case 'wheel': return `<g ${st}><circle cx="50" cy="48" r="15"/><circle cx="50" cy="48" r="3.4" fill="${col}"/><path d="M50 33v30M35 48h30M39.4 37.4l21.2 21.2M60.6 37.4L39.4 58.6" stroke-width="2.2"/></g>`;
      case 'clock': return `<g ${st}><circle cx="50" cy="48" r="15"/><path d="M50 39v9l6 5"/><path d="M45 29h10" /></g>`;
      case 'ball': return `<g ${st}><circle cx="50" cy="48" r="15"/><path d="M36 43c9 3 19 3 28 0M36 53c9-3 19-3 28 0M50 33c-5 9-5 21 0 30" stroke-width="2.4"/></g>`;
      case 'eight': return `<text x="50" y="58" text-anchor="middle" font-family="Do Hyeon, sans-serif" font-size="34" fill="${col}">8</text><path d="M66 35a20 20 0 0 1 0 26" ${st} stroke-width="2.4"/>`;
      case 'whistle': return `<g ${st}><circle cx="44" cy="52" r="10"/><path d="M50 43h17v8h-9"/><circle cx="44" cy="52" r="3" fill="${col}"/></g>`;
      case 'T': return `<text x="50" y="60" text-anchor="middle" font-family="Do Hyeon, sans-serif" font-size="36" fill="${col}">T</text>`;
      case 'hourglass': return `<g ${st}><path d="M39 33h22M39 63h22"/><path d="M42 33c0 10 16 11 16 15s-16 5-16 15M58 33c0 10-16 11-16 15s16 5 16 15"/></g><path d="M45 61c2-4 8-4 10 0z" fill="${col}"/>`;
      case 'trophy': return `<path d="M39 32h22v9a11 11 0 0 1-22 0z" fill="${col}"/><path d="M39 35h-6a6 6 0 0 0 7 8M61 35h6a6 6 0 0 1-7 8" ${st} stroke-width="2.6"/><rect x="47" y="51" width="6" height="7" fill="${col}"/><rect x="40" y="58" width="20" height="5" rx="1.5" fill="${col}"/>`;
      case 'flame': return `<path d="M50 29c5 9 15 14 15 27a15 15 0 0 1-30 0c0-7 4-11 7-16 2 5 4 7 7 8-2-7-2-13 1-19z" fill="${col}"/><path d="M50 50c3 4 6 6 6 10a6 6 0 0 1-12 0c0-4 3-6 6-10z" fill="rgba(0,0,0,.18)"/>`;
      case 'target': return `<g fill="none" stroke="${col}" stroke-width="3.4"><circle cx="50" cy="48" r="15"/><circle cx="50" cy="48" r="9"/></g><circle cx="50" cy="48" r="3.6" fill="${col}"/><path d="M50 48l15-15M60 33h5v5" stroke="${col}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
      case 'book': return `<g ${st}><path d="M50 37c-5-4-11-4-16-2v26c5-2 11-2 16 2 5-4 11-4 16-2V35c-5-2-11-2-16 2z"/><path d="M50 37v26" stroke-width="2.4"/></g>`;
      default: return '';
    }
  }

  function shapePath(shape) {
    if (shape === 'hex') return poly(50, 48, 36, 6, Math.PI / 6);
    if (shape === 'shield') return 'M50 10l32 10v24c0 21-14 36-32 44C32 80 18 65 18 44V20z';
    if (shape === 'star') return star(50, 48, 40, 33, 12);
    return null; // medal = circle
  }

  function svg(def, got, uid) {
    const id = 'b' + (uid || def.id || Math.random().toString(36).slice(2));
    const c1 = got ? def.c[0] : '#e3e7ec', c2 = got ? def.c[1] : '#b9c1cb';
    const gcol = got ? W : '#f6f8fa';
    const shape = def.shape || 'medal';
    const sp = shapePath(shape);
    let out = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true" class="badge-svg">
<defs>
  <linearGradient id="${id}g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
  <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".25"/><stop offset="1" stop-color="#ffffff" stop-opacity=".7"/></linearGradient>
  <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>`;
    // 메달 리본 꼬리
    if (shape === 'medal' || shape === 'star') {
      out += `<path d="M34 70l-8 24 10-5 6 9 6-22z" fill="${c2}" opacity="${got ? 1 : .7}"/><path d="M66 70l8 24-10-5-6 9-6-22z" fill="${c2}" opacity="${got ? 1 : .7}"/>`;
    }
    if (sp) {
      out += `<path d="${sp}" fill="url(#${id}g)"/><path d="${sp}" fill="none" stroke="url(#${id}r)" stroke-width="2.4"/>`;
      if (shape === 'hex') out += `<path d="${poly(50, 48, 29, 6, Math.PI / 6)}" fill="none" stroke="${W}" stroke-opacity=".35" stroke-width="1.4"/>`;
      if (shape === 'shield') out += `<path d="M50 17l25 8v19c0 17-11 29-25 36-14-7-25-19-25-36V25z" fill="none" stroke="${W}" stroke-opacity=".35" stroke-width="1.4"/>`;
      if (shape === 'star') out += `<circle cx="50" cy="48" r="27" fill="none" stroke="${W}" stroke-opacity=".45" stroke-width="1.6"/>`;
    } else {
      out += `<circle cx="50" cy="48" r="36" fill="url(#${id}g)"/><circle cx="50" cy="48" r="36" fill="none" stroke="url(#${id}r)" stroke-width="2.6"/>
<circle cx="50" cy="48" r="29" fill="none" stroke="${W}" stroke-opacity=".35" stroke-width="1.4" stroke-dasharray="2 3"/>`;
    }
    // 위쪽 광택
    out += `<ellipse cx="50" cy="28" rx="24" ry="13" fill="url(#${id}s)"/>`;
    out += glyph(def.glyph, gcol);
    // 아래 리본 띠
    if (def.label) {
      const w = Math.max(26, def.label.length * 7 + 12);
      out += `<rect x="${50 - w / 2}" y="66" width="${w}" height="13" rx="3" fill="${got ? '#10151c' : '#9aa4b0'}" opacity=".88"/>
<text x="50" y="75.6" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="8.4" letter-spacing=".6" fill="#fff">${def.label}</text>`;
    }
    if (!got) {
      out += `<g transform="translate(78 20)"><circle r="11" fill="#fff" stroke="#c4ccd6" stroke-width="1.4"/><rect x="-4.6" y="-1.6" width="9.2" height="7.4" rx="1.6" fill="#8a96a5"/><path d="M-3 -1.6v-2.4a3 3 0 0 1 6 0v2.4" fill="none" stroke="#8a96a5" stroke-width="1.8"/></g>`;
    }
    return out + '</svg>';
  }

  window.BadgeArt = { svg };
})();

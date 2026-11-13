/* 휠체어럭비 3D — 럭비두뇌(engine/rugby-brain.js)가 움직이고, 이 파일은 그리기만 한다.
   좌표: 엔진 x 0→28(공격 방향), y 0→15  →  3D x = x-14, z = y-7.5, 높이 y.
   엔진 각도 a(0=공격 방향, xy평면) → 3D rotation.y = -a.
   휠체어 생김새는 engine/rugby-chairs.js(2D)의 디자인을 실제 크기로 옮긴 것.
   A1(3.0)만 선수 몸 샘플: 손이 핸드림에 붙어서(IK) 바퀴 회전에 맞춰 밀고·놓고·돌아옴.
   모드 (?mode=): 관전(기본) / play = 우리팀 한 명을 사람이 조종 — 2D 게임(rugby-game)과 같은 RugbyBrain.match() 사용,
   나머지 7명·규정·점수는 엔진이 함. 플레이에선 공수·전후반에 따라 코트를 뒤집어 그림(FL). */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const RB = window.RugbyBrain;
const CS = window.RugbyCourt.SPEC;              // 코트 규격: 엔진 공용 부품 (engine/rugby-court.js)
const CL = CS.L, CW = CS.W, KD = CS.key.d, KW = CS.key.w, CR = CS.circleR, GW = CS.goalW;                         // 코트
const MODE = new URLSearchParams(location.search).get('mode') === 'play' ? 'play' : 'watch', PLAY = MODE === 'play';
let FL = 1;                                      // 플레이: 1 = 엔진 공격 방향이 화면 오른쪽, -1 = 왼쪽 (M.flip)
const toW = (x, y, h = 0) => new THREE.Vector3(FL * (x - CL / 2), h, FL * (y - CW / 2));
const BLUE = 0x2f81f7, RED = 0xf04a42;

/* ---------- 렌더러 ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07090d);
scene.fog = new THREE.Fog(0x07090d, 38, 80);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 220);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.485; controls.minDistance = 0.8; controls.maxDistance = 60;

/* ---------- 텍스처 (전부 코드로) ---------- */
function cvs(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep, srgb = true) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);

function woodCourt() {                          // 메이플 마루 + 코트 라인
  const s = 80, [c, g] = cvs(CL * s, CW * s), ph = 7;
  for (let y = 0; y < c.height; y += ph) {
    let x = -rnd(0, 160);
    while (x < c.width) {
      const len = rnd(110, 260), l = rnd(57, 67), hue = rnd(29, 35);
      g.fillStyle = `hsl(${hue},${rnd(40, 52)}%,${l}%)`; g.fillRect(x, y, len, ph);
      g.globalAlpha = .12; g.fillStyle = '#7a4a1e';
      for (let k = 0; k < 3; k++) g.fillRect(x + rnd(0, len), y + rnd(0, ph - 1), rnd(20, 70), 1);
      g.globalAlpha = 1; g.fillStyle = 'rgba(70,40,15,.35)'; g.fillRect(x, y, 1, ph);
      x += len;
    }
    g.fillStyle = 'rgba(70,40,15,.22)'; g.fillRect(0, y, c.width, 1);
  }
  g.fillStyle = 'rgba(25,70,150,.62)';         // 키 에어리어
  const ky = (CW / 2 - KW / 2) * s;
  g.fillRect(0, ky, KD * s, KW * s); g.fillRect((CL - KD) * s, ky, KD * s, KW * s);
  g.strokeStyle = '#f8f8f4'; g.lineWidth = CS.lineW * s;
  g.strokeRect(2, 2, c.width - 4, c.height - 4);
  g.beginPath(); g.moveTo(CL / 2 * s, 0); g.lineTo(CL / 2 * s, c.height); g.stroke();
  g.beginPath(); g.arc(CL / 2 * s, CW / 2 * s, CR * s, 0, Math.PI * 2); g.stroke();
  g.strokeRect(0, ky, KD * s, KW * s); g.strokeRect((CL - KD) * s, ky, KD * s, KW * s);
  g.strokeStyle = '#ffd33d'; g.lineWidth = 0.08 * s;  // 골라인 (콘 사이)
  [0, CL * s].forEach(x => { g.beginPath(); g.moveTo(x, (CW / 2 - GW / 2) * s); g.lineTo(x, (CW / 2 + GW / 2) * s); g.stroke(); });
  g.save(); g.globalAlpha = .18; g.fillStyle = '#ffffff'; g.font = `900 ${1.1 * s}px "Malgun Gothic",system-ui`; // 센터 로고
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SEOUL WR', CL / 2 * s, CW / 2 * s); g.restore();
  return tex(c);
}
function brushed() {                            // 금속 헤어라인 결 (거칠기 맵)
  const [c, g] = cvs(256, 256); g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) { const v = rnd(110, 200) | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.globalAlpha = .35; g.fillRect(rnd(-50, 256), rnd(0, 256), rnd(30, 160), 1); }
  return tex(c, [3, 1], false);
}
function tread() {                              // 타이어 트레드 (범프)
  const [c, g] = cvs(512, 32); g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 32);
  g.fillStyle = '#3a3a3a'; for (let x = 0; x < 512; x += 8) g.fillRect(x, 6, 2, 20);
  g.fillStyle = '#c0c0c0'; g.fillRect(0, 14, 512, 3);
  return tex(c, [6, 1], false);
}
function stitch() {                             // 방석 박음질
  const [c, g] = cvs(256, 256); g.fillStyle = '#ececec'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; g.setLineDash([9, 7]);
  g.strokeRect(16, 16, 224, 224); g.beginPath(); g.moveTo(128, 16); g.lineTo(128, 240); g.stroke();
  g.setLineDash([]); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(24, 24, 96, 208);
  return tex(c);
}
const T = { brushed: brushed(), tread: tread(), stitch: stitch() };

/* ---------- 경기장 조명 반사 환경 ---------- */
{
  const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(60, 30, 60), new THREE.MeshBasicMaterial({ color: 0x1a1f2a, side: THREE.BackSide })));
  for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    p.position.set(i * 8, 14, j * 7); p.rotation.x = Math.PI / 2; env.add(p);
  }
  const warm = new THREE.Mesh(new THREE.PlaneGeometry(50, 6), new THREE.MeshBasicMaterial({ color: 0x5a4630 }));
  warm.position.set(0, 2, -29); env.add(warm);
  scene.environment = pm.fromScene(env, 0.03).texture;
}
// 어두운 경기장: 코트만 스포트라이트 2개로 비추고, 관중석은 빛이 거의 안 닿게 (중계 화면처럼 휠체어가 주인공)
scene.add(new THREE.HemisphereLight(0x9fb4e0, 0x1a120a, 0.22));
const spill = new THREE.DirectionalLight(0x8fa6d8, 0.35); spill.position.set(0, 20, 0); scene.add(spill);   // 관중석에 번지는 아주 약한 빛
[-7, 7].forEach(x => {
  const sp = new THREE.SpotLight(0xfff4e6, 1500, 60, 0.47, 0.45, 2);
  sp.position.set(x, 24, 1.5); sp.target.position.set(x, 0, 0);
  sp.castShadow = true; sp.shadow.mapSize.set(2048, 2048); sp.shadow.bias = -0.0002; sp.shadow.normalBias = 0.02;
  sp.shadow.camera.near = 10; sp.shadow.camera.far = 40;
  scene.add(sp, sp.target);
});
const DIM = 0.12;                                // 관중석 쪽 재질의 환경 반사 세기

/* ---------- 코트·경기장 ---------- */
const court = new THREE.Mesh(new THREE.PlaneGeometry(CL, CW), new THREE.MeshPhysicalMaterial({ map: woodCourt(), roughness: .42, clearcoat: .7, clearcoatRoughness: .12 }));
court.rotation.x = -Math.PI / 2; court.receiveShadow = true; scene.add(court);
const runoff = new THREE.Mesh(new THREE.PlaneGeometry(CL + 7, CW + 6), new THREE.MeshPhysicalMaterial({ color: 0x24324a, roughness: .5, clearcoat: .4, clearcoatRoughness: .25 }));
runoff.rotation.x = -Math.PI / 2; runoff.position.y = -0.004; runoff.receiveShadow = true; scene.add(runoff);
const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: .85 }));
hallFloor.rotation.x = -Math.PI / 2; hallFloor.position.y = -0.01; hallFloor.receiveShadow = true; scene.add(hallFloor);
[1, -1].forEach(sd => [GW / 2, -GW / 2].forEach(z => {      // 골 콘 (키 바깥 모서리)
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.48, 24), new THREE.MeshStandardMaterial({ color: 0xff7b00, roughness: .5 }));
  cone.position.set(sd * CL / 2, 0.24, z); cone.castShadow = true; scene.add(cone);
}));

// 관중석: 계단 + 의자(인스턴스) + 관중(인스턴스, 60% 정도 채움)
const STAND = { rows: 10, rise: 0.42, depth: 0.85, gap: 0.56 };
const seatSpots = [];
function stand(cx, cz, len, dirX, dirZ) {      // dir = 코트 바깥쪽 방향
  const g = new THREE.Group(), stepM = new THREE.MeshStandardMaterial({ color: 0x161a21, roughness: .85, envMapIntensity: DIM });
  const along = new THREE.Vector3(dirZ, 0, -dirX);
  for (let r = 0; r < STAND.rows; r++) {
    const h = STAND.rise * (r + 1), off = r * STAND.depth + STAND.depth / 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(dirX ? STAND.depth : len, h, dirX ? len : STAND.depth), stepM);
    b.position.set(cx + dirX * off, h / 2, cz + dirZ * off); b.receiveShadow = true; g.add(b);
    const n = Math.floor(len / STAND.gap);
    for (let i = 0; i < n; i++) {
      const t = (i - (n - 1) / 2) * STAND.gap;
      seatSpots.push({ p: new THREE.Vector3(cx + dirX * off + along.x * t, h, cz + dirZ * off + along.z * t), yaw: Math.atan2(-dirX, -dirZ) });
    }
  }
  scene.add(g);
}
stand(0, -(CW / 2 + 5.2), 40, 0, -1); stand(0, CW / 2 + 5.2, 40, 0, 1);
stand(-(CL / 2 + 5.2), 0, 24, -1, 0); stand(CL / 2 + 5.2, 0, 24, 1, 0);
{
  const n = seatSpots.length, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  const seatG = new THREE.BoxGeometry(0.46, 0.07, 0.42), backG = new THREE.BoxGeometry(0.46, 0.42, 0.06);
  const seatM = new THREE.MeshStandardMaterial({ color: 0x173a70, roughness: .6, envMapIntensity: DIM });
  const seats = new THREE.InstancedMesh(seatG, seatM, n), backs = new THREE.InstancedMesh(backG, seatM, n);
  const fans = seatSpots.filter(() => Math.random() < 0.6);
  const bodyG = new THREE.CapsuleGeometry(0.17, 0.32, 4, 8), headG = new THREE.SphereGeometry(0.11, 10, 8);
  const bodies = new THREE.InstancedMesh(bodyG, new THREE.MeshStandardMaterial({ roughness: .8, envMapIntensity: DIM }), fans.length);
  const heads = new THREE.InstancedMesh(headG, new THREE.MeshStandardMaterial({ roughness: .7, envMapIntensity: DIM }), fans.length);
  const shirts = [0x2f81f7, 0x2f81f7, 0xf04a42, 0xf0f0f0, 0x22262e, 0xffc83d, 0x3fb950, 0x8b5cf6, 0x6e7681];
  const skins = [0xe8c4a0, 0xd6a77a, 0xb98a5e, 0x8d6342, 0xf1d3b6];
  seatSpots.forEach((s, i) => {
    q.setFromAxisAngle(up, s.yaw);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);   // 관중이 보는 방향(코트 쪽)
    m4.compose(s.p.clone().add(new THREE.Vector3(0, 0.3, 0)), q, s1); seats.setMatrixAt(i, m4);
    m4.compose(s.p.clone().add(new THREE.Vector3(0, 0.5, 0)).addScaledVector(fwd, -0.2), q, s1); backs.setMatrixAt(i, m4);
  });
  fans.forEach((s, i) => {
    q.setFromAxisAngle(up, s.yaw + rnd(-.25, .25));
    const h = rnd(0.92, 1.08);
    m4.compose(s.p.clone().add(new THREE.Vector3(rnd(-.04, .04), 0.62 * h, 0)), q, new THREE.Vector3(1, h, 1)); bodies.setMatrixAt(i, m4);
    bodies.setColorAt(i, new THREE.Color(shirts[(Math.random() * shirts.length) | 0]).multiplyScalar(0.45));   // 어둠 속 실루엣
    m4.compose(s.p.clone().add(new THREE.Vector3(0, 1.08 * h, 0)), q, s1); heads.setMatrixAt(i, m4);
    heads.setColorAt(i, new THREE.Color(skins[(Math.random() * skins.length) | 0]).multiplyScalar(0.4));
  });
  [seats, backs, bodies, heads].forEach(m => { m.receiveShadow = true; scene.add(m); });
}

// LED 광고판: 6m짜리 광고 칸을 이어 붙이고, 칸마다 광고가 7초씩 바뀜 (실제 경기장 방식).
// 후원사가 생기면 ADS에 한 줄 추가하면 됨. 지금은 자리 표시용 광고.
const ADS = [
  { mark: 'WR', title: 'SEOUL WHEELCHAIR RUGBY', sub: '서울 휠체어럭비', bg: ['#071a3d', '#1550b8'], fg: '#ffffff', ac: '#58a6ff' },
  { mark: 'AD', title: '광고 문의', sub: '이 자리에 후원사 로고가 들어갑니다', bg: ['#0c0c0e', '#26262b'], fg: '#ffd33d', ac: '#ffd33d' },
  { mark: 'A', title: '휠체어럭비 아카데미', sub: '규정 · 용어 · 전술을 무료로', bg: ['#06291e', '#137a55'], fg: '#effff7', ac: '#3fe0a0' },
  { mark: 'AI', title: '럭비두뇌', sub: 'AI가 읽는 휠체어럭비', bg: ['#2a0820', '#8a1a58'], fg: '#ffffff', ac: '#ff7bc4' },
  { mark: 'FP', title: 'FAIR PLAY', sub: '존중 · 안전 · 페어플레이', bg: ['#2b1c02', '#a86a12'], fg: '#ffffff', ac: '#ffd27a' },
];
const adTex = ADS.map(ad => {
  const W = 1024, H = 154, [c, g] = cvs(W, H);
  const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, ad.bg[0]); gr.addColorStop(1, ad.bg[1]);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(W * .55, 0); g.lineTo(W * .72, 0); g.lineTo(W * .62, H); g.lineTo(W * .45, H); g.fill();   // 사선 하이라이트
  // 마크 (둥근 배지)
  g.fillStyle = ad.ac; g.beginPath(); g.arc(92, H / 2, 50, 0, Math.PI * 2); g.fill();
  g.fillStyle = ad.bg[0]; g.font = `900 ${ad.mark.length > 1 ? 40 : 52}px system-ui,"Malgun Gothic"`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ad.mark, 92, H / 2 + 3);
  // 글자
  g.textAlign = 'left'; g.fillStyle = ad.fg;
  let fs = 58; g.font = `900 ${fs}px "Malgun Gothic",system-ui`;
  while (g.measureText(ad.title).width > W - 200 && fs > 30) { fs -= 2; g.font = `900 ${fs}px "Malgun Gothic",system-ui`; }
  g.fillText(ad.title, 168, 62);
  g.globalAlpha = .78; g.font = '600 28px "Malgun Gothic",system-ui'; g.fillText(ad.sub, 170, 114); g.globalAlpha = 1;
  // LED 점 격자 (가까이 보면 전광판 느낌)
  g.fillStyle = 'rgba(0,0,0,.28)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H);
  return tex(c);
});
const adSlots = [];
const boardBody = new THREE.MeshStandardMaterial({ color: 0x0b0e13, roughness: .6 });
function ledBoard(len, x, z, yaw) {
  const n = Math.round(len / 6), w = len / n, g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const face = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: adTex[0], emissiveIntensity: 1.15, roughness: .35 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w - 0.05, 0.9, 0.12), [boardBody, boardBody, boardBody, boardBody, face, boardBody]);
    m.position.set(-len / 2 + w * (i + 0.5), 0, 0); m.castShadow = m.receiveShadow = true; g.add(m);
    adSlots.push({ face, k: adSlots.length });
  }
  g.position.set(x, 0.45, z); g.rotation.y = yaw; scene.add(g);
}
ledBoard(36, 0, -(CW / 2 + 3.1), 0);
ledBoard(18, -(CL / 2 + 3.4), 0, Math.PI / 2);
ledBoard(18, CL / 2 + 3.4, 0, -Math.PI / 2);
let adStep = -1;
function rotateAds(time) {
  const s = Math.floor(time / 7);
  if (s === adStep) return; adStep = s;
  adSlots.forEach(sl => { sl.face.emissiveMap = adTex[(sl.k + s) % ADS.length]; sl.face.needsUpdate = true; });
}
const boardTexs = [];

// 천장 조명 트러스 + 빛나는 판
{
  const trussM = new THREE.MeshStandardMaterial({ color: 0x3a404a, metalness: .7, roughness: .4 });
  const lightM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 2.2 });
  for (let i = -2; i <= 2; i++) {
    const tr = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 26), trussM); tr.position.set(i * 7, 15.2, 0); scene.add(tr);
    for (let j = -1; j <= 1; j++) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.9), lightM); l.position.set(i * 7, 15, j * 6); scene.add(l); }
  }
}

// 전광판 (가운데 매달림)
const SB = (() => {
  const [c, g] = cvs(512, 256), t = tex(c);
  const mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.1 });
  const side = new THREE.MeshStandardMaterial({ color: 0x15191f, metalness: .6, roughness: .4 });
  const cube = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.1, 4.2), [mat, mat, side, side, mat, mat]);
  // 2026-11-13: 매달린 전광판은 뺌 (점수는 화면의 TV 스코어 바로)
  function draw(s) {
    g.fillStyle = '#04060a'; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#1f6feb'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 244);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#8b949e'; g.font = '700 26px "Malgun Gothic",system-ui'; g.fillText('SEOUL WR 3D', 256, 34);
    g.font = '900 64px system-ui'; g.fillStyle = '#58a6ff'; g.fillText(String(s.try), 150, 118); g.fillStyle = '#ff7b72'; g.fillText(String(s.to), 362, 118);
    g.font = '700 22px "Malgun Gothic",system-ui'; g.fillStyle = '#c9d1d9'; g.fillText('트라이', 150, 166); g.fillText('턴오버', 362, 166);
    g.fillStyle = '#ffd33d'; g.font = '800 40px ui-monospace,monospace'; g.fillText(s.time, 256, 214);
    t.needsUpdate = true;
  }
  return { draw };
})();

/* ---------- 휠체어 (engine/rugby-chairs.js 디자인 → 3D, 실제 크기) ---------- */
// 크기는 의자 부품(engine/rugby-chairs.js)의 그림 단위 U를 그대로 씀: 뒷바퀴 지름 78단위 = 25" → 반지름 39단위
const u = window.RugbyChairs.U, SY = 0.84, RW = 39 * u, CAMBER = 18 * Math.PI / 180, SEAT = 0.46, HALF_TRACK = 63 * u * SY;
const P = (x, y, h, lat = SY) => new THREE.Vector3(x * u, h, y * u * lat);
const metal = (c, r = .5) => new THREE.MeshStandardMaterial({ color: c, metalness: .95, roughness: r, roughnessMap: T.brushed, envMapIntensity: 1.2 });
const MAT = {
  m1: metal(0xd5dae0, .5), m2: metal(0xb3bac3, .6), bright: metal(0xf0f3f5, .38),
  disc: new THREE.MeshPhysicalMaterial({ color: 0x111418, metalness: .2, roughness: .35, clearcoat: 1, clearcoatRoughness: .08 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: .92 }),
  plate: new THREE.MeshStandardMaterial({ color: 0x323843, metalness: .55, roughness: .45 }),
  back: new THREE.MeshStandardMaterial({ color: 0x191d23, roughness: .85 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc8372d, roughness: .45 }),
  hub: new THREE.MeshStandardMaterial({ color: 0xd8283c, metalness: .7, roughness: .3 }),
  white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5 }),
  bolt: new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 1, roughness: .2 }),
};
function holeTex(slots) {
  const [c, g] = cvs(128, 128);
  g.fillStyle = slots ? '#1c2026' : '#b9c0c8'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = slots ? '#4b5361' : '#4d545e';
  if (slots) for (let j = 0; j < 5; j++) g.fillRect(14, 10 + j * 24, 100, 8);
  else for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) { g.beginPath(); g.arc(20 + i * 29, 12 + j * 21, 5, 0, 7); g.fill(); }
  return tex(c);
}
const plateA = new THREE.MeshStandardMaterial({ map: holeTex(false), metalness: .75, roughness: .35 });
const plateD = new THREE.MeshStandardMaterial({ map: holeTex(true), metalness: .3, roughness: .6 });
const geoCache = new Map();
function tube(pts, r, mat, closed = false) {
  const key = pts.map(p => p.toArray().map(v => v.toFixed(3)).join(',')).join(';') + r + closed;
  let geo = geoCache.get(key);
  if (!geo) { geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', 0.08), Math.max(10, pts.length * 14), r, 10, closed); geoCache.set(key, geo); }
  return new THREE.Mesh(geo, mat);
}
const mirror = fn => [-1, 1].map(fn);
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
function plateShape(pts2d, h, thick, mat) {
  const s = new THREE.Shape(pts2d.map(([x, y]) => new THREE.Vector2(x * u, -y * u * SY)));
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false }), mat);
  m.rotation.x = -Math.PI / 2; m.position.y = h; return m;
}
const shadeC = (c, k) => c.clone().lerp(new THREE.Color(12 / 255, 16 / 255, 24 / 255), k);

function wheel(side, teamC) {
  const holder = new THREE.Group();
  holder.position.copy(P(-8, side * 63, RW));
  holder.rotation.x = -side * CAMBER;
  const spin = new THREE.Group(); holder.add(spin);
  const out = side;
  spin.add(new THREE.Mesh(new THREE.TorusGeometry(RW - 0.015, 0.03, 16, 72),
    new THREE.MeshStandardMaterial({ color: shadeC(teamC, 0.2), roughness: .8, bumpMap: T.tread, bumpScale: 2 })));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(RW - 3.4 * u, 0.005, 8, 64), MAT.m1); rim.position.z = out * 0.008; spin.add(rim);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(RW - 4 * u, RW - 4 * u, 0.014, 64), MAT.disc); disc.rotation.x = Math.PI / 2; spin.add(disc);
  for (let j = 0; j < 15; j++) {
    const th = j * Math.PI * 2 / 15, b = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), MAT.bolt);
    b.position.set(Math.cos(th) * (RW - 6.2 * u), Math.sin(th) * (RW - 6.2 * u), out * 0.008); spin.add(b);
  }
  for (let j = 0; j < 3; j++) {
    const a = new THREE.Mesh(new THREE.TorusGeometry(10 * u, 0.004, 6, 20, 1.3), MAT.white);
    a.rotation.z = j * Math.PI * 2 / 3; a.position.z = out * 0.0085; spin.add(a);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 20), MAT.hub); hub.rotation.x = Math.PI / 2; spin.add(hub);
  const hr = new THREE.Mesh(new THREE.TorusGeometry(RW - 4 * u, 0.009, 10, 64), MAT.bright); hr.position.z = out * 0.035; spin.add(hr);
  for (let j = 0; j < 6; j++) {
    const th = j * Math.PI / 3, st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.028, 6), MAT.m2);
    st.rotation.x = Math.PI / 2; st.position.set(Math.cos(th) * (RW - 4 * u), Math.sin(th) * (RW - 4 * u), out * 0.021); spin.add(st);
  }
  return { holder, spin, side };
}
function caster(x, y, root) {
  const p = P(x, y, 0);
  root.add(tube([P(x, y, 0.16), P(x, y, 0.07)], 0.009, MAT.m2));
  root.add(box(0.03, 0.05, 0.04, MAT.m2, p.x, 0.065, p.z));
  const w = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.024, 18), MAT.rubber);
  w.rotation.x = Math.PI / 2; w.position.set(p.x, 0.042, p.z); root.add(w);
}
function numberTex(num, teamC, rotate) {
  const [c, g] = cvs(128, 128), t = String(num);
  g.translate(64, 64); if (rotate) g.rotate(Math.PI / 2);
  g.font = `900 ${t.length > 1 ? 70 : 88}px "Malgun Gothic",system-ui,sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 12; g.strokeStyle = '#' + shadeC(teamC, 0.6).getHexString(); g.strokeText(t, 0, 4);
  g.fillStyle = '#fff'; g.fillText(t, 0, 4);
  return tex(c);
}

function makeChair(colorHex, num, type) {
  const root = new THREE.Group(), C = new THREE.Color(colorHex);
  const team = new THREE.MeshStandardMaterial({ color: C, roughness: .6, map: T.stitch });
  const teamPlain = new THREE.MeshStandardMaterial({ color: C, roughness: .55 });
  const tape = new THREE.MeshStandardMaterial({ color: C, roughness: .4, emissive: C, emissiveIntensity: .15 });
  mirror(s => {                                                     // 안티팁
    root.add(tube([P(-40, s * 40, 0.17), P(-58, s * 36, 0.07)], 0.014, MAT.m2));
    root.add(tube([P(-44, s * 30, 0.2), P(-52, s * 36, 0.1)], 0.01, MAT.m2));
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 14), MAT.red);
    r.rotation.x = Math.PI / 2; r.position.copy(P(-62, s * 36, 0.024)); root.add(r);
  });
  const wheels = mirror(s => { const w = wheel(s, C); root.add(w.holder); return w; });
  if (type === 'A') {
    root.add(plateShape([[-44, -38], [-36, -47], [46, -40], [58, -24], [58, 24], [46, 40], [-36, 47], [-44, 38]], 0.15, 0.012, MAT.plate));
    mirror(s => {
      root.add(tube([P(-42, s * 44, 0.16), P(50, s * 38, 0.16), P(58, s * 26, 0.15)], 0.017, MAT.m1));
      root.add(tube([P(-42, s * 44, SEAT - 0.02), P(28, s * 41, SEAT - 0.03), P(52, s * 32, 0.2)], 0.016, MAT.m1));
      root.add(tube([P(-42, s * 44, 0.16), P(-42, s * 44, SEAT - 0.02)], 0.016, MAT.m1));
      root.add(tube([P(-34, s * 50, 0.25), P(26, s * 49, 0.25)], 0.011, MAT.m2));
      root.add(tube([P(-30, s * 42.2, 0.18), P(44, s * 36.6, 0.18)], 0.006, tape));
    });
    root.add(tube([P(-42, -44, 0.3), P(-44, 0, 0.3), P(-42, 44, 0.3)], 0.016, MAT.m1));
    const ring = s => [[22, s * 76], [44, s * 72], [64, s * 60], [78, s * 40], [84, s * 18], [85, 0]];
    const R1 = ring(-1).concat(ring(1).reverse().slice(1));
    const band = new THREE.Group(); band.position.y = 0.12; band.scale.y = 2.2;
    band.add(tube(R1.map(([x, y]) => P(x, y, 0)), 0.024, MAT.bright)); root.add(band);
    root.add(tube([[80, -30], [86, -10], [86.5, 0], [86, 10], [80, 30]].map(([x, y]) => P(x + 1.5, y, 0.168)), 0.006, tape));
    mirror(s => {
      root.add(tube([P(40, s * 30, SEAT - 0.04), P(78, s * 9, 0.15)], 0.014, MAT.m1));
      root.add(tube([P(28, s * 50, 0.14), P(62, s * 58, 0.13)], 0.012, MAT.m2));
      root.add(tube([P(80, s * 16, 0.09), P(90, s * 14, 0.09)], 0.012, MAT.m2));
    });
    root.add(box(22 * u, 0.008, 32 * u * SY, plateA, P(55, 0, 0).x, 0.1, 0));
    root.add(box(6 * u, 0.06, 44 * u * SY, MAT.rubber, P(93, 0, 0).x, 0.07, 0));
    root.add(tube([P(91, -22, 0.11), P(91, 22, 0.11)], 0.018, MAT.bright));
    caster(72, -24, root); caster(72, 24, root);
  } else {
    root.add(plateShape([[-42, -42], [8, -40], [8, 40], [-42, 42]], SEAT - 0.04, 0.012, MAT.plate));
    root.add(tube([[-42, -42], [10, -40], [44, -24], [60, -18], [64, -8], [64, 8], [60, 18], [44, 24], [10, 40], [-42, 42]].map(([x, y]) => P(x, y, 0.13)), 0.018, MAT.m1));
    root.add(tube([P(-42, -42, 0.3), P(-44, 0, 0.3), P(-42, 42, 0.3)], 0.016, MAT.m1));
    mirror(s => {
      root.add(tube([P(-2, s * 36, SEAT - 0.03), P(30, s * 30, 0.32), P(56, s * 20, 0.15)], 0.015, MAT.bright));
      root.add(tube([P(-42, s * 42, 0.13), P(-42, s * 42, SEAT - 0.03)], 0.016, MAT.m1));
      root.add(tube([P(8, s * 40, 0.13), P(8, s * 40, SEAT - 0.03)], 0.015, MAT.m1));
      root.add(tube([P(-30, s * 39, SEAT - 0.025), P(6, s * 37.6, SEAT - 0.025)], 0.006, tape));
    });
    root.add(box(22 * u, 0.008, 30 * u * SY, plateD, P(41, 0, 0).x, 0.1, 0));
    caster(56, -24, root); caster(56, 24, root);
    root.add(tube([[64, -16], [99, -40], [99, 40], [64, 16]].map(([x, y]) => P(x, y, 0.12)), 0.017, MAT.bright));
    mirror(s => {
      root.add(tube([P(64, s * 12, 0.12), P(99, s * 22, 0.12)], 0.0075, MAT.m2));
      root.add(tube([P(66, s * 4, 0.12), P(99, s * 34, 0.12)], 0.0075, MAT.m2));
      root.add(tube([P(80, s * 26, 0.12), P(99, s * 6, 0.12)], 0.0075, MAT.m2));
    });
    root.add(tube([P(64, 0, 0.12), P(99, 0, 0.12)], 0.0075, MAT.m2));
    const fb = P(101.5, 0, 0);
    root.add(box(5.4 * u, 0.1, 82 * u * SY, MAT.bright, fb.x, 0.12, 0));
    root.add(box(0.004, 0.022, 60 * u * SY, tape, fb.x + 2.8 * u, 0.12, 0));
    root.add(box(7 * u, 0.04, 72 * u * SY, MAT.rubber, fb.x - 1 * u, 0.045, 0));
  }
  const bk = P(-39, 0, 0);
  const back = new THREE.Mesh(new RoundedBoxGeometry(14 * u, 0.24, 64 * u * SY, 3, 0.012), MAT.back);
  back.position.set(bk.x, SEAT + 0.15, 0); back.rotation.z = 0.12; root.add(back);
  const bt = box(0.02, 0.012, 60 * u * SY, teamPlain, bk.x - 0.015, SEAT + 0.272, 0); bt.rotation.z = 0.12; root.add(bt);
  const cushion = new THREE.Mesh(new RoundedBoxGeometry(44 * u, 0.07, 62 * u * SY, 4, 0.025), team);
  cushion.position.set(P(-11, 0, 0).x, SEAT + 0.035, 0); root.add(cushion);
  root.add(box(4 * u, 0.074, 62 * u * SY + 0.004, MAT.back, P(-2, 0, 0).x, SEAT + 0.035, 0));
  root.add(box(5 * u, 0.076, 6 * u, MAT.m2, P(-2, 0, 0).x, SEAT + 0.035, 0));
  const nm = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshStandardMaterial({ map: numberTex(num, C, true), transparent: true, roughness: .6 }));
  nm.rotation.x = -Math.PI / 2; nm.position.set(P(-16, 0, 0).x, SEAT + 0.072, 0); root.add(nm);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(root);
  return { root, wheels, C, num, heading: 0, athlete: null };
}

/* ---------- 선수 샘플 (A1 한 명) ----------
   단순화한 마네킹 스타일(실사풍은 조금만 어색해도 티 남).
   팔: 2관절 IK로 손을 핸드림 위 점에 붙임. 미는 동안 손은 바퀴와 같이 돌고(실제 회전량 그대로),
   앞쪽 놓는 각도에 오면 손을 떼고 위로 돌아와 뒤쪽을 다시 잡음 → 엔진 속도에 맞춰 저절로 미는 리듬이 생김. */
const SHOW_ATHLETE = false;                     // 2026-11-13 감독 판정: 선수는 빼기 (코드는 나중을 위해 남김)
const L1 = 0.30, L2 = 0.29;
const GRAB_F = 118 * Math.PI / 180, REL_F = 48 * Math.PI / 180;    // 앞으로 갈 때 잡는/놓는 각 (핸드림 위 각도, 앞=0°, 위=90°)
const GRAB_B = 62 * Math.PI / 180, REL_B = 138 * Math.PI / 180;    // 뒤로 갈 때
function makeAthlete(ch) {
  const root = ch.root, C = ch.C;
  const jersey = new THREE.MeshStandardMaterial({ color: C, roughness: .7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8b48e, roughness: .65 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: .8 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x0f1114, roughness: .55 });
  const cap = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat);
  const seg = (a, b, mesh) => { const d = b.clone().sub(a); mesh.position.copy(a).add(b).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); };
  const add = m => { m.castShadow = true; m.receiveShadow = true; root.add(m); return m; };
  // 골반·다리 (고정)
  const pelvis = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.14, 0.32, 3, 0.05), dark); pelvis.position.set(-0.1, 0.6, 0); add(pelvis);
  mirror(s => {
    const hip = new THREE.Vector3(-0.05, 0.6, s * 0.09), knee = new THREE.Vector3(0.3, 0.64, s * 0.085), ank = new THREE.Vector3(0.41, 0.17, s * 0.08);
    const th = cap(0.066, hip.distanceTo(knee) - 0.04, dark); seg(hip, knee, th); add(th);
    const sh = cap(0.05, knee.distanceTo(ank) - 0.03, skin); seg(knee, ank, sh); add(sh);
    const kn = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), dark); kn.position.copy(knee); add(kn);
    const ft = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.07, 0.095, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: .6 }));
    ft.position.set(0.47, 0.14, s * 0.08); add(ft);
  });
  root.add(tube([new THREE.Vector3(0.12, 0.68, -0.16), new THREE.Vector3(0.12, 0.71, 0), new THREE.Vector3(0.12, 0.68, 0.16)], 0.02, MAT.back)); // 다리 끈
  // 상체 (골반에서 숙임)
  const torso = new THREE.Group(); torso.position.set(-0.1, 0.62, 0); root.add(torso);
  const chest = cap(0.14, 0.24, jersey); chest.position.y = 0.25; chest.scale.set(0.82, 1, 1.32); chest.castShadow = true; torso.add(chest);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), new THREE.MeshStandardMaterial({ map: numberTex(ch.num, C, false), transparent: true }));
  back.position.set(-0.118, 0.3, 0); back.rotation.y = -Math.PI / 2; torso.add(back);
  const neck = cap(0.045, 0.05, skin); neck.position.set(0.01, 0.52, 0); torso.add(neck);
  const head = new THREE.Group(); head.position.set(0.015, 0.6, 0); torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 18), skin); skull.scale.set(1.05, 1.12, 0.95); skull.position.y = 0.04; skull.castShadow = true; head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.104, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: .9 }));
  hair.scale.set(1.06, 1.12, 0.97); hair.position.set(-0.008, 0.05, 0); hair.rotation.z = 0.35; head.add(hair);
  const shoulders = mirror(s => { const j = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 10), jersey); j.position.set(0, 0.43, s * 0.19); j.castShadow = true; torso.add(j); return new THREE.Vector3(0, 0.43, s * 0.19); });
  // 팔 (매 프레임 IK)
  const arms = mirror((s, i) => ({
    side: s, w: ch.wheels[i],
    up: add(cap(0.05, L1 - 0.06, jersey)), fore: add(cap(0.042, L2 - 0.06, skin)),
    elbow: add(new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 10), skin)),
    hand: add(new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.05, 0.075, 2, 0.02), glove)),
    mode: 'push', lock: GRAB_F - 0.5, t: 0, from: new THREE.Vector3(), grab: GRAB_F, cur: new THREE.Vector3(), pass: null,
  }));
  const A = { torso, head, shoulders, arms, lean: 0.2, tilt: 0, yaw: 0, seg, chair: ch };
  ch.athlete = A;
  // 선수가 앉았으니 방석 등번호는 숨김
  root.children.forEach(o => { if (o.geometry && o.geometry.type === 'PlaneGeometry' && o.rotation.x === -Math.PI / 2) o.visible = false; });
  return A;
}
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function rimPoint(w, phi, out) {               // 핸드림 위 각도 phi → 휠체어(root) 좌표
  w.holder.updateMatrix();
  return out.set(Math.cos(phi) * (RW - 4 * u), Math.sin(phi) * (RW - 4 * u), w.side * 0.055).applyMatrix4(w.holder.matrix);
}
function solveArm(S, H, side, arm) {
  const d0 = S.distanceTo(H), d = THREE.MathUtils.clamp(d0, 0.12, L1 + L2 - 0.004);
  const dir = H.clone().sub(S).normalize(), hand = S.clone().addScaledVector(dir, d);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const pole = new THREE.Vector3(-0.55, 0.05, side * 1).normalize();          // 팔꿈치: 바깥·뒤쪽
  pole.addScaledVector(dir, -pole.dot(dir)).normalize();
  const E = S.clone().addScaledVector(dir, a).addScaledVector(pole, h);
  const seg = (A, B, m, r) => { const v = B.clone().sub(A); m.position.copy(A).add(B).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); };
  seg(S, E, arm.up); seg(E, hand, arm.fore); arm.elbow.position.copy(E);
  arm.hand.position.copy(hand); arm.hand.quaternion.copy(arm.fore.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
}
function updateAthlete(A, dt, st) {             // st: {v, acc, turn, ballLocal, passTo}
  const ch = A.chair, root = ch.root;
  // 상체: 기본 숙임 + 가속하면 더 숙이고, 감속하면 세움 + 미는 박자에 맞춰 살짝 + 돌 때 안쪽으로
  const pushing = A.arms.some(a => a.mode === 'push') && Math.abs(st.v) > 0.6;
  const target = 0.2 + THREE.MathUtils.clamp(st.acc * 0.07, -0.18, 0.32) + (pushing ? 0.06 : 0) + Math.min(Math.abs(st.v), 4) * 0.025;
  A.lean += (target - A.lean) * Math.min(1, dt * 6);
  A.tilt += (THREE.MathUtils.clamp(-st.turn * 0.07, -0.18, 0.18) - A.tilt) * Math.min(1, dt * 5);
  A.torso.rotation.set(A.tilt, 0, -A.lean, 'XZY');
  // 머리: 공 쪽으로
  if (st.ballLocal) {
    const yaw = THREE.MathUtils.clamp(Math.atan2(-st.ballLocal.z, st.ballLocal.x - 0.1), -1.15, 1.15);
    A.yaw += (yaw - A.yaw) * Math.min(1, dt * 5); A.head.rotation.set(0, A.yaw, A.lean * 0.6);
  }
  A.torso.updateMatrix();
  const recDur = THREE.MathUtils.clamp(0.42 - Math.abs(st.v) * 0.045, 0.24, 0.42);
  A.arms.forEach((arm, i) => {
    const S = A.shoulders[i].clone().applyMatrix4(A.torso.matrix);
    const rz = arm.w.spin.rotation.z, om = st.om[i];
    let H;
    if (st.passTo && !arm.pass) arm.pass = { t: 0, from: arm.cur.clone(), to: st.passTo.clone() };
    if (arm.pass) {                                         // 패스 동작: 가슴으로 모았다가 → 목표 쪽으로 밀어냄
      const p = arm.pass; p.t += dt;
      const chestPt = new THREE.Vector3(0.12, 0.88, arm.side * 0.07).applyMatrix4(new THREE.Matrix4()); // root 좌표
      const reach = S.clone().add(p.to.clone().sub(S).setY(0).normalize().multiplyScalar(0.5)).setY(S.y + 0.05);
      if (p.t < 0.14) H = p.from.clone().lerp(chestPt, p.t / 0.14);
      else if (p.t < 0.32) H = chestPt.clone().lerp(reach, (p.t - 0.14) / 0.18);
      else { arm.pass = null; arm.mode = 'rec'; arm.t = 0; arm.from.copy(reach); arm.grab = om <= 0 ? GRAB_F : GRAB_B; H = reach; }
    } else if (arm.mode === 'push') {
      const phi = arm.lock + rz;
      if (phi < REL_F) { arm.mode = 'rec'; arm.t = 0; rimPoint(arm.w, phi, arm.from); arm.grab = GRAB_F; }
      else if (phi > REL_B) { arm.mode = 'rec'; arm.t = 0; rimPoint(arm.w, phi, arm.from); arm.grab = GRAB_B; }
      H = rimPoint(arm.w, Math.min(Math.max(phi, REL_F), REL_B), new THREE.Vector3());
    }
    if (!H && arm.mode === 'rec') {                         // 손 떼고 위로 돌아오기 (위·바깥으로 아치)
      arm.t += dt / recDur;
      const s = Math.min(arm.t, 1), e = s * s * (3 - 2 * s);
      const to = rimPoint(arm.w, arm.grab, new THREE.Vector3());
      H = arm.from.clone().lerp(to, e);
      H.y += Math.sin(Math.PI * s) * 0.11; H.z += arm.side * Math.sin(Math.PI * s) * 0.05; H.x -= Math.sin(Math.PI * s) * 0.03;
      if (s >= 1) { arm.mode = 'push'; arm.lock = arm.grab - rz; }
    }
    arm.cur.copy(H);
    solveArm(S, H, arm.side, arm);
  });
}

/* ---------- 엔진 ---------- */
const hud = { play: document.getElementById('hPlay'), time: document.getElementById('hTime'), try: document.getElementById('hTry'), to: document.getElementById('hTo'), msg: document.getElementById('msg') };
let msgT = 0;
const score = { try: 0, to: 0, plays: 1 };
const say = (t, ms) => { hud.msg.textContent = t || ''; msgT = ms === 0 ? 1e9 : (ms || 2500) / 1000; };
const NAMES = { B: '우리팀', R: '상대팀' };
const PS = { me: 1, len: 3 };                    // 플레이 설정 (내 번호, 피리어드 분)
try { Object.assign(PS, JSON.parse(localStorage.getItem('wr3d.play') || '{}')); } catch (e) { }
let M = null, b, cur = PS.me, lastPoss = -1, lastHolder = null, started = !PLAY;

/* 조종 입력: 화면 기준(오른쪽 +x, 아래 +y) → 카메라가 보는 방향 기준 바닥(x,z) → match가 FL로 엔진 좌표로 바꿈 */
const keys = {}, pj = { x: 0, y: 0 }, _f = new THREE.Vector3();
function playInput() {
  let x = pj.x, y = pj.y;
  const kx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0), ky = (keys.arrowdown || keys.s ? 1 : 0) - (keys.arrowup || keys.w ? 1 : 0);
  if (kx || ky) { x = kx; y = ky; }
  if (!x && !y) return { x: 0, y: 0 };
  camera.getWorldDirection(_f); _f.y = 0; _f.normalize();
  return { x: -_f.z * x - _f.x * y, y: _f.x * x - _f.z * y };
}
if (PLAY) {
  M = RB.match({ plen: PS.len * 60, names: NAMES, human: { team: 'B', num: cur }, cfg: { autoNext: false }, msg: say, input: playInput,
    event: (k) => { if (k === 'final') showEnd(); } });
  b = M.brain; M.start(); say('');
} else {
  b = RB.create({
    cfg: { trans: false, mode: 'watch', autoNext: true },
    msg: say,
    event: (k) => { if (k === 'newGame') { score.plays++; hud.play.textContent = score.plays; } },
  });
  b.newGame(); score.plays = 1; hud.play.textContent = '1';
}
const chairs = {};
const teamOf = p => (PLAY ? M.team(p.id) : (p.team === 'A' ? 'B' : 'R'));
const keyOf = p => (PLAY ? teamOf(p) + p.num + (p.chair || 'A') : p.id);
function chairFor(p) {
  const k = keyOf(p);
  if (!chairs[k]) {
    const ch = makeChair(teamOf(p) === 'B' ? BLUE : RED, p.num, p.chair || 'A');
    ch.prev = null; chairs[k] = ch;
    if (SHOW_ATHLETE && !PLAY && p.id === 'A1') makeAthlete(ch);
  }
  return chairs[k];
}
const humanChair = () => { if (!PLAY) return chairs.A1; const id = M.humanId(), p = id && b.P(id); return p ? chairFor(p) : null; };
// 내 선수 표시(노란 고리)·패스 받을 동료 표시(흰 고리)
const ringMesh = (r, c, o) => { const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.07, r, 48), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.visible = false; scene.add(m); return m; };
const meRing = ringMesh(0.95, 0xffd33d, 0.95), aimRing = ringMesh(0.85, 0xffffff, 0.7);
// 벤치 쪽 예비 휠체어 (정지)
{
  [[-7, BLUE, 'A', 8], [-5.6, BLUE, 'D', 10], [5.6, RED, 'A', 6], [7, RED, 'D', 14]].forEach(([x, c, t, n]) => {
    const ch = makeChair(c, n, t); ch.root.position.set(x, 0, CW / 2 + 2.6); ch.root.rotation.y = Math.PI / 2;
  });
  const benchM = new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: .7 });
  [-6.3, 6.3].forEach(x => { const bn = box(4.5, 0.45, 0.6, benchM, x, 0.225, CW / 2 + 3.7); bn.castShadow = bn.receiveShadow = true; scene.add(bn); });
}

const ball = new THREE.Mesh(new THREE.SphereGeometry(0.105, 32, 24), new THREE.MeshPhysicalMaterial({ color: 0xf6f6f2, roughness: .45, clearcoat: .3,
  map: (() => { const [c, g] = cvs(256, 128); g.fillStyle = '#f6f6f2'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#d33'; g.lineWidth = 6; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(i * 64 + 32, 0); g.bezierCurveTo(i * 64 + 4, 40, i * 64 + 60, 88, i * 64 + 32, 128); g.stroke(); } return tex(c); })() }));
ball.castShadow = true; scene.add(ball);

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const DT = 1 / 60;
let readyT = 0, acc = 0, speed = 1, paused = false, lastPhase = b.G.phase, prevFly = null, sbT = 0;
function stepEngine(dt) {
  acc += dt * speed; let n = 0;
  if (PLAY) {
    while (acc >= DT && n < 8) { M.step(DT); acc -= DT; n++; }
    if (n === 8) acc = 0;
    return n * DT;
  }
  while (acc >= DT && n < 8) {
    if (b.G.phase === 'ready') { readyT += DT; if (readyT > 1.2) { readyT = 0; b.whistle(); } }   // 관전 모드: 1.2초 뒤 휘슬
    b.tick(DT); acc -= DT; n++;
  }
  if (n === 8) acc = 0;
  const G = b.G;
  if (G.phase === 'over' && lastPhase !== 'over') { if (G.result === 'try') score.try++; else score.to++; }
  lastPhase = G.phase;
  return n * DT;
}
function syncChairs(simDt, frameDt) {
  const G = b.G;
  let passTo = null;
  const f = G.ball.fly;
  if (f && f !== prevFly && f.from === 'A1') passTo = toW(f.tx, f.ty, 0);
  prevFly = f;
  if (PLAY && (M.flip ? -1 : 1) !== FL) { FL = -FL; for (const k in chairs) chairs[k].prev = null; setCam(camMode); }   // 코트 방향이 바뀌면 카메라도 반대편으로
  for (const p of G.ps) {
    const ch = chairFor(p), pos = toW(p.x, p.y), head = -(p.a || 0) + (FL < 0 ? Math.PI : 0);
    let d = 0, dth = 0;
    if (ch.prev && ch.prev.pos.distanceTo(pos) < 1.5) {
      d = (pos.x - ch.prev.pos.x) * Math.cos(head) - (pos.z - ch.prev.pos.z) * Math.sin(head);
      dth = wrap(head - ch.prev.head);
    }
    const dl = d - dth * HALF_TRACK, dr = d + dth * HALF_TRACK, om = [0, 0];
    ch.wheels[0].spin.rotation.z -= dl / RW; ch.wheels[1].spin.rotation.z -= dr / RW;
    if (simDt > 0) { om[0] = -dl / RW / simDt; om[1] = -dr / RW / simDt; }
    const v = simDt > 0 ? d / simDt : 0;
    ch.vS = ch.vS == null ? v : ch.vS + (v - ch.vS) * Math.min(1, frameDt * 8);
    const accel = simDt > 0 ? (ch.vS - (ch.vPrev ?? ch.vS)) / Math.max(frameDt, 1e-3) : 0; ch.vPrev = ch.vS;
    ch.aS = (ch.aS || 0) + (accel - (ch.aS || 0)) * Math.min(1, frameDt * 4);
    ch.turnS = (ch.turnS || 0) + ((simDt > 0 ? dth / simDt : 0) - (ch.turnS || 0)) * Math.min(1, frameDt * 6);
    ch.root.position.copy(pos); ch.root.rotation.y = head;
    ch.prev = { pos, head };
    if (ch.athlete) {
      ch.root.updateMatrixWorld();
      const bl = ch.root.worldToLocal(ball.position.clone());
      const pt = passTo ? ch.root.worldToLocal(passTo.clone()) : null;
      updateAthlete(ch.athlete, frameDt, { v: ch.vS, acc: ch.aS, turn: ch.turnS, om, ballLocal: bl, passTo: pt });
    }
  }
  // 공
  const bb = G.ball;
  if (bb.holder) {
    const hp = b.P(bb.holder), ch = hp && chairFor(hp);
    if (ch) { ch.root.updateMatrixWorld(); ball.position.copy(ch.root.localToWorld(ch.athlete ? new THREE.Vector3(0.12, 0.74, 0) : new THREE.Vector3(-0.02, 0.64, 0))); }
  } else if (bb.fly) {
    const k = THREE.MathUtils.clamp(bb.fly.t / bb.fly.dur, 0, 1), dist = Math.hypot(bb.fly.tx - bb.fly.sx, bb.fly.ty - bb.fly.sy);
    ball.position.copy(toW(bb.x, bb.y, 0.72 + Math.sin(Math.PI * k) * (0.25 + dist * 0.07)));
  } else {
    ball.position.copy(toW(bb.x, bb.y, 0.105));
  }
}

/* ---------- 카메라 ---------- */
let camMode = 'wide';
const PORTRAIT = () => PLAY && camera.aspect < 0.9;
const fitFov = () => { camera.fov = PORTRAIT() ? 62 : 38; camera.updateProjectionMatrix(); };
fitFov();
const CAM = {
  wide: {
    get off() {
      if (PORTRAIT()) return new THREE.Vector3(-FL * 15, 14, 0);          // 플레이·세로 화면: 공격 방향 뒤에서 (코트가 위로 뻗게)
      const k = Math.max(1, 1.45 / camera.aspect); return new THREE.Vector3(0, 13 * k, 17.5 * k);
    },
    tgt: () => PORTRAIT() ? new THREE.Vector3(THREE.MathUtils.clamp(ball.position.x, -9, 9) + FL * 3, 0, 0)
      : new THREE.Vector3(THREE.MathUtils.clamp(ball.position.x * 0.7, -6, 6), 0, 1.2),
  },
  ball: { off: new THREE.Vector3(-4.2, 3.2, 5.2), tgt: () => ball.position.clone().setY(0.4) },
  player: { get off() { return PLAY ? new THREE.Vector3(-FL * 5.2, 4.2, 3.4) : new THREE.Vector3(-1.7, 1.25, 1.9); }, tgt: () => { const c = humanChair(); return c ? c.root.position.clone().setY(0.7) : new THREE.Vector3(); } },
};
function setCam(m) {
  camMode = m;
  document.querySelectorAll('[data-cam]').forEach(e => e.classList.toggle('on', e.dataset.cam === m));
  const t = CAM[m].tgt(); controls.target.copy(t); camera.position.copy(t).add(CAM[m].off);
}
document.querySelectorAll('[data-cam]').forEach(e => e.onclick = () => setCam(e.dataset.cam));
const bSpeed = document.getElementById('bSpeed'), bPause = document.getElementById('bPause');
bSpeed.onclick = () => { speed = speed === 1 ? 0.5 : speed === 0.5 ? 2 : 1; bSpeed.textContent = speed + 'x'; };
bPause.onclick = () => { if (PLAY && !started) return; paused = !paused; bPause.textContent = paused ? '재생' : '멈춤'; bPause.classList.toggle('on', paused); };

/* ---------- 조이스틱: 좌우=빙 돌기, 위아래=높이(내려다보기) / ＋－=줌 ---------- */
const joy = { x: 0, y: 0, on: false };
{
  const el = document.getElementById('joy'), knob = document.getElementById('knob');
  const move = e => {
    const r = el.getBoundingClientRect(), R = r.width / 2;
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R); const d = Math.hypot(dx, dy), m = R - 20;
    if (d > m) { dx *= m / d; dy *= m / d; }
    joy.x = dx / m; joy.y = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`;
  };
  el.addEventListener('pointerdown', e => { joy.on = true; el.classList.add('on'); el.setPointerCapture(e.pointerId); move(e); });
  el.addEventListener('pointermove', e => { if (joy.on) move(e); });
  const end = () => { joy.on = false; joy.x = joy.y = 0; el.classList.remove('on'); knob.style.transform = ''; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  document.querySelectorAll('#zoom button').forEach(bt => bt.onclick = () => {
    const off = camera.position.clone().sub(controls.target).multiplyScalar(+bt.dataset.z);
    const len = THREE.MathUtils.clamp(off.length(), controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(off.setLength(len));
  });
}
const _sph = new THREE.Spherical();
function applyJoy(dt) {
  if (!joy.x && !joy.y) return;
  _sph.setFromVector3(camera.position.clone().sub(controls.target));
  _sph.theta -= joy.x * Math.abs(joy.x) * dt * 1.5;   // 살짝 밀면 천천히, 끝까지 밀면 빠르게
  _sph.phi = THREE.MathUtils.clamp(_sph.phi + joy.y * dt * 1.1, 0.12, controls.maxPolarAngle);
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(_sph));
}

/* ---------- 모드 버튼 ---------- */
document.querySelectorAll('[data-mode]').forEach(e => {
  e.classList.toggle('on', e.dataset.mode === MODE);
  e.onclick = () => { if (e.dataset.mode !== MODE) location.search = e.dataset.mode === 'watch' ? '' : '?mode=' + e.dataset.mode; };
});

/* ---------- 플레이: 조종 (2D 게임 rugby-game과 같은 키·규칙) ---------- */
const $ = id => document.getElementById(id);
const ourPre = () => (M.att === 'B' ? 'A' : 'D');
function setSeat(n) { cur = n; M.setHuman({ team: 'B', num: n }); }
const swap = () => { if (started) setSeat(cur % 4 + 1); };
const doPass = id => { if (started && !paused) M.pass(id); };
const doBounce = () => { if (started && !paused) M.bounce(); };
function showEnd() {
  const a = M.score.B, r = M.score.R;
  $('eTitle').textContent = a > r ? '승리!' : a < r ? '패배' : '무승부';
  $('eScore').textContent = `우리 ${a} : ${r} 상대`; $('end').hidden = false;
}
if (PLAY) {
  document.body.classList.add('play');
  paused = true;
  const LU = ['3.0', '2.0', '1.5', '0.5'];
  const chipRow = (el, items, curV, on) => {
    el.innerHTML = '';
    for (const [v, label] of items) {
      const bt = document.createElement('button'); bt.className = 'chip' + (v === curV ? ' on' : ''); bt.innerHTML = label;
      bt.onclick = () => { on(v); try { localStorage.setItem('wr3d.play', JSON.stringify(PS)); } catch (e) { } renderStart(); };
      el.appendChild(bt);
    }
  };
  const renderStart = () => {
    chipRow($('cSeat'), [1, 2, 3, 4].map(n => [n, `${n}번 <small>${LU[n - 1]}${n === 3 ? ' 인바' : ''}</small>`]), PS.me, v => PS.me = v);
    chipRow($('cLen'), [2, 3, 5].map(n => [n, n + '분']), PS.len, v => PS.len = v);
  };
  renderStart(); $('start').hidden = false;
  const go = () => {
    M.plen = PS.len * 60; M.start(); cur = PS.me; setSeat(cur); lastPoss = -1; lastHolder = null;
    started = true; paused = false; $('start').hidden = true; $('end').hidden = true; setCam('wide');
  };
  $('bGo').onclick = go; $('eRe').onclick = go;
  $('bPassP').onclick = () => doPass(); $('bBnc').onclick = doBounce; $('bSw').onclick = swap;
  // 왼쪽 조이스틱 (휴대폰)
  const j = $('pj'), k = j.querySelector('i'); let pid = null;
  const set = e => { const r = j.getBoundingClientRect(); let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2); const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } pj.x = dx; pj.y = dy; k.style.transform = `translate(${dx * 36}px,${dy * 36}px)`; };
  j.addEventListener('pointerdown', e => { pid = e.pointerId; j.setPointerCapture(pid); set(e); e.preventDefault(); });
  j.addEventListener('pointermove', e => { if (e.pointerId === pid) set(e); });
  const end = () => { pid = null; pj.x = pj.y = 0; k.style.transform = ''; };
  j.addEventListener('pointerup', end); j.addEventListener('pointercancel', end);
  addEventListener('keydown', e => {
    const kk = e.key.toLowerCase();
    if (kk.startsWith('arrow') || kk === ' ' || kk === 'tab') e.preventDefault();
    keys[kk] = true; if (!started) return;
    if (kk === ' ') doPass();
    else if (kk === 'b') doBounce();
    else if (kk === 'tab') swap();
    else if ('1234'.includes(kk) && kk.length === 1) {   // 공 가진 공격 중이면 그 번호에게 패스, 아니면 그 번호로 바꾸기
      const t = b.P(ourPre() + kk), hid = M.humanId();
      if (t && b.G.ball.holder === hid && ourPre() === 'A') doPass(t.id); else setSeat(+kk);
    }
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { for (const kk in keys) keys[kk] = false; });
  // 스코어 바: 우리 : 상대 · 피리어드·경기 시계 · 샷클락
  document.querySelector('#bug .a i').textContent = '우리';
  document.querySelector('#bug .d i').textContent = '상대';
}
const mmss = t => { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
function playFrame() {
  const G = b.G;
  if (M.poss !== lastPoss) { lastPoss = M.poss; setSeat(PS.me); lastHolder = null; }
  if (M.att === 'B' && G.inbounded) {                // 우리 공격 중 공이 동료에게 가면 그 선수로 자동 전환 (2D 게임과 같음)
    const h = G.ball.holder || (G.ball.fly && G.ball.fly.to) || null;
    if (h && h !== lastHolder) { lastHolder = h; if (h[0] === 'A' && +h[1] !== cur) setSeat(+h[1]); }
  }
  const hc = humanChair();
  meRing.visible = !!hc; if (hc) meRing.position.set(hc.root.position.x, 0.012, hc.root.position.z);
  const at = M.aimTarget(), ac = at && chairFor(at);
  aimRing.visible = !!ac; if (ac) aimRing.position.set(ac.root.position.x, 0.013, ac.root.position.z);
  const hold = M.att === 'B' && G.ball.holder === M.humanId();
  $('bPassP').classList.toggle('dim', !hold); $('bBnc').classList.toggle('dim', !hold);
}
function playHud() {
  const G = b.G;
  hud.try.textContent = M.score.B; hud.to.textContent = M.score.R;
  let shot;
  if (G.phase === 'trans') shot = '데드'; else if (G.phase === 'over') shot = '끝';
  else if (!G.inbounded) shot = '인바 ' + Math.ceil(Math.max(0, 8 - G.inboundT));
  else shot = '샷 ' + Math.ceil(Math.max(0, 40 - G.shotT));
  hud.time.textContent = mmss(M.gc);
  hud.time.nextElementSibling.textContent = `${M.per}P · ${shot}`;
  $('side').textContent = (M.att === 'B' ? '우리 공격' : '우리 수비') + ` · 나 ${cur}번`;
  $('side').className = M.att === 'B' ? 'att' : 'def';
}

/* ---------- 후처리 (가능하면 AO) ---------- */
let composer = null;
async function setupPost() {
  try {
    const { GTAOPass } = await import('three/addons/postprocessing/GTAOPass.js');
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    composer.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 12 });
    ao.blendIntensity = 0.85;
    composer.addPass(ao);
    composer.addPass(new OutputPass());
  } catch (e) { console.warn('AO 없이 진행', e); composer = null; }
}

/* ---------- 루프 ---------- */
const clock = new THREE.Clock();
syncChairs(0, 0); setCam('wide');
await setupPost();
document.getElementById('load').remove();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const simDt = paused ? 0 : stepEngine(dt);
  syncChairs(simDt, paused ? 0 : dt);
  rotateAds(clock.elapsedTime);
  msgT -= dt; if (msgT <= 0 && hud.msg.textContent && b.G.phase === 'live') hud.msg.textContent = '';
  if (PLAY) playFrame();
  sbT -= dt;
  if (sbT <= 0 && PLAY) { sbT = 0.2; playHud(); }
  else if (sbT <= 0) {
    sbT = 0.2; const tm = (b.G.t || 0).toFixed(1) + '초';
    hud.time.textContent = tm; hud.try.textContent = score.try; hud.to.textContent = score.to;
  }
  const nt = CAM[camMode].tgt(), k = camMode === 'wide' ? Math.min(1, dt * 1.5) : 1;
  const step = nt.sub(controls.target).multiplyScalar(k);
  controls.target.add(step); camera.position.add(step);
  applyJoy(dt);
  controls.update();
  if (composer) composer.render(); else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; fitFov(); if (PLAY) setCam(camMode);
  renderer.setSize(innerWidth, innerHeight); if (composer) composer.setSize(innerWidth, innerHeight);
});
// 시험용: 화면이 숨겨져 RAF가 멈춰도 한 프레임씩 돌려볼 수 있게
const testTick = (dt = 1 / 60) => { const sd = stepEngine(dt); syncChairs(sd, dt); if (PLAY) { playFrame(); playHud(); } };
window.__g = { b, M, chairs, scene, camera, setCam, keys, pj, testTick, render: () => renderer.render(scene, camera) };

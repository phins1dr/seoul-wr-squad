# 럭비 두뇌 (RugbyBrain)

휠체어럭비 AI·물리·규정 엔진. 화면(HTML·캔버스) 없이 돌아가서 랩·아카데미·게임이 같이 쓸 수 있어요.

- `rugby-brain.js` — 선수 움직임 AI(공격·라인수비·지역수비·프레스·키 수비·픽앤롤), 휠체어 물리, 규정(8초·12초·40초·키 8초·1m·백코트 등), 4피리어드 경기 진행
- `rugby-chairs.js` — 위에서 본 휠체어 그림 (공격형 A, 수비형 D)

## 쓰는 법

```html
<script src="../engine/rugby-brain.js"></script>
<script>
const m = RugbyBrain.match({
  plen: 180,                                  // 피리어드 길이(초), 4피리어드
  lines: { B: ['3.0','3.0','1.0','1.0'], R: ['3.0','2.0','2.0','1.0'] },
  human: { team: 'B', num: 1 },               // 사람이 조종할 선수 (null이면 전원 AI)
  input: () => ({ x: 0, y: 0 }),              // 화면 기준 조이스틱 (오른쪽 +x, 아래 +y)
  msg: (text, ms) => {},                      // "휘슬!", "득점!" 같은 안내
});
m.start();
// 매 프레임: m.step(dt); 그리고 m.brain.G 를 읽어서 그리기
// 버튼: m.pass(), m.pass('A2'), m.bounce(), m.setHuman({team:'B',num:3})
</script>
```

좌표는 x 0→28(공격 방향, 골라인 x=28), y 0→15, 단위 m. `m.flip`이 true면 화면에서 좌우를 뒤집어 그려요.
Node에서도 `require('./rugby-brain.js')`로 화면 없이 수백 판 돌릴 수 있어요.

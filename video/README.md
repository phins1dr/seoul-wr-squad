# 영상분석 (공격 턴 자동 분할 프로토타입)

2026-11-14에 `C:\Users\phins\wr-video-analysis`에서 옮겨 옴 (그전엔 PC에만 있고 백업이 없었음).

- `segment.py` / `track_mass.py` / `sample_frames.py`: 유튜브를 저장 없이 스트림으로 읽어(480p, 5fps) 선수 무리 위치로 공격 턴을 나눔
- `review.html`: 유튜브 위에서 턴을 확인·수정하고 CSV로 내보내는 화면
- `turns.json`, `*.csv`: 지금까지 돌린 결과

실행 환경(yt-dlp, opencv)은 옛 폴더의 `.venv`에 있음. 영상 프레임(`frames/`)과 슬라이드 캡처는 저장소에 안 올림.

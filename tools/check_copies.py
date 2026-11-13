#!/usr/bin/env python3
"""엔진 부품 복사본이 원본보다 뒤처졌는지 확인.

사용법: python tools/check_copies.py   (저장소 루트에서)
- engine/COPIES.json 의 목록을 읽어, 원본 파일의 지금 hash와 복사할 때 적어 둔 hash를 비교한다.
- 뒤처진 복사본이 있으면 종료 코드 1. 엔진을 고친 뒤 커밋 전에 돌릴 것.
- 아티팩트에 다시 올린 뒤에는 COPIES.json 의 hash와 synced를 고친다.
"""
import hashlib, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def h(path):
    return hashlib.sha256(open(path, 'rb').read().replace(b'\r\n', b'\n')).hexdigest()[:16]

data = json.load(open(os.path.join(ROOT, 'engine', 'COPIES.json'), encoding='utf-8'))
stale = 0
for c in data['copies']:
    src = os.path.join(ROOT, c['source'])
    now = h(src) if os.path.exists(src) else 'missing'
    if c['kind'] == 'old-embedded':
        state = '옛 코드 (교체 예정)'
        stale += 1
    elif now == c['hash']:
        state = 'OK'
    else:
        state = '원본이 바뀜 → 다시 올리기' if c['kind'] == 'same' else '원본이 바뀜 → 바뀐 부분 손으로 옮기기'
        stale += 1
    print(f"[{state}] {c['where']} · {c['file']} ← {c['source']} (맞춘 날 {c['synced'] or '-'})")
print(f"\n뒤처진 복사본 {stale}개" if stale else "\n모든 복사본이 원본과 같음")
sys.exit(1 if stale else 0)

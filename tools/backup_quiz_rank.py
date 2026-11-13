#!/usr/bin/env python3
"""퀴즈 챔피언십 공유 랭킹(Firebase Firestore) 백업.

사용법: python backup_quiz_rank.py <저장 폴더> [최근 몇 주, 기본 12]
- players(누적), hall(명예의 전당), weeks/<주>/players(주간) 를 JSON으로 저장
- 랭킹은 누구나 읽을 수 있게 열려 있어서 로그인 없이 읽힘 (쓰기는 안 함)
"""
import json, os, sys, datetime, urllib.request, urllib.error

BASE = 'https://firestore.googleapis.com/v1/projects/wr-quiz-fceaa/databases/(default)/documents/'

def fetch(path):
    docs, token = [], ''
    while True:
        url = BASE + path + '?pageSize=300' + ('&pageToken=' + token if token else '')
        try:
            d = json.load(urllib.request.urlopen(url, timeout=30))
        except urllib.error.HTTPError as e:
            if e.code == 404: return docs
            raise
        docs += d.get('documents', [])
        token = d.get('nextPageToken')
        if not token: return docs

out = sys.argv[1]
weeks = int(sys.argv[2]) if len(sys.argv) > 2 else 12
os.makedirs(out, exist_ok=True)
res = {'players': fetch('players'), 'hall': fetch('hall'), 'weeks': {}}
today = datetime.date.today()
for i in range(weeks):
    y, w, _ = (today - datetime.timedelta(weeks=i)).isocalendar()
    wk = f'{y}-W{w:02d}'
    docs = fetch(f'weeks/{wk}/players')
    if docs: res['weeks'][wk] = docs
fn = os.path.join(out, f'quiz-rank-{today}.json')
json.dump(res, open(fn, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(fn, 'players', len(res['players']), 'hall', len(res['hall']), 'weeks', {k: len(v) for k, v in res['weeks'].items()})

"""유튜브 영상을 파일로 저장하지 않고 스트림에서 바로 몇 장면을 뽑아 확인한다."""
import sys
import cv2
import yt_dlp

URL = sys.argv[1]
TIMES = [float(t) for t in sys.argv[2].split(",")]  # 초 단위
OUT = sys.argv[3] if len(sys.argv) > 3 else "frames"
FMT = sys.argv[4] if len(sys.argv) > 4 else "136"  # 720p mp4

with yt_dlp.YoutubeDL({"quiet": True, "format": FMT}) as ydl:
    info = ydl.extract_info(URL, download=False)
stream = info["url"]

import os
os.makedirs(OUT, exist_ok=True)
cap = cv2.VideoCapture(stream)
print("fps", cap.get(cv2.CAP_PROP_FPS), "size", cap.get(3), cap.get(4))
for t in TIMES:
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, frame = cap.read()
    if ok:
        path = os.path.join(OUT, f"t{int(t):05d}.jpg")
        cv2.imwrite(path, frame)
        print("saved", path)
    else:
        print("fail", t)

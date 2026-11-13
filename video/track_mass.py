"""유튜브 스트림을 저장 없이 읽어, 코트 위 선수 무리의 위치(코트 길이 방향)를 시간별로 기록한다.

출력 CSV: t(초), n(움직이는 물체 수), cx(무리 중심, 0=가까운 골라인 ~ 28=먼 골라인), xs(각 물체 x 목록)
"""
import sys, csv, time
import numpy as np
import cv2
import yt_dlp

URL = sys.argv[1]
OUT = sys.argv[2]
START = float(sys.argv[3]) if len(sys.argv) > 3 else 0
END = float(sys.argv[4]) if len(sys.argv) > 4 else 1e9
FMT = "135"          # 854x480 mp4 (가볍게)
STEP = 6             # 30fps 중 6프레임마다 1장 → 초당 5장

# 720p 기준 골라인 콘(아래쪽 밑동) 좌표 → 코트 좌표(m). x: 골라인 사이 28m, y: 콘 간격 8m
IMG720 = np.float32([[259, 488], [482, 660], [876, 342], [1067, 352]])
COURT = np.float32([[0, 3.5], [0, 11.5], [28, 3.5], [28, 11.5]])

with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "format": FMT}) as ydl:
    info = ydl.extract_info(URL, download=False)
cap = cv2.VideoCapture(info["url"])
W, H = int(cap.get(3)), int(cap.get(4))
sc = W / 1280.0
Himg2court = cv2.getPerspectiveTransform(IMG720 * sc, COURT)
Hcourt2img = np.linalg.inv(Himg2court)

# 코트(여유 포함) 영역 마스크
poly = np.float32([[-1.5, -0.5], [29.5, -0.5], [29.5, 15.5], [-1.5, 15.5]]).reshape(-1, 1, 2)
poly_img = cv2.perspectiveTransform(poly, Hcourt2img).reshape(-1, 2).astype(np.int32)
mask = np.zeros((H, W), np.uint8)
cv2.fillPoly(mask, [poly_img], 255)

bg = cv2.createBackgroundSubtractorMOG2(history=300, varThreshold=32, detectShadows=False)
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

if START > 0:
    cap.set(cv2.CAP_PROP_POS_MSEC, START * 1000)
fps = cap.get(cv2.CAP_PROP_FPS) or 30
idx = 0
t0 = time.time()
with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["t", "n", "cx", "xs"])
    while True:
        if idx % STEP:
            if not cap.grab():
                break
            idx += 1
            continue
        ok, frame = cap.read()
        if not ok:
            break
        t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
        idx += 1
        if t > END:
            break
        small = cv2.GaussianBlur(frame, (5, 5), 0)
        fg = bg.apply(small)
        fg = cv2.bitwise_and(fg, mask)
        fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, kernel)
        fg = cv2.dilate(fg, kernel, iterations=2)
        cnts, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        pts = []
        for c in cnts:
            if cv2.contourArea(c) < 60 * sc * sc:
                continue
            x, y, bw, bh = cv2.boundingRect(c)
            pts.append([x + bw / 2, y + bh])  # 바퀴가 닿는 아래쪽 중앙
        xs = []
        if pts:
            cp = cv2.perspectiveTransform(np.float32(pts).reshape(-1, 1, 2), Himg2court).reshape(-1, 2)
            xs = [round(float(p[0]), 1) for p in cp if -2 <= p[0] <= 30 and -1 <= p[1] <= 16]
        cx = round(float(np.median(xs)), 2) if xs else ""
        w.writerow([round(t, 2), len(xs), cx, " ".join(map(str, xs))])
        if idx % (STEP * 300) == 0:
            el = time.time() - t0
            print(f"t={t:7.1f}s  elapsed={el:6.1f}s  speed={(t-START)/max(el,1e-3):4.1f}x", flush=True)
print("done", time.time() - t0)

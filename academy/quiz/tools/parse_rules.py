#!/usr/bin/env python3
# 규정집 Part I (책 1~91쪽, PDF 12~102쪽) 텍스트를 조항 단위 JSON으로 변환한다.
# 퀴즈 화면은 이 결과(data/rules.json)를 읽기만 한다. 럭비 브레인(engine/rugby-brain.js)에는 아무것도 넣지 않는다.
# - 영문 페이지와 국문 페이지를 각각 스트림으로 이어 붙이고, 조항 제목으로 짝지어 하나로 만든다.
# - 조항 번호는 목차(Ⅰ장 목차, p007~009)를 기준으로 삼는다.
#   (원문 본문은 66조가 빠지고 69조가 두 번 나오는 인쇄상 결함이 있어, 본문 머리 번호를 그대로 쓰면 어긋난다)
# - 페이지 꼬리글("- 12 -")·머리글·장 표시는 본문에서 제거한다.
import json, re, os

# 사용법:
#   python3 tools/parse_rules.py <규정집.pdf> data/rules.json
#   (pypdf 필요. PDF 12~102쪽 = 책 1~91쪽 구간을 읽는다)
import sys, tempfile
TXT = os.environ.get("WWR_TEXT_DIR") or tempfile.mkdtemp(prefix="wwr_pages_")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "data", "rules.json")
FIRST, LAST = 12, 102

HANGUL = re.compile(r"[\uac00-\ud7a3]")
FOOTER = re.compile(r"^\s*-\s*(\d+)\s*-\s*$")
EN_ART = re.compile(r"^Article\s+(\d+)\s*[.:]\s*(.*)$")
KO_ART = re.compile(r"^(\d{1,3})\s*조\s*(.*)$")
LIST = re.compile(r"^(\s{2,}|[a-z]\.\s|[ivx]+\.\s|[ⅰ-ⅳ]\.\s|[①-⑳]|[•⚫▪◦]\s?|[-–]\s|\(?[0-9]{1,2}\)\s)")
DROP_HEAD = re.compile(r"^(Ⅰ\.|Ⅱ\.|Ⅲ\.|Ⅳ\.)\s*휠체어럭비")
CHAP_EN = re.compile(r"^SECTION\s+(\d+)\s*[.:]?\s*(.*)$", re.I)
CHAP_KO = re.compile(r"^(\d{1,2})장\s+([^\(]+)\((.+)\)\s*$")
APPX = re.compile(r"^부록\s*([A-C])\s*[-–‐‑]?\s*(.*?)\s*\((.*?)\)\s*$", re.M)


def norm(s):
    s = s.lower()
    s = s.replace("–", "-").replace("—", "-").replace("’", "'").replace("‘", "'")
    s = s.replace("centre", "center").replace("metre", "meter")
    s = s.replace("time out", "time-out")
    s = re.sub(r"[^0-9a-z가-힣]+", "", s)
    return s


def read_page(n):
    t = open(os.path.join(TXT, f"p{n:03d}.txt"), encoding="utf-8").read()
    page_no, out = None, []
    for ln in t.split("\n"):
        m = FOOTER.match(ln)
        if m:
            page_no = int(m.group(1)); continue
        if DROP_HEAD.match(ln.strip()):
            continue
        out.append(ln)
    lang = "ko" if len(HANGUL.findall("\n".join(out))) > 25 else "en"
    return page_no, lang, out


def clean_lines(lines, lang):
    paras, cur = [], ""
    for raw in lines:
        line = raw.rstrip("\r\n")
        if not line.strip():
            if cur: paras.append(cur); cur = ""
            continue
        lead = len(line) - len(line.lstrip())
        body = line[lead:]                 # 줄 끝의 공백은 그대로 둔다(원문의 띄어쓰기 단서)
        indented = lead >= 2
        is_list = bool(LIST.match(line)) and not body.startswith("  ")
        if cur and (indented or is_list):
            paras.append(cur); cur = ""
        if not cur:
            cur = body
        elif lang == "en":
            if cur.endswith("-"):
                cur = cur[:-1] + body
            elif cur.endswith(" "):
                cur += body
            else:
                cur += " " + body
        else:
            cur += body
    if cur: paras.append(cur)
    return paras


def split_long(paras, limit=420, target=300):
    """아주 긴 문단을 문장 경계에서만 나눈다(내용은 그대로, 읽기용 문단 나눔)."""
    out = []
    for para in paras:
        if len(para) <= limit:
            out.append(para); continue
        parts = re.split(r"(?<=[.!?])\s+(?=[가-힣A-Z(])", para)
        buf = ""
        for part in parts:
            if buf and len(buf) + len(part) + 1 > target:
                out.append(buf); buf = part
            else:
                buf = (buf + " " + part) if buf else part
        if buf: out.append(buf)
    return out


def fix_spacing(s):
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\s+([,.;:!?])", r"\1", s)
    if HANGUL.search(s):
        s = re.sub(r"([.;!?])([가-힣])", r"\1 \2", s)
        s = re.sub(r"([)】])([가-힣])", r"\1 \2", s)
    return s.strip()


def parse_stream(pages, lang_key):
    """페이지들을 순서대로 훑어 조항 단위로 자른다. 반환: [{'no':본문머리번호,'title':...,'page':...,'paras':[...]}] + 머리말"""
    items, preface = [], []
    cur = None            # 현재 조항 item
    buf = []              # (line, lang)
    first_page_body = []

    def flush():
        nonlocal buf
        if not buf: return
        grouped = {"ko": [], "en": []}
        # 언어가 바뀌는 페이지 경계에서 문단 합치기가 섞이지 않도록 페이지 단위로 먼저 처리
        runs = []
        for line, lang in buf:
            if runs and runs[-1][0] == lang: runs[-1][1].append(line)
            else: runs.append((lang, [line]))
        paras = []
        for lang, lines in runs:
            paras.extend(fix_spacing(p) for p in clean_lines(lines, lang) if fix_spacing(p))
        if cur is None:
            preface.extend(paras)
        else:
            cur["paras"].extend(paras)
        buf = []

    for pdfp, bookp, lang0, lines in pages:
        for ln in lines:
            s = ln.strip()
            if not s: continue
            if CHAP_EN.match(s) or CHAP_KO.match(s):
                continue     # 장 표시(페이지 여백에 찍힌 것)는 본문에서 제외
            m = (EN_ART.match(s) if lang_key == "en" else KO_ART.match(s))
            if m:
                flush()
                cur = {"no": int(m.group(1)), "title": m.group(2).strip(), "page": bookp, "paras": []}
                items.append(cur)
                continue
            buf.append((ln, lang_key))
    flush()
    return items, preface


def extract_pages(pdf_path):
    import pypdf
    r = pypdf.PdfReader(pdf_path)
    os.makedirs(TXT, exist_ok=True)
    for i in list(range(3, 10)) + list(range(FIRST, LAST + 3)):   # 3~9쪽은 목차
        t = r.pages[i - 1].extract_text() or ""
        open(os.path.join(TXT, f"p{i:03d}.txt"), "w", encoding="utf-8").write(t)
    print(f"PDF에서 {LAST - FIRST + 1}쪽 텍스트 추출 → {TXT}")


def main():
    if len(sys.argv) > 1 and sys.argv[1].lower().endswith(".pdf"):
        extract_pages(sys.argv[1])
    pages = []
    for n in range(FIRST, LAST + 1):
        book, lang, lines = read_page(n)
        pages.append((n, book if book else n - 11, lang, lines))

    # 목차 → 장/조항 기준 번호
    toc = ""
    for n in (7, 8, 9):
        toc += open(os.path.join(TXT, f"p{n:03d}.txt"), encoding="utf-8").read() + "\n"
    chapters, toc_articles, cur_ch = [], [], None
    for line in toc.split("\n"):
        s = line.strip()
        m = re.match(r"^(\d{1,2})장\s+(.+?)\((.+?)\)", s)
        if m:
            cur_ch = {"id": int(m.group(1)), "title": m.group(2).strip(), "en": m.group(3).strip(), "articles": []}
            chapters.append(cur_ch); continue
        m = re.match(r"^(\d{1,3})조\s+(.+?)\((.+?)\)", s)
        if m:
            no = int(m.group(1))
            toc_articles.append({"no": no, "ko": m.group(2).strip(), "en": m.group(3).strip(), "chapter": cur_ch["id"] if cur_ch else None})
            if cur_ch: cur_ch["articles"].append(no)
    chapters.sort(key=lambda c: c["id"])

    en_items, en_pre = parse_stream([p for p in pages if p[2] == "en"], "en")
    ko_items, ko_pre = parse_stream([p for p in pages if p[2] == "ko"], "ko")

    # 본문 머리 번호 → 기준 번호(목차) 매핑
    #  - 국문 머리줄은 "정의 ( Definition )"처럼 영문이 괄호로 붙어 있어 괄호 앞만 제목으로 본다.
    #  - 목차에 없는 제목이 여러 단어짜리로 잡히면(예: 잘못 끼어든 "Article 7. All lines ...")
    #    새 조항이 아니라 앞 조항 이어짐으로 처리한다.
    def canonicalize(items, lang):
        out, prev, notes = [], None, []
        for it in items:
            title = it["title"]
            core = title
            m = re.match(r"^(.*?)\s*\(\s*(.*?)\s*\)\s*$", title)
            if m and lang == "ko":
                core = m.group(1)
            key = norm(core)
            exact = [c for c in toc_articles if norm(c[lang]) == key]
            if exact:
                # 같은 제목이 여러 장에 있는 경우(예: 89조·99조 "정의 및 제재조치") 머리 번호와 가까운 쪽
                match = sorted(exact, key=lambda c: (c["no"] != it["no"], abs(c["no"] - it["no"])))[0]
            else:
                match = None
                if len(key) >= 3:
                    near = [c for c in toc_articles if norm(c[lang]).startswith(key) or key.startswith(norm(c[lang]))]
                    if near:
                        match = sorted(near, key=lambda c: abs(c["no"] - it["no"]))[0]
            if match:
                out.append({"no": match["no"], "paras": it["paras"], "page": it["page"], "title": core})
                prev = out[-1]
                if match["no"] != it["no"]:
                    notes.append((it["no"], match["no"], core))
            elif prev is not None and len(core.split()) > 4:
                # 조항 머리글이 아닌 줄이 "Article 7."처럼 잘못 잡힌 경우 → 앞 조항 이어짐
                prev["paras"].extend(it["paras"])
                notes.append((it["no"], "앞 조항에 합침", core[:40]))
            else:
                out.append({"no": it["no"], "paras": it["paras"], "page": it["page"], "title": core})
                prev = out[-1]
                notes.append((it["no"], "번호 유지(목차 미일치)", core[:40]))
        return out, notes

    en_can, en_notes = canonicalize(en_items, "en")
    ko_can, ko_notes = canonicalize(ko_items, "ko")


    def to_store(items):
        store = {}
        for it in items:
            cur = store.setdefault(it["no"], {"paras": [], "page": None})
            cur["paras"].extend(it["paras"])
            if it["page"] and (cur["page"] is None or it["page"] < cur["page"]):
                cur["page"] = it["page"]
        return store

    en_by_no, ko_by_no = to_store(en_can), to_store(ko_can)

    articles = []
    missing_ko, missing_en, empty, thin = [], [], [], []
    for t in toc_articles:
        e = en_by_no.get(t["no"], {})
        k = ko_by_no.get(t["no"], {})
        body_ko, body_en = k.get("paras", []), e.get("paras", [])
        if not body_ko: missing_ko.append(t["no"])
        if not body_en: missing_en.append(t["no"])
        if not body_ko and not body_en: empty.append(t["no"])
        if len("".join(body_ko)) < 15 or len("".join(body_en)) < 15:
            thin.append((t["no"], len("".join(body_ko)), len("".join(body_en))))
        articles.append({
            "no": t["no"],
            "chapter": t["chapter"],
            "titleKo": t["ko"],
            "titleEn": t["en"],
            "page": k.get("page") or e.get("page"),
            "bodyKo": split_long(body_ko),
            "bodyEn": split_long(body_en),
        })

    # 부록(도해/서식만 있는 페이지)
    appendices = []
    for n in range(102, 105):
        t = open(os.path.join(TXT, f"p{n:03d}.txt"), encoding="utf-8").read()
        m = APPX.search(t)
        if m:
            appendices.append({"id": m.group(1), "titleKo": (m.group(2) or "").strip(), "titleEn": m.group(3).strip(), "page": n - 11})

    meta = {
        "title": "휠체어럭비 경기규정",
        "edition": "International Rules for the Sport of Wheelchair Rugby — 2021년 1월 15일 IWRF(현 World Wheelchair Rugby) 기술위원회 출판 · 대한장애인럭비협회 번역·편집",
        "scope": "Ⅰ. 휠체어럭비 경기규정 (책 1~91쪽) — 조문 1~112조 및 부록 A~C",
        "note": "원문(영문)과 국문 번역을 그대로 옮겼습니다. 요약·의역하지 않았습니다. 원문 조판상 66조 머리글이 누락되고 69조가 두 번 인쇄되어 있어, 조항 번호는 규정집 목차를 기준으로 바로잡았습니다.",
        "sourceNote": "출처 표기: World Wheelchair Rugby(구 IWRF) 국제 경기규정 및 대한장애인럭비협회 한국어 번역본(2021). 원문을 변형 없이 인용 형태로 수록.",
        "articleCount": len(articles),
        "chapterCount": len(chapters),
    }
    data = {
        "meta": meta,
        "preface": {"ko": [fix_spacing(x) for x in ko_pre if x.strip()], "en": [fix_spacing(x) for x in en_pre if x.strip()]},
        "chapters": chapters,
        "articles": articles,
        "appendices": appendices,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # ---- 검증 ----
    ch = lambda ps: len("".join(ps))
    print(f"장 {len(chapters)}개 / 조항 {len(articles)}개 / 부록 {len(appendices)}개")
    print("1~112 누락:", [n for n in range(1, 113) if n not in {a['no'] for a in articles}])
    print("국문 없음:", missing_ko)
    print("영문 없음:", missing_en)
    print("양쪽 빈 조항:", empty)
    print("15자 미만:", thin)
    print("영문 머리번호 보정:", en_notes)
    print("국문 머리번호 보정:", ko_notes)
    print("장 배정 없음:", [a["no"] for a in articles if a["chapter"] is None])
    bad = []
    for a in articles:
        for p in a["bodyKo"] + a["bodyEn"]:
            if re.match(r"^-\s*\d+\s*-$", p) or re.match(r"^(Ⅰ|Ⅱ|Ⅲ|Ⅳ)\.", p) or re.match(r"^SECTION\s+\d+", p) or FOOTER.match(p):
                bad.append((a["no"], p[:50]))
    print("머리글/꼬리글 잔여:", len(bad), bad[:5])
    print("국문 글자수:", sum(ch(a['bodyKo']) for a in articles), "/ 영문:", sum(ch(a['bodyEn']) for a in articles))
    print("출력:", OUT, os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()

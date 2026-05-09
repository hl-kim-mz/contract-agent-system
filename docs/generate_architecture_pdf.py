# -*- coding: utf-8 -*-
"""
CAS Architecture PDF Generator  (v2)
3-page focused doc: 에이전트 구성 및 워크플로우
Font: Malgun Gothic (Windows 기본 한글 TTF)
"""

import os, math
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.platypus.flowables import Flowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ─── Korean Font (TTF only – OTF 제외) ────────────────────────
_FONT_CANDIDATES = [
    (r"C:\Windows\Fonts\malgun.ttf",   r"C:\Windows\Fonts\malgunbd.ttf"),
    (r"C:\Windows\Fonts\malgun.ttf",   r"C:\Windows\Fonts\malgun.ttf"),
    (r"C:\Windows\Fonts\NanumGothic.ttf", r"C:\Windows\Fonts\NanumGothicBold.ttf"),
]
BASE_FONT = BASE_FONT_BOLD = "Helvetica"
for _reg, _bold in _FONT_CANDIDATES:
    if os.path.exists(_reg):
        try:
            pdfmetrics.registerFont(TTFont("KR",     _reg))
            pdfmetrics.registerFont(TTFont("KR-Bold", _bold if os.path.exists(_bold) else _reg))
            BASE_FONT      = "KR"
            BASE_FONT_BOLD = "KR-Bold"
            break
        except Exception:
            continue

W, H = A4

# ─── Color Palette ────────────────────────────────────────────
CP  = colors.HexColor("#1A56DB")   # Primary blue
CS  = colors.HexColor("#2563EB")   # Secondary blue
CAI = colors.HexColor("#7C3AED")   # AI agent purple
CCO = colors.HexColor("#059669")   # Code green
CAW = colors.HexColor("#FF9900")   # AWS orange
CDB = colors.HexColor("#3B48CC")   # DynamoDB blue
CGY = colors.HexColor("#64748B")   # Gray text
CBL = colors.HexColor("#F8FAFC")   # Background light
CBB = colors.HexColor("#EFF6FF")   # Background blue
CBP = colors.HexColor("#F5F3FF")   # Background purple
CHR = colors.HexColor("#DC2626")   # High risk
CMR = colors.HexColor("#D97706")   # Medium risk
CLR = colors.HexColor("#059669")   # Low risk
CBR = colors.HexColor("#CBD5E1")   # Border

# ─── Styles ───────────────────────────────────────────────────
def S():
    return {
        "h1":   ParagraphStyle("H1",  fontSize=16, leading=20, spaceAfter=6, spaceBefore=14,
                               fontName=BASE_FONT_BOLD, textColor=CP),
        "h2":   ParagraphStyle("H2",  fontSize=11, leading=15, spaceAfter=4, spaceBefore=10,
                               fontName=BASE_FONT_BOLD, textColor=CP),
        "body": ParagraphStyle("Bd",  fontSize=8.5, leading=13, spaceAfter=3,
                               fontName=BASE_FONT, textColor=colors.HexColor("#1E293B")),
        "cap":  ParagraphStyle("Cap", fontSize=7.5, leading=10, spaceAfter=4,
                               fontName=BASE_FONT, textColor=CGY, alignment=TA_CENTER),
        "note": ParagraphStyle("Nt",  fontSize=8, leading=12, spaceAfter=3,
                               fontName=BASE_FONT, textColor=CGY, leftIndent=8),
    }

def tbl(hbg=CP, alt=CBL):
    return TableStyle([
        ("BACKGROUND",   (0,0),(-1,0), hbg),
        ("TEXTCOLOR",    (0,0),(-1,0), colors.white),
        ("FONTNAME",     (0,0),(-1,0), BASE_FONT_BOLD),
        ("FONTSIZE",     (0,0),(-1,0), 8),
        ("ALIGN",        (0,0),(-1,0), "CENTER"),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white, alt]),
        ("FONTNAME",     (0,1),(-1,-1), BASE_FONT),
        ("FONTSIZE",     (0,1),(-1,-1), 7.5),
        ("VALIGN",       (0,0),(-1,-1), "MIDDLE"),
        ("GRID",         (0,0),(-1,-1), 0.4, CBR),
        ("TOPPADDING",   (0,0),(-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
        ("LEFTPADDING",  (0,0),(-1,-1), 5),
        ("RIGHTPADDING", (0,0),(-1,-1), 5),
    ])

# ══════════════════════════════════════════════════════════════
#  SHARED DRAW HELPERS
# ══════════════════════════════════════════════════════════════

def draw_box(c, x, y, bw, bh, fill, stroke, lines,
             tc=colors.white, fsize=7.5, radius=3):
    """Rounded rect with vertically centred multi-line text."""
    c.setFillColor(fill); c.setStrokeColor(stroke); c.setLineWidth(0.8)
    c.roundRect(x, y, bw, bh, radius, fill=1, stroke=1)
    c.setFillColor(tc)
    n = len(lines); lh = fsize * 1.28
    ty = y + bh/2 + (n-1)*lh/2 - fsize*0.26
    for i, line in enumerate(lines):
        c.setFont(BASE_FONT_BOLD if i == 0 else BASE_FONT, fsize)
        c.drawCentredString(x + bw/2, ty, line)
        ty -= lh

def draw_arrow(c, x1, y1, x2, y2, color=CGY, lw=0.9, al=5):
    """Line + filled arrowhead."""
    c.setStrokeColor(color); c.setFillColor(color); c.setLineWidth(lw)
    c.line(x1, y1, x2, y2)
    ang = math.atan2(y2-y1, x2-x1)
    pts = [x2, y2,
           x2 - al*math.cos(ang+0.4), y2 - al*math.sin(ang+0.4),
           x2 - al*math.cos(ang-0.4), y2 - al*math.sin(ang-0.4)]
    p = c.beginPath()
    p.moveTo(pts[0], pts[1]); p.lineTo(pts[2], pts[3]); p.lineTo(pts[4], pts[5])
    p.close(); c.drawPath(p, fill=1, stroke=0)

def arrow_label(c, x, y, label, fsize=6):
    c.setFont(BASE_FONT, fsize); c.setFillColor(CGY)
    c.drawCentredString(x, y, label)

# ══════════════════════════════════════════════════════════════
#  PAGE 1 DIAGRAM  — 전체 시스템 아키텍처
# ══════════════════════════════════════════════════════════════

class ArchDiagram(Flowable):
    W, H = 170*mm, 118*mm
    def wrap(self, *a): return (self.W, self.H)

    def draw(self):
        c = self.canv; w, h = self.W, self.H

        # ── 1. UI Layer ──────────────────────────────────────
        draw_box(c, 8, h-30, w-16, 26, CP, CS,
                 ["사용자 인터페이스",
                  "대시보드  |  업로드  |  리스크리포트  |  Diff뷰  |  워크플로우  |  검색"],
                 fsize=7.5)

        draw_arrow(c, w/2, h-30, w/2, h-42)
        arrow_label(c, w/2+18, h-38, "HTTP / FastAPI")

        # ── 2. API Gateway ───────────────────────────────────
        draw_box(c, 8, h-62, w-16, 18, CS, CP,
                 ["API Gateway",
                  "/upload  /contracts  /workflow  /search  /settings"],
                 fsize=7.5)

        # ── 3. Three Columns ─────────────────────────────────
        cy = h-94; ch = 28; cg = 4
        col_defs = [
            (8,            w*0.31-4,  CCO, colors.HexColor("#047857"),
             ["DOCX 파서", "코드 기반 처리"]),
            (w*0.31+cg,    w*0.38-4,  CAI, colors.HexColor("#6D28D9"),
             ["Strands Agent SDK", "Risk Agent  |  Search Agent"]),
            (w*0.69+cg,    w*0.31-12, CCO, colors.HexColor("#047857"),
             ["Rule Engine", "코드 기반 라우팅"]),
        ]
        xs = [8, w*0.31+cg, w*0.69+cg]
        for i, (x, bw, fill, stroke, lines) in enumerate(col_defs):
            draw_arrow(c, x + bw/2, h-62, x + bw/2, cy+ch)
            draw_box(c, x, cy, bw, ch, fill, stroke, lines, fsize=7)

        # ── 4. AWS Infra container ───────────────────────────
        iy = 4; ih = cy - 10
        c.setFillColor(colors.HexColor("#FFF7ED"))
        c.setStrokeColor(CAW); c.setLineWidth(1.2)
        c.roundRect(8, iy, w-16, ih, 5, fill=1, stroke=1)
        c.setFillColor(CAW); c.setFont(BASE_FONT_BOLD, 8)
        c.drawCentredString(w/2, iy + ih - 10, "AWS 인프라")

        iw = (w-40) / 3
        infra = [
            (16,           ["Amazon S3", "계약서 원본 / JSON"],
             colors.HexColor("#E65C00"), colors.HexColor("#B34500")),
            (16+iw+4,      ["Amazon DynamoDB", "contracts / risks / workflow"],
             CDB, colors.HexColor("#2A36A8")),
            (16+iw*2+8,    ["AWS Bedrock", "Claude 3.5 Sonnet v2 / KB"],
             CAI, colors.HexColor("#6D28D9")),
        ]
        for x, lines, fill, stroke in infra:
            draw_box(c, x, iy+6, iw, ih-18, fill, stroke, lines, fsize=7)

        # arrows col → infra
        for x, bw, *_ in col_defs:
            draw_arrow(c, x+bw/2, cy, x+bw/2, iy+ih-6, color=CGY)


# ══════════════════════════════════════════════════════════════
#  PAGE 2 DIAGRAM  — Agent 오케스트레이션
# ══════════════════════════════════════════════════════════════

class AgentDiagram(Flowable):
    W, H = 170*mm, 110*mm
    def wrap(self, *a): return (self.W, self.H)

    def draw(self):
        c = self.canv; w, h = self.W, self.H

        # ── Orchestrator ──────────────────────────────────────
        ox, oy, ow, oh = w/2-45, h-36, 90, 28
        draw_box(c, ox, oy, ow, oh, CP, CS,
                 ["Orchestrator Agent", "Strands SDK  ·  FastAPI /workflow"],
                 fsize=8)

        # ── parse_contract (코드) ─────────────────────────────
        px, py, pw, ph = 6, h-76, 60, 24
        draw_box(c, px, py, pw, ph, CCO, colors.HexColor("#047857"),
                 ["parse_contract()", "코드 함수", "Contract JSON 생성"], fsize=7)
        draw_arrow(c, ox, oy+oh/2, px+pw, py+ph/2)
        arrow_label(c, (ox+px+pw)/2, py+ph/2+5, "호출")

        # ── Risk Agent ───────────────────────────────────────
        rax, ray, raw, rah = w/2-36, h-80, 72, 26
        draw_box(c, rax, ray, raw, rah, CAI, colors.HexColor("#6D28D9"),
                 ["Risk Agent", "Agent-as-Tool (Sub-Agent)"], fsize=7.5)
        draw_arrow(c, w/2, oy, w/2, ray+rah)
        arrow_label(c, w/2+18, ray+rah+6, "review_contract_risks()")

        # ── Risk Tools ───────────────────────────────────────
        tool_y = h-108; tool_h = 18; tool_w = 50; gap = 4
        tools = [
            ("check_risk()", "LLM 리스크 탐지", CAI),
            ("diff_with_prev()", "코드+LLM 비교", CCO),
            ("analyze_fin()", "LLM 재무 분석", CAI),
        ]
        total_tw = len(tools)*(tool_w+gap) - gap
        tx_start = w/2 - total_tw/2
        for i, (name, sub, col) in enumerate(tools):
            tx = tx_start + i*(tool_w+gap)
            draw_box(c, tx, tool_y, tool_w, tool_h, col, col,
                     [name, sub], fsize=6)
            draw_arrow(c, rax+raw/2, ray, tx+tool_w/2, tool_y+tool_h)

        # ── route_reviewers (코드) ────────────────────────────
        rvx, rvy, rvw, rvh = w-68, h-76, 64, 24
        draw_box(c, rvx, rvy, rvw, rvh, CCO, colors.HexColor("#047857"),
                 ["route_reviewers()", "Rule Engine", "검토자 라우팅"], fsize=7)
        draw_arrow(c, ox+ow, oy+oh/2, rvx, rvy+rvh/2)
        arrow_label(c, (ox+ow+rvx)/2, rvy+rvh/2+5, "호출")

        # ── Search Agent (독립) ───────────────────────────────
        sax, say, saw, sah = w-66, 8, 62, 30
        draw_box(c, sax, say, saw, sah,
                 colors.HexColor("#0891B2"), colors.HexColor("#0E7490"),
                 ["Search Agent", "독립 엔드포인트", "search_contract_history()"], fsize=6.5)

        # dashed separator
        c.setStrokeColor(CBR); c.setLineWidth(0.5); c.setDash([3,3])
        c.line(sax-6, 0, sax-6, h)
        c.setDash()
        c.setFont(BASE_FONT, 6); c.setFillColor(CGY)
        c.drawString(sax-5, h-10, "별도 실행")

        # Legend
        legend = [("■ AI (LLM)", CAI), ("■ 코드", CCO), ("■ 인프라", CAW)]
        lx = 8
        for txt, col in legend:
            c.setFillColor(col); c.setFont(BASE_FONT_BOLD, 6.5)
            c.drawString(lx, 8, txt); lx += 48


# ══════════════════════════════════════════════════════════════
#  PAGE 3 DIAGRAM A — 데이터 흐름 (스윔레인)
# ══════════════════════════════════════════════════════════════

class DataFlowDiagram(Flowable):
    W, H = 116*mm, 88*mm
    def wrap(self, *a): return (self.W, self.H)

    def draw(self):
        c = self.canv; w, h = self.W, self.H
        lanes = ["영업팀", "API", "처리 파이프라인", "저장소"]
        lw = w / len(lanes); lh_hdr = 16

        lane_colors = [CBB, CBL, CBP, colors.HexColor("#FFF7ED")]
        hdr_colors  = [CP,  CS,  CAI, CAW]

        for i in range(len(lanes)):
            c.setFillColor(lane_colors[i]); c.rect(i*lw, 0, lw, h, fill=1, stroke=0)
            c.setFillColor(hdr_colors[i]);  c.rect(i*lw, h-lh_hdr, lw, lh_hdr, fill=1, stroke=0)
            c.setFillColor(colors.white); c.setFont(BASE_FONT_BOLD, 7)
            c.drawCentredString(i*lw+lw/2, h-lh_hdr+4, lanes[i])

        c.setStrokeColor(CBR); c.setLineWidth(0.4)
        for i in range(1, len(lanes)):
            c.line(i*lw, 0, i*lw, h)

        bh = 13
        def sb(lane, yf, text, fill):
            x = lane*lw+3; bw2 = lw-6
            by = (1-yf)*(h-lh_hdr)
            c.setFillColor(fill); c.setStrokeColor(fill); c.setLineWidth(0.6)
            c.roundRect(x, by, bw2, bh, 2, fill=1, stroke=1)
            c.setFillColor(colors.white); c.setFont(BASE_FONT, 6)
            c.drawCentredString(x+bw2/2, by+bh/2-6*0.26, text)
            return x, by, bw2, bh

        def harrow(x1, y, x2):
            draw_arrow(c, x1, y, x2, y, lw=0.7)

        # Each row: (yf0,t0,c0, yf1,t1,c1, yf2,t2,c2, yf3,t3,c3)  — 12 items
        rows = [
            (0.88,"DOCX 업로드",CP,   0.88,"S3 저장",CS,       None,None,None,           0.88,"S3",CAW),
            (0.68,"분석 요청",  CP,   0.68,"parse_contract()",CS, 0.68,"JSON 생성",CCO,  0.68,"S3+DB",CAW),
            (None,None,None,          0.48,"risk_agent()",CAI,  0.48,"check/diff/fin",CAI, 0.48,"Risk→DB",CAW),
            (None,None,None,          0.28,"route_reviewers()",CCO, 0.28,"Workflow",CCO, 0.28,"DB 저장",CAW),
            (0.10,"리포트 수신",CP,   0.10,"응답",CS,           None,None,None,           None,None,None),
        ]

        prev_api_y = None
        for row in rows:
            yf0,t0,c0, yf1,t1,c1, yf2,t2,c2, yf3,t3,c3 = row
            boxes = []
            for lane,(yf,txt,col) in enumerate([(yf0,t0,c0),(yf1,t1,c1),(yf2,t2,c2),(yf3,t3,c3)]):
                boxes.append((lane, sb(lane,yf,txt,col) if txt else None))

            for i in range(len(boxes)-1):
                if boxes[i][1] and boxes[i+1][1]:
                    x1,by1,bw1,bh1 = boxes[i][1]; x2,by2,bw2,bh2 = boxes[i+1][1]
                    harrow(x1+bw1, by1+bh1/2, x2)

            if boxes[1][1]:
                x,by,bw2,bh2 = boxes[1][1]
                if prev_api_y is not None:
                    draw_arrow(c, x+bw2/2, prev_api_y, x+bw2/2, by+bh, lw=0.6)
                prev_api_y = by


# ══════════════════════════════════════════════════════════════
#  PAGE 3 DIAGRAM B — 계약 상태 전이
# ══════════════════════════════════════════════════════════════

class StatusDiagram(Flowable):
    W, H = 54*mm, 88*mm
    def wrap(self, *a): return (self.W, self.H)

    def draw(self):
        c = self.canv; w, h = self.W, self.H
        cx = w/2; bw = 72; bh = 13

        def sb(x, y, text, fill):
            c.setFillColor(fill); c.setStrokeColor(fill); c.setLineWidth(0.7)
            c.roundRect(x-bw/2, y, bw, bh, 3, fill=1, stroke=1)
            c.setFillColor(colors.white); c.setFont(BASE_FONT_BOLD, 7)
            c.drawCentredString(x, y+bh/2-7*0.26, text)

        states = [
            (cx, h-22,  "DRAFT",             CGY),
            (cx, h-40,  "PARSING",           colors.HexColor("#0891B2")),
            (cx, h-58,  "RISK_REVIEWED",      CAI),
            (cx, h-74,  "PENDING_APPROVAL",   CS),
        ]
        ends = [
            (cx-22, h-88, "APPROVED", CLR),
            (cx+22, h-88, "REJECTED", CHR),
        ]

        # start dot
        c.setFillColor(colors.HexColor("#1E293B"))
        c.circle(cx, h-12, 4, fill=1, stroke=0)
        c.setFont(BASE_FONT, 6); c.setFillColor(CGY)
        c.drawCentredString(cx, h-11, "업로드")

        labels = ["파싱 시작", "파싱 완료", "라우팅 완료"]
        prev = (cx, h-12)
        for i, (x, y, name, fill) in enumerate(states):
            draw_arrow(c, prev[0], prev[1]-4, x, y+bh, color=CGY)
            if i > 0:
                arrow_label(c, cx+20, (prev[1]+y+bh)/2, labels[i-1])
            sb(x, y, name, fill)
            prev = (x, y)

        # branch
        lx, ly = states[-1][0], states[-1][1]
        for ex, ey, name, fill in ends:
            draw_arrow(c, lx, ly, ex, ey+bh, color=CGY)
            sb(ex, ey, name, fill)

        # side note
        c.setFillColor(CAI); c.setFont(BASE_FONT, 5.5)
        c.drawString(cx+39, h-54, "→ 리스크 리포트 생성")

        # dashed back arrow
        c.setStrokeColor(CHR); c.setLineWidth(0.5); c.setDash([2,2])
        c.line(cx+22+bw/2, h-88+bh/2, cx+22+bw/2+10, h-88+bh/2)
        c.line(cx+22+bw/2+10, h-88+bh/2, cx+22+bw/2+10, h-22+bh/2)
        draw_arrow(c, cx+22+bw/2+10, h-22+bh/2, cx+bw/2, h-22+bh/2, color=CHR)
        c.setDash()
        c.setFont(BASE_FONT, 5); c.setFillColor(CHR)
        c.drawString(cx+22+bw/2+2, h-55, "재업로드")


# ══════════════════════════════════════════════════════════════
#  PAGE DECORATION
# ══════════════════════════════════════════════════════════════

def header_footer(canvas, doc, title=""):
    canvas.saveState()
    pw, ph = A4
    # header bar
    canvas.setFillColor(CP)
    canvas.rect(0, ph-12*mm, pw, 12*mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white); canvas.setFont(BASE_FONT_BOLD, 9)
    canvas.drawString(18*mm, ph-8*mm, "CAS — Contract Agent System  |  아키텍처 설계서")
    canvas.setFont(BASE_FONT, 8)
    canvas.drawRightString(pw-18*mm, ph-8*mm, f"에이전트 구성 및 워크플로우")
    # footer
    canvas.setStrokeColor(CBR); canvas.setLineWidth(0.4)
    canvas.line(18*mm, 12*mm, pw-18*mm, 12*mm)
    canvas.setFont(BASE_FONT, 7); canvas.setFillColor(CGY)
    canvas.drawString(18*mm, 8.5*mm, "Megazone Digital  ·  2026.05.09")
    canvas.drawRightString(pw-18*mm, 8.5*mm, f"p.{doc.page}")
    canvas.restoreState()

# ══════════════════════════════════════════════════════════════
#  BUILD
# ══════════════════════════════════════════════════════════════

def build(out_path):
    doc = SimpleDocTemplate(
        out_path, pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=18*mm, bottomMargin=18*mm,
    )
    ST = S()
    story = []

    def h1(t): story.append(Paragraph(t, ST["h1"]))
    def h2(t): story.append(Paragraph(t, ST["h2"]))
    def p(t):  story.append(Paragraph(t, ST["body"]))
    def sp(n=4): story.append(Spacer(1, n))
    def hr(): story.append(HRFlowable(width="100%", thickness=0.4, color=CBR, spaceAfter=5))
    def cap(t): story.append(Paragraph(t, ST["cap"]))

    # ══ PAGE 1 ══════════════════════════════════════════════
    # Title block
    title_tbl = Table([[
        Paragraph("CAS", ParagraphStyle("T1", fontSize=28, fontName=BASE_FONT_BOLD,
                                        textColor=CP, leading=32)),
        Paragraph(
            "Contract Agent System<br/>"
            "<font size='9' color='#64748B'>에이전트 구성 및 워크플로우 아키텍처</font>",
            ParagraphStyle("T2", fontSize=14, fontName=BASE_FONT_BOLD,
                           textColor=colors.HexColor("#1E293B"), leading=20)),
    ]], colWidths=[30*mm, 132*mm])
    title_tbl.setStyle(TableStyle([
        ("VALIGN", (0,0),(-1,-1), "MIDDLE"),
        ("LINEAFTER", (0,0),(0,0), 1.5, CP),
        ("LEFTPADDING",(1,0),(1,0), 10),
    ]))
    story.append(title_tbl)
    sp(6)

    # Meta strip
    meta = Table([[
        "Track 3  ·  Multi-Agent System",
        "AWS Bedrock  +  Strands Agent SDK",
        "2026년 5월 9일",
    ]], colWidths=[57.3*mm, 76*mm, 36*mm])
    meta.setStyle(TableStyle([
        ("BACKGROUND",  (0,0),(-1,0), CBB),
        ("FONTNAME",    (0,0),(-1,0), BASE_FONT),
        ("FONTSIZE",    (0,0),(-1,0), 7.5),
        ("ALIGN",       (0,0),(-1,0), "CENTER"),
        ("TOPPADDING",  (0,0),(-1,0), 4),
        ("BOTTOMPADDING",(0,0),(-1,0), 4),
        ("BOX",         (0,0),(-1,0), 0.4, CBR),
        ("INNERGRID",   (0,0),(-1,0), 0.4, CBR),
    ]))
    story.append(meta)
    sp(8)

    h1("1. 전체 시스템 아키텍처")
    p("계약서 DOCX 업로드부터 리스크 탐지 · 버전 비교 · 검토 라우팅 · 히스토리 검색까지 "
      "3개의 AI Agent가 협력하는 Multi-Agent 계약 검토 시스템입니다.")
    sp(5)
    story.append(ArchDiagram())
    cap("그림 1. CAS 전체 아키텍처 — UI · API · Agent · AWS 인프라 레이어")

    # ══ PAGE 2 ══════════════════════════════════════════════
    story.append(PageBreak())
    h1("2. Agent 구성 및 오케스트레이션")
    p("Strands Agent SDK 기반 계층적 Multi-Agent 구조입니다. "
      "Orchestrator가 코드 함수·Sub-Agent·Rule Engine을 조율하며, "
      "Search Agent는 RAG 엔드포인트로 독립 운영됩니다.")
    sp(5)
    story.append(AgentDiagram())
    cap("그림 2. Agent 오케스트레이션 흐름 — Orchestrator → Risk Agent(Tools) / Search Agent")
    sp(8)
    hr()

    h2("AI vs 코드 역할 분담")
    role_data = [
        ["구성 요소", "처리 방식", "근거"],
        ["리스크 조항 탐지",       "AI  (Risk Agent — check_risk)",        "법적 맥락 이해, 비정형 판단"],
        ["재무·손익 리스크 분석",  "AI  (Risk Agent — analyze_financials)", "비정형 금융 조건 해석"],
        ["Diff 리스크 영향 요약",  "AI  (Risk Agent — diff_with_prev 후단)", "변경 의미의 법적 해석"],
        ["계약 히스토리 검색",     "AI  (Search Agent — RAG)",              "의미 기반 유사 검색"],
        ["DOCX 텍스트 추출",       "코드  (python-docx)",                   "확정적 구조 파싱"],
        ["버전 간 Diff 비교",      "코드  (deepdiff)",                      "JSON 구조 비교, 재현 가능"],
        ["검토자 라우팅 결정",     "코드  (Rule Engine — if/else)",         "리스크×금액 매트릭스 일관성"],
    ]
    role_tbl = Table(role_data, colWidths=[48*mm, 68*mm, 54*mm])
    rts = tbl(CP, CBL)
    for r in range(1, 5): rts.add("BACKGROUND", (1,r),(1,r), CBP)
    for r in range(5, 8): rts.add("BACKGROUND", (1,r),(1,r), colors.HexColor("#F0FDF4"))
    role_tbl.setStyle(rts)
    story.append(role_tbl)

    # ══ PAGE 3 ══════════════════════════════════════════════
    story.append(PageBreak())
    h1("3. 데이터 흐름 및 계약 상태 전이")
    sp(4)

    flow_row = Table([[DataFlowDiagram(), StatusDiagram()]],
                     colWidths=[118*mm, 56*mm])
    flow_row.setStyle(TableStyle([
        ("VALIGN", (0,0),(-1,-1), "TOP"),
        ("LEFTPADDING",(0,0),(-1,-1), 0),
        ("RIGHTPADDING",(0,0),(-1,-1), 0),
    ]))
    story.append(flow_row)

    captions = Table([[
        Paragraph("그림 3. 계약 분석 데이터 흐름 (스윔레인)", ST["cap"]),
        Paragraph("그림 4. 계약 상태 전이도", ST["cap"]),
    ]], colWidths=[118*mm, 56*mm])
    story.append(captions)

    sp(8); hr()
    h2("리스크 탐지 유형 (9가지)")
    risk_data = [
        ["리스크 유형",         "MZC 허용 기준",                  "등급"],
        ["무제한 배상책임",     "계약금액 100% 이하 한도",        "HIGH"],
        ["IP 완전이전",         "공동소유 또는 기존 IP 제외 조건","HIGH"],
        ["일방적 해지권",       "양 당사자 30일 서면 통지",       "HIGH"],
        ["CR 절차 미정의",      "서면 합의 + 비용 정산 기준 명시","HIGH"],
        ["과도한 지체상금",     "0.05%/일 이하",                  "MED"],
        ["자동갱신 조건",       "갱신 거절 기한 명시",            "MED"],
        ["분쟁 관할 불리",      "서울중앙지방법원 지정",          "MED"],
        ["하자보수 기간 미달",  "1년 이상 (SI 계약)",             "MED"],
        ["비밀유지 기간 미정",  "계약 종료 후 3년 이상",          "LOW"],
    ]
    rtbl = Table(risk_data, colWidths=[52*mm, 90*mm, 28*mm])
    riskts = tbl(CAI, CBP)
    for r in range(1, 5):
        for col, bg in [(2, CHR)]:
            riskts.add("BACKGROUND", (col,r),(col,r), bg)
            riskts.add("TEXTCOLOR",  (col,r),(col,r), colors.white)
            riskts.add("FONTNAME",   (col,r),(col,r), BASE_FONT_BOLD)
            riskts.add("ALIGN",      (col,r),(col,r), "CENTER")
    for r in range(5, 9):
        riskts.add("BACKGROUND", (2,r),(2,r), CMR)
        riskts.add("TEXTCOLOR",  (2,r),(2,r), colors.white)
        riskts.add("FONTNAME",   (2,r),(2,r), BASE_FONT_BOLD)
        riskts.add("ALIGN",      (2,r),(2,r), "CENTER")
    riskts.add("BACKGROUND", (2,9),(2,9), CLR)
    riskts.add("TEXTCOLOR",  (2,9),(2,9), colors.white)
    riskts.add("FONTNAME",   (2,9),(2,9), BASE_FONT_BOLD)
    riskts.add("ALIGN",      (2,9),(2,9), "CENTER")
    rtbl.setStyle(riskts)
    story.append(rtbl)

    doc.build(story,
              onFirstPage=lambda cv, d: header_footer(cv, d),
              onLaterPages=lambda cv, d: header_footer(cv, d))
    print(f"생성 완료: {out_path}")


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "CAS_Architecture.pdf")
    build(out)

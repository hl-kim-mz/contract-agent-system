RISK_PATTERNS = [
    {
        "type": "무제한_배상책임",
        "category": "배상",
        "description": "배상한도 미설정 또는 계약금액 초과",
        "threshold": "계약금액 100%",
        "default_level": "HIGH",
        "keywords": ["배상", "손해배상", "배상한도", "무제한"],
    },
    {
        "type": "IP_완전이전",
        "category": "지재권",
        "description": "개발 산출물 지재권 전부 이전",
        "threshold": "공동소유 또는 기존 IP 제외",
        "default_level": "HIGH",
        "keywords": ["지식재산", "저작권", "특허", "IP", "지재권", "완전이전"],
    },
    {
        "type": "일방적_해지권",
        "category": "해지",
        "description": "갑 단독 해지 + 위약금 없음",
        "threshold": "양 당사자 서면 통지 30일 전",
        "default_level": "HIGH",
        "keywords": ["해지", "해제", "일방", "즉시해지", "통보"],
    },
    {
        "type": "과도한_지체상금",
        "category": "지체상금",
        "description": "지체상금율 0.1%/일 초과",
        "threshold": "0.05%/일",
        "default_level": "MEDIUM",
        "keywords": ["지체상금", "지연", "페널티", "%/일"],
    },
    {
        "type": "자동갱신_조건",
        "category": "갱신",
        "description": "갱신 거절 기한 미명시",
        "threshold": "갱신 거절 기한 명시",
        "default_level": "MEDIUM",
        "keywords": ["자동갱신", "갱신", "연장", "자동연장"],
    },
    {
        "type": "분쟁_관할_불리",
        "category": "분쟁관할",
        "description": "상대방 소재지 법원 지정",
        "threshold": "서울중앙지방법원",
        "default_level": "MEDIUM",
        "keywords": ["관할", "법원", "중재", "분쟁"],
    },
    {
        "type": "비밀유지_기간_미정",
        "category": "비밀유지",
        "description": "계약 종료 후 비밀유지 기간 미명시",
        "threshold": "계약 종료 후 3년",
        "default_level": "LOW",
        "keywords": ["비밀유지", "기밀", "NDA", "confidential"],
    },
    {
        "type": "하자보수_기간_미달",
        "category": "하자보수",
        "description": "하자보수 기간 1년 미만 (SI 계약)",
        "threshold": "1년 이상",
        "default_level": "MEDIUM",
        "keywords": ["하자", "보수", "유지보수", "하자보수"],
    },
    {
        "type": "CR_절차_미정의",
        "category": "CR절차",
        "description": "변경요청 처리 기준 미명시 (SI 계약)",
        "threshold": "서면 합의 + 비용 정산",
        "default_level": "HIGH",
        "keywords": ["변경요청", "CR", "change request", "범위변경"],
    },
]

RISK_PATTERN_MAP = {p["type"]: p for p in RISK_PATTERNS}

RISK_LEVEL_PRIORITY = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}


def get_overall_risk(clause_risks: list) -> str:
    """조항별 리스크 목록에서 전체 리스크 레벨 결정"""
    if not clause_risks:
        return "LOW"
    max_level = max(
        RISK_LEVEL_PRIORITY.get(r.get("risk_level", "LOW"), 1)
        for r in clause_risks
    )
    return {3: "HIGH", 2: "MEDIUM", 1: "LOW"}[max_level]

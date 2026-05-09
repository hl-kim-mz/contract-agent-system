import re

# 조항 제목 패턴: 제1조 (목적) 또는 제1조（목적）
_CLAUSE_TITLE = re.compile(r'(제\s*\d+\s*조\s*[（(（][^）)）]{1,30}[）)）])')

_CORP_SUFFIX = r'(?:주식회사|유한회사|㈜|합자회사|합명회사)'

# 엔티티 패턴 (두 가지 형식 지원)
# 형식 1: 갑) 메가존디지털 주식회사  or  갑: 메가존디지털 주식회사
# 형식 2: 메가존디지털 주식회사(이하 '갑')  or  메가존디지털 주식회사(이하 "갑")
_PARTY_PATTERNS = {
    "갑": [
        re.compile(r'갑[）)）]\s*[:：]?\s*([^（(）)\n]{2,40}?' + _CORP_SUFFIX + r')'),
        re.compile(r'([^（(）)\n]{2,40}?' + _CORP_SUFFIX + r')\s*[\(（]\s*이하\s*[\'"]?갑[\'"]?\s*[\)）]'),
    ],
    "을": [
        re.compile(r'을[）)）]\s*[:：]?\s*([^（(）)\n]{2,40}?' + _CORP_SUFFIX + r')'),
        re.compile(r'([^（(）)\n]{2,40}?' + _CORP_SUFFIX + r')\s*[\(（]\s*이하\s*[\'"]?을[\'"]?\s*[\)）]'),
    ],
}
_DATE = re.compile(r'\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일')
# 숫자: 500,000,000원 / 한글: 오억 원정 / 혼합: 5억 원
_AMOUNT = re.compile(
    r'(?:금\s*)?(?:'
    r'[\d,]+\s*(?:억|만|천)?\s*원(?:정)?'
    r'|(?<![가-힣])(?:금\s+)?[일이삼사오육칠팔구십백천만억]{2,}\s*(?:억|만)?\s*원(?:정)?'
    r'|₩\s*[\d,]+'
    r')'
)
# 지연 0.5%/일 또는 0.5% (일당) 패턴
_PENALTY = re.compile(r'(\d+\.?\d*\s*%\s*(?:/?\s*(?:일|월)|를?\s*위약금))')


def extract_clauses(text: str) -> list:
    """제N조 헤딩 기준으로 조항을 분리한다."""
    parts = _CLAUSE_TITLE.split(text)
    clauses = []
    idx = 1

    # split 결과: [pre, title1, body1, title2, body2, ...]
    i = 1
    while i < len(parts):
        title = parts[i].strip()
        body = parts[i + 1].strip() if i + 1 < len(parts) else ""
        clauses.append({
            "index": idx,
            "title": title,
            "body": (title + "\n" + body).strip(),
        })
        idx += 1
        i += 2

    return clauses


_LEADING_CONJ = re.compile(r'^(?:와|과|및|또는|,|，)\s*')


def _clean_name(name: str) -> str:
    return _LEADING_CONJ.sub("", name).strip()


def extract_entities(text: str) -> dict:
    parties = []
    for role, patterns in _PARTY_PATTERNS.items():
        found = None
        for pattern in patterns:
            m = pattern.search(text)
            if m:
                found = _clean_name(m.group(1))
                break
        if found and not any(p["role"] == role for p in parties):
            parties.append({"role": role, "name": found})

    dates = list(dict.fromkeys(_DATE.findall(text)))
    amounts = list(dict.fromkeys(_AMOUNT.findall(text)))
    penalty_rates = list(dict.fromkeys(_PENALTY.findall(text)))

    return {
        "parties": parties,
        "dates": dates,
        "amounts": amounts,
        "penalty_rates": penalty_rates,
    }

"""
DOCX 파싱 데모 스크립트
samples/ 하위 모든 DOCX를 파싱해 samples/parsed/ 에 JSON으로 저장한다.
"""
import difflib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
SAMPLES = ROOT / "samples"
PARSED = SAMPLES / "parsed"

sys.path.insert(0, str(ROOT))

from tools.clause_extractor import extract_clauses, extract_entities
from tools.document_loader import load_docx


def _flatten_tables(tables: list) -> str:
    lines = []
    for table in tables:
        for row in table:
            lines.append(" ".join(cell for cell in row if cell))
    return "\n".join(lines)


def parse_file(docx_path: Path, out_path: Path) -> dict:
    data = load_docx(str(docx_path))
    clauses = extract_clauses(data["text"])
    combined_text = data["text"] + "\n" + _flatten_tables(data["tables"])
    entities = extract_entities(combined_text)

    data["clauses"] = clauses
    data["clause_count"] = len(clauses)
    data["entities"] = entities

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  OK  {docx_path.relative_to(SAMPLES)} → {out_path.relative_to(PARSED)}")
    return data


def make_diff(v1: dict, v2: dict, out_path: Path) -> None:
    from datetime import datetime, timezone

    def clause_map(d):
        return {c["title"]: c["body"] for c in d.get("clauses", [])}

    m1, m2 = clause_map(v1), clause_map(v2)
    all_titles = list(dict.fromkeys(list(m1) + list(m2)))

    changed, added, removed = [], [], []
    diffs = []

    for title in all_titles:
        t1, t2 = m1.get(title), m2.get(title)
        if t1 is None:
            added.append(title)
            status = "ADDED"
        elif t2 is None:
            removed.append(title)
            status = "REMOVED"
        elif t1 != t2:
            changed.append(title)
            status = "CHANGED"
        else:
            continue

        udiff = "".join(
            difflib.unified_diff(
                (t1 or "").splitlines(keepends=True),
                (t2 or "").splitlines(keepends=True),
                fromfile=f"v1/{title}",
                tofile=f"v2/{title}",
            )
        )
        diffs.append({
            "clause_title": title,
            "status": status,
            "v1_text": t1,
            "v2_text": t2,
            "unified_diff": udiff,
        })

    full_diff = "".join(
        difflib.unified_diff(
            v1["text"].splitlines(keepends=True),
            v2["text"].splitlines(keepends=True),
            fromfile=v1["source_file"],
            tofile=v2["source_file"],
        )
    )

    def ent(d, key):
        return d.get("entities", {}).get(key, [])

    result = {
        "source_v1": v1["source_file"],
        "source_v2": v2["source_file"],
        "diffed_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "v1_clauses": v1["clause_count"],
            "v2_clauses": v2["clause_count"],
            "changed_clauses": changed,
            "added_clauses": added,
            "removed_clauses": removed,
        },
        "clause_diffs": diffs,
        "entity_changes": {
            "dates": {"v1": ent(v1, "dates"), "v2": ent(v2, "dates")},
            "parties": {"v1": ent(v1, "parties"), "v2": ent(v2, "parties")},
            "amounts": {"v1": ent(v1, "amounts"), "v2": ent(v2, "amounts")},
            "penalties": {"v1": ent(v1, "penalty_rates"), "v2": ent(v2, "penalty_rates")},
        },
        "full_unified_diff": full_diff,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  DIFF {out_path.relative_to(PARSED)}")


def main():
    TARGETS = [
        # (docx 경로, parsed 출력 경로)
        (SAMPLES / "contracts" / "NDA_에이원테크놀로지_v1.docx",
         PARSED / "contracts" / "NDA_에이원테크놀로지_v1.json"),
        (SAMPLES / "contracts" / "NDA_에이원테크놀로지_v2.docx",
         PARSED / "contracts" / "NDA_에이원테크놀로지_v2.json"),
        (SAMPLES / "contracts" / "SI_비즈솔루션코리아_v1.docx",
         PARSED / "contracts" / "SI_비즈솔루션코리아_v1.json"),
        (SAMPLES / "계약대금_지급각서.docx",
         PARSED / "계약대금_지급각서.json"),
        (SAMPLES / "전자문서_이용동의_위임장.docx",
         PARSED / "전자문서_이용동의_위임장.json"),
    ]

    # RAG 문서 자동 수집
    for sub in ("legal_basis", "risk_basis"):
        for docx_path in sorted((SAMPLES / "rag" / sub).glob("*.docx")):
            out = PARSED / "rag" / sub / (docx_path.stem + ".json")
            TARGETS.append((docx_path, out))

    results = {}
    print("\n[1/2] DOCX 파싱")
    for docx_path, out_path in TARGETS:
        if not docx_path.exists():
            print(f"  SKIP {docx_path} (not found)")
            continue
        data = parse_file(docx_path, out_path)
        results[docx_path.stem] = data

    print("\n[2/2] Diff 생성")
    v1_key = "NDA_에이원테크놀로지_v1"
    v2_key = "NDA_에이원테크놀로지_v2"
    if v1_key in results and v2_key in results:
        make_diff(
            results[v1_key],
            results[v2_key],
            PARSED / "contracts" / "NDA_에이원테크놀로지_diff_v1_v2.json",
        )

    print("\n완료")


if __name__ == "__main__":
    main()

"""통합 테스트: DOCX 파싱 → 리스크 분석 → 리포트 확인"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from tools.clause_extractor import extract_clauses, extract_entities
from tools.document_loader import load_docx

SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "..", "samples")
SAMPLE_DOCX = os.path.join(SAMPLE_DIR, "계약대금_지급각서.docx")


def test_parsing_pipeline():
    """파싱 파이프라인 단독 테스트 (AWS 불필요)"""
    assert os.path.exists(SAMPLE_DOCX), f"샘플 파일 없음: {SAMPLE_DOCX}"

    doc = load_docx(SAMPLE_DOCX)
    assert doc["text"], "텍스트 추출 실패"

    clauses = extract_clauses(doc["text"])
    entities = extract_entities(doc["text"])

    print(f"[OK] 파싱: {doc['paragraph_count']}단락, {len(clauses)}조항")
    print(f"[OK] 엔티티: {json.dumps(entities, ensure_ascii=False)}")
    return {"doc": doc, "clauses": clauses, "entities": entities}


def test_full_pipeline():
    """전체 파이프라인 테스트 (AWS + MCP 필요)"""
    from agents.orchestrator import analyze_contract

    result = analyze_contract(SAMPLE_DOCX)
    print("[OK] 분석 완료")
    print(result["analysis"])
    return result


if __name__ == "__main__":
    print("=== Step 1. 파싱 테스트 ===")
    test_parsing_pipeline()

    print("\n=== Step 2. 전체 파이프라인 테스트 ===")
    if os.getenv("MODEL_PROVIDER") == "bedrock":
        test_full_pipeline()
    else:
        print("[SKIP] MODEL_PROVIDER != bedrock — AWS 환경에서 실행하세요")

    print("\n[DONE] 통합 테스트 완료")

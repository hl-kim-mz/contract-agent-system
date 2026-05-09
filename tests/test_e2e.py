"""E2E 통합 테스트: DOD-006
TC-001: DOCX 업로드 → 리스크 리포트 조회
TC-002: 업로드 → 워크플로우 → 승인
TC-003: 검색 엔드포인트
"""
import json
import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def _upload_contract(client, sample_docx_bytes):
    """Helper: upload a DOCX and return contract_id."""
    resp = client.post(
        "/contracts/analyze",
        files={"file": ("test_contract.docx", sample_docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"customer_name": "테스트사", "contract_type": "SI", "uploaded_by": "test_user"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    return data["data"]["contract_id"]


class TestTC001UploadToReport:
    """TC-001: DOCX 업로드 → 리스크 리포트 조회"""

    def test_upload_returns_contract_id(self, client, sample_docx_bytes, mock_agents):
        contract_id = _upload_contract(client, sample_docx_bytes)
        assert contract_id is not None
        assert len(contract_id) == 36  # UUID format

    def test_upload_creates_risk_report(self, client, sample_docx_bytes, mock_agents):
        contract_id = _upload_contract(client, sample_docx_bytes)

        resp = client.get(f"/contracts/{contract_id}/report")
        assert resp.status_code == 200
        report = resp.json()["data"]
        assert report["overall_risk"] in ("HIGH", "MEDIUM", "LOW")
        assert "clause_risks" in report
        assert isinstance(report["clause_risks"], list)

    def test_upload_calls_all_agents(self, client, sample_docx_bytes, mock_agents):
        _upload_contract(client, sample_docx_bytes)
        mock_agents["parsing"].assert_called_once()
        mock_agents["risk"].assert_called_once()
        mock_agents["legal"].assert_called_once()

    def test_contract_status_is_risk_reviewed(self, client, sample_docx_bytes, mock_agents):
        contract_id = _upload_contract(client, sample_docx_bytes)

        resp = client.get(f"/contracts/{contract_id}")
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "RISK_REVIEWED"


class TestTC002WorkflowApproval:
    """TC-002: 업로드 → 워크플로우 → 승인"""

    def test_upload_creates_workflow_steps(self, client, sample_docx_bytes, mock_agents):
        contract_id = _upload_contract(client, sample_docx_bytes)

        resp = client.get(f"/contracts/{contract_id}/workflow")
        assert resp.status_code == 200
        steps = resp.json()["data"]
        assert len(steps) > 0
        for step in steps:
            assert "department" in step
            assert "status" in step

    def test_approve_step(self, client, sample_docx_bytes, mock_agents):
        contract_id = _upload_contract(client, sample_docx_bytes)

        wf_resp = client.get(f"/contracts/{contract_id}/workflow")
        steps = wf_resp.json()["data"]
        step_id = steps[0]["id"]

        approve_resp = client.post(
            f"/workflow/{step_id}/approve",
            json={"status": "APPROVED", "comment": "테스트 승인"},
        )
        assert approve_resp.status_code == 200
        approved = approve_resp.json()["data"]
        assert approved["status"] == "APPROVED"
        assert approved["signed_at"] is not None


class TestTC003Search:
    """TC-003: 검색 엔드포인트"""

    def test_search_returns_answer(self, client):
        mock_search = MagicMock(return_value=MagicMock(
            __str__=lambda self: json.dumps({
                "answer": "배상한도 관련 조항이 3건 발견되었습니다.",
                "sources": [{"contract_id": "test-id", "customer_name": "A사", "clause_content": "배상한도..."}],
            }, ensure_ascii=False)
        ))

        with patch("agents.search_agent.search_agent", mock_search):
            resp = client.get("/search", params={"query": "배상한도"})

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "answer" in data
        assert data["answer"] != ""

    def test_search_with_customer_filter(self, client):
        mock_search = MagicMock(return_value=MagicMock(
            __str__=lambda self: json.dumps({"answer": "결과", "sources": []}, ensure_ascii=False)
        ))

        with patch("agents.search_agent.search_agent", mock_search):
            resp = client.get("/search", params={"query": "계약", "customer": "A사"})

        assert resp.status_code == 200
        mock_search.assert_called_once()
        call_arg = mock_search.call_args[0][0]
        assert "A사" in call_arg

    def test_search_graceful_on_agent_failure(self, client):
        with patch("agents.search_agent.search_agent", side_effect=Exception("Agent down")):
            resp = client.get("/search", params={"query": "테스트"})

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "오류" in data["answer"] or "error" in data["answer"].lower()


class TestMissingEndpoints:
    """DOD-004: text, progress 엔드포인트 검증"""

    def test_text_endpoint(self, client, sample_docx_bytes, mock_agents):
        contract_id = _upload_contract(client, sample_docx_bytes)

        resp = client.get(f"/contracts/{contract_id}/text")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["contract_id"] == contract_id
        assert "clauses" in data
        assert "entities" in data
        assert "raw_text_preview" in data

    def test_progress_endpoint(self, client, sample_docx_bytes, mock_agents):
        contract_id = _upload_contract(client, sample_docx_bytes)

        resp = client.get(f"/contracts/{contract_id}/progress")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["contract_id"] == contract_id
        assert data["overall_status"] == "RISK_REVIEWED"
        assert data["progress_percent"] == 80
        assert len(data["steps"]) == 5

    def test_progress_step_labels(self, client, sample_docx_bytes, mock_agents):
        contract_id = _upload_contract(client, sample_docx_bytes)

        resp = client.get(f"/contracts/{contract_id}/progress")
        step_ids = [s["id"] for s in resp.json()["data"]["steps"]]
        assert step_ids == ["upload", "parse", "risk", "legal", "workflow"]
